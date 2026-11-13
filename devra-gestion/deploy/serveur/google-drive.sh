#!/bin/bash
#
# Copie chiffrée des sauvegardes vers Google Drive, à lancer UNE FOIS par
# l'administrateur, en root, sur le serveur où tourne Devra Gestion :
#   sudo bash deploy/serveur/google-drive.sh
#
# - demande l'autorisation Google Drive obtenue sur votre ordinateur avec rclone ;
# - génère deux phrases secrètes de chiffrement (affichées UNE SEULE FOIS) ;
# - écrit la configuration dans /opt/devra-gestion/.env (BACKUP_REMOTE et
#   RCLONE_CONFIG_*), vérifie l'accès, puis lance une première sauvegarde.
#
# Les fichiers sont chiffrés sur le serveur avant d'être envoyés : Google ne voit
# que des noms et des contenus illisibles. Accès limité aux fichiers créés par
# la sauvegarde (rien d'autre dans votre Drive n'est lisible).
# Voir docs/SAUVEGARDES.md.
set -euo pipefail
umask 077

DIR=/opt/devra-gestion
FOLDER=sauvegardes-gestion

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() {
  echo "Erreur : $*" >&2
  exit 1
}
yes_no() { # yes_no "Question" o|n (défaut)
  local answer
  read -r -p "$1 [$([ "$2" = o ] && echo O/n || echo o/N)] : " answer || answer=
  answer=${answer:-$2}
  [[ $answer =~ ^[oOyY] ]]
}

[ "$(id -u)" -eq 0 ] || die "lancez ce script en root : sudo bash $0"
[ -f "$DIR/.env" ] || die "$DIR/.env absent : installez d'abord l'application (installer.sh)"
command -v docker >/dev/null || die "Docker n'est pas installé"
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

say "Copie chiffrée des sauvegardes vers Google Drive"

current=$(env_value BACKUP_REMOTE)
if [ -n "$current" ] && ! yes_no "Une copie distante est déjà configurée ($current). La remplacer par Google Drive ?" n; then
  echo "Rien n'a été modifié."
  exit 0
fi

cat <<'EOF'

Étape 1 — sur VOTRE ordinateur (Windows ou Mac), avec un navigateur :

  1. Téléchargez rclone : https://rclone.org/downloads/ (Windows : « Intel/AMD - 64 Bit »,
     décompressez le zip ; Mac : « macOS »). Rien à installer.
  2. Ouvrez un terminal dans le dossier de rclone (Windows : clic droit dans le dossier →
     « Ouvrir dans le terminal ») et tapez :

       Windows :  .\rclone.exe authorize "drive" "eyJzY29wZSI6ImRyaXZlLmZpbGUifQ"
       Mac :      ./rclone authorize "drive" "eyJzY29wZSI6ImRyaXZlLmZpbGUifQ"

  3. Le navigateur s'ouvre : choisissez le compte Google, puis « Autoriser ».
  4. Le terminal affiche un long texte entre « Paste the following into your remote
     machine ---> » et « <---End paste ». Copiez ce texte (sans les flèches).

EOF
read -r -p "Collez ici le texte affiché par rclone : " pasted || die "réponse manquante"
pasted=$(printf '%s' "$pasted" | tr -d '[:space:]')
[ -n "$pasted" ] || die "texte vide"

