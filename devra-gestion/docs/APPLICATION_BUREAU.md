# Application de bureau (Windows et Mac)

L'application de bureau ouvre l'outil de gestion dans sa propre fenêtre et affiche ses
notifications **dans celles du système** (centre de notifications de Windows, de macOS),
sans dépendre des notifications du navigateur.

- Nouveaux messages des discussions (équipe et clients), fichiers envoyés par un client, site
  d'un client hors ligne ou de retour en ligne, renouvellements proches (domaine, hébergement,
  certificat).
- Nombre de messages non lus : pastille sur l'icône (Dock sur Mac, barre des tâches sur Windows).
- Fermer la fenêtre la cache seulement : l'application reste dans la barre des tâches (Windows,
  près de l'horloge) ou la barre des menus (Mac, en haut à droite). Pour la quitter : clic sur
  l'icône → « Quitter ».
- Lancement au démarrage de l'ordinateur (fenêtre cachée), désactivable : clic sur l'icône →
  « Lancer au démarrage de l'ordinateur ».

Aucune information de l'entreprise n'est écrite dans l'application : l'adresse de l'outil est
demandée au premier lancement, puis on se connecte avec son email et son mot de passe habituels.

## Fonctionnement

Toutes les 20 secondes, l'application demande à l'outil les nouvelles notifications de
l'utilisateur connecté (`GET /api/notifications`). Chaque notification est enregistrée dans la
base au moment où elle est envoyée et gardée 30 jours. Si l'ordinateur était éteint, les
notifications manquées s'affichent au démarrage (un seul résumé s'il y en a plus de trois).

Les notifications du navigateur (menu utilisateur → « Activer les notifications ») continuent de
fonctionner en parallèle pour ceux qui le souhaitent ; dans l'application de bureau, ce menu
indique « Notifications de l'application activées ».

## Télécharger l'installateur

L'application est construite automatiquement par GitHub à chaque modification (dossier
`desktop/`).

1. Sur GitHub, ouvrir le dépôt → onglet **Actions** → **Application de bureau**.
2. Ouvrir la dernière exécution réussie (coche verte).
3. En bas de la page, section **Artifacts** : télécharger **Gestion-Windows** ou **Gestion-Mac**
   (un fichier `.zip` qui contient l'installateur).

Les fichiers restent disponibles 90 jours. Pour en reconstruire : onglet Actions →
« Application de bureau » → **Run workflow**.

## Installer sur Windows

1. Décompresser `Gestion-Windows.zip`, puis double-cliquer sur `Gestion-1.0.0-Windows.exe`.
2. L'application n'est pas signée (un certificat Microsoft coûte plusieurs centaines de francs
   par an) : Windows affiche « Windows a protégé votre ordinateur ». Cliquer sur
   **Informations complémentaires** → **Exécuter quand même**.
3. L'installation se fait sans question ; l'application s'ouvre et demande l'adresse de l'outil
   (ex. `https://gestion.exemple.ch`).
4. Se connecter. Les notifications arrivent dès maintenant.

Si aucune notification n'apparaît : Paramètres Windows → Système → Notifications → vérifier que
les notifications sont activées, que **Gestion** est autorisé et que « Ne pas déranger » est
désactivé.

## Installer sur Mac

1. Décompresser `Gestion-Mac.zip`, puis ouvrir `Gestion-1.0.0-Mac.dmg` et glisser **Gestion**
   dans le dossier **Applications** (fonctionne sur Mac Intel et Apple Silicon).
2. L'application n'est pas signée par Apple (abonnement développeur de 99 $ par an) : au premier
   lancement, macOS refuse de l'ouvrir. Ouvrir **Réglages Système** → **Confidentialité et
   sécurité**, descendre jusqu'au message sur « Gestion » → **Ouvrir quand même**, puis confirmer
   avec son mot de passe.
   - Si macOS indique que l'application « est endommagée » : ouvrir le Terminal et taper
     `xattr -dr com.apple.quarantine /Applications/Gestion.app`, puis relancer.
3. Indiquer l'adresse de l'outil, se connecter.
4. À la première notification, macOS demande l'autorisation : cliquer sur **Autoriser**
   (sinon : Réglages Système → Notifications → Gestion).

## Mettre à jour l'application

L'application elle-même change rarement (l'outil, lui, se met à jour sur le serveur et
l'application affiche toujours sa dernière version). Quand le dossier `desktop/` est modifié,
télécharger le nouvel installateur et l'installer par-dessus l'ancien : l'adresse et la session
sont conservées.

## Changer d'adresse ou de compte

- Adresse : clic sur l'icône de l'application → « Changer l'adresse du serveur… ».
- Compte : menu utilisateur de l'outil → « Se déconnecter », puis se reconnecter.

## Construire soi-même (développeurs)

```bash
cd desktop
npm ci
npm start              # lance l'application en développement
npm run dist:win       # installateur Windows (sur Windows)
npm run dist:mac       # image disque Mac (sur un Mac)
```

Le code tient en trois fichiers : `main.js` (fenêtre, icône, notifications), `preload.js` et
`setup.html` (page « Adresse du serveur »). Sécurité : la fenêtre n'a aucun accès au système
(isolation, bac à sable), seuls les liens de l'outil s'y ouvrent (les autres partent dans le
navigateur), et seule la copie dans le presse-papiers est autorisée aux pages.
