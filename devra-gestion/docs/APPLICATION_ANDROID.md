# Application Android

L'application Android ouvre l'outil de gestion dans sa propre fenêtre et affiche ses
notifications dans celles du téléphone, **sans Google Play** : elle s'installe depuis un fichier
`.apk`, copié par câble USB depuis l'ordinateur.

- Nouveaux messages des discussions (équipe et clients), fichiers envoyés par un client, site
  d'un client hors ligne ou de retour en ligne, renouvellements proches.
- Toucher une notification ouvre la bonne page (la discussion, le site…).
- Envoi de photos et de documents depuis le téléphone (fichiers partagés, justificatifs de
  dépenses), téléchargement des factures et des fichiers (dossier « Téléchargements »).
- Les liens vers d'autres sites s'ouvrent dans le navigateur du téléphone.
- Appui long sur l'icône : raccourcis « Discussions » et « Réglages ».

Aucune information de l'entreprise n'est écrite dans l'application : l'adresse de l'outil
(https://…) est demandée au premier lancement, puis on se connecte avec son email et son mot de
passe habituels. Android 8 ou plus récent.

## Notifications

L'application demande à l'outil les nouvelles notifications de l'utilisateur connecté
(`GET /api/notifications`), sans passer par Google ni par les notifications du navigateur :

- **par défaut**, toutes les **15 minutes** environ (le minimum permis par Android pour une
  vérification en arrière-plan), et à chaque ouverture de l'application ;
- avec l'option **« Notifications instantanées »** (Réglages de l'application), toutes les
  **30 secondes**. Android exige alors une petite notification permanente « Notifications
  instantanées actives ». Quand le téléphone est en veille prolongée, Android peut espacer les
  vérifications ; elles reprennent dès qu'il se réveille.

Les réglages s'ouvrent depuis le menu utilisateur de l'outil (« Réglages de l'application ») ou
par un appui long sur l'icône. Si les notifications n'arrivent pas : Paramètres du téléphone →
Applications → Gestion → Notifications (autorisées) et → Batterie → « Sans restriction »
(certains fabricants arrêtent sinon les applications en arrière-plan).

## Télécharger l'APK

L'application est construite automatiquement par GitHub à chaque modification (dossier
`android/`).

1. Sur GitHub, ouvrir le dépôt → onglet **Actions** → **Application Android**.
2. Ouvrir la dernière exécution réussie (coche verte).
3. En bas de la page, section **Artifacts** : télécharger **Gestion-Android** (un `.zip`),
   puis le décompresser : il contient `Gestion-Android.apk`.

## Installer par câble USB (sans outil à installer)

1. Brancher le téléphone à l'ordinateur avec un câble USB. Sur le téléphone, toucher la
   notification « Recharge via USB » et choisir **Transfert de fichiers**.
2. Sur l'ordinateur, ouvrir le téléphone (Windows : Explorateur de fichiers ; Mac : application
   [Android File Transfer](https://www.android.com/filetransfer/) ou « OpenMTP ») et copier
   `Gestion-Android.apk` dans le dossier **Download** du téléphone.
3. Sur le téléphone, ouvrir l'application **Fichiers** → **Téléchargements** → toucher
   `Gestion-Android.apk`.
4. Android demande d'autoriser l'installation depuis cette source : **Paramètres** → activer
   **Autoriser depuis cette source** → revenir et toucher **Installer**. Si Play Protect affiche
   un avertissement (application inconnue) : **Plus de détails** → **Installer quand même**.
5. Ouvrir **Gestion**, indiquer l'adresse de l'outil, se connecter, puis **Autoriser** les
   notifications.

### Variante pour les développeurs (adb)

Avec les outils Android ([platform-tools](https://developer.android.com/tools/releases/platform-tools))
et le « Débogage USB » activé dans les options pour les développeurs du téléphone :

```bash
adb install -r Gestion-Android.apk
```

## Mettre à jour

L'outil se met à jour sur le serveur : l'application affiche toujours sa dernière version. Seule
une modification du dossier `android/` demande d'installer un nouvel APK, de la même façon,
par-dessus l'ancien.

### Clé de signature (une fois, recommandé)

Android n'accepte une mise à jour que si elle est signée avec **la même clé** que la version
installée. Sans clé enregistrée, GitHub signe chaque APK avec une clé de test différente : il
faut alors **désinstaller** l'ancienne version avant d'installer la nouvelle (il faudra se
reconnecter). Pour l'éviter, créer une fois une clé permanente :

1. Onglet **Actions** → **Application Android** → **Run workflow** → cocher **Créer une clé de
   signature** → **Run workflow**.
2. Ouvrir l'exécution, télécharger l'artifact **Cle-Android-a-enregistrer** (disponible 24
   heures) et lire `A-LIRE.txt`.
3. GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** :
   créer les quatre secrets indiqués (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`).
4. Ranger `gestion.keystore` et `A-LIRE.txt` dans un gestionnaire de mots de passe, puis les
   supprimer de l'ordinateur.
5. Relancer la construction (Actions → Application Android → Run workflow, sans cocher la case),
   désinstaller une dernière fois l'application de test, puis installer le nouvel APK. Les
   versions suivantes s'installeront par-dessus.

## Construire soi-même (développeurs)

Avec Android Studio, ouvrir le dossier `android/`. Le code (Java, sans bibliothèque externe) :

- `MainActivity.java` : fenêtre de l'outil (envoi et téléchargement de fichiers, liens externes) ;
- `SettingsActivity.java` : adresse de l'outil et notifications instantanées ;
- `Poller.java`, `PollJob.java`, `InstantService.java`, `BootReceiver.java` : notifications.

Sécurité : seules les pages de l'outil s'ouvrent dans l'application (https obligatoire), aucune
fonction du téléphone n'est exposée aux pages, et la session n'est utilisée que pour lire les
notifications de l'utilisateur connecté.
