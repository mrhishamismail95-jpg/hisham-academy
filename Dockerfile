FROM node:22-bookworm-slim AS build
WORKDIR /app/apps/web
COPY apps/web/package.json ./
RUN npm install
COPY apps/web ./
RUN npm run build
FROM node:22-bookworm-slim AS runtime
WORKDIR /app/apps/web
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/apps/web ./
COPY db /app/db
EXPOSE 3000
CMD ["node", "server.mjs"]
