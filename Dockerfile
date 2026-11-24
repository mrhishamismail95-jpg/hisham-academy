# Build context: repository root (contains apps/ and db/)
FROM oven/bun:1 AS build
WORKDIR /app/apps/web

# Copy package manifests first for better layer caching
COPY apps/web/package.json ./
COPY apps/web/bun.lock* ./
# Prefer frozen lockfile when present; otherwise install fresh
RUN if [ -f bun.lock ]; then bun install --frozen-lockfile; else bun install; fi

COPY apps/web ./
COPY shared /app/shared
RUN bun run build

FROM node:22-slim AS runtime
WORKDIR /app/apps/web
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/apps/web ./
COPY db /app/db
EXPOSE 3000
# Prefer running migrations as a one-off release command, not on every boot.
CMD ["node", "./build/server/index.js"]
