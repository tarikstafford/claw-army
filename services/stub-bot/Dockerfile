FROM node:20-alpine AS base

WORKDIR /app

# Copy workspace root for pnpm
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY .npmrc ./

# Copy package manifests for all workspace deps
COPY packages/db/package.json packages/db/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/event-schemas/package.json packages/event-schemas/
COPY services/stub-bot/package.json services/stub-bot/

# Install dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile --filter @claw/stub-bot...

# Copy source
COPY packages/db/ packages/db/
COPY packages/shared-types/ packages/shared-types/
COPY packages/event-schemas/ packages/event-schemas/
COPY services/stub-bot/ services/stub-bot/

WORKDIR /app/services/stub-bot

CMD ["npx", "tsx", "src/main.ts"]
