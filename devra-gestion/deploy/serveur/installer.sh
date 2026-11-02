#!/bin/bash
#
# Installation de Devra Gestion sur un serveur Linux (Docker), à lancer UNE FOIS
# par l'administrateur, en root :
#   sudo bash deploy/serveur/installer.sh
#
# - copie les fichiers Docker Compose dans /opt/devra-gestion (lisible par root seul) ;
# - crée le fichier .env : secrets générés automatiquement, puis quelques questions
#   (adresse, accès HTTPS, emails, premier administrateur, sauvegardes) ;
# - connecte Docker au registre des images (jeton GitHub « read:packages ») ;
# - installe /usr/local/sbin/claude-devra et l'autorise (sudo) au compte de l'agent ;
# - démarre l'application.
#
# Relancer le script après une mise à jour des fichiers compose : le .env existant
# est conservé. Voir docs/DEPLOIEMENT_SERVEUR.md.
set -euo pipefail
umask 077

DIR=/opt/devra-gestion
WRAPPER=/usr/local/sbin/claude-devra
SUDOERS=/etc/sudoers.d/claude-devra
KIT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() {
  echo "Erreur : $*" >&2
  exit 1
}

# ask VARIABLE "Question" [valeur par défaut] : réponse obligatoire, sans apostrophe.
ask() {
  local answer
  while true; do
    read -r -p "$2${3:+ [$3]} : " answer || die "réponse manquante"
    answer=${answer:-${3:-}}
    if [ -z "$answer" ]; then
      echo "  Réponse obligatoire."
    elif [[ $answer == *"'"* ]]; then
      echo "  L'apostrophe (') n'est pas acceptée."
    else
      printf -v "$1" '%s' "$answer"
      return
    fi
  done
}

# ask_secret VARIABLE "Question" : saisie masquée, peut rester vide.
ask_secret() {
  local answer
  while true; do
    read -r -s -p "$2 : " answer || die "réponse manquante"
    echo
    if [[ $answer == *"'"* ]]; then
      echo "  L'apostrophe (') n'est pas acceptée."
    else
      printf -v "$1" '%s' "$answer"
      return
    fi
  done
}

yes_no() { # yes_no "Question" o|n (défaut)
  local answer
  read -r -p "$1 [$([ "$2" = o ] && echo O/n || echo o/N)] : " answer || answer=
  answer=${answer:-$2}
  [[ $answer =~ ^[oOyY] ]]
}

# --- Vérifications ------------------------------------------------------------
[ "$(id -u)" -eq 0 ] || die "lancez ce script en root : sudo bash $0"
for file in compose.yaml compose.cloudflare.yaml .env.example deploy/serveur/claude-devra; do
  [ -f "$KIT/$file" ] || die "fichier manquant : $KIT/$file (copiez tout le kit, voir docs/DEPLOIEMENT_SERVEUR.md)"
done
case "$(uname -m)" in
  x86_64 | aarch64) ;;
  *) die "architecture $(uname -m) non prise en charge (x86_64 ou aarch64 / 64 bits requis)" ;;
esac
command -v docker >/dev/null || die "Docker n'est pas installé. Installez-le puis relancez ce script :
  curl -fsSL https://get.docker.com | sh"
docker compose version >/dev/null 2>&1 || die "le module « docker compose » manque (paquet docker-compose-plugin)"
for tool in curl openssl visudo; do
  command -v "$tool" >/dev/null || die "commande manquante : $tool"
done

say "Devra Gestion — installation dans $DIR"

# --- Fichiers Docker Compose --------------------------------------------------
install -d -m 700 -o root -g root "$DIR"
install -m 644 -o root -g root "$KIT/compose.yaml" "$KIT/compose.cloudflare.yaml" "$KIT/.env.example" "$DIR/"
echo "Fichiers compose copiés."

# --- Configuration (.env) -----------------------------------------------------
NEW_ENV=false
ADMIN_TEMP_PASSWORD=
if [ -f "$DIR/.env" ]; then
  echo "Configuration existante conservée : $DIR/.env"
