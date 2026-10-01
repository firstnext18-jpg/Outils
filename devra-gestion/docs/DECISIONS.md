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
- **Recherche globale** (Ctrl+K) : les clients, puis les devis (phase 4) ; les factures s'y
  ajouteront en phase 5.
- **Données de démonstration** (`npm run db:seed:demo`) : 15 clients fictifs, avec des adresses
  email en `.example` (domaine réservé, aucun email ne peut partir vers une vraie personne).

## Catalogue (phase 3)

- **Prix hors TVA, en centimes.** La TVA (désactivée pour l'instant) s'appliquera au niveau du
  document (phase 4), selon les paramètres.
- **Saisie des montants tolérante** : « 1'490.00 », « 1 490,50 », « CHF 90 », « 1.250,5 » sont
  compris ; plus de deux décimales, lettres ou montant négatif sont refusés. En quittant le champ,
  le montant est remis en forme (« 1'490.00 »).
- **Unités choisies dans une liste fixe** (forfait, heure, pièce, page, jour, mois, trimestre,
  année) plutôt qu'en texte libre : chacune a son libellé français et allemand, au singulier et au
  pluriel, pour que les documents allemands soient entièrement traduits. L'unité dépend du type :
  une prestation à l'heure se compte en heures, un abonnement dans sa période.
- **Nom et description en allemand facultatifs** : une prestation ajoutée à un devis en allemand
  reprend ces textes s'ils existent, sinon le texte français.
- **Les documents copient les lignes** : modifier ou supprimer une prestation ne change aucun devis
  ni aucune facture existants. La suppression reste donc possible ; la désactivation retire
  simplement la prestation des choix proposés.
- **Données par défaut créées par une migration SQL** (exemples du catalogue, types de sites) :
  une migration ne s'exécute qu'une fois par base, alors que le seed tourne à chaque déploiement.
  Ainsi, un élément supprimé dans l'interface ne réapparaît pas au déploiement suivant. Les types
  de sites, créés par le seed en phase 2, sont passés dans cette migration (sans effet si la liste
  existe déjà).
- **Formulaires** : le composant `FormField` de shadcn/ui transmet désormais le type des valeurs
  transformées par le schéma Zod (ex. prix saisi en texte, converti en centimes). Les listes
  déroulantes ignorent la valeur vide que Radix peut envoyer quand leurs options changent.

## Devis (phase 4)

- **Montants en centimes entiers, quantités en millièmes, pourcentages en points de base**
  (8.1 % = 810). Les multiplications passent par `BigInt` et l'arrondi est « au plus proche,
  moitié vers le haut ». Tout le calcul est dans `src/domain/totals.ts`, partagé par l'éditeur
  (affichage en direct) et le serveur (qui recalcule tout et ignore les montants envoyés).
- **Ordre des calculs** : quantité × prix (arrondi au centime) → remise de ligne → sous-total →
  remise globale → TVA par taux → total arrondi aux 5 centimes (l'écart apparaît sur une ligne
  « Arrondi ») → acompte, lui aussi arrondi aux 5 centimes. Une remise ne dépasse jamais le
  montant auquel elle s'applique.
- **Remise globale et acompte : sur le montant unique seulement** (décision validée). Les
  abonnements sont totalisés à part, par périodicité, et seront facturés par les abonnements
  (phases 5 et 7).
- **TVA avec remise globale** : la remise est répartie entre les taux au prorata des montants
  (méthode du plus fort reste, sans perte d'un centime), puis la TVA est calculée par taux. Le
  choix « TVA activée » est enregistré sur chaque devis : activer la TVA plus tard ne change pas
  les devis déjà enregistrés (un brouillon la prend en compte lorsqu'il est enregistré à nouveau).
- **Numéro attribué à la création**, par une seule requête SQL (`INSERT … ON CONFLICT DO UPDATE
… RETURNING`) dans la transaction qui crée le devis : deux créations simultanées ne peuvent pas
  obtenir le même numéro, et un échec n'en consomme aucun. Le compteur repart à 1 chaque année
  (celle de la date du document), c'est pourquoi le format doit contenir l'année. Un numéro de
  devis supprimé n'est pas réattribué. Le « prochain numéro » réglable dans les paramètres ne peut
  qu'avancer.
- **Statuts** : brouillon → envoyé → accepté / refusé ; un devis envoyé dont la validité est
  dépassée devient « expiré » (vérifié à l'affichage des devis et chaque matin par les tâches
  quotidiennes). Acceptation et refus peuvent être annulés (retour à « envoyé »), un devis expiré
  peut encore être accepté. **Seul un brouillon se modifie ou se supprime** : pour corriger un
  devis envoyé, on le repasse en brouillon (c'est tracé dans l'historique).
- **« Marquer comme envoyé » en attendant les emails** (phase 6) : le devis est alors considéré
  comme transmis au client. À ce moment, les coordonnées du client et de l'entreprise sont
  **figées** sur le devis : le PDF reste identique même si une fiche change ensuite.
- **PDF généré avec PDFKit**, polices standard (Helvetica, aucune police à embarquer), format A4 :
  adresse du destinataire à la position de la fenêtre des enveloppes C5 suisses (à droite), en-tête
  de tableau répété sur chaque page, pied de page avec numéros de page, filigrane « Brouillon » /
  « Entwurf » tant que le devis n'est pas envoyé. Les fichiers de métriques de PDFKit sont inclus
  explicitement dans le build `standalone`.
- **Textes des documents en JSON** (`src/i18n/documents/fr.json`, `de.json`) ; un test vérifie que
  les deux fichiers ont les mêmes clés. Les textes par défaut (introduction, conditions) sont des
  valeurs par défaut du schéma, modifiables dans les paramètres puis sur chaque devis.
- **Espace insécable avant « % »** (« 30 % ») pour éviter une coupure de ligne entre le nombre et
  le signe, à l'écran comme sur le PDF.
- **Nom de l'entreprise sur les documents** : celui saisi dans les paramètres, jamais un nom
  générique ; s'il manque, l'en-tête et le nom du fichier PDF s'en passent.
- **Plafond de 20 millions de francs par devis** : les montants sont stockés en entiers 32 bits
  (en centimes), largement suffisant ; au-delà, un message clair est affiché.
- **Données de démonstration** : `npm run db:seed:demo` ajoute 6 devis fictifs, un par statut,
  si la base n'en contient aucun.

## Factures et paiements (phase 5)

- **Numéro attribué à l'émission, pas à la création** : un brouillon de facture n'a pas de
  numéro et peut être supprimé sans laisser de trou. L'émission attribue le numéro (même
  requête SQL que pour les devis, dans la transaction), la référence de paiement et fige les
  coordonnées. Les numéros suivent l'année de la date de la facture.
- **Une facture émise ne se modifie plus** : elle s'annule avec un motif (elle garde son numéro et
  reste dans l'historique, avec la mention « annulée » sur le PDF), puis on la duplique pour la
  corriger. La copie d'une facture annulée reprend son type et son devis (ex. facture d'acompte
  corrigée) ; sinon, une copie est une facture simple. Une facture qui a des paiements ne
  s'annule pas : on supprime d'abord les paiements (saisie erronée). La note de crédit est
  reportée après la V1 (décision validée).
- **Statuts** : brouillon → envoyée → partiellement payée → payée, ou annulée. Le statut d'une
  facture émise découle des paiements, mis à jour dans la même transaction qu'un paiement
  enregistré ou supprimé (avec un verrou sur la facture : deux paiements simultanés ne peuvent pas
  dépasser le solde). **« En retard » n'est pas enregistré** : il se calcule à l'affichage
  (échéance dépassée, solde restant), il reste donc juste même si la tâche planifiée n'a pas
  tourné.
- **« Émettre » en attendant les emails** (phase 6) : l'émission vaut envoi (statut « envoyée »).
  Elle demande une confirmation, comme l'annulation et les suppressions.
- **Conversion d'un devis accepté** : facture simple si le devis n'a pas d'acompte ; sinon
  facture d'acompte, puis facture finale une fois l'acompte émis. Une seule facture active de
  chaque sorte par devis (verrou sur le devis contre les doubles clics). Un devis facturé ne
  change plus de statut tant que ses factures ne sont pas annulées. Les lignes d'abonnement ne
  sont pas reprises (décision validée) : elles relèveront du module Abonnements (phase 7).
- **Facture d'acompte** : son montant est celui prévu au devis (TVA comprise). Si la TVA est
  activée, il est réparti entre les taux au prorata et chaque part est convertie en montant hors
  TVA, pour afficher la TVA de chaque taux ; un test vérifie que la facture retombe exactement sur
  l'acompte du devis.
- **Facture finale** : elle reprend toutes les prestations uniques du devis (TVA sur le montant
  total), puis déduit les factures d'acompte émises, TVA comprise : « Total − acompte facturé =
  montant à payer » (pratique courante en Suisse). Les acomptes sont relus à l'émission (l'un
  d'eux a pu être annulé). Si un acompte déduit n'est pas encore payé, un avertissement
  s'affiche : il reste dû sur sa propre facture.
- **QR-facture** (librairie `swissqrbill`, conforme aux règles SIX) :
  - compte : le QR-IBAN s'il est renseigné (référence **QRR** de 27 chiffres : préfixe éventuel de
    la banque, année et numéro de la facture, clé modulo 10 récursif), sinon l'IBAN classique
    (référence **SCOR** ISO 11649 construite sur le numéro, clé modulo 97). Les deux références
    sont donc uniques et permettent de rapprocher un paiement de sa facture ; la variante
    « sans référence » n'est pas proposée ;
  - le numéro de facture figure dans les informations supplémentaires (« Facture F-2026-001 ») ;
  - adresses structurées ; le client n'apparaît comme débiteur que si son adresse est complète
    (sinon la case reste à remplir à la main, ce que la norme permet) ;
  - montant = montant à payer ; pas de QR-facture sur un brouillon (ni numéro ni référence), ni
    sur une facture annulée ou sans montant à payer ;
  - l'émission est refusée tant que l'IBAN (ou le QR-IBAN) et l'adresse de l'entreprise manquent ;
  - le QR code produit a été décodé et contrôlé (charge utile SPC 0200 complète).
- **Mise en page de la QR-facture** : section paiement de 105 mm en bas de la dernière page, au
  niveau de la perforation ; s'il ne reste pas assez de place, elle passe seule sur une nouvelle
  page **A4** (et non sur le petit format proposé par la librairie, qui s'imprime mal). Sur cette
  page, le pied de page se réduit à une ligne au-dessus de la section paiement. Les espacements
  ont été resserrés pour qu'une facture courante tienne sur une page avec sa QR-facture.
- **PDF archivé à l'émission** dans `DATA_DIR/documents/invoices/` (inclus dans les sauvegardes
  en phase 10) : le PDF servi ensuite est exactement celui de l'émission. S'il manque, il est
  régénéré à partir des données figées et réarchivé.
- **Paiements** : montant entre 0.01 et le solde ; date jusqu'à aujourd'hui. Un paiement se
  supprime (erreur de saisie), il ne se modifie pas.
- **Fiche client** : « total facturé » = somme des montants à payer des factures émises (acompte
  et facture finale ne se recoupent donc pas), « encaissé » = paiements, « impayé » = solde des
  factures ouvertes ; les factures annulées ne comptent pas.
- **Éditeur commun** : les blocs de l'éditeur (client et dates, lignes, textes, remises) sont
  partagés entre devis et factures ; le schéma et les conversions des lignes sont dans
  `src/modules/documents/lines.ts`. Sur une facture, toutes les lignes sont dues (option
  `separateRecurring: false` du moteur de calcul).

## Emails (phase 6)

- **Envoi depuis la fiche du document**, dans une fenêtre qui propose destinataire (email du
  client), objet et message tirés du modèle de la langue du document ; tout reste modifiable
  avant l'envoi. Le texte est envoyé tel quel, avec une version HTML sobre (paragraphes, nom de
  l'entreprise en tête) et le PDF en pièce jointe.
- **Variables** : celles du cahier des charges (`{client}`, `{numero}`, `{montant}`,
  `{echeance}`, `{lien}`), plus **`{entreprise}`** pour signer les messages sans écrire le nom de
  l'entreprise en dur dans les modèles par défaut. `{client}` désigne la personne de contact
  d'une entreprise si elle est renseignée (plus naturel dans une formule de politesse), sinon le
  nom du client. `{lien}` : lien d'acceptation en ligne (phase 9). Les variables sont
  remplacées en deux temps : à l'ouverture de la fenêtre, puis à l'envoi (pour `{numero}` d'une
  facture pas encore émise). Une variable inconnue dans un modèle est refusée à l'enregistrement
  (faute de frappe).
- **Devis en brouillon** : il part comme devis définitif (coordonnées figées, sans filigrane) et
  ne passe en « envoyé » **qu'après un envoi réussi** ; en cas d'échec, il reste un brouillon.
- **Facture en brouillon** (« Émettre et envoyer ») : elle est d'abord émise (numéro, référence,
  PDF archivé), puis envoyée. Si l'envoi échoue, elle reste émise et l'envoi peut être relancé :
  envoyer l'email dans la transaction d'émission aurait risqué un numéro attribué à un email
  parti puis annulé. « Émettre sans envoyer » et « Marquer comme envoyé » restent disponibles
  (envoi postal, remise en main propre).
