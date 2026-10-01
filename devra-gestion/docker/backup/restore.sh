#!/bin/sh
#
# Restauration d'une sauvegarde de Devra Gestion (voir docs/SAUVEGARDES.md).
#
#   docker compose run --rm restore
#       liste les sauvegardes disponibles
#   docker compose run --rm restore --test [derniere | <fichier.dump>]
#       vérifie une sauvegarde : la restaure dans une base temporaire, compte
#       les données, puis supprime cette base (sans toucher à l'application)
#   docker compose run --rm restore [--oui] derniere | <fichier.dump> [<fichiers.tar.gz>]
#       restaure la base (et les fichiers) ; arrêtez d'abord l'application
#       (docker compose stop app cron) pour ne perdre aucune saisie en cours
#
# La base actuelle n'est pas supprimée : elle est renommée
# <base>_avant_restauration (la précédente copie de ce nom est remplacée).
set -eu

ROOT=/backups
DB="$PGDATABASE"
CHECK_DB="${DB}_verification"
NEW_DB="${DB}_restauration"
OLD_DB="${DB}_avant_restauration"

log() { echo "$*"; }
fail() { echo "Erreur : $*" >&2; exit 1; }
sql() { psql --dbname=postgres --no-psqlrc --quiet --tuples-only --no-align -v ON_ERROR_STOP=1 -c "$1"; }

latest() { ls -1 "$ROOT/$1" 2> /dev/null | grep -v '\.tmp$' | sort | tail -n 1; }

# « derniere », un nom de fichier, ou un chemin complet → chemin du fichier.
resolve() {
  folder=$1
  name=$2
  if [ "$name" = "derniere" ]; then
    name=$(latest "$folder")
    [ -n "$name" ] || fail "aucune sauvegarde dans $ROOT/$folder"
  fi
  case "$name" in
    /*) path=$name ;;
    *) path="$ROOT/$folder/$name" ;;
  esac
  [ -f "$path" ] || fail "fichier introuvable : $path"
  echo "$path"
}

list() {
  echo "Sauvegardes de la base ($ROOT/base) :"
  ls -lh "$ROOT/base" 2> /dev/null | awk 'NR > 1 { print "  " $NF "  (" $5 ")" }'
  echo "Sauvegardes des fichiers ($ROOT/fichiers) :"
  ls -lh "$ROOT/fichiers" 2> /dev/null | awk 'NR > 1 { print "  " $NF "  (" $5 ")" }'
  [ -f "$ROOT/derniere-sauvegarde.txt" ] && echo "Dernière sauvegarde : $(cat "$ROOT/derniere-sauvegarde.txt")"
  return 0
}

restore_into() {
  target=$1
  dump=$2
  sql "DROP DATABASE IF EXISTS \"$target\" WITH (FORCE)"
  sql "CREATE DATABASE \"$target\""
  pg_restore --no-owner --exit-on-error --dbname="$target" "$dump"
}

counts() {
  psql --dbname="$1" --no-psqlrc --quiet -v ON_ERROR_STOP=1 -c "
    SELECT (SELECT count(*) FROM client) AS clients,
           (SELECT count(*) FROM quote) AS devis,
           (SELECT count(*) FROM invoice) AS factures,
           (SELECT count(*) FROM payment) AS paiements,
           (SELECT count(*) FROM \"user\") AS utilisateurs,
           (SELECT max(\"createdAt\") FROM activity_log) AS derniere_activite"
}

if [ $# -eq 0 ]; then
  list
  exit 0
fi

if [ "$1" = "--test" ]; then
  dump=$(resolve base "${2:-derniere}")
  log "Vérification de $(basename "$dump") dans une base temporaire…"
  restore_into "$CHECK_DB" "$dump"
  counts "$CHECK_DB"
  sql "DROP DATABASE \"$CHECK_DB\" WITH (FORCE)"
  archive=$(latest fichiers)
  if [ -n "$archive" ]; then
    tar -tzf "$ROOT/fichiers/$archive" > /dev/null
    log "Archive des fichiers lisible : $archive ($(tar -tzf "$ROOT/fichiers/$archive" | grep -c '\.pdf$') PDF)."
  fi
  log "Sauvegarde vérifiée : elle peut être restaurée."
  exit 0
fi

confirmed=no
if [ "$1" = "--oui" ]; then
  confirmed=yes
  shift
fi
[ $# -ge 1 ] || fail "indiquez la sauvegarde à restaurer (ou « derniere »)"
dump=$(resolve base "$1")
archive=""
if [ $# -ge 2 ]; then
  archive=$(resolve fichiers "$2")
elif [ "$1" = "derniere" ]; then
  name=$(latest fichiers)
  [ -n "$name" ] && archive="$ROOT/fichiers/$name"
fi

echo "Restauration de $(basename "$dump")${archive:+ et de $(basename "$archive")}."
echo "La base actuelle sera conservée sous le nom « $OLD_DB »."
echo "L'application doit être arrêtée : docker compose stop app cron"
if [ "$confirmed" != yes ]; then
  printf 'Tapez RESTAURER pour continuer : '
  read -r answer || answer=""
  [ "$answer" = "RESTAURER" ] || fail "restauration annulée"
fi

log "Restauration de la base dans « $NEW_DB »…"
restore_into "$NEW_DB" "$dump"
# Échange des noms une fois la restauration réussie : jamais de base vide entre les deux.
# Les connexions à la base actuelle sont bloquées puis coupées (si l'application
# tourne encore, elle se reconnecte ensuite à la base restaurée).
sql "DROP DATABASE IF EXISTS \"$OLD_DB\" WITH (FORCE)"
if [ "$(sql "SELECT count(*) FROM pg_database WHERE datname = '$DB'")" = "1" ]; then
  sql "ALTER DATABASE \"$DB\" WITH ALLOW_CONNECTIONS false"
  sql "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB' AND pid <> pg_backend_pid()" > /dev/null
  sql "ALTER DATABASE \"$DB\" RENAME TO \"$OLD_DB\""
  sql "ALTER DATABASE \"$OLD_DB\" WITH ALLOW_CONNECTIONS true"
fi
sql "ALTER DATABASE \"$NEW_DB\" RENAME TO \"$DB\""
counts "$DB"

if [ -n "$archive" ]; then
  log "Restauration des fichiers depuis $(basename "$archive")…"
  rm -rf /data/.avant-restauration
  mkdir -p /data/.avant-restauration
  find /data -mindepth 1 -maxdepth 1 ! -name .avant-restauration -exec mv {} /data/.avant-restauration/ \;
  tar -xzf "$archive" -C /data
  chown -R 1000:1000 /data # utilisateur « node » de l'application
fi

log "Restauration terminée. Redémarrez l'application : docker compose up -d"
