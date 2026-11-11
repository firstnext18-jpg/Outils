# syntax=docker/dockerfile:1
#
# Image de Devra Gestion — compatible ARM64 (Raspberry Pi 4/5) et x86-64.
# Étapes :
#   deps    → dépendances npm (+ client Prisma généré)
#   build   → application Next.js compilée (sortie « standalone »)
#   tools   → migrations et seed (utilisé par le service « migrate »)
#   runner  → image finale, minimale, lancée par le service « app »

# Image Node.js de base (modifiable, ex. pour épingler une version précise).
ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
FROM deps AS build
COPY . .
# Aucun secret n'est nécessaire au build : ils sont lus au démarrage.
RUN npm run build

# ---------------------------------------------------------------------------
FROM deps AS tools
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false
COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./
USER node
# Applique les migrations en attente, puis le seed (idempotent).
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts"]

# ---------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/data \
    TZ=Europe/Zurich

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# Planificateur des tâches quotidiennes (service « cron » de compose.yaml).
COPY --chown=node:node docker/cron/scheduler.mjs ./docker/cron/scheduler.mjs
# Génération des clés des notifications (voir docs/DEPLOIEMENT_SERVEUR.md).
COPY --chown=node:node docker/vapid-keys.mjs ./docker/vapid-keys.mjs

RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/connexion').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
