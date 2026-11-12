# Devra Gestion

Outil de gestion des **clients, devis et factures** (avec QR-facture suisse) pour une petite
entreprise, auto-hébergé sur un Raspberry Pi.

- Plusieurs utilisateurs avec des rôles : **Admin**, **Membre**, **Lecture seule**
- Montants en CHF, formats suisses (`30.09.2026`, `CHF 1'250.00`)
- Interface en français, mode clair et sombre, utilisable sur téléphone
- Documents en français et en allemand

## Avancement

| Phase                                     | Contenu                                                           | État        |
| ----------------------------------------- | ----------------------------------------------------------------- | ----------- |
| 1. Fondations                             | Connexion, invitations, rôles, paramètres de l'entreprise, Docker | ✅ Terminée |
| 2. Clients                                | Fiches, recherche, import/export CSV-Excel                        | ✅ Terminée |
| 3. Catalogue                              | Prestations réutilisables                                         | ✅ Terminée |
| 4. Devis                                  | Calculs, remises, acompte, PDF FR/DE                              | ✅ Terminée |
| 5. Factures                               | QR-facture, paiements, acomptes                                   | ✅ Terminée |
| 6. Emails                                 | Envoi des devis et factures                                       | ✅ Terminée |
| 7. Relances et abonnements                | Relances, abonnements, tâches quotidiennes                        | ✅ Terminée |
| 8. Tableau de bord                        | Indicateurs, graphiques, zones d'action                           | ✅ Terminée |
| 9. Acceptation en ligne, exports, journal | Devis acceptés en ligne, export comptable, journal d'activité     | ✅ Terminée |
| 10. Production                            | Sauvegardes, HTTPS, sécurité, déploiement Raspberry Pi            | ✅ Terminée |
| 11. Discussions                           | Canal général, discussions par client, notifications              | ✅ Terminée |
| 12. Espace client                         | Devis, factures, abonnements et discussion pour chaque client     | ✅ Terminée |

## Ce qui fonctionne aujourd'hui

- **Connexion** par email et mot de passe, **mot de passe oublié** (lien par email, valable 1 h).
- **Limitation des tentatives** : 5 essais de connexion par minute et par adresse IP.
- **Invitation d'utilisateurs** par un admin (lien valable 7 jours), choix du rôle,
  changement de rôle, désactivation / réactivation d'un compte.
- **Paramètres → Entreprise** : nom, adresse, contact, IBAN et QR-IBAN (vérifiés), préfixe de
  référence QRR si la banque l'impose, logo.
- **Paramètres → Types de sites** : liste modifiable (ajouter, renommer, réordonner, désactiver).
- **Paramètres → Documents** : textes par défaut des devis et des factures (introduction,
  conditions) et pied de page, en français et en allemand.
- **Paramètres → Facturation** : format des numéros (`D-{AAAA}-{NNN}`, `F-{AAAA}-{NNN}`…) et
  prochain numéro, validité des devis et délai de paiement par défaut, TVA (désactivée par défaut ;
  numéro TVA et taux 8.1 / 2.6 / 3.8 % une fois activée).
- **Clients** :
  - particuliers et entreprises, adresse suisse structurée (rue, numéro, NPA, localité, canton),
    contact, type de site demandé, langue des documents (FR/DE), tags et notes ;
  - liste avec recherche (sans tenir compte des accents), filtres (type, canton, type de site,
    tag, archivés), tri et pagination ; tableau sur ordinateur, cartes sur téléphone ;
  - fiche client avec coordonnées, projet et historique des modifications ;
  - si deux personnes modifient la même fiche en même temps, la seconde est prévenue au lieu
    d'écraser le travail de la première ;
  - archivage (et désarchivage), suppression avec confirmation ;
  - **import CSV / Excel** en 4 étapes : fichier, correspondance des colonnes (reconnue
    automatiquement en français, allemand et anglais), vérification (erreurs, doublons par email),
    import ;
  - **export CSV / Excel** de la liste affichée (filtres appliqués), réimportable tel quel ;
  - export de toutes les données d'un client au format JSON (droit d'accès, nLPD).
