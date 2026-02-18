# Phase 1: Data Foundation - Research

**Researched:** 2026-02-18
**Domain:** PostgreSQL/Drizzle ORM schema, TypeScript monorepo shared packages, GCP infrastructure provisioning, Docker network isolation
**Confidence:** MEDIUM-HIGH (stack well-verified; GCP local dev patterns have known friction areas documented below)

---

## Summary

Phase 1 covers four distinct technical domains: (1) a PostgreSQL schema with Drizzle ORM and migration tooling, (2) shared TypeScript packages in a monorepo, (3) GCP infrastructure provisioning with Terraform, and (4) Docker network isolation for bot containers. Each domain is mature and well-understood independently, but their combination in a single phase creates integration friction — particularly around accessing GCP-hosted Memorystore Redis from local development, which has no public endpoint and requires a Compute Engine SSH tunnel. This is the most notable operational pitfall and should be a named task in Plan 01-03.

The Drizzle ORM ecosystem is actively evolving; the stable version as of this research is 0.45.1 with a v1.0.0-beta.2 in progress. The recommended approach for this project is stable 0.45.1 with drizzle-kit 0.31.9 using the generate + migrate workflow (not push) since these are production-grade migrations. Zod v4 (released stable July 2025) has meaningful API changes from v3 — all shared packages should start on v4 from the beginning to avoid a migration debt. Docker network isolation for egress blocking is achievable with the `internal: true` compose network combined with a multi-network architecture where bots sit on an isolated internal network and can only reach the Tool Gateway via container-to-container networking.

**Primary recommendation:** Build the schema package as the canonical source of truth for all Drizzle table definitions and inferred TypeScript types. Use a `packages/db` monorepo pattern with drizzle.config.ts owning schema glob resolution and migration output. Keep shared-types, event-schemas, and tool-contracts as pure TypeScript packages (no Drizzle dependency) using the "internal packages" strategy (source files as main/types entrypoints) for live type propagation without a build step.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.1 | PostgreSQL ORM, schema definition, query builder | Type-safe SQL without code generation; schema IS the TypeScript type |
| drizzle-kit | 0.31.9 | Migration generation and application CLI | Official companion; generate + migrate workflow for auditable SQL |
| pg (node-postgres) | 8.18.0 | PostgreSQL driver | Most widely used Node.js PG driver; drizzle-orm/node-postgres adapter |
| zod | 4.3.6 | Runtime schema validation for shared contracts | TypeScript-first, runtime + compile-time types from single definition; v4 is stable |
| @google-cloud/pubsub | 5.2.3 | Pub/Sub publisher and subscriber client | Official Google client library |
| ioredis | 5.9.3 | Redis client for BullMQ and direct Redis ops | Required by BullMQ; full TypeScript support |
| bullmq | 5.69.3 | Task queue on Redis (Phase 2, but Redis must exist in Phase 1) | Lease semantics, stall detection, TypeScript native |
| typescript | 5.9.3 | Compiler | Strict mode enforcement across all packages |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dotenv | latest | Environment variable loading | All service entrypoints and drizzle.config.ts |
| tsx | latest | TypeScript script execution (no compile step) | Running migration scripts and seed scripts locally |
| @types/pg | latest | TypeScript types for pg driver | Dev dependency on the db package |
| terraform (hashicorp/google) | ~7.19.0 | GCP infrastructure provisioning | All GCP resources in Plan 01-03 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| drizzle-orm | Prisma | Prisma generates a client from a schema file — less flexible, more magic. Drizzle schemas are just TypeScript. Not recommended given team preference for transparent SQL. |
| drizzle-orm | Kysely | Kysely is pure query builder, no schema management. Would require a separate migration tool. Drizzle owns the full stack. |
| zod v4 | zod v3 | v3 is EOL-bound now that v4 is stable (July 2025). v4 has breaking API changes (`.errors` → `.issues`, `z.email()` instead of `z.string().email()`). Starting on v4 avoids a future migration. |
| pg (node-postgres) | postgres.js | postgres.js is faster but drizzle-orm/node-postgres is the official adapter. Switching requires changing the drizzle init. Can be evaluated later. |
| Terraform | Pulumi | Pulumi is TypeScript-native but Terraform has more GCP module coverage. For MVP, Terraform with hashicorp/google provider is the lower-friction path. |
| docker --internal network | GCP VPC firewall rules | VPC firewall rules are the production enforcement mechanism. For local dev, Docker internal network is the correct analog. Plan 01-04 is local-only. |