- **Historique des envois** (table `email_log`) : destinataires, copie, objet, message, pièce
  jointe, auteur, date, et le message d'erreur du serveur SMTP en cas d'échec. Les envois réussis
  apparaissent aussi dans l'historique du document.
- **Copie à l'expéditeur** en copie cachée ; **réponse** (« Reply-To ») vers l'email de
  l'entreprise s'il est renseigné, l'expéditeur restant `SMTP_FROM` (adresse autorisée par le
  serveur SMTP).
- **Destinataires** : 5 au maximum, séparés par des virgules ; adresses contrôlées et
  dédoublonnées.
- **Tests** : les emails reçus sont vérifiés dans Mailpit (objet, texte, pièce jointe, copie,
  Reply-To). Le mode « chaos » de Mailpit (activé dans `compose.dev.yaml`) simule un refus du
  serveur SMTP pour tester le cas d'échec.

## Relances et abonnements (phase 7)

### Relances

- **Trois niveaux** : 1er rappel, 2e rappel, mise en demeure. Délais réglables (par défaut 10 jours
  après l'échéance, puis 15 jours après la relance précédente), frais par niveau (0 par défaut,
  CHF 1'000.00 au plus) et nouveau délai de paiement accordé (10 jours par défaut), dans
  Paramètres → Relances. Chaque niveau n'est enregistré qu'une fois par facture (contrainte
  d'unicité, et niveau revérifié sous verrou de la facture).
- **Mode manuel par défaut** : la page « Relances à envoyer » propose les relances dont le délai
  est atteint ; on les envoie par email ou on les enregistre pour un envoi par courrier (le PDF
  s'ouvre pour être imprimé). **Mode automatique** : les tâches quotidiennes envoient les
  relances dues par email ; les clients sans adresse email restent dans la liste. Depuis la fiche
  d'une facture en retard, la relance suivante peut aussi être envoyée avant son terme.
- **Montant** : solde de la facture (montant dû − paiements + frais déjà facturés) + frais du
  niveau. Les frais sont ajoutés à la facture (`feesCents`) : ils font partie du solde, du montant
  à payer et des totaux du client. La facture garde son échéance initiale (elle reste « en
  retard ») ; le nouveau délai figure sur la relance.
- **Un seul texte** par niveau et par langue : il sert de corps à l'email et de lettre sur le
  PDF. Modifié dans la fenêtre d'envoi, il est enregistré avec la relance (le PDF peut ainsi être
  régénéré à l'identique). Variable ajoutée : `{date}` (date de la facture).
- **PDF de la relance** : lettre, récapitulatif (facture, déjà payé, frais), puis **QR-facture du
  montant à payer avec le compte et la référence de la facture** : le paiement est reconnu comme
  celui de la facture. Archivé dans `DATA_DIR/documents/reminders/`.
- **Une relance par email n'est enregistrée que si l'envoi réussit** : en cas d'échec, l'erreur
  figure dans l'historique des emails et la relance reste à envoyer.

### Abonnements

- **Création** depuis un devis accepté (« Créer l'abonnement », avec une date de début) : **un
  abonnement par périodicité**, car une facture périodique ne peut pas mélanger mois et années.
  Les lignes sont copiées ; devis et abonnement sont liés. Ou saisie directe (Abonnements →
  Nouvel abonnement).
- **Périodes ancrées sur la date de début** : la période n commence à début + n × 1, 3 ou 12 mois.
  Un 31 devient le dernier jour des mois plus courts, sans dérive (31.01 → 28.02 → 31.03). La
  facture est générée **le premier jour de la période** (facturation à l'avance, l'usage pour un
  hébergement).
- **Rattrapage** : les périodes commencées et pas encore facturées (serveur arrêté quelques jours)
  le sont à la prochaine exécution, 12 au plus à la fois. **Jamais deux fois** : contrainte
  d'unicité (abonnement, début de période) sur les factures et compteur de périodes facturées
  avancé sous condition, dans la même transaction que la création de la facture.
- **Pause** : rien n'est facturé pendant la pause ; à la reprise, les périodes commencées pendant
  la pause sont sautées et la facturation reprend avec la première période qui commence ce
  jour-là ou après. **Résiliation** : immédiate et définitive ; les factures déjà générées restent.
  **Suppression** : seulement si l'abonnement n'a jamais été facturé.
- **Modification** : prestations, libellé, langue et notes à tout moment (pour les prochaines
  factures) ; date de début et périodicité verrouillées après la première facture (elles
  définissent les périodes déjà facturées).
- **Factures d'abonnement** : type « Facture d'abonnement », période indiquée sur la fiche et le
  PDF, date du jour de génération, délai de paiement et TVA des paramètres de ce jour-là.
  **En brouillon par défaut**, pour les vérifier avant l'envoi ; avec l'option « Envoyer
  directement les factures d'abonnement » (Paramètres → Relances), elles sont émises puis
  envoyées par email si le client a une adresse (sinon elles restent en brouillon). Elles sont
  numérotées à l'émission, comme toutes les factures (pas de trou).
- **Revenu récurrent** : hors TVA, abonnements actifs uniquement. MRR = mensuels + trimestriels ÷ 3
  \+ annuels ÷ 12 (arrondi au centime) ; revenu annuel = somme exacte des montants annualisés.

### Tâches quotidiennes

- **Une seule fonction** (`runDailyTasks`) enchaîne : devis expirés, factures d'abonnement,
  relances (envoi en mode automatique, comptage en mode manuel). Chaque étape est indépendante :
  l'échec de l'une n'empêche pas les autres. Chaque exécution est enregistrée (table `task_run`)
  et visible dans Paramètres → Tâches, avec un bouton « Lancer maintenant » (admin).
- **Sans risque si elle est relancée** : chaque étape ne fait que ce qui reste à faire (statut des
  devis, unicité des périodes, niveau des relances). Une exécution déjà en cours (depuis moins
  de 30 minutes) refuse d'en démarrer une seconde.
- **Planification : un conteneur `cron`** (même image, petit script Node sans dépendance,
  `docker/cron/scheduler.mjs`) appelle `POST /api/taches/quotidiennes` chaque jour à
  `CRON_TIME` (heure de Zurich, 06:00 par défaut) et à son démarrage (rattrapage si le Raspberry Pi
  était éteint le matin). Si l'application ne répond pas, il réessaie chaque minute (10 fois).
  Plutôt qu'un minuteur dans le serveur Next.js (rien ne garantit qu'il tourne en continu, et il
  tournerait dans chaque instance) ou que la crontab de la machine (hors de Docker, moins visible) :
  la logique reste dans l'application (Prisma, emails, PDF), le conteneur ne fait que la
  déclencher, et ses journaux sont dans `docker compose logs cron`.
- **Route protégée par `CRON_SECRET`** (32 caractères au moins, comparé en temps constant) dans
  l'en-tête `Authorization: Bearer …`. Sans secret configuré, la route est désactivée (503). Elle
  répond 409 si une exécution est en cours, 500 si une tâche a échoué (le conteneur réessaie).

### Base de données

- Nouvelles tables `reminder`, `subscription`, `subscription_item` et `task_run` ; colonnes
  `feesCents`, `subscriptionId`, `periodStart` / `periodEnd` sur les factures.
- `prisma migrate dev` refuse de créer, sans terminal interactif, une migration qui ajoute une
  contrainte d'unicité (avertissement à confirmer). La migration est alors générée avec
  `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, puis
  appliquée avec `prisma migrate deploy`.

## Tableau de bord (phase 8)

- **Périodes** : mois, trimestre ou année **en cours**, du premier jour à aujourd'hui, ou période
  personnalisée (10 ans au plus). La période choisie est dans l'adresse (`/?periode=annee`,
  `/?periode=personnalise&du=…&au=…`) : elle se partage et fonctionne sans JavaScript.
- **Comparaison avec la période précédente, à durée égale** : le 1er–15 octobre se compare au
  1er–15 septembre (et non à tout septembre, ce qui ferait paraître en forte baisse une période à
  peine commencée) ; l'année en cours au même jour de l'année précédente ; une période
  personnalisée à la période de même durée qui la précède. Sans chiffre sur la période
  précédente, aucun pourcentage n'est affiché.
- **Chiffre d'affaires facturé** : montant à payer des factures émises (ni brouillons ni
  annulées), à leur date. Une facture finale ne compte que ce qui reste après l'acompte, déjà
  compté avec la facture d'acompte : rien n'est compté deux fois. **Encaissé** : paiements, à leur
  date. Montants TVA comprise si elle est activée (Devra n'y est pas assujettie) ; les frais de
  relance ne comptent pas dans le facturé.
- **Indicateurs « photo du moment »**, indépendants de la période : factures impayées (dont en
  retard), devis en attente (envoyés, encore valables ; « expire bientôt » = dans les 7 jours),
  revenu récurrent (MRR des abonnements actifs, hors TVA), nombre de clients par zone et types de
  site demandés (fiches clients actuelles, sans les archivés).
- **Indicateurs de la période** : facturé, encaissé, taux de conversion (devis **envoyés pendant la
  période** — date d'envoi, à Zurich — et acceptés depuis, sur le nombre de devis envoyés),
  meilleurs clients (top 5 du facturé), chiffre d'affaires par zone et par type de site vendu.
- **Zones d'action** d'après l'adresse **actuelle** des clients (canton, NPA et localité). La
  carte de la Suisse par canton (« serait un plus » dans le cahier des charges) n'est pas faite :
  elle demanderait d'embarquer les contours des cantons ; à proposer séparément.
- **Graphiques** : Recharts pour l'évolution sur 12 mois (barres facturé / encaissé, avec un
  tableau équivalent pour les lecteurs d'écran) ; les classements (clients, zones, types de site)
  sont des listes avec barres horizontales en HTML, lisibles sur téléphone et accessibles. Deux
  couleurs de graphique (`--chart-1`, `--chart-2`) suivent le thème clair / sombre.
- **Raccourci « Enregistrer un paiement »** : choix parmi les factures ouvertes (recherche par mots
  dans le numéro et le client, sans recherche approximative qui confondrait `F-2020-003` et
  `F-2026-003`), puis le même formulaire que sur la fiche de la facture. Les raccourcis ne sont
  pas affichés en lecture seule.
- **Calculs en base** (agrégats Prisma), regroupés par mois en JavaScript : quelques requêtes
  légères, sans table de statistiques à tenir à jour.

## Acceptation en ligne, export comptable, journal (phase 9)

### Acceptation des devis en ligne

- **Option désactivée par défaut** (Paramètres → Facturation). Désactivée après coup, elle rend
  aussitôt les liens déjà envoyés inutilisables.
- **Lien secret** : jeton aléatoire de 256 bits, dont seule l'empreinte SHA-256 est enregistrée
  (table `quote_link`) : une copie de la base ne permet pas de retrouver les liens. Un lien est
  créé à chaque envoi du devis par email (les précédents restent valables). Il permet
  d'accepter ou de refuser tant que le devis est « envoyé » et que sa date de validité n'est pas
  dépassée, puis reste consultable 30 jours de plus avant d'expirer.
- **Variable `{lien}`** : dans la fenêtre d'envoi, elle reste telle quelle (« sera remplacée à
  l'envoi ») ; le lien n'est créé qu'au moment de l'envoi. **Sans l'option, la ligne qui contient
  `{lien}` est retirée** du message : les modèles par défaut contiennent donc une phrase
  « Vous pouvez le consulter et l'accepter en ligne : {lien} » qui n'apparaît que si l'option
  est activée. Une migration l'ajoute aux modèles jamais modifiés.
- **Page publique** `/devis-en-ligne/<jeton>`, sans compte, dans la langue du devis (français ou
  allemand) : coordonnées figées à l'envoi, lignes, totaux, conditions, PDF. Ni indexée, ni
  transmise en « Referer ». Acceptation : nom et prénom + case « J'ai lu ce devis et j'en accepte
  les conditions » ; refus : nom + commentaire facultatif.
- **Enregistrement** : statut, date, nom saisi et adresse IP (en-tête `AUTH_IP_HEADER` du reverse
  proxy), dans une transaction qui verrouille le devis (deux décisions simultanées ne peuvent pas
  aboutir). Le journal attribue la décision au client (« Jeanne Lumen (client, en ligne) »). Si
  l'équipe annule ensuite la décision dans l'outil, ces informations sont effacées.
- **Notification** : email aux admins et aux membres actifs (nom du client, montant, lien vers
  le devis ; commentaire en cas de refus). Un échec d'envoi n'annule pas la décision.

### Export comptable

- Page **Factures → Export comptable**, accessible à tous les rôles (consultation), avec des
  périodes en un clic (mois et trimestre derniers, année en cours, année dernière) ou des dates
  choisies. Chaque export est inscrit au journal (nLPD).
- **Factures** émises dans la période (selon leur date), **annulées comprises** avec leur statut
  et leur motif : la suite des numéros reste complète. **Paiements** selon leur date de
  réception. **Clients** facturés ou ayant payé pendant la période, avec facturé, encaissé et
  solde ouvert à ce jour.
- **Excel** : un classeur de trois feuilles, montants en nombres (format `#,##0.00`), dates en
  dates. **CSV** (un fichier par jeu de données) : séparateur point-virgule, BOM UTF-8,
  montants `1250.00` sans séparateur de milliers et dates `JJ.MM.AAAA`, reconnus par Excel en
  Suisse ; protection contre l'injection de formules comme pour l'export des clients.
- **ZIP des PDF** : PDF archivés des factures émises (dossier `factures`) et des relances
  (dossier `relances`) de la période, tels qu'envoyés (régénérés s'ils manquent), stockés sans
  recompression (ils sont déjà compressés), avec `fflate` (petite bibliothèque sans
  dépendance). 500 documents au plus par archive, pour la mémoire du Raspberry Pi. Les devis ne
  sont pas inclus (ce ne sont pas des pièces comptables).

### Journal d'activité

- Page **Paramètres → Journal** (admin) : phrases complètes avec l'objet concerné, recherche
  dans le numéro ou le nom, filtres par personne, par type et par période (journées de Zurich),
  50 lignes par page, lien « Ouvrir » vers le document s'il existe encore. Sur chaque document,
  l'historique propre reste visible par tous.

## Production (phase 10)

### Sauvegardes

- **Conteneur dédié** (`backup`), construit sur l'image PostgreSQL 18 : `pg_dump` et `pg_restore`
  ont exactement la version du serveur. Plutôt qu'une crontab sur le Raspberry Pi : tout reste
  dans Docker Compose (installation et mise à jour identiques), et le journal est dans
  `docker compose logs backup`.
- **Sauvegarde logique** (`pg_dump`, format « custom » compressé) plutôt qu'une copie du volume :
  cohérente sans arrêter la base, plus petite, indépendante de l'architecture et restaurable
  dans une version plus récente de PostgreSQL. Chaque fichier est relu (`pg_restore --list`)
  avant d'être gardé. Les fichiers de l'application (logo, PDF archivés) sont sauvegardés à côté
  dans une archive `tar.gz`.
- **Planification** : le script vérifie l'heure chaque minute ; dès que l'heure prévue est
  passée et que la sauvegarde du jour manque, il la fait (rattrapage après une coupure).
  Chaque sauvegarde tourne dans son propre processus, pour que la moindre erreur l'interrompe
  (`set -e`), avec un nouvel essai 30 minutes plus tard. Le service attend la fin des
  migrations : la toute première sauvegarde contient déjà les tables.
- **Rotation** par âge des fichiers (30 jours par défaut), puis **copie hors du Raspberry Pi**
  avec rclone, configuré uniquement par variables d'environnement (`RCLONE_CONFIG_*` dans
  `.env`, pas de fichier de configuration). `rclone copy` puis suppression des copies trop
  anciennes, jamais `rclone sync` : un disque local vidé par erreur n'efface pas les copies
  distantes. Chiffrement côté Raspberry Pi possible et conseillé (stockage `crypt`).
- **Restauration** (`restore`, profil Compose lancé à la main) : liste, vérification dans une base
  temporaire (`--test`, sans toucher à l'application), ou restauration. La sauvegarde est
  d'abord restaurée dans une base à part ; une fois réussie, les noms sont échangés (connexions
  à l'ancienne base bloquées puis coupées) : jamais de base vide ou à moitié restaurée. La base
  et les fichiers précédents sont conservés (`…_avant_restauration`). Confirmation à taper
  (`RESTAURER`), sauf avec `--oui`. Un contrôle « l'application est-elle arrêtée ? » par le
  nombre de connexions a été écarté : l'application ferme ses connexions inactives après
  quelques secondes, il laissait passer une application en marche.
- **Testé de bout en bout** avec Docker Compose : sauvegarde, copie distante (stockage rclone
  local), vérification, restauration après altération des données, restauration après perte
  totale des volumes depuis la copie distante, rotation locale et distante.

### Accès HTTPS

- Deux fichiers Compose d'appoint, activés par `COMPOSE_FILE` dans `.env` (les commandes
  `docker compose …` restent les mêmes) : `compose.cloudflare.yaml` (**recommandé** : aucun
  port ouvert sur la box, adresse IP masquée) et `compose.caddy.yaml` (certificat Let's Encrypt
  automatique, redirection HTTP → HTTPS). `AUTH_IP_HEADER` suit l'option (`cf-connecting-ip` ou
  `x-forwarded-for`, que Caddy réécrit avec la vraie adresse du visiteur).
