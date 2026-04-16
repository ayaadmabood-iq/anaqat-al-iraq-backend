# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------------------
# Multi-stage build for Anaqat Al-Iraq backend.
#
#   builder  : installs full toolchain, compiles TypeScript → dist/
#   runner   : minimal node:22-alpine, prod deps only, non-root, healthcheck
#
# Runtime entrypoint is `node dist/main.js`. Migrations are NOT run
# automatically on container start — run them explicitly (see RUNBOOK.md):
#     docker run --rm --env-file .env <image> npm run migration:run:prod
# -----------------------------------------------------------------------------

FROM node:22-alpine AS builder
WORKDIR /app
ENV NODE_ENV=development

# Copy manifests first so `npm ci` caches when code changes.
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Then copy source and build.
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

# Strip dev deps in a throwaway step so they don't end up in the final layer.
RUN npm prune --omit=dev --legacy-peer-deps


FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Bring in wget for the HEALTHCHECK; node:alpine ships without it.
RUN apk add --no-cache wget tini

# Run as an unprivileged user. The base image already ships a `node` user
# (uid 1000) — reuse it instead of creating a new one.
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/package.json ./package.json

# Writable uploads dir owned by the runtime user. Mount a volume in compose
# / k8s if uploads must survive container restarts.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

USER node
EXPOSE 3000

# tini reaps zombie children and forwards SIGTERM cleanly to the node process,
# which lets our enableShutdownHooks() path actually run.
ENTRYPOINT ["/sbin/tini", "--"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "dist/main.js"]
