# Déploiement sur le serveur (iMac Linux) piloté par un agent

Ce guide installe Devra Gestion sur un serveur Linux où un **agent** (Claude, compte `claude`,
accès SSH restreint) assure l'exploitation au quotidien. Il s'adresse à deux lecteurs :

- **l'administrateur du serveur** (vous) : une installation unique, en root (étapes 2 et 3) ;
- **l'agent** : transfert du kit (étape 1), vérifications, mises à jour, sauvegardes (étapes 4 et
  suivantes).

## Principe

L'application a besoin de PostgreSQL, d'envoyer des emails et de faire des sauvegardes : elle
tourne avec **Docker Compose**, exactement comme sur le Raspberry Pi. Le bac à sable des
applications Node de l'agent (`claude-app` : 400 Mo de mémoire, aucun accès réseau sortant,
fichiers en lecture seule, pas de `.env`) ne le permet pas.

Le compte de l'agent ne peut pas utiliser Docker directement (ce serait un accès root). L'installation
lui donne une seule commande, **`sudo /usr/local/sbin/claude-devra`**, limitée à une liste fermée
d'actions :

| Commande                                  | Effet                                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| `claude-devra status`                     | état des services, réponse de l'application, version des images, dernière sauvegarde    |
| `claude-devra logs [service] [lignes]`    | journal d'un service : `app` (défaut), `cron`, `backup`, `db`, `migrate`, `cloudflared` |
| `claude-devra update [version]`           | sauvegarde, téléchargement des images, redémarrage (`latest` par défaut)                |
| `claude-devra update sha-1a2b3c4`         | retour à une version précise (7 premiers caractères du commit)                          |
| `claude-devra backup`                     | sauvegarde immédiate                                                                    |
| `claude-devra check-backup`               | restaure la dernière sauvegarde dans une base temporaire pour la vérifier               |
| `claude-devra start` / `stop` / `restart` | démarrer, arrêter, redémarrer                                                           |

L'agent ne peut **pas** : lire les secrets (`/opt/devra-gestion/.env`), modifier la configuration
ou les fichiers compose, restaurer une sauvegarde, supprimer des données. Ces opérations restent à
l'administrateur (section « Réservé à l'administrateur »).

Les images de l'application ne sont pas construites sur le serveur : GitHub Actions les construit
à chaque mise à jour de `main` (flux « Images Docker », x86-64 et ARM64) et le serveur les
télécharge depuis GitHub Container Registry (`ghcr.io`, privé).

## Prérequis

- La version à installer est fusionnée dans `main` et la dernière exécution du flux
  **« Images Docker »** est **verte** (onglet **Actions** du dépôt GitHub).
- Sur le serveur : Linux 64 bits (x86-64 ou ARM64), **Docker** avec `docker compose`, 2 Go de
  mémoire libre et 5 Go de disque. Sans Docker : `curl -fsSL https://get.docker.com | sh` (root).
- Un jeton GitHub **« classic »** avec la seule permission **`read:packages`** (GitHub →
  Settings → Developer settings → Personal access tokens → Tokens (classic)) : il permet au
  serveur de télécharger les images.
