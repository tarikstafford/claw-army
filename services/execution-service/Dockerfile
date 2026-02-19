FROM node:20-alpine AS base

WORKDIR /app

# Copy workspace root for pnpm
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY .npmrc ./

# Copy package manifests for all workspace deps
COPY packages/db/package.json             packages/db/
COPY packages/event-schemas/package.json  packages/event-schemas/
COPY packages/shared-types/package.json   packages/shared-types/
COPY services/execution-service/package.json services/execution-service/

# Install dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile --filter @claw/execution-service...

# Copy source
COPY packages/db/                packages/db/
COPY packages/event-schemas/     packages/event-schemas/
COPY packages/shared-types/      packages/shared-types/
COPY services/execution-service/ services/execution-service/

WORKDIR /app/services/execution-service

ENV NODE_OPTIONS="--conditions @claw/source"

EXPOSE 3001

CMD ["npx", "tsx", "src/main.ts"]