- **Catalogue de prestations** :
  - forfaits, prestations à l'heure, suppléments et abonnements (mensuels, trimestriels,
    annuels), avec prix hors TVA et unité (forfait, h, page, pièce, jour, mois…) ;
  - nom et description en allemand facultatifs, repris sur les documents en allemand ;
  - regroupement par catégorie, recherche, filtres, duplication, désactivation ;
  - pré-rempli avec 11 exemples aux prix fictifs, à ajuster.
- **Tarifs publics pour le site vitrine** : `<APP_URL>/tarif.php` renvoie en JSON toutes les
  prestations actives du catalogue (prix, unités, catégories, FR/DE), sans connexion. Voir
  [`docs/TARIFS_SITE_VITRINE.md`](docs/TARIFS_SITE_VITRINE.md).
- **Devis** :
  - éditeur : client (recherche), dates, langue FR/DE, type de site, lignes du catalogue ou
    libres (quantités décimales, unité, prix, remise en % ou en CHF), ordre modifiable, textes
    d'introduction et de conditions ;
  - calculs en direct, identiques à ceux du serveur : remise par ligne, remise globale, TVA par
    taux (si activée), total arrondi aux 5 centimes, acompte à la commande (% ou CHF) ;
  - les abonnements sont totalisés à part (par mois / trimestre / an), sans remise globale ;
  - numérotation automatique sans doublon (`D-2026-001`, remise à 1 chaque année) ;
  - statuts brouillon → envoyé → accepté / refusé, expiré automatiquement après la date de
    validité ; seul un brouillon se modifie ou se supprime ;
  - duplication, historique, liste avec recherche et filtre par statut, devis sur la fiche client ;
  - **PDF A4** en français ou en allemand (« Offerte »), adresse placée pour les enveloppes à
    fenêtre, filigrane « brouillon », nom de fichier `Devra_Devis_D-2026-001_Client.pdf` ;
  - à l'envoi, les coordonnées du client et de l'entreprise sont figées sur le devis.
- **Factures** :
  - **conversion d'un devis accepté en un clic** : facture simple, ou facture d'acompte puis
    facture finale qui déduit l'acompte facturé ; les abonnements ne sont pas repris (ils sont
    facturés par un abonnement, créé en un clic depuis le devis) ;
  - création directe, avec le même éditeur que les devis (toutes les lignes sont dues, y compris
    une période d'abonnement) ;
  - brouillon modifiable, puis **émission** : numéro sans trou (`F-2026-001`), référence de
    paiement, coordonnées figées, PDF archivé ; une facture émise ne se modifie plus, elle
    s'annule (avec un motif) et se duplique ;
  - **QR-facture suisse** en bas de la dernière page (référence QRR avec un QR-IBAN, SCOR avec un
    IBAN classique, numéro de facture dans les informations supplémentaires), en français ou en
    allemand ;
  - **paiements** partiels ou complets (date, montant, virement / espèces / TWINT / autre, note),
    solde et statut mis à jour automatiquement : envoyée → partiellement payée → payée ;
    « en retard » s'affiche dès le lendemain de l'échéance ;
  - liste avec recherche et filtre par statut ; sur la fiche client : factures, total facturé,
    encaissé et impayé ; un client qui a des factures ne peut pas être supprimé.
- **Envoi par email** des devis et des factures, depuis leur fiche :
  - PDF en pièce jointe, message proposé à partir d'un modèle (français ou allemand selon la
    langue du document), modifiable avant l'envoi ;
  - variables `{client}`, `{numero}`, `{date}`, `{montant}`, `{echeance}`, `{lien}` et
    `{entreprise}` ;
  - plusieurs destinataires possibles, copie optionnelle à l'expéditeur, réponses adressées à
    l'email de l'entreprise ;
  - un devis en brouillon passe en « envoyé » ; une facture en brouillon est émise puis envoyée
    (« Émettre et envoyer ») ;
  - historique des envois sur le document, échecs compris (avec le message du serveur).
- **Paramètres → Emails** : modèles d'envoi des devis et des factures, en français et en
  allemand ; une variable mal écrite est signalée.