**Installation:**
```bash
# db package
npm install drizzle-orm pg dotenv
npm install -D drizzle-kit tsx @types/pg

# shared-types, event-schemas, tool-contracts (no drizzle dependency)
npm install zod

# infrastructure connectivity check script
npm install ioredis @google-cloud/pubsub pg
```

---

## Architecture Patterns

### Recommended Monorepo Structure

```
claw-army/                          # repo root
├── packages/
│   ├── db/                         # Drizzle schema, migrations, db client
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   ├── executions.ts
│   │   │   │   ├── tasks.ts
│   │   │   │   ├── bots.ts
│   │   │   │   ├── billing_events.ts
│   │   │   │   ├── telemetry.ts
│   │   │   │   └── dna_store.ts
│   │   │   ├── index.ts            # re-exports db client + all tables
│   │   │   └── client.ts           # drizzle() instance
│   │   ├── migrations/             # generated SQL migration files (committed)
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   ├── shared-types/               # Pure TS interfaces/types
│   │   ├── src/
│   │   │   ├── execution.ts
│   │   │   ├── task.ts
│   │   │   ├── bot.ts
│   │   │   └── index.ts
│   │   └── package.json
│   ├── event-schemas/              # Zod schemas for Pub/Sub event payloads
│   │   ├── src/
│   │   │   ├── bot-events.ts
│   │   │   ├── execution-events.ts
│   │   │   ├── guardrail-events.ts
│   │   │   └── index.ts
│   │   └── package.json
│   └── tool-contracts/             # Zod schemas for Tool Gateway request/response
│       ├── src/
│       │   ├── llm-call.ts
│       │   ├── fetch-url.ts
│       │   ├── write-file.ts
│       │   └── index.ts
│       └── package.json
├── services/
│   ├── execution-service/          # Phase 2+
│   ├── tool-gateway/               # Phase 3+
│   └── ...
├── infra/
│   ├── terraform/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── modules/
│   │       ├── cloud-sql/
│   │       ├── memorystore/
│   │       ├── pubsub/
│   │       └── vpc/
│   └── docker/
│       └── bot-isolation/
│           └── docker-compose.yml
├── scripts/
│   └── connectivity-check.ts       # Plan 01-03 health check script
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

### Pattern 1: Internal Package Strategy for Shared Types

**What:** Package.json `main` and `types` fields point directly to `.ts` source files, not compiled output. No build step needed for type resolution.

**When to use:** For all three shared packages (shared-types, event-schemas, tool-contracts). Services import from source, TypeScript resolves types live.

**Example:**
```json
// packages/shared-types/package.json
{
  "name": "@claw/shared-types",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "@claw/source": "./src/index.ts",
      "default": "./dist/index.js"
    }
  }
}
```

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "customConditions": ["@claw/source"],
    "declaration": true,
    "declarationMap": true,
    "composite": true
  }
}
```

**Why it wins:** "When you update your code in one file, the effects of that change propagate to all files that import it instantaneously, with no build step." Source: https://colinhacks.com/essays/live-types-typescript-monorepo

### Pattern 2: Drizzle Schema as Single Source of Truth

**What:** Drizzle table definitions live in `packages/db/src/schema/`. TypeScript types for inserts and selects are inferred from the schema using `$inferInsert` and `$inferSelect`. The shared-types package re-exports or references these inferred types to avoid duplication.

**When to use:** Whenever a table record type is needed in another service.

**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/column-types/pg
import { pgTable, uuid, pgEnum, timestamp, varchar, integer, jsonb, text, boolean } from 'drizzle-orm/pg-core';

