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

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM dependencies AS builder

ARG NEXT_PUBLIC_APP_ENV=staging
ARG NEXT_PUBLIC_GTM_ID
ARG NEXT_PUBLIC_SENTRY_DSN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_RELEASE
ARG SENTRY_SOURCE_MAPS_ENABLED=false

ENV NODE_ENV=production \
    NEXT_PUBLIC_APP_ENV=${NEXT_PUBLIC_APP_ENV} \
    NEXT_PUBLIC_GTM_ID=${NEXT_PUBLIC_GTM_ID} \
    NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}

COPY . .
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    if [ "${SENTRY_SOURCE_MAPS_ENABLED}" = "true" ]; then \
      test -s /run/secrets/SENTRY_AUTH_TOKEN || { echo "Missing SENTRY_AUTH_TOKEN build secret" >&2; exit 1; }; \
      SENTRY_AUTH_TOKEN="$(cat /run/secrets/SENTRY_AUTH_TOKEN)" \
      SENTRY_ORG="${SENTRY_ORG}" \
      SENTRY_PROJECT="${SENTRY_PROJECT}" \
      SENTRY_RELEASE="${SENTRY_RELEASE}" \
      SENTRY_SOURCE_MAPS_ENABLED=true \
      pnpm build; \
    else \
      pnpm build; \
    fi

FROM node:${NODE_VERSION} AS runner

LABEL org.opencontainers.image.source="https://github.com/goldmayo/oioi-bwg"

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

WORKDIR /app

RUN mkdir -p .next && chown node:node .next

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=6 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/readyz').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"]

CMD ["node", "server.js"]
