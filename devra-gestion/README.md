# Devra Gestion

Outil de gestion des **clients, devis et factures** (avec QR-facture suisse) pour une petite
entreprise, auto-hébergé sur un Raspberry Pi.

- Plusieurs utilisateurs avec des rôles : **Admin**, **Membre**, **Lecture seule**
- Montants en CHF, formats suisses (`30.09.2026`, `CHF 1'250.00`)
- Interface en français, mode clair et sombre, utilisable sur téléphone
- Documents en français et en allemand _(à venir)_

## Avancement

| Phase                                     | Contenu                                                           | État        |
| ----------------------------------------- | ----------------------------------------------------------------- | ----------- |
| 1. Fondations                             | Connexion, invitations, rôles, paramètres de l'entreprise, Docker | ✅ Terminée |
| 2. Clients                                | Fiches, recherche, import/export CSV-Excel                        | ✅ Terminée |
| 3. Catalogue                              | Prestations réutilisables                                         | À venir     |
| 4. Devis                                  | Calculs, remises, acompte, PDF FR/DE                              | À venir     |
| 5. Factures                               | QR-facture, paiements, acomptes                                   | À venir     |
| 6. Emails                                 | Envoi des devis et factures                                       | À venir     |
| 7. Relances et abonnements                | Tâches planifiées                                                 | À venir     |
| 8. Tableau de bord                        | Indicateurs et graphiques                                         | À venir     |
| 9. Acceptation en ligne, exports, journal |                                                                   | À venir     |
| 10. Production                            | Sauvegardes, déploiement Raspberry Pi                             | À venir     |

## Ce qui fonctionne aujourd'hui

- **Connexion** par email et mot de passe, **mot de passe oublié** (lien par email, valable 1 h).
- **Limitation des tentatives** : 5 essais de connexion par minute et par adresse IP.
- **Invitation d'utilisateurs** par un admin (lien valable 7 jours), choix du rôle,
  changement de rôle, désactivation / réactivation d'un compte.
- **Paramètres → Entreprise** : nom, adresse, contact, IBAN et QR-IBAN (vérifiés), logo.
- **Paramètres → Types de sites** : liste modifiable (ajouter, renommer, réordonner, désactiver).
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
- **Recherche globale** (Ctrl+K) : clients par nom, localité, email ou téléphone.
- **Navigation** latérale (repliable, en tiroir sur téléphone), thème clair / sombre / système.
- Chaque action importante est enregistrée dans un **journal d'activité** (la page de consultation
  arrive en phase 9).

## Installation en local (développement)

Prérequis : **Node.js 22.12+** (24 recommandé) et **Docker**.

```bash
cd devra-gestion
cp .env.example .env          # puis complétez BETTER_AUTH_SECRET et ADMIN_PASSWORD
npm install
npm run db:up                 # PostgreSQL + Mailpit (faux serveur email)
npm run db:migrate            # crée les tables
npm run db:seed               # crée le premier administrateur (ADMIN_EMAIL / ADMIN_PASSWORD)
npm run db:seed:demo          # facultatif : 15 clients fictifs pour découvrir l'outil
npm run dev
```

- Application : <http://localhost:3000>
- Emails envoyés (invitations, mots de passe) : <http://localhost:8025> (Mailpit)

## Lancer avec Docker (comme en production)

```bash
cp .env.example .env          # complétez au minimum BETTER_AUTH_SECRET, POSTGRES_PASSWORD,
                              # APP_URL, SMTP_* et ADMIN_*
docker compose up -d --build
```

Trois services démarrent : `db` (PostgreSQL), `migrate` (applique les migrations et crée le
premier admin, puis s'arrête) et `app` (l'application, sur `127.0.0.1:3000`). Les images
fonctionnent sur Raspberry Pi (ARM64) comme sur un ordinateur classique.

Le guide complet (Raspberry Pi, HTTPS sur `gestion.devra.ch`, sauvegardes) arrivera en phase 10.

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
| `npm run db:seed:demo`        | Ajoute des clients fictifs (base de développement uniquement)                       |
| `npm run db:studio`           | Explorateur de la base (Prisma Studio)                                              |

## Structure

```
devra-gestion/
├─ prisma/                schéma de la base, migrations, seed
├─ src/
│  ├─ app/
│  │  ├─ (auth)/          connexion, mot de passe oublié, invitation
│  │  ├─ (app)/           application connectée (navigation latérale)
│  │  └─ api/             authentification, logo
│  ├─ domain/             règles métier pures, sans base de données (testées)
│  ├─ modules/<module>/   schémas Zod, services, actions serveur par module
│  ├─ server/             authentification, base, sessions, emails, fichiers
│  ├─ components/         composants d'interface (ui/ = shadcn/ui)
│  └─ lib/                utilitaires (formats suisses…)
├─ tests/e2e/             tests Playwright
├─ docs/                  documentation (DECISIONS.md…)
├─ compose.yaml           production (Docker)
└─ compose.dev.yaml       développement (PostgreSQL + Mailpit)
```

Les choix techniques et leurs raisons sont détaillés dans [`docs/DECISIONS.md`](docs/DECISIONS.md).
