# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Cultivation RPG engine — build image
#
# better-sqlite3 is a native module, so it is compiled once in the deps stage
# against the same Debian base the runtime uses. Copying node_modules forward
# rather than reinstalling keeps the runtime image free of a toolchain.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:24-bookworm-slim AS deps
WORKDIR /app

# python3/make/g++ are needed only to build better-sqlite3; they never reach
# the runtime image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci


FROM deps AS build
WORKDIR /app
COPY tsconfig.json ./
COPY src ./src
COPY config ./config
COPY data ./data
RUN npm run build


FROM node:24-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Run unprivileged. The node image already ships a `node` user.
RUN mkdir -p /data && chown -R node:node /data

COPY --from=deps  --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist         ./dist
COPY --chown=node:node package.json ./
COPY --chown=node:node config ./config
COPY --chown=node:node data   ./data
COPY --chown=node:node web    ./web
# The narrator loads docs/world/NARRATOR-CORE.md verbatim as its Tier 1
# constitution. Without this the container silently falls back to a reduced
# built-in copy, which is exactly the kind of quiet degradation that is hard
# to notice in play.
COPY --chown=node:node docs   ./docs

USER node

# Campaign database lives on the mounted volume, not in the layer.
ENV RPG_MCP_DB_PATH=/data/cultivation.db

EXPOSE 8787
CMD ["node", "dist/web/server.js"]
