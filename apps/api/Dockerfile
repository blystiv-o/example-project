# syntax=docker/dockerfile:1.7

FROM node:22.14.0-bookworm-slim AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci


FROM dependencies AS build

COPY tsconfig.base.json turbo.json ./
COPY apps/api apps/api
COPY packages/shared packages/shared

RUN npm run build --workspace @money-tracker/shared \
    && npm run build --workspace @money-tracker/api


FROM node:22.14.0-bookworm-slim AS production-dependencies

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci --omit=dev \
      --workspace @money-tracker/api \
      --workspace @money-tracker/shared \
      --include-workspace-root=false \
    && npm cache clean --force


FROM node:22.14.0-bookworm-slim AS runtime

ENV NODE_ENV=production \
    API_PORT=3001 \
    LOG_FILE=/app/logs/api.log

WORKDIR /app

COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=production-dependencies /app/apps/api/package.json ./apps/api/package.json
COPY --from=production-dependencies /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/migrations ./apps/api/migrations
COPY --from=build /app/packages/shared/dist ./packages/shared/dist

RUN mkdir -p /app/logs \
    && chown node:node /app/logs

USER node
WORKDIR /app/apps/api

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.API_PORT + '/api/v1/health').then(response => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "--enable-source-maps", "dist/main.js"]
