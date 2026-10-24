# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.16.0-bookworm-slim

FROM node:${NODE_VERSION} AS base

ENV NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_STORE_DIR=/pnpm/store

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

WORKDIR /app

FROM base AS pruner

RUN pnpm dlx turbo@2.11.7 --version
COPY . .
ARG BUILD_APP=web
RUN case "${BUILD_APP}" in \
      all) set -- @oioi-bwg/web @oioi-bwg/console ;; \
      web|console) set -- "@oioi-bwg/${BUILD_APP}" ;; \
      *) exit 1 ;; \
    esac; \
    pnpm dlx turbo@2.11.7 prune "$@" --docker

FROM base AS dependencies

COPY --from=pruner /app/out/json/ ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM dependencies AS builder

ARG BUILD_APP=web
ARG NEXT_PUBLIC_APP_ENV=local
ARG NEXT_PUBLIC_GTM_ID
ARG NEXT_PUBLIC_SENTRY_DSN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_RELEASE
ARG SENTRY_SOURCE_MAPS_ENABLED=false

# This builder does not restore compiler/task caches between changed builds.
ENV NODE_ENV=production \
    OIOI_EPHEMERAL_BUILD=true \
    NEXT_PUBLIC_APP_ENV=${NEXT_PUBLIC_APP_ENV} \
    NEXT_PUBLIC_GTM_ID=${NEXT_PUBLIC_GTM_ID} \
    NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}

COPY --from=pruner /app/out/full/ ./
RUN if [ "${BUILD_APP}" != web ]; then mkdir -p apps/console/public; fi
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    case "${BUILD_APP}" in all|web|console) ;; *) exit 1 ;; esac; \
    set --; if [ "${BUILD_APP}" != all ]; then set -- "--filter=@oioi-bwg/${BUILD_APP}"; fi; \
    if [ "${SENTRY_SOURCE_MAPS_ENABLED}" = "true" ]; then \
      test -s /run/secrets/SENTRY_AUTH_TOKEN || { echo "Missing SENTRY_AUTH_TOKEN build secret" >&2; exit 1; }; \
      SENTRY_AUTH_TOKEN="$(cat /run/secrets/SENTRY_AUTH_TOKEN)" \
      SENTRY_ORG="${SENTRY_ORG}" \
      SENTRY_PROJECT="${SENTRY_PROJECT}" \
      SENTRY_RELEASE="${SENTRY_RELEASE}" \
      SENTRY_SOURCE_MAPS_ENABLED=true \
      pnpm exec turbo run build "$@" --cache=local:r; \
    else \
      pnpm exec turbo run build "$@" --cache=local:r; \
    fi

# CI passes BUILD_APP=all and verifies both shared builder outputs before caching.
FROM scratch AS verification-cache
COPY --from=builder /app/apps/web/.next/standalone/apps/web/server.js /web-server.js
COPY --from=builder /app/apps/console/.next/standalone/apps/console/server.js /console-server.js

FROM node:${NODE_VERSION} AS runtime-base

LABEL org.opencontainers.image.source="https://github.com/goldmayo/oioi-bwg"

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

WORKDIR /app

RUN mkdir -p apps && chown node:node apps

USER node

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=6 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/readyz').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"]

FROM runtime-base AS runner

RUN mkdir -p apps/web/.next

COPY --from=builder --chown=node:node /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static

CMD ["node", "apps/web/server.js"]
