# syntax=docker/dockerfile:1.7
# ---- deps: install with the exact lockfile ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- build: compile the Next.js standalone bundle ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runtime: small image with ffmpeg for video posters ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ARG VERSION=dev
ENV GALLEY_VERSION=$VERSION \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    GALLEY_DATA_DIR=/data
# The `command -v setpriv` is a build-time assertion: the entrypoint drops
# privileges with it, so a future base image that stopped shipping util-linux
# should fail the build here rather than someone's server at midnight.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg curl tini tzdata \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data && chown node:node /data \
    && command -v setpriv >/dev/null
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
# Starts as root so the entrypoint can make a bind-mounted /data writable, then
# drops to PUID:PGID (1000:1000 by default) before exec'ing the app. Pass
# --user to skip that, and chown the host directory yourself.
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