# Le texte est soit le jeton (JSON), soit un bloc base64 qui le contient : lu avec
# Node dans l'image de l'application (aucun outil à installer sur le serveur).
token=$(printf '%s' "$pasted" | docker compose run --rm --no-deps -T --entrypoint node cron -e '
  let input = "";
  process.stdin.on("data", (c) => (input += c)).on("end", () => {
    try {
      let token = input.trim();
      if (!token.startsWith("{")) {
        const blob = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
        token = blob.token;
      }
      const parsed = JSON.parse(token);
      if (!parsed.refresh_token) throw new Error("refresh_token absent");
      process.stdout.write(JSON.stringify(parsed));
    } catch {
      process.exit(1);
    }
  });') || die "texte non reconnu : copiez tout le texte affiché entre les deux flèches"
[[ $token != *"'"* ]] || die "texte non reconnu"

say "Chiffrement"
# Réinstallation : les sauvegardes déjà sur Google Drive restent lisibles avec les mêmes phrases.
existing=false
if yes_no "Réinstallation : des sauvegardes chiffrées existent déjà sur ce Google Drive et vous avez leurs deux phrases secrètes ?" n; then
  existing=true
  read -r -s -p "Phrase 1 (saisie masquée) : " pass1 || die "réponse manquante"
  echo
  read -r -s -p "Phrase 2 (saisie masquée) : " pass2 || die "réponse manquante"
  echo
  [ -n "$pass1" ] && [ -n "$pass2" ] || die "les deux phrases sont obligatoires"
else
  pass1=$(openssl rand -base64 24 | tr -d '/+=')
  pass2=$(openssl rand -base64 24 | tr -d '/+=')
fi
obscure() { docker compose run --rm --no-deps -T --entrypoint rclone backup obscure "$1"; }
obscured1=$(obscure "$pass1")
obscured2=$(obscure "$pass2")

cp -p .env ".env.avant-google-drive"
set_env RCLONE_CONFIG_GOOGLE_TYPE drive
set_env RCLONE_CONFIG_GOOGLE_SCOPE drive.file
set_env RCLONE_CONFIG_GOOGLE_TOKEN "$token"
set_env RCLONE_CONFIG_GOOGLECHIFFRE_TYPE crypt
set_env RCLONE_CONFIG_GOOGLECHIFFRE_REMOTE "google:$FOLDER"
set_env RCLONE_CONFIG_GOOGLECHIFFRE_PASSWORD "$obscured1"
set_env RCLONE_CONFIG_GOOGLECHIFFRE_PASSWORD2 "$obscured2"
set_env BACKUP_REMOTE "googlechiffre:"

say "Vérification de l'accès à Google Drive"
if ! docker compose run --rm --no-deps -T --entrypoint rclone backup mkdir "google:$FOLDER"; then
  mv ".env.avant-google-drive" .env
  die "accès refusé par Google : configuration annulée (.env restauré). Recommencez l'étape 1."
fi
echo "Accès vérifié : dossier « $FOLDER » dans votre Google Drive."

if $existing; then
  unset pass1 pass2
  rm -f ".env.avant-google-drive"
  docker compose up -d backup
  say "Récupération des sauvegardes depuis Google Drive"
  echo "Copie (déchiffrée) dans le dossier des sauvegardes du serveur…"
  docker compose run --rm --no-deps -T --entrypoint rclone backup copy googlechiffre: /backups \
    --include "base/*.dump" --include "fichiers/*.tar.gz"
  docker compose run --rm -T restore
  echo
  echo "Pour restaurer la dernière sauvegarde (voir docs/SAUVEGARDES.md) :"
  echo "  cd $DIR && docker compose stop app cron && docker compose run --rm restore derniere && docker compose up -d"
  exit 0
fi

cat <<EOF

╔══════════════════════════════════════════════════════════════════════════╗
  PHRASES SECRÈTES DE CHIFFREMENT — affichées une seule fois

    Phrase 1 : $pass1
    Phrase 2 : $pass2

  Notez-les MAINTENANT dans un gestionnaire de mots de passe (hors du serveur).
  Sans elles, les sauvegardes sur Google Drive sont illisibles si le serveur
  est perdu. Voir « Restaurer depuis Google Drive » dans docs/SAUVEGARDES.md.
╚══════════════════════════════════════════════════════════════════════════╝

EOF
confirm=
while [ "$confirm" != "NOTÉ" ] && [ "$confirm" != "NOTE" ]; do
  read -r -p "Tapez NOTÉ quand les deux phrases sont notées : " confirm || break
done
unset pass1 pass2
rm -f ".env.avant-google-drive"

say "Première sauvegarde"
docker compose up -d backup
sleep 5
docker compose exec -T backup backup.sh maintenant
echo
echo "Fichiers sur Google Drive (noms et contenus chiffrés) :"
docker compose run --rm --no-deps -T --entrypoint rclone backup ls "google:$FOLDER" | head -n 10

say "Terminé."
echo "Chaque nuit, la sauvegarde est copiée (chiffrée) dans le dossier « $FOLDER » de votre"
echo "Google Drive ; les copies de plus de $(env_value BACKUP_RETENTION_DAYS | grep . || echo 30) jours sont supprimées."
echo "État : sudo /usr/local/sbin/claude-devra status (ligne « Dernière sauvegarde »)."
