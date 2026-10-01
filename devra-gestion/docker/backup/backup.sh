#!/bin/sh
#
# Sauvegardes automatiques de Devra Gestion.
#
#   backup.sh            chaque jour à BACKUP_TIME (heure de Zurich), et au
#                        démarrage si la sauvegarde du jour manque (rattrapage
#                        après une coupure du Raspberry Pi)
#   backup.sh maintenant une sauvegarde immédiate, puis s'arrête
#
# Chaque sauvegarde comprend :
#   base/devra_AAAA-MM-JJ_HHMM.dump              la base PostgreSQL (pg_dump, format « custom »)
#   fichiers/devra-fichiers_AAAA-MM-JJ_HHMM.tar.gz  logo et PDF archivés (DATA_DIR)
# Les sauvegardes de plus de BACKUP_RETENTION_DAYS jours sont supprimées. Si
# BACKUP_REMOTE est renseigné, elles sont aussi copiées hors du Raspberry Pi
# avec rclone (même durée de conservation).
#
# Connexion à la base : variables PGHOST, PGUSER, PGPASSWORD, PGDATABASE.
set -eu
umask 077 # données personnelles : lisibles par le seul compte root

ROOT=/backups
BACKUP_TIME="${BACKUP_TIME:-02:30}"
RETENTION="${BACKUP_RETENTION_DAYS:-30}"
REMOTE="${BACKUP_REMOTE:-}"
STATUS="$ROOT/derniere-sauvegarde.txt"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }

case "$BACKUP_TIME" in
  [0-2][0-9]:[0-5][0-9]) ;;
  *) log "BACKUP_TIME invalide : $BACKUP_TIME (format HH:MM attendu)"; exit 1 ;;
esac
case "$RETENTION" in
  '' | *[!0-9]*) log "BACKUP_RETENTION_DAYS invalide : $RETENTION"; exit 1 ;;
esac
if [ "$RETENTION" -lt 1 ]; then log "BACKUP_RETENTION_DAYS doit valoir au moins 1"; exit 1; fi

# « 07:05 » → 425 (minutes depuis minuit)
minutes() {
  h=${1%%:*}
  m=${1##*:}
  echo $((${h#0} * 60 + ${m#0}))
}

backup_once() {
  stamp=$(date +%Y-%m-%d_%H%M)
  mkdir -p "$ROOT/base" "$ROOT/fichiers"
  db="$ROOT/base/devra_$stamp.dump"
  files="$ROOT/fichiers/devra-fichiers_$stamp.tar.gz"

  log "Sauvegarde de la base $PGDATABASE…"
  pg_dump --format=custom --compress=6 --file="$db.tmp"
  # Le fichier doit être relisible par pg_restore avant d'être gardé.
  pg_restore --list "$db.tmp" > /dev/null
  mv "$db.tmp" "$db"

  log "Sauvegarde des fichiers (logo, PDF archivés)…"
  tar -czf "$files.tmp" -C /data --exclude=./.avant-restauration .
  mv "$files.tmp" "$files"

  # Rotation : ne garde que les RETENTION derniers jours.
  find "$ROOT/base" "$ROOT/fichiers" -type f -mtime +"$((RETENTION - 1))" -print -delete \
    | sed 's/^/Supprimée (plus de '"$RETENTION"' jours) : /'

  if [ -n "$REMOTE" ]; then
    log "Copie hors du Raspberry Pi vers $REMOTE…"
    # Configuration du stockage par variables RCLONE_CONFIG_* (pas de fichier rclone.conf).
    rclone copy "$ROOT" "$REMOTE" --log-level ERROR \
      --include "base/*.dump" --include "fichiers/*.tar.gz"
    # Jamais de « sync » : un disque local vide effacerait aussi les copies distantes.
    rclone delete "$REMOTE" --log-level ERROR --min-age "${RETENTION}d" \
      --include "base/*.dump" --include "fichiers/*.tar.gz"
  fi

  summary="$(date '+%Y-%m-%d %H:%M') OK · base $(du -h "$db" | cut -f1) · fichiers $(du -h "$files" | cut -f1)"
  [ -n "$REMOTE" ] && summary="$summary · copie vers $REMOTE"
  echo "$summary" > "$STATUS"
  log "Terminé : $summary"
}

# Une sauvegarde par processus : « set -e » y arrête tout à la première erreur
# (il serait ignoré dans la condition d'un « if »).
if [ "${1:-}" = "maintenant" ]; then
  trap 'code=$?
    if [ "$code" -ne 0 ]; then
      rm -f "$ROOT"/base/*.tmp "$ROOT"/fichiers/*.tmp
      echo "$(date "+%Y-%m-%d %H:%M") ÉCHEC (voir docker compose logs backup)" > "$STATUS"
      log "ÉCHEC de la sauvegarde"
    fi' EXIT
  backup_once
  exit 0
fi

log "Sauvegardes chaque jour à $BACKUP_TIME (heure de Zurich), conservées $RETENTION jours, dans $ROOT${REMOTE:+ et $REMOTE}."
target=$(minutes "$BACKUP_TIME")
retry_after=0
while :; do
  now=$(date +%s)
  today=$(date +%Y-%m-%d)
  if [ "$(minutes "$(date +%H:%M)")" -ge "$target" ] && [ "$now" -ge "$retry_after" ] \
    && ! ls "$ROOT/base/devra_${today}_"*.dump > /dev/null 2>&1; then
    # Après un échec, nouvel essai 30 minutes plus tard.
    "$0" maintenant || retry_after=$((now + 1800))
  fi
  sleep 60
done