else
  NEW_ENV=true
  say "Configuration (les secrets sont générés automatiquement)"
  declare -A VALUES

  ask 'VALUES[APP_URL]' "Adresse publique de l'application (ex. https://gestion.devra.ch)"
  VALUES[APP_URL]=${VALUES[APP_URL]%/}
  [[ ${VALUES[APP_URL]} =~ ^https?://[^/[:space:]]+$ ]] || die "adresse invalide : ${VALUES[APP_URL]}"

  echo
  echo "Accès HTTPS depuis Internet :"
  echo "  1) nouveau tunnel Cloudflare dédié à l'application (recommandé, jeton du tunnel requis)"
  echo "  2) tunnel Cloudflare déjà installé sur ce serveur (il pointera vers http://localhost:<port>)"
  echo "  3) autre reverse proxy sur ce serveur (nginx, Caddy…)"
  ask HTTPS_MODE "Choix" 1
  case $HTTPS_MODE in
    1)
      VALUES[COMPOSE_FILE]=compose.yaml:compose.cloudflare.yaml
      VALUES[AUTH_IP_HEADER]=cf-connecting-ip
      ask_secret 'VALUES[CLOUDFLARE_TUNNEL_TOKEN]' "Jeton du tunnel Cloudflare (saisie masquée)"
      [ -n "${VALUES[CLOUDFLARE_TUNNEL_TOKEN]}" ] || die "jeton du tunnel requis pour ce choix"
      ;;
    2)
      VALUES[COMPOSE_FILE]=compose.yaml
      VALUES[AUTH_IP_HEADER]=cf-connecting-ip
      ;;
    3)
      VALUES[COMPOSE_FILE]=compose.yaml
      VALUES[AUTH_IP_HEADER]=x-forwarded-for
      echo "  Le reverse proxy doit REMPLACER l'en-tête X-Forwarded-For par l'adresse du visiteur"
      echo "  (nginx : proxy_set_header X-Forwarded-For \$remote_addr;), jamais le compléter."
      ;;
    *) die "choix invalide : $HTTPS_MODE" ;;
  esac

  port=3000
  while command -v ss >/dev/null && ss -ltnH "sport = :$port" | grep -q .; do port=$((port + 1)); done
  ask 'VALUES[APP_PORT]' "Port local de l'application (127.0.0.1 seulement)" "$port"
  [[ ${VALUES[APP_PORT]} =~ ^[0-9]{2,5}$ ]] || die "port invalide : ${VALUES[APP_PORT]}"

  ask 'VALUES[IMAGE_REGISTRY]' "Registre des images (ex. ghcr.io/votre-compte-github)"
  VALUES[IMAGE_REGISTRY]=$(printf '%s' "${VALUES[IMAGE_REGISTRY]%/}" | tr '[:upper:]' '[:lower:]')
  VALUES[IMAGE_TAG]=latest

  say "Envoi des emails (SMTP)"
  ask 'VALUES[SMTP_HOST]' "Serveur SMTP (ex. mail.infomaniak.com)"
  ask 'VALUES[SMTP_PORT]' "Port" 465
  ask 'VALUES[SMTP_SECURE]' "TLS direct (true pour le port 465, false pour 587)" \
    "$([ "${VALUES[SMTP_PORT]}" = 465 ] && echo true || echo false)"
  read -r -p "Utilisateur SMTP (vide si aucun) : " 'VALUES[SMTP_USER]' || true
  [[ ${VALUES[SMTP_USER]} != *"'"* ]] || die "l'apostrophe (') n'est pas acceptée"
  ask_secret 'VALUES[SMTP_PASSWORD]' "Mot de passe SMTP (saisie masquée)"
  ask 'VALUES[SMTP_FROM]' "Expéditeur (ex. Devra <facturation@devra.ch>)"

  say "Premier administrateur (mot de passe provisoire généré)"
  ask 'VALUES[ADMIN_NAME]' "Nom"
  ask 'VALUES[ADMIN_EMAIL]' "Email"
  ADMIN_TEMP_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)
  VALUES[ADMIN_PASSWORD]=$ADMIN_TEMP_PASSWORD

  say "Sauvegardes"
  ask 'VALUES[BACKUP_DIR]' "Dossier des sauvegardes (de préférence sur un autre disque)" /var/backups/devra-gestion

  VALUES[BETTER_AUTH_SECRET]=$(openssl rand -base64 32)
  VALUES[POSTGRES_PASSWORD]=$(openssl rand -hex 24)
  VALUES[CRON_SECRET]=$(openssl rand -base64 32)
  VALUES[AUTH_RATE_LIMIT]=true

  # .env = .env.example avec ces valeurs (entre apostrophes : pris tels quels par Docker Compose).
  tmp=$(mktemp "$DIR/.env.XXXXXX")
  declare -A WRITTEN
  while IFS= read -r line || [ -n "$line" ]; do
    key=${line%%=*}
    if [[ $line =~ ^[A-Z_][A-Z0-9_]*= ]] && [ -n "${VALUES[$key]+x}" ]; then
      printf "%s='%s'\n" "$key" "${VALUES[$key]}"
      WRITTEN[$key]=1
    else
      printf '%s\n' "$line"
    fi
  done <"$KIT/.env.example" >"$tmp"
  for key in "${!VALUES[@]}"; do
    [ -n "${WRITTEN[$key]+x}" ] || printf "%s='%s'\n" "$key" "${VALUES[$key]}" >>"$tmp"
  done
  chmod 600 "$tmp"
  mv "$tmp" "$DIR/.env"
  echo "Configuration enregistrée : $DIR/.env (lisible par root seul)"

  backup_dir=${VALUES[BACKUP_DIR]}
  [[ $backup_dir == /* ]] || backup_dir="$DIR/$backup_dir"
  install -d -m 700 -o root -g root "$backup_dir"
fi

# --- Registre des images ------------------------------------------------------
registry=$(sed -n "s/^IMAGE_REGISTRY=//p" "$DIR/.env" | tail -n 1 | tr -d "'\"")
[ -n "$registry" ] || die "IMAGE_REGISTRY est vide dans $DIR/.env"
host=${registry%%/*}
if grep -qs "\"$host\"" /root/.docker/config.json && ! yes_no "Docker est déjà connecté à $host. Se reconnecter ?" n; then
  :
else
  say "Connexion à $host (téléchargement des images)"
  if [ "$host" = ghcr.io ]; then
    echo "Jeton GitHub « classic » avec la seule permission read:packages :"
    echo "GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)."
  fi
  ask registry_user "Nom d'utilisateur"
  ask_secret registry_token "Jeton (saisie masquée)"
  printf '%s' "$registry_token" | docker login "$host" -u "$registry_user" --password-stdin
  unset registry_token
fi

# --- Commande de l'agent ------------------------------------------------------
install -m 755 -o root -g root "$KIT/deploy/serveur/claude-devra" "$WRAPPER"
say "Compte de l'agent"
ask agent_user "Compte autorisé à lancer $WRAPPER avec sudo" claude
if id "$agent_user" >/dev/null 2>&1; then
  tmp=$(mktemp)
  printf '%s ALL=(root) NOPASSWD: %s\n' "$agent_user" "$WRAPPER" >"$tmp"
  visudo -cqf "$tmp" || die "règle sudo invalide"
  install -m 440 -o root -g root "$tmp" "$SUDOERS"
  rm -f "$tmp"
  echo "Autorisé : sudo $WRAPPER (compte $agent_user), et rien d'autre."
else
  echo "Compte $agent_user introuvable : règle sudo non installée (relancez le script plus tard)."
fi

# --- Démarrage ----------------------------------------------------------------
if yes_no "Télécharger les images et démarrer l'application maintenant ?" o; then
  "$WRAPPER" update latest
  if $NEW_ENV; then
    if (cd "$DIR" && docker compose logs migrate 2>/dev/null) | grep -q "Administrateur créé"; then
      # Le compte existe : le mot de passe provisoire n'a plus besoin de rester dans .env.
      sed -i "s/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=/" "$DIR/.env"
    else
      echo "Attention : administrateur non créé, voir : sudo $WRAPPER logs migrate"
    fi
  fi
fi

say "Terminé."
app_url=$(sed -n "s/^APP_URL=//p" "$DIR/.env" | tail -n 1 | tr -d "'\"")
app_port=$(sed -n "s/^APP_PORT=//p" "$DIR/.env" | tail -n 1 | tr -d "'\"")
echo "Application : $app_url (sur ce serveur : http://127.0.0.1:${app_port:-3000})"
if [ -n "$ADMIN_TEMP_PASSWORD" ]; then
  echo
  echo "Premier administrateur : $(sed -n "s/^ADMIN_EMAIL=//p" "$DIR/.env" | tr -d "'\"")"
  echo "Mot de passe provisoire (affiché une seule fois) : $ADMIN_TEMP_PASSWORD"
  echo "→ Connectez-vous, puis choisissez votre mot de passe avec « Mot de passe oublié ? »."
fi
echo
echo "L'agent pilote ensuite l'application avec : sudo $WRAPPER status | logs | update | backup | check-backup"
echo "Configuration : $DIR/.env (après modification : sudo $WRAPPER start)"
