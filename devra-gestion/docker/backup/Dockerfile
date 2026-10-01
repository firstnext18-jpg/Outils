# syntax=docker/dockerfile:1
#
# Sauvegardes de Devra Gestion (services « backup » et « restore » de compose.yaml).
# Même version de PostgreSQL que la base : pg_dump et pg_restore compatibles.
# rclone copie les sauvegardes hors du Raspberry Pi (facultatif, voir docs/SAUVEGARDES.md).
# Compatible ARM64 (Raspberry Pi 4/5) et x86-64.

ARG POSTGRES_IMAGE=postgres:18-alpine
FROM ${POSTGRES_IMAGE}

RUN apk add --no-cache rclone tzdata

COPY backup.sh restore.sh /usr/local/bin/
RUN chmod 755 /usr/local/bin/backup.sh /usr/local/bin/restore.sh

ENV TZ=Europe/Zurich
WORKDIR /backups
ENTRYPOINT ["backup.sh"]