- **Acceptation des devis en ligne** (option, Paramètres → Facturation) : le devis envoyé par
  email contient un lien sécurisé vers une page publique, en français ou en allemand, où le
  client consulte le devis (et son PDF) puis l'accepte (nom + case « J'accepte ») ou le refuse
  (avec un commentaire facultatif). Le statut est mis à jour, la date, le nom et l'adresse IP
  sont enregistrés, et l'équipe est prévenue par email.
- **Export comptable** (Factures → Export comptable) : factures, paiements et clients d'une
  période en Excel (un classeur de trois feuilles) ou en CSV, et les PDF des factures et des
  relances de la période dans un fichier ZIP.
- **Journal d'activité** (Paramètres → Journal) : « Marc a envoyé le devis D-2026-004 par email
  à … », avec recherche, filtres par personne, par type et par période, et lien vers le
  document.
- **Relances** des factures impayées :
  - trois niveaux : 1er rappel, 2e rappel, mise en demeure ; délais (par défaut 10 jours après
    l'échéance, puis 15 jours entre deux relances), frais par niveau (0 par défaut) et nouveau
    délai de paiement accordé, dans **Paramètres → Relances** ;
  - mode **manuel** (par défaut) : la page « Relances à envoyer » liste les relances dues, à
    envoyer par email ou à enregistrer pour un envoi par courrier ; mode **automatique** : elles
    partent chaque matin par email ;
  - chaque relance a son PDF (lettre + QR-facture du montant restant, frais compris, même
    référence de paiement que la facture), archivé et joint à l'email ; textes FR/DE modifiables ;
  - les frais s'ajoutent au solde de la facture ; l'historique des relances est sur la facture.
- **Abonnements** (hébergement, maintenance, nom de domaine…) :
  - créés depuis un devis accepté (un par périodicité) ou saisis directement ; mensuels,
    trimestriels ou annuels, avec une date de début ;
  - une facture par période, générée automatiquement au début de chaque période (en brouillon,
    ou émise et envoyée directement si l'option est activée) ; les périodes manquées sont
    rattrapées, jamais facturées deux fois ;
  - pause (les périodes de la pause ne sont pas facturées), reprise, résiliation, modification
    du contenu pour les prochaines factures ;
  - revenu récurrent mensuel (MRR) et annuel, hors TVA ; abonnements sur la fiche client.
- **Tâches quotidiennes** (devis expirés, factures d'abonnement, relances) : lancées chaque matin
  par le conteneur `cron`, ou à la main dans **Paramètres → Tâches**, qui affiche aussi les
  dernières exécutions.
- **Tableau de bord** (page d'accueil), pour le mois, le trimestre, l'année en cours ou une
  période choisie, comparée à la période précédente :
  - chiffre d'affaires facturé et encaissé, graphique des 12 derniers mois ;
  - factures impayées (dont en retard, avec la liste), devis en attente (et ceux qui expirent
    dans les 7 jours), taux de conversion des devis ;
  - meilleurs clients (top 5), zones d'action (CA et nombre de clients par canton et par
    localité), types de site demandés et vendus, revenu récurrent (MRR) ;
  - raccourcis « Nouveau devis », « Nouveau client » et « Enregistrer un paiement » (choix de la
    facture, puis paiement).
- **Discussions** entre utilisateurs (menu « Discussions ») :
  - un **canal général**, ouvert à tous, et des **discussions par client** (sujet + messages),
    démarrées depuis la fiche du client ou la page Discussions ;
  - pastilles des **messages non lus** (menu, liste, fiche client), mise à jour automatique des
    fils ouverts (toutes les 5 secondes), liens cliquables ;
  - **accusés de lecture** : sous ses propres messages, l'auteur voit « Lu par Marc et Rita »
    ou « Pas encore lu » ;
  - **lecture seule** : consulte les discussions sans y écrire ; supprimer un client supprime
    ses discussions ; elles figurent dans l'export de ses données (nLPD).
- **Notifications** de l'ordinateur ou du téléphone (Windows, macOS, Android) pour les nouveaux
  messages, même application fermée : menu utilisateur → « Activer les notifications », sur
  chaque appareil (Web Push, clés `VAPID_*` dans `.env`).
- **Espace client** (`/espace-client`, en français ou en allemand selon la langue du client) :
  - accès créé depuis la fiche du client (« Créer l'accès à l'espace client ») : identifiant et
    mot de passe **générés**, affichés une seule fois (à copier) avec un bouton « Envoyer par
    email » ; nouveau mot de passe ou désactivation de l'accès depuis la même fiche ;
  - le client y voit **ce qui est à payer** (solde, échéance, compte et référence de la
    QR-facture), ses **devis** (hors brouillons, qu'il peut **accepter ou refuser** en ligne),
    ses **factures** émises et ses **abonnements**, avec les PDF ;
  - une **discussion avec l'équipe**, une par client, marquée « Visible par le client » côté
    équipe : le client reçoit un email quand l'équipe lui écrit, l'équipe une notification quand
    il répond ; il ne voit **jamais les discussions internes** ;
  - il peut **changer son mot de passe** (Mon compte) ou en recevoir un nouveau par email
    (« Mot de passe oublié ? »).
- **Recherche globale** (Ctrl+K) : clients (nom, localité, email, téléphone), devis et factures
  (numéro, objet).
- **Navigation** latérale (repliable, en tiroir sur téléphone), thème clair / sombre / système.
- Chaque action importante est enregistrée dans le **journal d'activité**.

## Installation en local (développement)

Prérequis : **Node.js 22.12+** (24 recommandé) et **Docker**.

```bash
cd devra-gestion
cp .env.example .env          # puis complétez BETTER_AUTH_SECRET et ADMIN_PASSWORD
npm install
npm run db:up                 # PostgreSQL + Mailpit (faux serveur email)
npm run db:migrate            # crée les tables
npm run db:seed               # crée le premier administrateur (ADMIN_EMAIL / ADMIN_PASSWORD)
npm run db:seed:demo          # facultatif : clients, devis, factures et abonnements fictifs
npm run dev
```

- Application : <http://localhost:3000>
- Emails envoyés (invitations, documents, relances) : <http://localhost:8025> (Mailpit)
- En développement, il n'y a pas de conteneur `cron` : les tâches quotidiennes se lancent depuis
  **Paramètres → Tâches** (« Lancer maintenant »).

## Production (Raspberry Pi)

Le guide pas à pas est dans [`docs/DEPLOIEMENT_RASPBERRY_PI.md`](docs/DEPLOIEMENT_RASPBERRY_PI.md) :
installation de Raspberry Pi OS 64 bits et de Docker, fichier `.env`, accès HTTPS sur
`gestion.devra.ch` par **Cloudflare Tunnel** (recommandé) ou **Caddy**, mises à jour, dépannage.

Le Raspberry Pi ne construit pas l'application : le flux GitHub Actions
[`images-docker.yml`](../.github/workflows/images-docker.yml) construit les images (ARM64 et
x86-64) à chaque mise à jour de `main` et les publie dans GitHub Container Registry
(`ghcr.io`) ; le Raspberry Pi les télécharge.

**Sur un serveur Linux** dont l'administrateur délègue l'exploitation à un agent (compte
restreint) : voir [`docs/DEPLOIEMENT_SERVEUR.md`](docs/DEPLOIEMENT_SERVEUR.md) (installation
unique en root avec `deploy/serveur/installer.sh`, puis commande `claude-devra` pour l'agent).

En résumé :

```bash
cp .env.example .env          # secrets, SMTP, admin, sauvegardes, IMAGE_REGISTRY, option HTTPS
docker login ghcr.io          # une fois, avec un jeton « read:packages »
docker compose pull && docker compose up -d --no-build
```

Sur un serveur plus puissant, on peut aussi construire sur place : `IMAGE_REGISTRY` vide, puis
`docker compose up -d --build`.

| Service                  | Rôle                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `db`                     | PostgreSQL                                                                                           |
| `migrate`                | applique les migrations et crée le premier admin, puis s'arrête                                      |
| `app`                    | l'application, sur `127.0.0.1:3000` seulement                                                        |
| `cron`                   | tâches quotidiennes (devis expirés, factures d'abonnement, relances), à `CRON_TIME`                  |
| `backup`                 | sauvegarde quotidienne de la base et des fichiers, rotation sur 30 jours, copie distante facultative |
| `cloudflared` ou `caddy` | accès HTTPS depuis Internet (`compose.cloudflare.yaml` ou `compose.caddy.yaml`)                      |

Les images fonctionnent sur Raspberry Pi (ARM64) comme sur un ordinateur classique.

**Sauvegardes et restauration** : voir [`docs/SAUVEGARDES.md`](docs/SAUVEGARDES.md).

```bash
docker compose exec backup backup.sh maintenant   # sauvegarde immédiate
docker compose run --rm restore --test            # vérifie la dernière sauvegarde
docker compose run --rm restore derniere          # restaure (application arrêtée)
```

## Commandes utiles

| Commande                      | Rôle                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `npm run dev`                 | Serveur de développement                                                            |
| `npm run build` / `npm start` | Build et serveur de production                                                      |
| `npm run lint`                | ESLint (aucun avertissement toléré)                                                 |
| `npm run typecheck`           | Vérification TypeScript                                                             |
| `npm run format`              | Formatage Prettier                                                                  |
| `npm test`                    | Tests unitaires (Vitest)                                                            |
| `npm run test:e2e`            | Tests de bout en bout (Playwright) ; nécessitent `npm run db:up` et `npm run build` |
| `npm run db:up` / `db:down`   | Démarre / arrête PostgreSQL et Mailpit de développement                             |
| `npm run db:migrate`          | Crée une migration après modification de `prisma/schema.prisma`                     |
| `npm run db:seed`             | Crée le premier admin si la base n'a aucun utilisateur                              |
| `npm run db:seed:demo`        | Ajoute des données fictives (base de développement uniquement)                      |
| `npm run db:studio`           | Explorateur de la base (Prisma Studio)                                              |

## Structure

```
devra-gestion/
├─ prisma/                schéma de la base, migrations, seed
├─ src/
│  ├─ app/
│  │  ├─ (auth)/          connexion, mot de passe oublié, invitation
│  │  ├─ (app)/           application connectée (navigation latérale)
│  │  ├─ (public)/        page d'acceptation des devis en ligne (sans compte)
│  │  └─ api/             authentification, logo, exports, PDF, tâches quotidiennes
│  ├─ domain/             règles métier pures, sans base de données (testées)
│  ├─ modules/<module>/   schémas Zod, services, actions serveur par module
│  ├─ server/             authentification, base, sessions, emails, fichiers, PDF
│  ├─ i18n/documents/     textes des documents en français et en allemand
│  ├─ components/         composants d'interface (ui/ = shadcn/ui)
│  └─ lib/                utilitaires (formats suisses…)
├─ docker/
│  ├─ cron/               planificateur des tâches quotidiennes (conteneur cron)
│  ├─ backup/             sauvegarde et restauration (conteneurs backup et restore)
│  └─ caddy/              configuration du reverse proxy HTTPS (option Caddy)
├─ tests/e2e/             tests Playwright
├─ docs/                  déploiement, sauvegardes, choix techniques
├─ compose.yaml           production (Docker)
├─ compose.cloudflare.yaml / compose.caddy.yaml   options d'accès HTTPS
└─ compose.dev.yaml       développement (PostgreSQL + Mailpit)
```

## Documentation

- [`docs/DEPLOIEMENT_RASPBERRY_PI.md`](docs/DEPLOIEMENT_RASPBERRY_PI.md) : installation sur le
  Raspberry Pi, HTTPS, mises à jour, dépannage, mesures de sécurité.
- [`docs/DEPLOIEMENT_SERVEUR.md`](docs/DEPLOIEMENT_SERVEUR.md) : installation sur un serveur
  Linux exploité par un agent (compte restreint, commande `claude-devra`).
- [`docs/SAUVEGARDES.md`](docs/SAUVEGARDES.md) : fonctionnement des sauvegardes, copie hors du
  Raspberry Pi, vérification et restauration.
- [`docs/TARIFS_SITE_VITRINE.md`](docs/TARIFS_SITE_VITRINE.md) : tarifs publics (`/tarif.php`)
  pour le site vitrine, format et exemples PHP / JavaScript.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) : choix techniques et leurs raisons.
- [`.env.example`](.env.example) : toutes les variables de configuration, commentées.
