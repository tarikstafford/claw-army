FROM node:20-alpine AS base

WORKDIR /app

# Copy workspace root for pnpm
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY .npmrc ./

# Copy package manifests for all workspace deps
COPY packages/event-schemas/package.json packages/event-schemas/
COPY packages/tool-contracts/package.json packages/tool-contracts/
COPY services/bot-worker/package.json services/bot-worker/

# Install dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile --filter @claw/bot-worker...

# Copy source
COPY packages/event-schemas/ packages/event-schemas/
COPY packages/tool-contracts/ packages/tool-contracts/
COPY services/bot-worker/ services/bot-worker/

WORKDIR /app/services/bot-worker

ENV NODE_OPTIONS="--conditions @claw/source"

CMD ["npx", "tsx", "src/main.ts"]