export const executionStatusEnum = pgEnum('execution_status', [
  'queued', 'running', 'paused', 'stopped', 'completed', 'failed'
]);

export const executions = pgTable('executions', {
  id: uuid().primaryKey().defaultRandom(),
  status: executionStatusEnum().notNull().default('queued'),
  objective: text().notNull(),
  maxBots: integer('max_bots').notNull(),
  budgetCapUsd: integer('budget_cap_usd').notNull(), // stored as cents
  runtimeLimitSeconds: integer('runtime_limit_seconds').notNull(),
  allowedTools: text('allowed_tools').array().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 3 })
    .defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 })
    .defaultNow().notNull(),
});

export type Execution = typeof executions.$inferSelect;
export type NewExecution = typeof executions.$inferInsert;
```

**Key insight on timestamps:** Use `{ withTimezone: true, precision: 3 }` on all timestamp columns. This is "10-15% faster than string mode" and avoids timezone coercion bugs. Source: Drizzle ORM 2025 best practices guide.

### Pattern 3: Generate + Migrate (Not Push) for Migrations

**What:** `drizzle-kit generate` creates SQL migration files in `packages/db/migrations/`. These are committed to version control. `drizzle-kit migrate` or the programmatic `migrate()` function applies them.

**When to use:** Always. Never use `push` for anything that will touch a real database. `push` is for throw-away local dev databases only.

**Example:**
```typescript
// packages/db/drizzle.config.ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './migrations',
  schema: './src/schema/**/*.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

```bash
# Generate migration after schema change
npx drizzle-kit generate

# Apply migrations (run from packages/db)
npx drizzle-kit migrate
```

```typescript
// Programmatic migration (for service startup)
// Source: https://orm.drizzle.team/docs/drizzle-kit-migrate
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './client';

await migrate(db, { migrationsFolder: './migrations' });
```

### Pattern 4: Docker Network Isolation for Bot Containers

**What:** Bots run on an `internal: true` Docker network with no route to the internet. The Tool Gateway is attached to BOTH the internal bot network AND the regular bridge network (which can reach external services). Bots can only communicate with containers on the same internal network — in this case, only the Tool Gateway.

**When to use:** Local dev bot isolation simulation (Plan 01-04). Production uses GCP VPC firewall rules instead.

**Example:**
```yaml
# Source: Docker Compose networks docs (https://docs.docker.com/reference/compose-file/networks/)
services:
  bot:
    image: claw-bot:latest
    networks:
      - bot-internal
    # No ports exposed — no internet access

  tool-gateway:
    image: claw-tool-gateway:latest
    networks:
      - bot-internal    # reachable FROM bots
      - external        # can reach external APIs
    ports:
      - "8080:8080"

networks:
  bot-internal:
    internal: true      # blocks all egress to internet/host gateway
    driver: bridge
  external:
    driver: bridge      # normal network with internet access
```

**Key behavior of `internal: true`:** "Containers on an internal network may communicate between each other, but not with any other network, as no default route is configured and firewall rules are set up to drop all traffic to or from other networks." Source: Docker Compose network docs.

### Pattern 5: Zod v4 Schema Definition for Shared Contracts

**What:** Event schemas and tool contracts are defined as Zod schemas. TypeScript types are inferred via `z.infer<typeof schema>`. This gives runtime validation AND compile-time types from a single definition.

**When to use:** All `event-schemas` and `tool-contracts` package definitions.

**Example:**
```typescript
// Source: https://zod.dev/v4
import { z } from 'zod';

// Note: Zod v4 breaking change — string format validators moved to top-level
export const botStartedEventSchema = z.object({
  type: z.literal('bot_started'),
  botId: z.uuid(),           // z.uuid() NOT z.string().uuid() (Zod v4)
  executionId: z.uuid(),
  timestamp: z.iso.datetime(),
  metadata: z.object({
    imageTag: z.string(),
    taskId: z.uuid().optional(),
  }),
});

export type BotStartedEvent = z.infer<typeof botStartedEventSchema>;
```

