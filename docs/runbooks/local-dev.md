# Runbook: Local Development

## Prerequisites

- Node.js 22+
- pnpm 10+
- Docker Desktop

## Starting the Stack

```bash
# 1. Infrastructure
docker compose -f docker-compose.dev.yml up -d

# 2. pgvector extension (first time only)
docker exec postgres-db-1 apt-get install -y postgresql-17-pgvector
docker exec postgres-db-1 psql -U postgres -d clawdb -c 'CREATE EXTENSION IF NOT EXISTS vector;'

# 3. Database
pnpm db:migrate
pnpm --filter @claw/db seed:archetypes

# 4. Services
pnpm dev
```

## Common Issues

### pnpm 10.x doesn't pass inline env vars
Each service has `.npmrc` with `node-options=--conditions=@claw/source`. Don't try to pass env vars inline.

### Migrations 0008-0010 not in journal
Apply manually via psql — they're idempotent with `IF NOT EXISTS`:
```bash
docker exec postgres-db-1 psql -U postgres -d clawdb -f packages/db/migrations/0008_*.sql
```

### OpenClaw pinned version
OpenClaw is pinned to `v2026.2.22-2`. Do not use `@latest` — breaking releases are common.

### Paperclip submodule
```bash
git submodule update --init --recursive
```

## Ports

| Service | Port |
|---------|------|
| SvelteKit UI | 5173 |
| Paperclip Express | 3100 |
| PostgreSQL | 5432 |
| Redis | 6379 |
