# Sauvegardes et restauration

Ce document explique comment Devra Gestion est sauvegardé, comment copier les sauvegardes hors du
Raspberry Pi, et comment restaurer en cas de problème. Toutes les commandes se lancent dans le
dossier `devra-gestion` du Raspberry Pi.

## Ce qui est sauvegardé

Le service `backup` (lancé avec les autres par `docker compose up -d`) fait **chaque jour**, à
l'heure `BACKUP_TIME` (02:30 par défaut, heure de Zurich) :

| Fichier                                          | Contenu                                                                                               |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `base/devra_AAAA-MM-JJ_HHMM.dump`                | toute la base PostgreSQL : clients, devis, factures, paiements, utilisateurs, paramètres, journal…    |
| `fichiers/devra-fichiers_AAAA-MM-JJ_HHMM.tar.gz` | les fichiers de l'application : logo, PDF archivés, fichiers partagés avec les clients, justificatifs |
| `derniere-sauvegarde.txt`                        | la date et le résultat de la dernière sauvegarde (OK ou ÉCHEC)                                        |

- La base est exportée avec `pg_dump` (format « custom », compressé), puis **relue** avec
  `pg_restore --list` avant d'être gardée : un fichier illisible n'est jamais conservé.
- Les sauvegardes de plus de **`BACKUP_RETENTION_DAYS` jours** (30 par défaut) sont supprimées.
- **Rattrapage** : si le Raspberry Pi était éteint à l'heure prévue, la sauvegarde du jour est
  faite dès son redémarrage. En cas d'échec, un nouvel essai a lieu 30 minutes plus tard.
- Les fichiers ne sont lisibles que par l'administrateur du Raspberry Pi (`root`) : ils
  contiennent des données personnelles (nLPD).

Ne sont **pas** dans les sauvegardes : le fichier `.env` (secrets). Gardez-en une copie à part,
dans un gestionnaire de mots de passe par exemple : il faut le même `BETTER_AUTH_SECRET` et le
même `POSTGRES_PASSWORD`… ou les redéfinir lors d'une réinstallation.

### Où sont les sauvegardes ?

Dans le dossier `BACKUP_DIR` du fichier `.env` (`./sauvegardes` par défaut, dans le dossier du
projet). **Une carte SD peut lâcher sans prévenir** : choisissez de préférence un disque USB ou un
partage réseau (NAS) monté sur le Raspberry Pi, par exemple :

```bash
# Disque USB monté sur /mnt/sauvegardes (voir docs/DEPLOIEMENT_RASPBERRY_PI.md)
BACKUP_DIR=/mnt/sauvegardes/devra
```

### Vérifier que tout fonctionne

```bash
sudo cat sauvegardes/derniere-sauvegarde.txt   # date et résultat (dossier BACKUP_DIR)
docker compose logs --tail 20 backup        # journal du service
docker compose run --rm restore             # liste des sauvegardes disponibles
docker compose exec backup backup.sh maintenant   # sauvegarde immédiate (ex. avant une mise à jour)
```

## Copie chiffrée sur Google Drive (recommandé)

Un incendie, un vol ou une panne de disque détruiraient le serveur **et** ses sauvegardes. Le plus
simple est d'envoyer chaque sauvegarde, **chiffrée**, sur Google Drive :

- chiffrement sur le serveur avant l'envoi (rclone « crypt ») : Google ne voit que des noms et des
  contenus illisibles ;
- accès limité aux fichiers créés par la sauvegarde (autorisation Google « drive.file ») : le
  reste de votre Drive n'est pas lisible ;
- copie chaque nuit après la sauvegarde, copies de plus de `BACKUP_RETENTION_DAYS` jours
  supprimées (environ 30 copies : prévoir l'espace, la base et les fichiers pèsent en général
  quelques dizaines de Mo).

### Mise en place (une fois, par l'administrateur)

1. L'agent dépose le kit à jour sur le serveur (voir [DEPLOIEMENT_SERVEUR.md](DEPLOIEMENT_SERVEUR.md),
   étape 1) : il contient `deploy/serveur/google-drive.sh`.
2. Sur le serveur, en root :

   ```bash
   sudo bash /home/claude/devra-gestion-kit/deploy/serveur/google-drive.sh
   ```

