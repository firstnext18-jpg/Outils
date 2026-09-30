# Décisions techniques

Choix pris en cours de route, avec leur raison. Le plus récent en bas de chaque section.

## Organisation du projet

**Le projet vit dans le sous-dossier `devra-gestion/` du dépôt `Outils`.**
Un dépôt dédié (`devra-gestion`, privé) était prévu, mais GitHub a refusé sa création depuis la
session de développement. Le sous-dossier est autonome : on pourra le déplacer dans son propre
dépôt en gardant l'historique (`git subtree split --prefix=devra-gestion`).

**Git : une PR par phase.** Le développement se fait sur une branche de travail ; chaque phase
terminée fait l'objet d'une pull request, fusionnée après validation.

## Stack

| Choix                                      | Pourquoi                                                                                                                                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Better Auth** (et non Auth.js)           | Auth.js v5 est toujours en bêta et son mode email + mot de passe impose des sessions JWT sans réinitialisation intégrée. Better Auth fournit email + mot de passe, réinitialisation, sessions en base (révocables) et limitation des tentatives. |
| **Prisma 7** (et non 8)                    | Dernière version stable (la 8 est en préversion). Plus de moteur Rust pour les requêtes : rien de natif à compiler pour ARM64.                                                                                                                   |
| **Argon2id** via `@node-rs/argon2`         | Algorithme recommandé par l'OWASP (19 Mio, 2 itérations). Binaires précompilés pour ARM64 et x86-64.                                                                                                                                             |
| **Next.js 16**, Node 24 LTS                | Versions stables actuelles. Sortie `standalone` pour une image Docker légère.                                                                                                                                                                    |
| **shadcn/ui** (base Radix)                 | Composants copiés dans `src/components/ui/`. Le site ui.shadcn.com étant inaccessible depuis l'environnement de développement, les fichiers ont été repris tels quels du dépôt officiel GitHub (même code).                                      |
| **Police Geist** via le paquet npm `geist` | Pas de téléchargement depuis Google Fonts au build : le build fonctionne hors ligne.                                                                                                                                                             |
| **react-hook-form + Zod**                  | Les mêmes schémas Zod valident les formulaires dans le navigateur et les actions côté serveur.                                                                                                                                                   |

## Données

- **Identifiants UUID v7** pour toutes les tables : uniques, non devinables et triables par date de
  création. Better Auth est configuré pour laisser la base les générer.
- **Paramètres en une seule ligne** (table `settings`, id = 1). Les informations de l'entreprise
  (nom, adresse, IBAN, logo…) n'apparaissent jamais dans le code.
- **IBAN et QR-IBAN dans deux champs distincts**, stockés sans espaces. La validation vérifie la clé
  de contrôle, le pays (CH/LI, seuls acceptés par la QR-facture) et le type : un QR-IBAN (IID
  30000–31999) ne peut pas être saisi comme IBAN classique, et inversement.
- **Logo : PNG ou JPEG uniquement, 2 Mo maximum.** Ce sont les formats que PDFKit sait intégrer
  dans les PDF. Le type est vérifié sur les premiers octets du fichier, pas sur son nom. Le fichier
  est enregistré dans `DATA_DIR/uploads` (volume Docker, inclus dans les sauvegardes) et servi par
  `/api/logo`, route publique puisque le logo apparaît sur la page de connexion.

## Utilisateurs et sécurité

- **Pas d'inscription libre** : un admin invite par email. L'invitation est valable 7 jours ; seule
  l'empreinte SHA-256 du jeton est stockée. Réinviter la même adresse annule l'invitation précédente.
- **Mot de passe : 10 caractères minimum.**
- **Limitation des tentatives** (compteurs stockés en base, donc conservés après un redémarrage) :
  - connexion : 5 essais par minute et par adresse IP (les connexions réussies comptent aussi) ;
  - mot de passe oublié : 3 demandes par 5 minutes ;
  - l'adresse IP est lue dans l'en-tête défini par `AUTH_IP_HEADER` : `cf-connecting-ip` derrière
    Cloudflare Tunnel, `x-forwarded-for` derrière Caddy. Une mauvaise valeur permettrait de
    contourner la limitation.