### Anti-Patterns to Avoid

- **Using `push` for non-throwaway databases:** drizzle-kit push modifies the live database without generating migration files. There is no rollback path and no audit trail. Use only for local scratch databases.
- **Mixing Drizzle schema types with manually-written interfaces:** Defining a `type Execution = { id: string; ... }` separately from the Drizzle table definition will drift. Always derive types with `$inferSelect` / `$inferInsert`.
- **Placing drizzle.config.ts at repo root with cross-package schema globs:** Works but creates path resolution complexity. Keep drizzle.config.ts inside `packages/db` and reference migrations from services using absolute paths.
- **Using Zod v3 syntax in new code:** `z.string().uuid()` and `.errors` are changed in v4. Starting on v3 and migrating later is costly. Use v4 from day one.
- **Using `--network none` for bot containers:** `--network none` also blocks container-to-container communication. The bot needs to reach the Tool Gateway. Use `internal: true` bridge network instead.
- **Hardcoding database passwords in Terraform:** Use `google_secret_manager_secret` or `TF_VAR_` injection via CI. The Cloud SQL Auth Proxy eliminates the need for password-based connections in most cases.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL migration versioning and application | Custom migration runner | drizzle-kit generate + migrate | Handles migration state tracking, ordering, idempotency; the `__drizzle_migrations` table is managed automatically |
| PostgreSQL type safety | Manual type casting from `pg` query results | drizzle-orm `$inferSelect` / `$inferInsert` | Zero-cast: the ORM maps query results directly to TypeScript types |
| Runtime validation of event payloads | Custom JSON schema validation | Zod v4 schemas | Zod gives compile-time + runtime validation from one definition; error messages are structured and traversable |
| Docker egress filtering | Custom iptables rules in Dockerfile | `internal: true` Docker compose network | Docker manages iptables rules; manual iptables rules conflict with Docker's management and break on daemon restart |
| Redis connection management | Raw `net.Socket` connections | ioredis 5.x | Handles reconnection, cluster topology, pipelining, and TypeScript types |
| GCP resource provisioning | `gcloud` CLI scripts | Terraform with hashicorp/google provider | Declarative, idempotent, state-tracked; `gcloud` scripts are not reproducible or reviewable |

**Key insight:** The generate + migrate workflow in Drizzle is the highest-leverage pattern in this phase. Every downstream phase writes queries against the schema. Correctness here prevents type bugs that are invisible until runtime in every subsequent phase.

---

## Common Pitfalls

### Pitfall 1: Memorystore Redis Has No Public Endpoint

**What goes wrong:** A developer tries to `redis-cli -h <memorystore-ip>` from their laptop and gets a connection timeout. The Memorystore instance is only accessible from within the authorized VPC network.

**Why it happens:** GCP Memorystore Redis "always uses internal IP addresses" — RFC 1918 only. There is no public IP option.

**How to avoid:** For the connectivity health check in Plan 01-03, the developer must set up an SSH tunnel via a Compute Engine bastion VM OR use a local Redis Docker container (`redis:7`) for the local dev environment, with the real Memorystore reachable only from GCP-hosted services. Document which approach Plan 01-03 will use — this is a planning decision that affects the connectivity check script design.

**Warning signs:** `redis-cli ping` hangs indefinitely; `ECONNREFUSED` on 6379 from local machine.

**Recommended resolution:** Use `redis:7` Docker locally for Plan 01-04 egress testing. The GCP Memorystore connectivity check should be run from a Compute Engine VM via `gcloud compute ssh ... -- redis-cli -h <ip> ping`, not from local.

### Pitfall 2: Drizzle Monorepo TypeScript Type Errors from Compiled Packages

**What goes wrong:** A service imports `@claw/db` and gets TS error: `Property [IsDrizzleTable] is missing in type`. This is a known Drizzle monorepo bug when the db package is compiled to `dist/` and imported from another workspace.

**Why it happens:** Drizzle table types carry internal branded type markers. When compiled, these markers are lost or duplicated in a way TypeScript can't reconcile across package boundaries.