3. Le script explique comment obtenir l'autorisation Google **depuis votre ordinateur** (le
   serveur n'a pas de navigateur) : télécharger rclone (<https://rclone.org/downloads/>, rien à
   installer), lancer dans un terminal
   `rclone authorize "drive" "eyJzY29wZSI6ImRyaXZlLmZpbGUifQ"`, accepter dans le navigateur, puis
   coller dans le script le texte affiché.
4. Le script génère deux **phrases secrètes de chiffrement** et les affiche **une seule fois** :
   notez-les dans un gestionnaire de mots de passe. Sans elles, les copies sur Google Drive sont
   illisibles si le serveur est perdu.
5. Il vérifie l'accès, lance une première sauvegarde et affiche les fichiers envoyés (dossier
   `sauvegardes-gestion` de votre Google Drive).

Ensuite, `sudo /usr/local/sbin/claude-devra status` indique « copie vers googlechiffre: » sur la
ligne « Dernière sauvegarde ».

### Restaurer depuis Google Drive (serveur perdu)

1. Réinstallez l'application sur un nouveau serveur (`installer.sh`).
2. Relancez `google-drive.sh`, autorisez Google comme ci-dessus et répondez **o** à la question
   « Réinstallation… ? », puis saisissez vos deux phrases secrètes : le script récupère les
   sauvegardes (déchiffrées) dans le dossier des sauvegardes du serveur et les liste.
3. Restaurez la dernière sauvegarde :

   ```bash
   cd /opt/devra-gestion
   docker compose stop app cron
   docker compose run --rm restore derniere
   docker compose up -d
   ```

## Copie vers un autre stockage

Plutôt que Google Drive, le service `backup` peut copier chaque sauvegarde vers un stockage distant avec
[rclone](https://rclone.org), qui fonctionne avec la plupart des services : Infomaniak kDrive ou
Swiss Backup, SFTP vers un autre ordinateur, S3, etc.

1. Décrivez le stockage dans `.env` avec des variables `RCLONE_CONFIG_<NOM>_<OPTION>` (pas de
   fichier de configuration à gérer). Exemple pour un stockage WebDAV nommé `DISTANT` :

   ```bash
   BACKUP_REMOTE=distant:devra-sauvegardes
   RCLONE_CONFIG_DISTANT_TYPE=webdav
   RCLONE_CONFIG_DISTANT_URL=https://…            # adresse WebDAV donnée par le fournisseur
   RCLONE_CONFIG_DISTANT_VENDOR=other
   RCLONE_CONFIG_DISTANT_USER=prenom@exemple.ch
   RCLONE_CONFIG_DISTANT_PASS=…                   # voir ci-dessous
   ```

   Le mot de passe doit être « masqué » par rclone :

   ```bash
   docker compose run --rm --entrypoint rclone backup obscure 'le-mot-de-passe'
   ```

   Les options de chaque type de stockage sont décrites sur <https://rclone.org/overview/>.

2. **Chiffrez** les sauvegardes avant qu'elles ne quittent le Raspberry Pi (fortement conseillé
   pour un stockage en ligne) avec un second stockage de type `crypt` qui enveloppe le premier :

   ```bash
   BACKUP_REMOTE=coffre:
   RCLONE_CONFIG_COFFRE_TYPE=crypt
   RCLONE_CONFIG_COFFRE_REMOTE=distant:devra-sauvegardes
   RCLONE_CONFIG_COFFRE_PASSWORD=…                # masqué avec « rclone obscure », comme ci-dessus
   ```

   **Notez la phrase de passe en lieu sûr** (hors du Raspberry Pi) : sans elle, les sauvegardes
   distantes sont illisibles.

3. Redémarrez le service, puis testez :

   ```bash
   docker compose up -d backup
   docker compose exec backup backup.sh maintenant
   docker compose run --rm --entrypoint rclone backup ls "$(grep ^BACKUP_REMOTE= .env | cut -d= -f2)"
   ```

La copie distante ajoute les nouvelles sauvegardes et supprime celles de plus de
`BACKUP_RETENTION_DAYS` jours. Elle ne fait jamais de « miroir » : si le disque local est perdu
ou vidé, les copies distantes ne sont pas effacées.

## Vérifier qu'une sauvegarde peut être restaurée