- Testé avec Caddy en local (certificat interne pour `localhost`) : redirection HTTP → HTTPS,
  cookie de session `__Secure-…` (`Secure`, `HttpOnly`), en-têtes de sécurité, et une fausse
  adresse IP envoyée par le visiteur ignorée.

### En-têtes de sécurité

- **CSP** sur les pages : ressources de l'application uniquement, pas d'intégration dans un
  cadre (`frame-ancestors 'none'`), formulaires vers l'application seulement, pas d'objets.
  Scripts et styles « inline » autorisés : Next.js et le thème clair/sombre en ont besoin ; une
  CSP à « nonces » demanderait un traitement de chaque page par le proxy, à envisager plus tard.
  Pas de CSP sur `/api` : les PDF y sont affichés par le lecteur intégré du navigateur.
- **HSTS** d'un an (sans `includeSubDomains` ni `preload`, pour ne pas engager les autres
  sous-domaines de devra.ch). Ignoré par les navigateurs tant que le site est servi en HTTP.

### Limites connues

- Dans l'environnement de développement utilisé, le dépôt de paquets Alpine est inaccessible :
  l'étape `apk add rclone` de l'image de sauvegarde n'a pas pu y être exécutée. Les scripts ont
  été testés dans une image équivalente contenant le binaire officiel de rclone. La
  construction des images en ARM64 se fait sur le Raspberry Pi lui-même.

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
  binaires précompilés ARM64), exécutée avec l'utilisateur non privilégié `node`. Un service
  `migrate` applique les migrations et le seed, puis s'arrête ; l'application ne démarre qu'après
  son succès.
- **ESLint** : les variables volontairement inutilisées sont préfixées par `_`.
- **`npm audit`** : ExcelJS dépend d'une ancienne version de `uuid` (vulnérabilité « moderate »
  limitée aux fonctions v3/v5/v6 avec un tampon fourni, que nous n'utilisons pas).
- **`npm audit`** signale 4 vulnérabilités « high » dans des dépendances des outils en ligne de
  commande de Prisma (`mysql2`, `deepmerge-ts`). Elles ne sont pas utilisées par l'application en
  fonctionnement (nous n'utilisons pas MySQL) ; à suivre lors des mises à jour de Prisma.