- **Rôles vérifiés côté serveur, partout** :
  - chaque action serveur passe par `authAction()` (`src/server/action.ts`), qui exige le rôle
    minimum en paramètre, puis valide les données avec Zod ;
  - chaque page protégée appelle `requireUser()` ou `requireRole()` (et pas seulement le layout,
    qui n'est pas réexécuté à chaque navigation) ;
  - le fichier `src/proxy.ts` ne fait qu'une redirection de confort vers la page de connexion.
- **Un utilisateur n'est jamais supprimé, il est désactivé** : ses sessions sont fermées
  immédiatement et il ne peut plus se connecter. Son historique reste intact. Un admin ne peut ni se
  désactiver ni changer son propre rôle, et il reste toujours au moins un admin actif.
- **Après une réinitialisation du mot de passe**, toutes les sessions ouvertes sont fermées.
- **Protection CSRF** : Better Auth vérifie l'origine des requêtes ; les actions serveur de Next.js
  comparent l'en-tête `Origin` à l'hôte.

## Clients (phase 2)

- **Colonnes calculées** enregistrées avec chaque client :
  - `displayName` : raison sociale, ou « Prénom Nom » ;
  - `sortName` : nom en minuscules sans accents, pour que « Émile » se range avec les E (le tri de
    PostgreSQL sous Alpine se fait sinon octet par octet) ;
  - `searchText` : nom, contact, email, téléphone, adresse et tags sans accents. La recherche
    découpe la saisie en mots ; chaque mot doit apparaître (« dubois sion »).
- **Verrouillage optimiste** : chaque fiche porte un numéro de version. Une modification n'est
  enregistrée que si la fiche n'a pas changé depuis son ouverture ; sinon l'utilisateur est invité
  à recharger la page.
- **Longueurs maximales alignées sur la QR-facture** (nom et rue 70 caractères, numéro et NPA 16,
  localité 35) pour que chaque client puisse figurer comme débiteur sans retouche. Le NPA d'un
  client suisse doit comporter 4 chiffres ; le canton n'est proposé que pour la Suisse.
- **Archiver plutôt que supprimer** : l'archivage retire le client de la liste en gardant tout son
  historique. La suppression définitive reste possible pour une fiche créée par erreur ; dès les
  phases 4 et 5, la base refusera de supprimer un client lié à des devis ou des factures.
- **Import** :
  - le fichier est lu côté serveur (Papa Parse pour le CSV, ExcelJS pour le .xlsx) : même code
    pour tous, testé ;
  - encodage détecté (UTF-8, sinon Windows-1252 des CSV d'Excel) et séparateur détecté
    (`;`, `,`, tabulation) ;
  - limites : 5 Mo et 5 000 lignes ;
  - une adresse saisie en une seule colonne (« Rue du Lac 12 ») est séparée en rue et numéro ;
  - doublons = même email qu'un client existant ou qu'une ligne précédente du fichier ; par défaut
    ils sont ignorés, l'utilisateur peut choisir de les importer quand même ;
  - l'import se fait en une seule transaction (tout ou rien) et laisse une seule ligne dans le
    journal d'activité (nom du fichier, nombre de clients).
- **Export** : CSV avec point-virgule, BOM UTF-8 et fins de ligne Windows (s'ouvre correctement
  dans Excel en Suisse), ou Excel (.xlsx). Les cellules commençant par `=`, `+`, `-` ou `@` sont
  préfixées d'une apostrophe (protection contre l'injection de formules) ; l'import retire ce
  préfixe. Les intitulés de colonnes sont reconnus par l'import : un export se réimporte tel quel.
- **Export nLPD** d'un client : fichier JSON avec toutes ses données et l'historique de sa fiche,
  réservé aux membres et admins, et inscrit au journal. Les devis et factures s'y ajouteront.
- **Types de sites** : un type utilisé ne peut pas être supprimé, seulement désactivé (il n'est plus
  proposé mais reste affiché sur les fiches existantes). Noms uniques sans tenir compte de la casse.
- **Recherche globale** (Ctrl+K) : les clients pour l'instant ; les numéros de devis et de factures
  s'y ajouteront avec les phases 4 et 5.
- **Données de démonstration** (`npm run db:seed:demo`) : 15 clients fictifs, avec des adresses
  email en `.example` (domaine réservé, aucun email ne peut partir vers une vraie personne).

## Interface

- **Interface en français, sans bibliothèque de traduction.** Les traductions FR/DE ne concernent
  que les documents envoyés aux clients (phase 4), dans des fichiers séparés.
- **Formats suisses** : dates `JJ.MM.AAAA` et montants `CHF 1'250.00`, avec une apostrophe droite
  (et non l'apostrophe typographique que produit `Intl` pour `de-CH`). Fuseau Europe/Zurich partout.
- **Mode clair / sombre** avec `next-themes` : choix mémorisé sur l'appareil (par défaut : celui du
  système).
- **Modules pas encore développés** : visibles dans la navigation, avec une page « Module en
  préparation ».

## Build, tests et déploiement

- **Aucune page n'est pré-générée au build** (`dynamic = "force-dynamic"` sur les layouts) : le build
  n'a besoin ni de la base de données ni des secrets. C'est indispensable pour construire l'image
  Docker.
- **Next.js : `agentRules: false`**, pour que `next dev` ne crée pas de fichiers `AGENTS.md` /
  `CLAUDE.md` dans le projet.
- **Tests de bout en bout sur une base éphémère** : chaque lancement crée une base PostgreSQL au nom
  unique (`devra_gestion_e2e_…`), puis la supprime. Aucune base existante n'est jamais vidée. Les
  emails sont lus dans Mailpit.
- **Docker : image multi-étapes** sur `node:24-bookworm-slim` (Debian, glibc : compatible avec les
  binaires précompilés ARM64). Un service `migrate` applique les migrations et le seed, puis
  s'arrête ; l'application ne démarre qu'après son succès.
- **ESLint** : les variables volontairement inutilisées sont préfixées par `_`.
- **`npm audit`** : ExcelJS dépend d'une ancienne version de `uuid` (vulnérabilité « moderate »
  limitée aux fonctions v3/v5/v6 avec un tampon fourni, que nous n'utilisons pas).
- **`npm audit`** signale 4 vulnérabilités « high » dans des dépendances des outils en ligne de
  commande de Prisma (`mysql2`, `deepmerge-ts`). Elles ne sont pas utilisées par l'application en
  fonctionnement (nous n'utilisons pas MySQL) ; à suivre lors des mises à jour de Prisma.
