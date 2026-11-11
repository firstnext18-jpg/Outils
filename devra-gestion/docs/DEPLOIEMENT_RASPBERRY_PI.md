# Déploiement sur un Raspberry Pi

Guide pas à pas pour installer Devra Gestion sur un Raspberry Pi, accessible en HTTPS sur
`https://gestion.devra.ch`. Comptez environ une heure.

L'application n'est pas construite sur le Raspberry Pi (il faudrait plus de 2,5 Go de mémoire) :
GitHub la construit automatiquement à chaque mise à jour de la branche `main`, et le Raspberry Pi
télécharge les images prêtes à l'emploi (voir [section 6](#6-récupérer-lapplication)).

Sommaire :

1. [Matériel](#1-matériel)
2. [Installer Raspberry Pi OS](#2-installer-raspberry-pi-os)
3. [Préparer le système](#3-préparer-le-système)
4. [Installer Docker](#4-installer-docker)
5. [Disque des sauvegardes](#5-disque-des-sauvegardes)
6. [Récupérer l'application](#6-récupérer-lapplication)
7. [Configurer le fichier .env](#7-configurer-le-fichier-env)
8. [Accès HTTPS : Cloudflare Tunnel ou Caddy](#8-accès-https--cloudflare-tunnel-ou-caddy)
9. [Lancer l'application](#9-lancer-lapplication)
10. [Premiers pas et vérifications](#10-premiers-pas-et-vérifications)
11. [Mettre à jour l'application](#11-mettre-à-jour-lapplication)
12. [Commandes utiles et dépannage](#12-commandes-utiles-et-dépannage)
13. [Sécurité : ce qui est en place](#13-sécurité--ce-qui-est-en-place)

---

## 1. Matériel

- **Raspberry Pi 5 ou 4** avec **2 Go de mémoire au moins** (4 Go donnent plus de marge), et son
  alimentation officielle (une alimentation trop faible provoque des plantages). En
  fonctionnement, l'application, la base et le tunnel utilisent moins de 1 Go.
- **Un SSD USB** (recommandé) ou une carte microSD de bonne qualité (A2, 32 Go ou plus). Une
  carte SD s'use : le SSD est nettement plus fiable pour une base de données.
- **Un second disque USB** (ou un NAS) pour les sauvegardes.
- Un câble Ethernet vers la box (plus stable que le Wi-Fi).

Toutes les images Docker utilisées existent en ARM64 : le système doit être en **64 bits**
(`uname -m` doit afficher `aarch64`).

## 2. Installer Raspberry Pi OS

1. Sur un ordinateur, installez [Raspberry Pi Imager](https://www.raspberrypi.com/software/).
2. Choisissez votre modèle, puis **Raspberry Pi OS Lite (64-bit)** (sans bureau : inutile pour
   un serveur), et le SSD ou la carte SD.
3. Dans les réglages (« Modifier les réglages ») :
   - nom d'hôte : `devra` (le Raspberry Pi sera joignable sous `devra.local`) ;
   - un nom d'utilisateur et un mot de passe solide ;
   - fuseau horaire **Europe/Zurich**, clavier suisse ;
   - onglet Services : **activer SSH** (de préférence avec une clé publique).
4. Écrivez l'image, branchez le disque sur le Raspberry Pi, l'Ethernet, puis l'alimentation.

Depuis votre ordinateur :

```bash
ssh votre-utilisateur@devra.local
```

Dans l'interface de votre box, **réservez une adresse IP fixe** au Raspberry Pi (réservation
DHCP) : c'est indispensable pour l'option Caddy, et pratique dans tous les cas.

## 3. Préparer le système

```bash
# Mises à jour
sudo apt update && sudo apt full-upgrade -y

# Mises à jour de sécurité automatiques
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades   # répondre « Oui »

# Fuseau horaire (si ce n'est pas déjà fait)
sudo timedatectl set-timezone Europe/Zurich

# Outils utilisés plus loin
sudo apt install -y git ufw
```

**Mémoire d'échange** (marge de sécurité, surtout sur un modèle 2 Go) : vérifiez avec
`free -h` que la ligne « Swap » indique **1 Go ou plus**. Raspberry Pi OS Trixie (2025 et
suivants) la règle tout seul. Sur Raspberry Pi OS Bookworm, si elle est plus petite :

```bash
sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=1024/' /etc/dphys-swapfile
sudo systemctl restart dphys-swapfile
free -h   # la ligne « Swap » doit indiquer 1,0Gi
```

**Pare-feu** : seul SSH est ouvert (ajoutez 80 et 443 seulement avec l'option Caddy, plus bas).

```bash
sudo ufw allow OpenSSH
sudo ufw enable
```

> Docker ajoute ses propres règles : les ports publiés par Docker contournent ufw. C'est
> pourquoi l'application n'est publiée que sur `127.0.0.1` (le Raspberry Pi lui-même), et la
> base de données nulle part.

## 4. Installer Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
exit   # puis reconnectez-vous en SSH pour que le groupe « docker » soit pris en compte
```

Vérification :

```bash
docker run --rm hello-world
docker compose version
```

## 5. Disque des sauvegardes

Branchez le disque USB des sauvegardes, puis repérez-le (ici `/dev/sda1`) :

```bash
lsblk -f
```

Si le disque est neuf, formatez-le en ext4 (**efface son contenu**) :

```bash
sudo mkfs.ext4 -L sauvegardes /dev/sda1
```

Montez-le automatiquement sur `/mnt/sauvegardes` à chaque démarrage :

```bash
sudo mkdir -p /mnt/sauvegardes
echo "LABEL=sauvegardes /mnt/sauvegardes ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab
sudo mount -a
sudo mkdir -p /mnt/sauvegardes/devra
df -h /mnt/sauvegardes
```

(`nofail` : le Raspberry Pi démarre même si le disque est débranché.)

## 6. Récupérer l'application

Le Raspberry Pi a besoin de deux choses, toutes deux privées sur GitHub : le **dépôt** (fichiers
de configuration et documentation) et les **images Docker** de l'application. Il faut donc deux
jetons d'accès en lecture seule, à créer sur GitHub → Settings → Developer settings → Personal
access tokens (notez leur date d'expiration : il faudra les renouveler).

**1. Le dépôt.** Jeton **Fine-grained token**, limité au dépôt `Outils`, permission
« Contents : Read-only ». Puis :

```bash
cd ~
git clone -b main https://github.com/firstnext18-jpg/Outils.git
# Nom d'utilisateur : votre compte GitHub ; mot de passe : le jeton
cd ~/Outils/devra-gestion
```

(`-b main` est important : c'est la branche qui contient la version à installer.)

**2. Les images.** GitHub Actions construit les images pour Raspberry Pi à chaque mise à jour de
`main` (environ 20 minutes ; suivi dans l'onglet **Actions** du dépôt, flux « Images
Docker ») et les publie dans GitHub Container Registry (`ghcr.io`). Vérifiez dans l'onglet Actions
que la dernière exécution est **verte**, puis créez un jeton **Tokens (classic)** avec la seule
permission **`read:packages`** (GitHub n'accepte pas encore les jetons « fine-grained » pour les
images). Sur le Raspberry Pi :

```bash
docker login ghcr.io -u firstnext18-jpg
# Mot de passe : le jeton « read:packages »
```

Docker le mémorise (`~/.docker/config.json`) : à refaire seulement quand le jeton expire.

## 7. Configurer le fichier .env

```bash
cp .env.example .env
chmod 600 .env        # lisible par vous seul : il contient les secrets
nano .env
```

Chaque variable est expliquée dans le fichier. À renseigner au minimum :

| Variable                                                                           | Valeur                                                                      |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `APP_URL`                                                                          | `https://gestion.devra.ch`                                                  |
| `BETTER_AUTH_SECRET`                                                               | `openssl rand -base64 32`                                                   |
| `POSTGRES_PASSWORD`                                                                | `openssl rand -hex 24` (lettres et chiffres uniquement)                     |
| `CRON_SECRET`                                                                      | `openssl rand -base64 32`                                                   |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | serveur d'envoi (ex. Infomaniak : `mail.infomaniak.com`, `465`, `true`)     |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`                                      | le premier compte administrateur                                            |
| `BACKUP_DIR`                                                                       | `/mnt/sauvegardes/devra`                                                    |
| `IMAGE_REGISTRY`                                                                   | `ghcr.io/firstnext18-jpg` (images construites par GitHub)                   |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`                                            | notifications des discussions : voir section 10, après le premier lancement |
| `AUTH_IP_HEADER`, `COMPOSE_FILE` et la suite                                       | selon l'option HTTPS choisie (section suivante)                             |

Pour générer les secrets :

```bash
openssl rand -base64 32
openssl rand -hex 24
```

`DATABASE_URL` et `DATA_DIR` n'ont pas besoin d'être modifiés : Docker Compose les règle.

Gardez une copie du fichier `.env` en lieu sûr (gestionnaire de mots de passe) : il n'est pas
dans les sauvegardes.

## 8. Accès HTTPS : Cloudflare Tunnel ou Caddy

Choisissez **une** des deux options.

### Option A — Cloudflare Tunnel (recommandée)

Aucun port à ouvrir sur la box, adresse IP de la maison cachée, protection de Cloudflare.
Condition : les DNS du domaine `devra.ch` sont gérés par Cloudflare (offre gratuite ; si le
domaine est chez Infomaniak, on peut y remplacer les serveurs de noms par ceux de Cloudflare).

1. Dans le tableau de bord Cloudflare : **Zero Trust → Networks → Tunnels → Create a tunnel**,
   type **Cloudflared**, nom `devra-gestion`.
2. À l'étape d'installation, copiez le **jeton** (la longue chaîne après `--token`). Inutile
   d'installer quoi que ce soit : le conteneur `cloudflared` s'en charge.
3. Étape « Public Hostname » : sous-domaine `gestion`, domaine `devra.ch`, service **HTTP**,
   URL **`app:3000`**.
4. Dans Cloudflare, **SSL/TLS → Edge Certificates → Always Use HTTPS : activé**.
5. Dans `.env` :

   ```bash
   COMPOSE_FILE=compose.yaml:compose.cloudflare.yaml
   CLOUDFLARE_TUNNEL_TOKEN=eyJ…            # le jeton copié
   AUTH_IP_HEADER=cf-connecting-ip
   ```

### Option B — Caddy (le Raspberry Pi reçoit directement le trafic)

Caddy obtient et renouvelle seul le certificat HTTPS (Let's Encrypt).

1. Chez le gestionnaire du domaine (ex. Infomaniak), créez un enregistrement **A** :
   `gestion.devra.ch` → l'adresse IP publique de la box (<https://ifconfig.me>). Si cette
   adresse change de temps en temps, utilisez le DynDNS proposé par le gestionnaire du domaine
   ou par la box.
2. Dans la box, **redirigez les ports 80 et 443 (TCP, et 443 UDP)** vers l'adresse IP fixe du
   Raspberry Pi.
3. Ouvrez ces ports dans le pare-feu du Raspberry Pi :

   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443
   ```

4. Dans `.env` :

   ```bash
   COMPOSE_FILE=compose.yaml:compose.caddy.yaml
   DOMAIN=gestion.devra.ch
   ACME_EMAIL=admin@devra.ch                # avertissements de Let's Encrypt
   AUTH_IP_HEADER=x-forwarded-for
   ```

> `AUTH_IP_HEADER` doit correspondre à l'option choisie : c'est l'en-tête qui donne la vraie
> adresse IP des visiteurs (limitation des tentatives de connexion, acceptation des devis en
> ligne). Une mauvaise valeur permettrait de contourner la limitation.

## 9. Lancer l'application

```bash
cd ~/Outils/devra-gestion
docker compose pull              # télécharge les images (quelques minutes la première fois)
docker compose up -d --no-build  # démarre tout
```

`--no-build` garantit que rien n'est construit sur le Raspberry Pi : s'il manque une image, la
commande s'arrête avec un message d'erreur au lieu de lancer une construction trop lourde.

Les services démarrent dans l'ordre :

| Service                  | Rôle                                                                 |
| ------------------------ | -------------------------------------------------------------------- |
| `db`                     | PostgreSQL (données dans le volume `db-data`)                        |
| `migrate`                | met la base à jour et crée le premier administrateur, puis s'arrête  |
| `app`                    | l'application, sur `127.0.0.1:3000`                                  |
| `cron`                   | tâches quotidiennes (devis expirés, factures d'abonnement, relances) |
| `backup`                 | sauvegardes quotidiennes (voir [SAUVEGARDES.md](SAUVEGARDES.md))     |
| `cloudflared` ou `caddy` | accès HTTPS depuis Internet                                          |

Vérifiez :

```bash
docker compose ps                 # « app » doit être « healthy »
docker compose logs -f app        # Ctrl+C pour quitter
curl -I http://127.0.0.1:3000/connexion
```

Tous les services redémarrent seuls après une coupure de courant (`restart: unless-stopped`).

## 10. Premiers pas et vérifications

1. Ouvrez **https://gestion.devra.ch** et connectez-vous avec `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
2. Choisissez votre mot de passe personnel : déconnectez-vous, cliquez sur **« Mot de passe
   oublié ? »** et suivez le lien reçu par email (cela vérifie aussi l'envoi des emails). Videz
   ensuite `ADMIN_PASSWORD` dans `.env`.
3. **Paramètres → Entreprise** : nom, adresse, email, téléphone, IBAN ou QR-IBAN, logo.
4. **Paramètres → Facturation** : numérotation, délais, TVA, acceptation des devis en ligne.
5. **Paramètres → Utilisateurs** : invitez les associés (rôle Admin, Membre ou Lecture seule).
6. **Paramètres → Tâches** : une exécution « automatique » apparaît peu après le démarrage
   (conteneur `cron`).
7. Sauvegardes : lancez-en une et vérifiez-la.

   ```bash
   docker compose exec backup backup.sh maintenant
   docker compose run --rm restore --test
   ```

8. Faites un devis de test et envoyez-le-vous par email, puis une facture : scannez la
   QR-facture avec l'application de votre banque (sans valider le paiement).
9. **Notifications des discussions** (facultatif) : créez les clés, puis redémarrez :

   ```bash
   docker compose run --rm --no-deps app node docker/vapid-keys.mjs >> .env
   docker compose up -d --no-build
   ```

   Chaque utilisateur les active ensuite sur ses appareils : menu utilisateur → « Activer les
   notifications ». Ne régénérez pas ces clés par la suite (chaque appareil devrait les
   réactiver).

## 11. Mettre à jour l'application

Une fois la nouvelle version fusionnée dans `main`, attendez que la construction GitHub soit
terminée (onglet **Actions**, flux « Images Docker » en vert), puis :

```bash
cd ~/Outils
git pull
cd devra-gestion
docker compose exec backup backup.sh maintenant   # sauvegarde avant la mise à jour
docker compose pull                                # télécharge les nouvelles images
docker compose up -d --no-build                    # redémarre avec la nouvelle version
docker image prune -f                              # libère la place des anciennes images
```

Les migrations de la base sont appliquées automatiquement (service `migrate`).

**Revenir à la version précédente** en cas de problème : chaque construction publie aussi les
images sous le nom de sa version, `sha-` suivi des 7 premiers caractères du commit (visible dans
l'onglet Actions ou avec `git log --oneline`). Dans `.env`, indiquez par exemple
`IMAGE_TAG=sha-1a2b3c4`, puis relancez `docker compose pull` et `docker compose up -d --no-build`
(revenez ensuite à `IMAGE_TAG=latest`, ou supprimez la ligne). Si nécessaire, restaurez la
sauvegarde faite juste avant ([SAUVEGARDES.md](SAUVEGARDES.md)).

Pensez aussi à mettre à jour le système de temps en temps : `sudo apt update && sudo apt full-upgrade -y`,
puis `sudo reboot`.

## 12. Commandes utiles et dépannage

```bash
docker compose ps                         # état des services
docker compose logs --tail 100 app        # journal de l'application
docker compose logs --tail 50 cron backup # tâches quotidiennes et sauvegardes
docker compose restart app                # redémarrer l'application
docker compose down                       # tout arrêter (les données sont conservées)
docker compose up -d --no-build           # tout redémarrer
df -h / /mnt/sauvegardes                  # place disque
```

| Problème                                               | Piste                                                                                                                                                                                           |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docker compose pull` : « denied » ou « unauthorized » | Connexion à `ghcr.io` absente ou jeton expiré : `docker login ghcr.io` (section 6). `IMAGE_REGISTRY` exact dans `.env` ? Ne suivez pas le conseil « docker compose build » qui s'affiche alors. |
| « manifest unknown » / « no matching manifest »        | La construction GitHub n'est pas terminée ou a échoué (onglet Actions) ; le système doit être en 64 bits (`uname -m`).                                                                          |
| Une construction démarre sur le Raspberry Pi           | `IMAGE_REGISTRY` manque dans `.env` : arrêtez (Ctrl+C), complétez `.env`, puis utilisez `--no-build` (section 9).                                                                               |
| `docker compose up` refuse : « … manquant dans .env »  | La variable indiquée est obligatoire : complétez `.env`.                                                                                                                                        |
| Erreur 502 / 1033 (Cloudflare)                         | L'application ne tourne pas (`docker compose ps`), ou l'URL du tunnel n'est pas `app:3000`.                                                                                                     |
| Certificat refusé (Caddy)                              | L'enregistrement DNS ne pointe pas vers la box, ou les ports 80/443 ne sont pas redirigés : `docker compose logs caddy`.                                                                        |
| Les emails ne partent pas                              | Réglages `SMTP_*` ; le message d'erreur du serveur figure dans l'historique des envois du document.                                                                                             |
| Connexion impossible malgré le bon mot de passe        | Trop d'essais : attendre une minute. `APP_URL` doit être exactement l'adresse utilisée dans le navigateur (`https://…`).                                                                        |
| Heures décalées                                        | `timedatectl` doit indiquer Europe/Zurich.                                                                                                                                                      |
| Sauvegarde en échec                                    | `docker compose logs backup` ; disque des sauvegardes monté (`df -h /mnt/sauvegardes`) ?                                                                                                        |

## 13. Sécurité : ce qui est en place

- **HTTPS obligatoire** : Cloudflare (« Always Use HTTPS ») ou Caddy redirigent HTTP vers HTTPS ;
  l'application demande au navigateur de n'utiliser que HTTPS (HSTS) et ses cookies de session
  ne circulent qu'en HTTPS (`Secure`, `HttpOnly`, `SameSite=Lax`).
- **Rien d'exposé directement** : l'application n'écoute que sur le Raspberry Pi
  (`127.0.0.1:3000`), la base de données n'est accessible qu'aux conteneurs.
- **Connexion** : mots de passe hachés (Argon2), 5 tentatives par minute et par adresse IP,
  liens d'invitation et de réinitialisation à usage unique et limités dans le temps.
- **Droits vérifiés côté serveur** à chaque action (Admin, Membre, Lecture seule) ; toutes les
  entrées validées (Zod) ; requêtes en base via Prisma uniquement ; protection CSRF (vérification
  de l'origine des requêtes).
- **En-têtes de sécurité** : politique de contenu (CSP) limitée à l'application, pas
  d'intégration dans un cadre, pas de détection de type de contenu.
- **Secrets** dans `.env` uniquement (`chmod 600`), jamais dans le code ni dans Git.
- **Sauvegardes** quotidiennes, lisibles par le seul administrateur, copiables (chiffrées) hors
  du Raspberry Pi.
- **Mises à jour de sécurité** du système automatiques ; SSH par clé recommandé.
