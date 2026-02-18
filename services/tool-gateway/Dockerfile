FROM node:20-alpine AS base

WORKDIR /app

# Copy workspace root for pnpm
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY .npmrc ./

# Copy package manifests for all workspace deps
COPY packages/db/package.json packages/db/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/event-schemas/package.json packages/event-schemas/
COPY packages/tool-contracts/package.json packages/tool-contracts/
COPY services/tool-gateway/package.json services/tool-gateway/

# Install dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile --filter @claw/tool-gateway...

# Copy source
COPY packages/db/ packages/db/
COPY packages/shared-types/ packages/shared-types/
COPY packages/event-schemas/ packages/event-schemas/
COPY packages/tool-contracts/ packages/tool-contracts/
COPY services/tool-gateway/ services/tool-gateway/

WORKDIR /app/services/tool-gateway

# Required: resolves @claw/* workspace packages via src/ (no dist/ in dev)
ENV NODE_OPTIONS="--conditions @claw/source"

EXPOSE 3002

CMD ["npx", "tsx", "src/main.ts"]