- L'accès HTTPS, au choix :
  1. **un nouveau tunnel Cloudflare** (recommandé) : Cloudflare → Zero Trust → Networks →
     Tunnels → Create a tunnel (Cloudflared), copier le **jeton** ; « Public Hostname » :
     `gestion.devra.ch` → service **HTTP**, URL **`app:3000`** ;
  2. **le tunnel Cloudflare déjà installé sur le serveur** : ajouter la « Public Hostname »
     `gestion.devra.ch` → **HTTP** `localhost:3000` (ou le port choisi à l'installation) ;
  3. **un autre reverse proxy** (nginx…) vers `http://127.0.0.1:3000`, qui **remplace**
     l'en-tête `X-Forwarded-For` par l'adresse du visiteur (`proxy_set_header X-Forwarded-For
$remote_addr;`) — sans quoi la limitation des tentatives de connexion se contourne.
- Les réglages du serveur d'envoi d'emails (SMTP), ex. Infomaniak : `mail.infomaniak.com`,
  port `465`, TLS direct.

## Étape 1 — l'agent dépose le kit sur le serveur

Depuis le dossier `devra-gestion` du dépôt (branche `main`), sur l'ordinateur de l'utilisateur.
Le kit ne contient aucun secret : les fichiers compose, `.env.example` et `deploy/serveur/`.

```bash
ssh -i ~/.ssh/id_ed25519_claude claude@imac-serveur "mkdir -p devra-gestion-kit/deploy"
scp -i ~/.ssh/id_ed25519_claude compose.yaml compose.cloudflare.yaml .env.example claude@imac-serveur:devra-gestion-kit/
scp -i ~/.ssh/id_ed25519_claude -r deploy/serveur claude@imac-serveur:devra-gestion-kit/deploy/
ssh -i ~/.ssh/id_ed25519_claude claude@imac-serveur "find devra-gestion-kit -type l; ls -R devra-gestion-kit"
```

La commande `find … -type l` ne doit rien afficher (aucun lien symbolique). Si le dossier
personnel du compte n'est pas accessible en écriture, s'arrêter et le signaler à l'utilisateur.

L'agent indique ensuite à l'utilisateur la commande de l'étape 2, avec le chemin exact du kit.

## Étape 2 — l'administrateur lance l'installation (une fois, en root)

Relisez le script si vous le souhaitez (`deploy/serveur/installer.sh`, dans le dépôt), puis, sur le
serveur, avec votre compte habituel :

```bash
sudo bash /home/claude/devra-gestion-kit/deploy/serveur/installer.sh
```

Le script vérifie Docker, copie les fichiers dans `/opt/devra-gestion` (lisible par root seul),
génère les secrets (`BETTER_AUTH_SECRET`, `POSTGRES_PASSWORD`, `CRON_SECRET`) et pose quelques
questions :

| Question                | Réponse                                                                        |
| ----------------------- | ------------------------------------------------------------------------------ |
| Adresse publique        | `https://gestion.devra.ch`                                                     |
| Accès HTTPS             | `1`, `2` ou `3` (voir les prérequis) ; pour `1`, le jeton du tunnel            |
| Port local              | `3000` (proposé automatiquement s'il est libre)                                |
| Registre des images     | `ghcr.io/firstnext18-jpg`                                                      |
| SMTP                    | serveur, port, TLS, utilisateur, mot de passe, expéditeur                      |
| Premier administrateur  | nom et email (le mot de passe provisoire est généré et affiché une seule fois) |
| Dossier des sauvegardes | `/var/backups/devra-gestion`, ou un disque externe monté                       |
| Connexion au registre   | votre nom d'utilisateur GitHub et le jeton `read:packages`                     |
| Compte autorisé         | `claude` (le compte de l'agent)                                                |

Il télécharge ensuite les images et démarre l'application (environ 2 minutes), puis affiche
l'adresse, l'email de l'administrateur et le **mot de passe provisoire**. Le mot de passe
provisoire est retiré de `.env` dès que le compte est créé.

Le kit peut ensuite être supprimé : `rm -r /home/claude/devra-gestion-kit`.

## Étape 3 — premiers pas (administrateur)

1. Ouvrez **https://gestion.devra.ch** et connectez-vous avec l'email et le mot de passe
   provisoire.
2. Déconnectez-vous, cliquez sur **« Mot de passe oublié ? »** et choisissez votre mot de passe
   avec le lien reçu par email (cela vérifie aussi l'envoi des emails).
3. **Paramètres → Entreprise** (nom, adresse, IBAN ou QR-IBAN, logo), **Facturation**,
   **Utilisateurs** : comme décrit dans [DEPLOIEMENT_RASPBERRY_PI.md](DEPLOIEMENT_RASPBERRY_PI.md),
   section 10.

## Étape 4 — l'agent vérifie l'installation

```bash
ssh -i ~/.ssh/id_ed25519_claude claude@imac-serveur "sudo /usr/local/sbin/claude-devra status"
ssh -i ~/.ssh/id_ed25519_claude claude@imac-serveur "sudo /usr/local/sbin/claude-devra backup"
ssh -i ~/.ssh/id_ed25519_claude claude@imac-serveur "sudo /usr/local/sbin/claude-devra check-backup"
```

Attendu : `app`, `backup`, `cron` et `db` en `running` (`app` et `db` : `healthy`, `cloudflared`
en plus avec un tunnel dédié), « Application … : HTTP 200 », puis « Sauvegarde vérifiée : elle
peut être restaurée. ».

## Mettre à jour (agent)

Quand une nouvelle version est fusionnée dans `main` et que le flux « Images Docker » est vert :

```bash
ssh -i ~/.ssh/id_ed25519_claude claude@imac-serveur "sudo /usr/local/sbin/claude-devra update"
```

La commande fait une sauvegarde, télécharge les images, redémarre (les migrations de la base
s'appliquent seules), puis affiche l'état. Si une image de l'application ne peut pas être
téléchargée, elle s'arrête sans rien changer. En cas de problème, revenir à la version précédente
(`sha-` suivi des 7 premiers caractères du commit, visibles dans l'onglet Actions) :

```bash
ssh -i ~/.ssh/id_ed25519_claude claude@imac-serveur "sudo /usr/local/sbin/claude-devra update sha-1a2b3c4"
```

Si la version défaillante a modifié la base, l'ancienne version peut refuser de démarrer : il faut
alors restaurer la sauvegarde faite juste avant la mise à jour (administrateur, ci-dessous).

Si une nouvelle version modifie `compose.yaml` ou `compose.cloudflare.yaml` (la pull request le
signale), l'agent redépose le kit (étape 1) et l'administrateur relance `installer.sh` : la
configuration existante est conservée.

## Surveillance (agent)

- Une fois par semaine : `claude-devra status` (dernière sauvegarde « OK » et datée du jour).
- Une fois par mois : `claude-devra check-backup`.
- En cas d'erreur signalée par un utilisateur : `claude-devra logs app 200`.
- Toujours rapporter à l'utilisateur la commande lancée et son résultat ; ne jamais chercher à
  contourner un refus.

## Réservé à l'administrateur

Toutes ces commandes se lancent en root, dans `/opt/devra-gestion` :

```bash
sudo -i
cd /opt/devra-gestion
```

- **Modifier la configuration** (SMTP, adresse, heure des tâches…) : `nano .env`, puis
  `claude-devra start` (les conteneurs concernés redémarrent).
- **Copie des sauvegardes hors du serveur** (rclone, chiffrée) : variables `BACKUP_REMOTE` et
  `RCLONE_CONFIG_*` dans `.env`, voir [SAUVEGARDES.md](SAUVEGARDES.md).
- **Restaurer une sauvegarde** : commandes `docker compose …` de [SAUVEGARDES.md](SAUVEGARDES.md)
  (section « Restaurer »), lancées depuis `/opt/devra-gestion`.
- **Renouveler le jeton GitHub** quand il expire : relancer `installer.sh` et répondre « o » à
  « Se reconnecter ? ».
- **Retirer l'agent** : `rm /etc/sudoers.d/claude-devra`.
- **Désinstaller** : `docker compose down` (les données restent dans les volumes Docker et les
  sauvegardes) ; `docker compose down -v` efface aussi la base et les fichiers, définitivement.

## Ajout proposé au skill « serveur-imac » de l'agent

Le skill de l'agent n'autorise que les commandes qu'il liste. Pour qu'il prenne en charge Devra
Gestion, ajoutez-lui par exemple :

> **Devra Gestion** (application Docker installée par l'administrateur dans `/opt/devra-gestion`,
> voir `devra-gestion/docs/DEPLOIEMENT_SERVEUR.md` dans le dépôt Outils) : la seule commande
> autorisée est `sudo /usr/local/sbin/claude-devra status|logs|update|backup|check-backup|start|stop|restart`.
> Jamais `docker` directement, jamais de lecture de `/opt/devra-gestion/.env`. Confirmation de
> l'utilisateur avant `update` (sauf demande explicite), `stop` et tout retour à une version
> précédente.
