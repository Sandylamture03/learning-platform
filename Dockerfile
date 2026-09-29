# syntax=docker/dockerfile:1
# The whole platform in one image: the API serves the site at /, the app at /app/ and itself at /api.
# Build: docker build -t learning-platform .
# Run:   docker run -p 3000:3000 -e DATABASE_URL=postgres://… learning-platform

FROM node:24-slim AS base
# Corepack installs the pnpm version pinned in package.json ("packageManager").
RUN corepack enable
WORKDIR /repo

# Everything installed, then the site and the app built.
FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm exec turbo run build --filter=@lp/site --filter=@lp/shell

# Only what runs in production: the sources (Node.js runs the TypeScript directly) and production dependencies.
FROM base AS runtime-deps
COPY . .
RUN pnpm install --frozen-lockfile --prod

FROM node:24-slim
ENV NODE_ENV=production PORT=3000
WORKDIR /repo
COPY --from=runtime-deps /repo /repo
COPY --from=build /repo/apps/site/dist apps/site/dist
COPY --from=build /repo/apps/shell/dist apps/shell/dist
USER node
EXPOSE 3000
# Migrations first (each applies once, under a lock, so several instances starting together is fine), then the
# server. exec makes it PID 1's direct child, so SIGTERM from the host reaches it and it shuts down cleanly.
CMD ["sh", "-c", "node apps/api/src/migrate-cli.ts && exec node apps/api/src/server.ts"]
