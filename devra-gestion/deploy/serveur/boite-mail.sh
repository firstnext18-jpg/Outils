#!/bin/bash
#
# Section Mail : boîte où arrivent les réponses des clients (IMAP), à lancer
# par l'administrateur, en root, sur le serveur où tourne Devra Gestion :
#   sudo bash deploy/serveur/boite-mail.sh
#
# - demande l'adresse de la boîte et son mot de passe (Gmail : mot de passe
#   d'application) ;
# - écrit IMAP_HOST, IMAP_PORT, IMAP_SECURE, IMAP_USER et IMAP_PASSWORD dans
#   /opt/devra-gestion/.env (lisible par root seul) ;
# - redémarre l'application et lance une première relève pour vérifier.
# Voir docs/SECTION_MAIL.md.
set -euo pipefail
umask 077

DIR=/opt/devra-gestion

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() {
  echo "Erreur : $*" >&2
  exit 1
}

[ "$(id -u)" -eq 0 ] || die "lancez ce script en root : sudo bash $0"
[ -f "$DIR/.env" ] || die "$DIR/.env absent : installez d'abord l'application (installer.sh)"
command -v docker >/dev/null || die "Docker n'est pas installé"
command -v curl >/dev/null || die "commande manquante : curl"
cd "$DIR"

env_value() {
  sed -n "s/^$1=//p" .env | tail -n 1 | sed -e "s/^'\(.*\)'\$/\1/" -e 's/^"\(.*\)"$/\1/'
}

# Remplace (ou ajoute) une variable du fichier .env, entre apostrophes.
set_env() {
  local tmp
  tmp=$(mktemp "$DIR/.env.XXXXXX")
  grep -v "^$1=" .env >"$tmp" || true
  printf "%s='%s'\n" "$1" "$2" >>"$tmp"
  chmod 600 "$tmp"
  mv "$tmp" .env
}

say "Section Mail : boîte où arrivent les réponses des clients"
cat <<'TXT'

Pour Gmail, il faut un « mot de passe d'application » (pas le mot de passe du compte) :
  1. https://myaccount.google.com/security → activer la « Validation en deux étapes » ;
  2. https://myaccount.google.com/apppasswords → nom « Gestion » → Créer ;
  3. copier les 16 lettres affichées (les espaces ne comptent pas).

TXT
read -r -p "Adresse de la boîte (ex. contact@exemple.ch) : " address || die "réponse manquante"
address=$(printf '%s' "$address" | tr -d '[:space:]')
[[ $address =~ ^[^@]+@[^@]+\.[^@]+$ ]] || die "adresse invalide : $address"
default_host=imap.gmail.com
[[ $address == *@gmail.com || $address == *@googlemail.com ]] || default_host=""
read -r -p "Serveur IMAP${default_host:+ [$default_host]} : " host || true
host=${host:-$default_host}
[ -n "$host" ] || die "serveur IMAP manquant (ex. mail.infomaniak.com)"
read -r -s -p "Mot de passe (Gmail : mot de passe d'application, saisie masquée) : " password || die "réponse manquante"
echo
password=$(printf '%s' "$password" | tr -d '[:space:]')
[ -n "$password" ] || die "mot de passe manquant"
[[ $password != *"'"* ]] || die "l'apostrophe (') n'est pas acceptée"

cp -p .env ".env.avant-boite-mail"
set_env IMAP_HOST "$host"
set_env IMAP_PORT 993
set_env IMAP_SECURE true
set_env IMAP_USER "$address"
set_env IMAP_PASSWORD "$password"
unset password

say "Redémarrage de l'application"
docker compose up -d app cron
port=$(env_value APP_PORT)
port=${port:-3000}
for _ in $(seq 1 60); do
  curl -s -o /dev/null -m 5 "http://127.0.0.1:$port/connexion" && break
  sleep 2
done

say "Première relève"
secret=$(env_value CRON_SECRET)
result=$(curl -s -m 120 -X POST -H "Authorization: Bearer $secret" \
  "http://127.0.0.1:$port/api/taches/courriels" || true)
echo "$result"
if [[ $result == *'"ok":true'* ]]; then
  rm -f ".env.avant-boite-mail"
  say "Terminé."
  echo "Les emails des clients arrivés dans $address apparaissent dans la section Mail"
  echo "(relève toutes les 2 minutes). Les emails envoyés depuis l'outil ont cette adresse"
  echo "en « Répondre à »."
else
  mv ".env.avant-boite-mail" .env
  docker compose up -d app cron >/dev/null 2>&1 || true
  die "relève impossible (voir le message ci-dessus) : configuration annulée. Vérifiez l'adresse et le mot de passe d'application, puis relancez ce script."
fi
