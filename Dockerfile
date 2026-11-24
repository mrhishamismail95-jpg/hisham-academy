# Build context: this folder (the one containing apps/ and db/)
FROM oven/bun:1 AS build
WORKDIR /app/apps/web
COPY apps/web/package.json apps/web/bun.lock ./
RUN bun install --frozen-lockfile
COPY apps/web ./
COPY shared /app/shared
RUN bun run build

FROM node:22-slim AS runtime
WORKDIR /app/apps/web
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/apps/web ./
COPY db /app/db
EXPOSE 3000
# Run `node scripts/migrate.mjs` as a release/pre-deploy step, not on every boot.
CMD ["node", "./build/server/index.js"]