À faire **une fois par mois** (et après chaque changement de disque ou de stockage distant). La
vérification restaure la sauvegarde dans une base temporaire, affiche ce qu'elle contient, puis
supprime cette base : l'application continue de fonctionner normalement.

```bash
docker compose run --rm restore --test                              # la dernière sauvegarde
docker compose run --rm restore --test devra_2026-10-01_0230.dump   # une sauvegarde précise
```

Résultat attendu :

```
 clients | devis | factures | paiements | utilisateurs | derniere_activite
---------+-------+----------+-----------+--------------+-------------------
      42 |    67 |       58 |        61 |            3 | 2026-10-01 …
Archive des fichiers lisible : devra-fichiers_2026-10-01_0230.tar.gz (58 PDF).
Sauvegarde vérifiée : elle peut être restaurée.
```

## Restaurer

### Revenir à la sauvegarde d'un jour précis (le Raspberry Pi fonctionne)

```bash
# 1. Arrêter l'application (rien ne doit être saisi pendant la restauration)
docker compose stop app cron

# 2. Choisir la sauvegarde
docker compose run --rm restore

# 3. Restaurer la base et les fichiers…
docker compose run --rm restore derniere
#    …ou une sauvegarde précise (base, puis fichiers) :
docker compose run --rm restore devra_2026-09-28_0230.dump devra-fichiers_2026-09-28_0230.tar.gz
#    Tapez RESTAURER pour confirmer.

# 4. Redémarrer l'application
docker compose up -d
```

Ce que fait la restauration :

- la sauvegarde est d'abord restaurée dans une base à part ; ce n'est **qu'une fois la
  restauration réussie** qu'elle remplace la base actuelle (jamais de base vide ou à moitié
  restaurée) ;
- **la base actuelle n'est pas supprimée** : elle est renommée `devra_gestion_avant_restauration`
  (la copie précédente de ce nom est remplacée), et les fichiers actuels sont déplacés dans
  `/data/.avant-restauration`. Une fois que tout est vérifié, vous pouvez les supprimer :

  ```bash
  # « devra » et « devra_gestion » : valeurs de POSTGRES_USER et POSTGRES_DB dans .env
  docker compose exec db psql -U devra -d postgres -c 'DROP DATABASE devra_gestion_avant_restauration'
  docker compose exec app rm -rf /data/.avant-restauration
  ```

- au redémarrage, le service `migrate` applique les éventuelles migrations plus récentes que la
  sauvegarde : une sauvegarde faite avec une version précédente de l'application se restaure
  normalement.

Tout ce qui a été saisi **après** la sauvegarde restaurée est perdu (sauf dans la copie
`devra_gestion_avant_restauration`).

### Tout réinstaller (Raspberry Pi ou carte SD perdus)

1. Installez un Raspberry Pi neuf en suivant [DEPLOIEMENT_RASPBERRY_PI.md](DEPLOIEMENT_RASPBERRY_PI.md),
   jusqu'au premier lancement compris (section 9), avec le même fichier `.env`.
2. Récupérez les sauvegardes dans `BACKUP_DIR` : branchez le disque USB, ou copiez-les depuis le
   stockage distant :

   ```bash
   docker compose run --rm --entrypoint rclone backup copy "$(grep ^BACKUP_REMOTE= .env | cut -d= -f2)" /backups
   ```

3. Restaurez la dernière sauvegarde, puis redémarrez :

   ```bash
   docker compose stop app cron
   docker compose run --rm restore derniere
   docker compose up -d
   ```

4. Connectez-vous : les comptes, les mots de passe et toutes les données sont ceux de la sauvegarde.

## Testé

La procédure a été testée de bout en bout avec Docker Compose (données de démonstration, PDF
archivé) :

- sauvegarde automatique au démarrage et à la demande, copie distante (stockage rclone local) ;
- vérification avec `restore --test` ;
- données modifiées et PDF supprimés, puis restauration : clients, paiements et PDF retrouvés,
  base précédente conservée, application de nouveau disponible ;
- **perte totale** (volumes Docker supprimés), réinstallation, restauration depuis la copie
  distante : 15 clients, 11 factures, 7 paiements et le PDF retrouvés, connexion avec le compte
  d'origine ;
- rotation : sauvegardes de plus de 30 jours supprimées en local et à distance, celles de
  29 jours conservées.