**How to avoid:** Use the "internal packages" strategy — set `main` and `types` in `packages/db/package.json` to point to the `.ts` source files directly. The service resolves Drizzle types from source, not compiled output. Reference: GitHub issue #1558 on drizzle-team/drizzle-orm.

**Warning signs:** TypeScript error mentioning `[IsDrizzleTable]`, `[Brand]`, or similar internal symbols when importing from a compiled db package.

### Pitfall 3: Docker `--internal` Network Blocks DNS for External Hosts but Allows Internal Container Resolution

**What goes wrong:** Egress test passes for TCP connections but a bot container can still perform DNS lookups for external hosts via the embedded DNS server.

**Why it happens:** Docker's embedded DNS server in user-defined bridge networks forwards external DNS lookups to the host's DNS servers. An `internal: true` network blocks gateway routing, but DNS queries may still resolve (they just won't be routable).

**How to avoid:** The egress test in Plan 01-04 must test BOTH: (1) TCP connection attempt to an external IP is refused/dropped, AND (2) DNS resolution of an external hostname either fails or returns no usable route. The success criteria explicitly calls out "TCP connections AND DNS queries."

**Warning signs:** `nslookup google.com` inside the bot container returns an IP address even though the container "has no internet." The actual connection will fail, but DNS resolving means the isolation is not complete at the DNS layer.

### Pitfall 4: Zod v4 API Breaking Changes (`.errors` → `.issues`, format validators)

**What goes wrong:** Code written with Zod v3 patterns breaks at runtime: `error.errors is not a function` or `z.string().email is not a function`.

**Why it happens:** Zod v4 (stable July 2025) changed `.errors` to `.issues` on `ZodError`, and moved string format validators (`email`, `uuid`, `url`) from method-chained forms to top-level functions.

**How to avoid:** Start all packages on Zod v4 from day one. Use `z.email()`, `z.uuid()`, `z.url()` at the top level. Access validation errors via `error.issues`, not `error.errors`.

**Warning signs:** Catch blocks accessing `e.errors` crash; intellisense doesn't suggest `.email()` on a `z.string()`.

### Pitfall 5: drizzle-kit generate Drift if Schema Files Change Without Running Generate

**What goes wrong:** A developer modifies a table definition in `packages/db/src/schema/` but forgets to run `drizzle-kit generate`. The migration folder is out of sync with the TypeScript schema. Tests pass locally (because the local DB was pushed), but CI migrations fail.

**Why it happens:** The TypeScript schema and the SQL migration files are separate artifacts. drizzle-kit generate is the bridge between them.

**How to avoid:** Add `drizzle-kit generate` as a lint check in CI. Check that the `migrations/` folder has no uncommitted changes after running generate against the current schema. Alternatively, add a pre-commit hook that runs generate and fails if it produces new output.

**Warning signs:** Migrations folder modified timestamp is older than schema file modified timestamp; CI says "migration already applied" when a new column clearly doesn't exist in the database.

### Pitfall 6: Cloud SQL Auth Proxy Required for Local-to-GCP Database Access

**What goes wrong:** A developer tries to connect to Cloud SQL using the public IP and gets SSL handshake failures or connection refused.

**Why it happens:** Cloud SQL instances are typically configured with no authorized external networks (private IP only). Even if a public IP exists, direct connections require authorized network CIDRs.

**How to avoid:** Use the Cloud SQL Auth Proxy for all local-to-GCP connections. The proxy handles authentication and TLS automatically. Run it as a local binary or Docker container alongside services in docker-compose.

**Warning signs:** `pg` connection throws `SSL SYSCALL error: EOF detected` or `connection refused` when connecting directly to Cloud SQL IP.

---

## Code Examples

Verified patterns from official sources:

### Drizzle Table Definition with pgEnum and JSONB

```typescript
// Source: https://orm.drizzle.team/docs/column-types/pg
import { pgTable, uuid, pgEnum, timestamp, varchar, integer, jsonb, text, boolean, index } from 'drizzle-orm/pg-core';

export const taskStatusEnum = pgEnum('task_status', [
  'pending', 'claimed', 'completed', 'failed'
]);

export const tasks = pgTable('tasks', {
  id: uuid().primaryKey().defaultRandom(),
  executionId: uuid('execution_id').notNull()
    .references(() => executions.id, { onDelete: 'cascade' }),
  status: taskStatusEnum().notNull().default('pending'),
  description: text().notNull(),
  claimedByBotId: uuid('claimed_by_bot_id'),
  leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true, precision: 3 }),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).defaultNow().notNull(),
}, (table) => [
  index('tasks_execution_id_idx').on(table.executionId),
  index('tasks_status_idx').on(table.status),
]);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
```

### JSONB with Type Safety for dna_store

```typescript
// Source: https://orm.drizzle.team/docs/column-types/pg
import { jsonb } from 'drizzle-orm/pg-core';

interface DnaRecord {
  systemPromptTemplate: string;
  toolCallSequence: Array<{ tool: string; argPattern: Record<string, unknown> }>;
  retryStrategy: { maxRetries: number; backoffMs: number };
  timingProfile: { avgTaskMs: number; p95TaskMs: number };
  tokenDistribution: { promptAvg: number; completionAvg: number };
}

export const dnaStore = pgTable('dna_store', {
  id: uuid().primaryKey().defaultRandom(),
  botId: uuid('bot_id').notNull(),
  executionId: uuid('execution_id').notNull(),
  objectiveCategory: varchar('objective_category', { length: 255 }).notNull(),
  version: integer().notNull().default(1),
  dnaPayload: jsonb('dna_payload').$type<DnaRecord>().notNull(),
  capturedAt: timestamp('captured_at', { withTimezone: true, precision: 3 }).defaultNow().notNull(),
});
```

### Drizzle Client Setup with Cloud SQL Auth Proxy (Local Dev)

```typescript
// Source: Official Drizzle PostgreSQL setup + Cloud SQL Auth Proxy docs
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index';

// When Cloud SQL Auth Proxy runs locally on port 5432:
// DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/clawdb
export const db = drizzle(process.env.DATABASE_URL!, { schema });
```

### Zod v4 Event Schema

```typescript
// Source: https://zod.dev/v4
import { z } from 'zod';

export const toolInvokedEventSchema = z.object({
  type: z.literal('tool_invoked'),
  invocationId: z.uuid(),       // z.uuid() — Zod v4 top-level
  botId: z.uuid(),
  executionId: z.uuid(),
  toolName: z.string(),
  timestamp: z.iso.datetime(),
  durationMs: z.number().int().nonnegative(),
  tokenCount: z.number().int().nonnegative().optional(),
  success: z.boolean(),
  errorReason: z.string().optional(),
});

export type ToolInvokedEvent = z.infer<typeof toolInvokedEventSchema>;
```

### GCP Pub/Sub Publisher (Node.js)

```typescript
// Source: https://github.com/googleapis/nodejs-pubsub
import { PubSub } from '@google-cloud/pubsub';

const pubsub = new PubSub({ projectId: process.env.GCP_PROJECT_ID });

export async function publishEvent(topicName: string, payload: object): Promise<string> {
  const topic = pubsub.topic(topicName);
  const data = Buffer.from(JSON.stringify(payload));
  const messageId = await topic.publishMessage({ data });
  return messageId;
}
```

### Pub/Sub Emulator for Local Dev

```yaml
# docker-compose.local.yml — run alongside services for local dev
services:
  pubsub-emulator:
    image: gcr.io/google.com/cloudsdktool/google-cloud-cli:emulators
    command: gcloud beta emulators pubsub start --host-port=0.0.0.0:8085
    ports:
      - "8085:8085"
```

```bash
# In your .env for local dev
PUBSUB_EMULATOR_HOST=localhost:8085
```

### Docker Compose Bot Network Isolation

```yaml
# infra/docker/bot-isolation/docker-compose.yml
services:
  bot-test:
    image: alpine:latest
    command: ["sh", "-c", "wget -T 3 -q https://google.com && echo 'FAIL: External reached' || echo 'PASS: External blocked'"]
    networks:
      - bot-internal

  tool-gateway-stub:
    image: alpine:latest
    command: ["sh", "-c", "nc -l -p 8080"]
    networks:
      - bot-internal
      - external

networks:
  bot-internal:
    internal: true
    driver: bridge
  external:
    driver: bridge
```

### Connectivity Health Check Script (skeleton)

```typescript
// scripts/connectivity-check.ts
import pg from 'pg';
import { createClient } from 'ioredis';
import { PubSub } from '@google-cloud/pubsub';

async function checkPostgres() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('SELECT 1');
  await client.end();
  console.log('[PASS] PostgreSQL reachable');
}

async function checkRedis() {
  const redis = new Redis(process.env.REDIS_URL!);
  await redis.ping();
  redis.disconnect();
  console.log('[PASS] Redis reachable');
}

async function checkPubSub() {
  const pubsub = new PubSub({ projectId: process.env.GCP_PROJECT_ID });
  const [topics] = await pubsub.getTopics();
  console.log(`[PASS] Pub/Sub reachable — ${topics.length} topics`);
}

Promise.all([checkPostgres(), checkRedis(), checkPubSub()])
  .then(() => { console.log('\n[ALL PASS] Infrastructure reachable'); process.exit(0); })
  .catch((e) => { console.error('\n[FAIL]', e.message); process.exit(1); });
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `serial` / `SERIAL` columns in PostgreSQL | Identity columns with `.generatedAlwaysAsIdentity()` | PostgreSQL 10+ / Drizzle 2025 guidance | Serial is a pseudo-type; identity columns are SQL standard and more predictable |
| Zod v3 `.string().email()`, `error.errors` | Zod v4 `z.email()`, `error.issues` | July 2025 (v4.0.0 stable) | Must use v4 APIs from the start; all libraries depending on Zod need to verify v4 compat |
| Terraform hashicorp/google provider 5.x | 6.x / 7.x | 6.0.0 GA in late 2024; 7.x current | Deletion protection enabled by default on many resources; need explicit `deletion_protection = false` in dev/test |
| `push` for development schema | `push` for local scratch, `generate + migrate` for anything tracked | Always intended, now better documented | `push` with production databases is data loss risk |
| BullMQ on Redis for task queue | BullMQ 5.x on Redis 7.x | BullMQ v5 is current stable | Prior decisions note BullMQ over Postgres locking; Phase 1 must provision Redis for this |

**Deprecated/outdated:**
- `drizzle-orm-pg`: This older npm package is superseded by `drizzle-orm` with `drizzle-orm/pg-core` imports. Do not use `drizzle-orm-pg`.
- `bull` (without MQ): The predecessor to BullMQ. BullMQ is the current maintained version.
- GCP Container Registry (`gcr.io`): Replaced by Artifact Registry (`*.pkg.dev`). New projects should use Artifact Registry exclusively.

---

## Open Questions

1. **Local Redis: Docker vs. Memorystore tunnel for Plan 01-03**
   - What we know: Memorystore has no public IP; SSH tunnel requires a bastion VM; Docker `redis:7` is simpler for local dev
   - What's unclear: Does the Phase 1 success criterion ("GCP resources reachable from local development") require testing the actual Memorystore instance, or is a local Redis acceptable for the BullMQ smoke test?
   - Recommendation: Run `redis:7` locally for BullMQ testing in Plan 01-04. For Plan 01-03 connectivity check, test the real Memorystore from a Compute Engine instance via `gcloud compute ssh` and document that local Redis is the dev analog. This avoids a persistent bastion VM cost.

2. **pnpm vs. npm for workspaces**
   - What we know: PROJECT.md does not specify a package manager. pnpm is the community standard for monorepos in 2025 (workspace:* protocol, content-addressable storage, strict phantom dependency prevention). npm workspaces also work.
   - What's unclear: Any team preference or constraint.
   - Recommendation: Use pnpm. The `workspace:*` protocol with `pnpm-workspace.yaml` is the most ergonomic setup. If there is a reason to avoid pnpm, npm workspaces are a valid fallback with minor ergonomic differences.

3. **Schema for billing_events: Storing cents vs. USD floats**
   - What we know: PostgreSQL stores floating point imprecisely; monetary values should be stored as integer cents or as `NUMERIC` with explicit precision.
   - What's unclear: Is billing_events storing real dollar amounts or estimated display-only figures?
   - Recommendation: Store all monetary values as `integer` (cents/microdollars) or `numeric(12, 6)` for token cost precision. Never `real` or `float`. This is a schema decision for Plan 01-01.

4. **Drizzle v1.0.0 beta timing**
   - What we know: v1.0.0-beta.2 was released Feb 12, 2025; stable 0.45.1 is the current recommended version.
   - What's unclear: Whether v1.0.0 stable will land before Phase 1 is implemented and whether it carries breaking changes.
   - Recommendation: Use 0.45.1 stable. Avoid v1.0.0-beta for production-tracked infrastructure. Monitor for stable release.

---

## Sources

### Primary (HIGH confidence)

- https://orm.drizzle.team/docs/get-started/postgresql-new — Drizzle PostgreSQL setup, packages, connection init
- https://orm.drizzle.team/docs/column-types/pg — UUID, timestamp, JSONB, pgEnum column types with examples
- https://orm.drizzle.team/docs/migrations — Migration strategy overview (generate vs push vs migrate)
- https://orm.drizzle.team/docs/drizzle-kit-migrate — Programmatic migrate() function
- https://zod.dev/v4 — Zod v4 release notes and breaking changes
- https://zod.dev/v4/changelog — Zod v4 migration guide (`.errors` → `.issues`, format validators)
- https://docs.docker.com/reference/compose-file/networks/ — `internal: true` network behavior
- https://docs.cloud.google.com/sql/docs/postgres/connect-auth-proxy — Cloud SQL Auth Proxy setup and local dev
- https://docs.cloud.google.com/memorystore/docs/redis/connect-redis-instance — Memorystore no public IP, SSH tunnel method
- https://github.com/googleapis/nodejs-pubsub — Pub/Sub Node.js client
- https://colinhacks.com/essays/live-types-typescript-monorepo — Internal packages strategy for live TS types

### Secondary (MEDIUM confidence)

- https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717 — Drizzle ORM 2025 best practices (community guide, verified against official docs)
- https://altan.fyi/drizzle-migration-monorepo/ — Drizzle migration in monorepo patterns
- https://docs.bullmq.io/guide/workers/stalled-jobs — BullMQ stalled job / lease renewal mechanism
- https://fruty.io/2021/02/15/how-to-restrict-outbound-traffic-on-a-docker-infrastructure/ — Docker egress restriction strategy
- https://registry.terraform.io/providers/hashicorp/google/latest — Terraform Google provider (v7.19.0 current)
- Cloud SQL Auth Proxy Docker Compose setup — Verified across multiple sources

### Tertiary (LOW confidence — validate before acting)

- Memorystore Redis `redis:7` Docker equivalence for local dev — Multiple community sources agree but no official GCP documentation explicitly endorses this pattern
- Drizzle [IsDrizzleTable] brand type bug workaround via internal packages — GitHub issue #1558, community-confirmed, not in official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via npm show; official docs checked for each library
- Architecture patterns: HIGH — Drizzle and Docker patterns from official docs; internal packages pattern from authoritative source (Colin McDonnell)
- Pitfalls: HIGH — Memorystore no-public-IP from official docs; Drizzle brand type bug from tracked GitHub issue; Zod v4 breaking changes from official migration guide
- GCP Terraform modules: MEDIUM — versions from Terraform Registry; specific module configurations not deeply verified
- Docker network isolation DNS behavior: MEDIUM — documented behavior but untested in this specific multi-network composition

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (30 days — all libraries in active development but changes are unlikely to break these patterns within the month)
