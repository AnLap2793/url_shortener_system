FROM node:22.22.0-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/application/package.json packages/application/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/observability/package.json packages/observability/package.json
RUN npm install --global npm@10.9.4 && npm ci --ignore-scripts

FROM dependencies AS build
COPY . .
RUN npm run build:all

FROM node:22.22.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
# ponytail: local image keeps the verified dependency tree; prune after a runtime dependency audit exists.
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
