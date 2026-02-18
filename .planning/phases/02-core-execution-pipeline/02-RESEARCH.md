# Phase 2: Core Execution Pipeline - Research

**Researched:** 2026-02-18
**Domain:** REST API service, task queue (BullMQ/Redis), Docker container orchestration (dockerode), JWT injection, event bus (Pub/Sub), state machine lifecycle
**Confidence:** HIGH for BullMQ and Drizzle patterns; MEDIUM for dockerode HostConfig specifics and Cloud Run Jobs comparison; LOW for Cloud Run Jobs vs dockerode GCE latency (no official benchmark data found)

---

## Summary

Phase 2 builds four cooperating services on top of the Phase 1 data foundation: (1) an Execution Service REST API (Fastify + Drizzle) that owns the execution state machine; (2) a Planner that decomposes objectives into flat parallel tasks written to both the DB and the BullMQ queue; (3) a Task Queue layer (BullMQ 5 on Redis) that enforces atomic lease-based claiming, heartbeat extension, and stalled-job reassignment; and (4) a Bot Orchestrator that spawns stub Docker containers via dockerode, enforces max_bots, injects short-lived JWTs, emits lifecycle events to Pub/Sub, and auto-terminates idle bots.

All four components must work without real LLM calls. The Planner for Phase 2 is explicitly a stub: it produces N hardcoded or algorithmically-split task descriptions from the objective string — the actual LLM call is Phase 3+. BullMQ's built-in stall detection covers the lease-heartbeat-reassignment requirement (ORCH-03) with zero custom code: configure `lockDuration` and `stalledInterval`, let BullMQ handle the rest. The single highest-risk architectural decision — Cloud Run Jobs vs dockerode on a local Docker socket — remains unresolved and should be treated as a prototype gate before Phase 2 implementation commits. For local development (Phase 2 scope), dockerode on the host Docker socket is the correct and only practical choice; Cloud Run Jobs validation is deferred but should be explicitly addressed via a prototype task.

**Primary recommendation:** Build the Execution Service with Fastify 5 + Drizzle (guarded state transitions with `.returning()`), the Task Queue with BullMQ 5 using the standard Worker + processor pattern (not manual getNextJob), the Planner as a deterministic stub (no LLM), and the Bot Orchestrator with dockerode + jose for JWT injection. Use `@google-cloud/pubsub` with `PUBSUB_EMULATOR_HOST` for local event emission.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastify | 5.7.4 | HTTP framework for Execution Service REST API | Fastest Node.js framework; built-in schema validation; TypeScript-native; pino logging included |
| bullmq | 5.69.3 | Task queue with lease semantics on Redis | Already decided in prior decisions; atomic locking, stall detection, heartbeat renewal built-in |
| ioredis | 5.9.3 | Redis client for BullMQ (required peer dep) | Required by BullMQ; full TypeScript support |
| dockerode | 4.0.9 | Docker container lifecycle management (spawn, inspect, stop) | Official Docker Remote API client for Node.js; only viable option for local dev |
| @types/dockerode | 4.0.1 | TypeScript types for dockerode | DefinitelyTyped-maintained; covers ContainerCreateOptions, HostConfig, Container methods |
| jose | 6.1.3 | Short-lived JWT signing and verification | Zero dependencies; Web-interoperable; `SignJWT` + `jwtVerify` async API |
| @google-cloud/pubsub | 5.2.3 | Pub/Sub event emission (bot lifecycle, execution status) | Already in Phase 1 stack; works with `PUBSUB_EMULATOR_HOST` for local dev |
| drizzle-orm | 0.45.1 | Execution and task state transitions with `.returning()` | Carried from Phase 1; `.returning()` enables atomic state guards |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @sinclair/typebox | 0.34.48 | JSON Schema + TypeScript type from single definition | Fastify route request/response schemas with compile-time types |
| @fastify/type-provider-typebox | 6.1.0 | TypeBox integration for Fastify type provider | Eliminates manual generic type parameters on routes |
| vitest | 4.0.18 | Unit and integration testing | Test processor logic in isolation; mock BullMQ Job objects |
| pino | 10.3.1 | Structured logging (included in Fastify by default) | Zero-config with Fastify; use `logger: true` in fastify options |
| @claw/db | workspace | Drizzle schema types and db client | Imported by execution-service for all DB operations |
| @claw/event-schemas | workspace | Zod v4 event schemas for Pub/Sub payload validation | Used before publishing events to ensure payload correctness |
| @claw/shared-types | workspace | Domain entity types (Execution, Task, Bot) | Used in service type signatures |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fastify | express | Express has no built-in schema validation or serialization. Fastify's JSON schema validation gives free request validation + 10-20% faster response serialization. Express chosen by familiarity — Fastify is the correct choice here. |
| fastify | hono | Hono is lighter but has smaller ecosystem and less mature TypeScript support for route-level schema validation. Fastify is the correct choice for this service. |
| dockerode | @google-cloud/run (Cloud Run Jobs) | Cloud Run Jobs API has documented latency anomalies (3s normal, up to 87s under grpc queue timeout conditions). dockerode on local Docker socket is sub-second. Cloud Run Jobs is the long-term GCP target but MUST be prototype-validated before Phase 3. |
| jose | jsonwebtoken (9.0.3) | jsonwebtoken uses callback style and is less actively maintained. jose is async-native, zero-dep, and works in all JS runtimes. jose is the correct choice. |
| BullMQ Worker processor | BullMQ manual getNextJob | Manual getNextJob requires custom stall checker startup, manual lock extension, and manual loop logic. The Worker + processor pattern handles all of this automatically. Use manual only if bots need to pull jobs on demand from within the container — evaluate in Phase 3. |

**Installation (per service):**
```bash
# services/execution-service
pnpm add fastify @sinclair/typebox @fastify/type-provider-typebox @claw/db @claw/event-schemas @claw/shared-types bullmq ioredis dockerode jose @google-cloud/pubsub

pnpm add -D @types/dockerode vitest typescript tsx
```

---

## Architecture Patterns

### Recommended Project Structure

```
claw-army/
├── services/
│   ├── execution-service/              # Plan 02-01: REST API + state machine
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── executions.ts       # POST /executions, GET /executions/:id
│   │   │   │   └── index.ts
│   │   │   ├── services/
│   │   │   │   ├── execution.service.ts   # state machine transitions
│   │   │   │   └── planner.service.ts     # Plan 02-02: objective → tasks (stub)
│   │   │   ├── orchestrator/
│   │   │   │   ├── bot-orchestrator.ts    # Plan 02-04: dockerode spawn/terminate
│   │   │   │   └── bot-registry.ts        # in-memory map: botId → Container
│   │   │   ├── queue/
│   │   │   │   ├── task-queue.ts          # Plan 02-03: BullMQ Queue + Worker
│   │   │   │   └── lease.ts               # lockDuration constants
│   │   │   ├── events/
│   │   │   │   └── publisher.ts           # Pub/Sub event emission
│   │   │   ├── app.ts                     # fastify instance, plugins, routes
│   │   │   └── main.ts                    # process entrypoint
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── ...
├── packages/
│   └── ... (from Phase 1)
└── docker-compose.dev.yml             # postgres + redis + pubsub emulator (Phase 1)
```

### Pattern 1: Fastify Service with TypeBox Schema Validation

**What:** Fastify route definitions use TypeBox schemas for both request body validation and response serialization. The `@fastify/type-provider-typebox` plugin wires TypeBox schemas to Fastify's type system, eliminating manual generic type parameters.

**When to use:** All Execution Service route handlers.

**Example:**
```typescript
// Source: https://fastify.dev/docs/latest/Reference/TypeScript/
import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';

const app = Fastify({ logger: true }).withTypeProvider<TypeBoxTypeProvider>();

const CreateExecutionBody = Type.Object({
  objective: Type.String({ minLength: 1 }),
  maxBots: Type.Integer({ minimum: 1, maximum: 20 }),
  budgetCapCents: Type.Optional(Type.Integer({ minimum: 0 })),
  runtimeLimitSeconds: Type.Optional(Type.Integer({ minimum: 60 })),
  allowedTools: Type.Array(Type.String()),
});

const CreateExecutionReply = Type.Object({
  executionId: Type.String({ format: 'uuid' }),
  status: Type.Literal('queued'),
});

app.post('/executions', {
  schema: {
    body: CreateExecutionBody,
    response: { 201: CreateExecutionReply },
  },
  handler: async (request, reply) => {
    // request.body is fully typed — no cast needed
    const { objective, maxBots, budgetCapCents, runtimeLimitSeconds, allowedTools } = request.body;
    // ... create execution in DB
    return reply.code(201).send({ executionId: '...', status: 'queued' });
  },
});
```

### Pattern 2: Execution State Machine with Drizzle Guarded Updates

**What:** State transitions in PostgreSQL use `UPDATE ... WHERE status = 'current_state' ... RETURNING *`. If the row count returned is zero, the transition was invalid (race condition or wrong current state). This is atomic without a separate SELECT.

**When to use:** Every execution lifecycle transition: queued → running, running → completed, etc.

**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/update
import { db, executions } from '@claw/db';
import { eq, and } from 'drizzle-orm';

async function transitionExecution(
  executionId: string,
  fromStatus: string,
  toStatus: string,
): Promise<boolean> {
  const updated = await db
    .update(executions)
    .set({ status: toStatus as any, updatedAt: new Date() })
    .where(
      and(
        eq(executions.id, executionId),
        eq(executions.status, fromStatus as any),
      )
    )
    .returning({ id: executions.id });

  return updated.length === 1; // false = race condition, already transitioned
}
```

**Key insight:** This pattern prevents double-transitions under concurrent requests without a transaction or advisory lock. The WHERE clause acts as the lock.

### Pattern 3: BullMQ Task Queue with Worker Processor

**What:** The Planner writes task records to Postgres AND adds jobs to a BullMQ Queue in the same logical operation (not necessarily in a DB transaction — see Pitfall 2). Workers process jobs with automatic lock renewal via the built-in heartbeat. BullMQ's `stalledInterval` timer automatically detects expired locks and moves jobs back to `waiting`.

**When to use:** Task creation (Planner) and task consumption (Bot Orchestrator).

**Example:**
```typescript
// Source: https://docs.bullmq.io/readme-1 and https://docs.bullmq.io/guide/workers
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

// Queue connection — maxRetriesPerRequest default (fast fail for producers)
const queueConnection = new IORedis({ host: 'localhost', port: 6379 });

// Worker connection — maxRetriesPerRequest: null (infinite retry for background workers)
const workerConnection = new IORedis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
});

const TASK_QUEUE_NAME = 'claw-tasks';

// Producer: add a task job to the queue
const taskQueue = new Queue<{ taskId: string; executionId: string; description: string }>(
  TASK_QUEUE_NAME,
  { connection: queueConnection }
);

await taskQueue.add('task', { taskId, executionId, description }, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
});

// Consumer (inside bot container or orchestrator):
const worker = new Worker<{ taskId: string; executionId: string; description: string }>(
  TASK_QUEUE_NAME,
  async (job: Job) => {
    const { taskId, executionId, description } = job.data;
    // Update DB: tasks SET status='claimed', claimed_by_bot_id=botId WHERE id=taskId
    // Do work...
    // Update DB: tasks SET status='completed'
    return { result: '...' };
  },
  {
    connection: workerConnection,
    lockDuration: 30_000,      // 30s lock; bot must complete or extend within this window
    stalledInterval: 15_000,   // check for stalled jobs every 15s
    maxStalledCount: 2,        // allow 2 stalls before failing permanently
    concurrency: 1,            // one task per worker (one task per bot)
  },
);

// CRITICAL: must attach error handler or worker stops silently on error
worker.on('error', (err) => console.error('Worker error:', err));
```

### Pattern 4: Dockerode Container Spawn with HostConfig Constraints

**What:** The Bot Orchestrator creates stub bot containers via `docker.createContainer()` with CPU/memory caps, a custom Docker network, no persistent filesystem (no volume mounts), and environment variables for JWT injection. The container is auto-removed on exit (`AutoRemove: true`).

**When to use:** `BotOrchestrator.spawnBot()`.

**Example:**
```typescript
// Source: https://github.com/apocas/dockerode
import Docker from 'dockerode';

// Auto-detects socket: /var/run/docker.sock (Linux) or user socket (macOS)
const docker = new Docker();

async function spawnBotContainer(opts: {
  botId: string;
  executionId: string;
  jwtToken: string;
  networkName: string;
  imageTag: string;
}): Promise<string> {
  const container = await docker.createContainer({
    Image: opts.imageTag,
    name: `claw-bot-${opts.botId}`,
    Env: [
      `BOT_ID=${opts.botId}`,
      `EXECUTION_ID=${opts.executionId}`,
      `BOT_JWT=${opts.jwtToken}`,
      `REDIS_URL=redis://redis:6379`,
      `POSTGRES_URL=postgresql://postgres:postgres@postgres:5432/clawdb`,
    ],
    HostConfig: {
      Memory: 512 * 1024 * 1024,    // 512 MB limit
      NanoCpus: 1_000_000_000,       // 1 CPU in nanocpus (10^9 = 1 CPU)
      NetworkMode: opts.networkName, // bot-internal network (no egress)
      AutoRemove: true,              // clean up on exit
      // No Binds — no persistent filesystem (ORCH-04)
    },
  });

  await container.start();
  const info = await container.inspect();
  return info.Id; // containerId stored in bots.container_id
}
```

**macOS socket note:** On macOS with Docker Desktop 4.18+, the socket is at `/Users/<user>/.docker/run/docker.sock`. Pass `socketPath` explicitly or set `DOCKER_HOST` env variable. `new Docker()` defaults to `/var/run/docker.sock` which may not exist. For local dev, set `DOCKER_HOST=unix:///Users/<user>/.docker/run/docker.sock` or use `new Docker({ socketPath: process.env.DOCKER_SOCKET_PATH ?? '/var/run/docker.sock' })`.

### Pattern 5: Short-Lived JWT Injection via jose

**What:** Before spawning each bot container, the orchestrator mints a short-lived JWT signed with a shared secret. The JWT encodes `botId`, `executionId`, and an expiry of 15 minutes. The bot reads this JWT from the `BOT_JWT` environment variable and uses it to authenticate against the Task Queue or Tool Gateway.

**When to use:** `BotOrchestrator.spawnBot()` — call `mintBotJwt()` before `createContainer`.

**Example:**
```typescript
// Source: https://github.com/panva/jose
import * as jose from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.BOT_JWT_SECRET!);

export async function mintBotJwt(botId: string, executionId: string): Promise<string> {
  return new jose.SignJWT({ botId, executionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(botId)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(JWT_SECRET);
}

export async function verifyBotJwt(token: string): Promise<{ botId: string; executionId: string }> {
  const { payload } = await jose.jwtVerify(token, JWT_SECRET);
  return { botId: payload.botId as string, executionId: payload.executionId as string };
}
```

### Pattern 6: Pub/Sub Event Emission with Emulator Support

**What:** Bot lifecycle events (`bot_started`, `bot_stopped`, `task_claimed`, `task_completed`) are published to Pub/Sub topics. The `PUBSUB_EMULATOR_HOST` env variable automatically routes to the local emulator from Phase 1's `docker-compose.dev.yml`. Payloads are validated with `@claw/event-schemas` Zod schemas before publishing.

**When to use:** All `ORCH-06` lifecycle events.

**Example:**
```typescript
// Source: https://github.com/googleapis/nodejs-pubsub
import { PubSub } from '@google-cloud/pubsub';
import { botStartedEventSchema, type BotStartedEvent } from '@claw/event-schemas';

// PUBSUB_EMULATOR_HOST=localhost:8085 → routes to local emulator automatically
const pubsub = new PubSub({ projectId: process.env.GCP_PROJECT_ID });

export async function publishBotStarted(event: BotStartedEvent): Promise<void> {
  // Validate before publishing
  botStartedEventSchema.parse(event);
  const data = Buffer.from(JSON.stringify(event));
  await pubsub.topic('bot-events').publishMessage({ data });
}
```

### Pattern 7: Idle Bot Termination via setInterval

**What:** The Bot Orchestrator tracks each bot's `lastTaskClaimedAt` timestamp. A periodic check (`setInterval`) identifies bots idle for > 5 minutes and calls `container.stop()` + emits `bot_stopped` event with `reason: 'idle_timeout'`. This satisfies ORCH-05.

**When to use:** Orchestrator module initialization.

**Example:**
```typescript
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const CHECK_INTERVAL_MS = 30_000;       // check every 30 seconds

// Bot registry: botId → { container, lastTaskClaimedAt, executionId }
const botRegistry = new Map<string, BotEntry>();

const idleChecker = setInterval(async () => {
  const now = Date.now();
  for (const [botId, entry] of botRegistry.entries()) {
    if (now - entry.lastTaskClaimedAt > IDLE_TIMEOUT_MS) {
      await entry.container.stop();
      botRegistry.delete(botId);
      await publishBotStopped({ type: 'bot_stopped', botId, reason: 'idle_timeout', ... });
    }
  }
}, CHECK_INTERVAL_MS);
```

### Anti-Patterns to Avoid

- **Using manual `getNextJob` when Worker + processor suffices:** The manual pattern requires starting the stalled check timer, managing the processing loop, and handling lock extension manually. Use `new Worker(name, processor, options)` for Phase 2.
- **Sharing a single ioredis connection between Queue and Worker instances:** Workers need `maxRetriesPerRequest: null`; Queues should use the default. Mixing them causes either stalled workers (if null on Queue) or unresponsive workers (if default on Worker connection). Create separate connections.
- **Not attaching an error handler to Worker:** Without `worker.on('error', ...)`, unhandled errors stop job processing silently. Always attach the error handler immediately after creating a Worker.
- **Storing secrets in Drizzle column instead of injecting via Env:** Bot JWTs are ephemeral. They must be injected via `Env` in `createContainer` and expire. Do not store them in the `bots` table.
- **Using `AutoRemove: false` without explicit cleanup logic:** `AutoRemove: true` ensures containers are cleaned up when the process exits. Without it, stopped containers accumulate in Docker until manually pruned.
- **Attempting to use Cloud Run Jobs API for local Phase 2 development:** Cloud Run Jobs require a provisioned GCP project, Artifact Registry image, and VPC. Local dev uses dockerode on the host Docker socket exclusively. Cloud Run Jobs is the Phase 3+ GCP target.
- **Calling `container.stop()` without a timeout:** By default, `container.stop()` sends SIGTERM and waits 10 seconds. Use `container.stop({ t: 5 })` for a 5-second grace period to match idle timeout semantics.
- **Building the Planner as a real LLM call in Phase 2:** The success criteria says "verifiable without real LLM calls." The Phase 2 Planner must be a stub — produce N hardcoded or string-split task descriptions. The LLM-backed planner is Phase 3+.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job lock and stall detection | Custom Redis lock + heartbeat timer | BullMQ `lockDuration` + `stalledInterval` | BullMQ uses Lua scripts for atomic lock operations in Redis. Custom implementations always have race conditions during the lock renewal gap. |
| Atomic job claiming (no double-claim) | SELECT FOR UPDATE on tasks table | BullMQ's built-in Redis lock + atomic move-to-active | BullMQ uses a single atomic Redis operation (BRPOPLPUSH or equivalent) to claim jobs. Postgres row locks work but require a persistent DB connection per bot, which doesn't scale. |
| JWT signing and verification | Custom HMAC + base64 | jose `SignJWT` + `jwtVerify` | Handles algorithm selection, claim validation, expiry checking, and edge cases (clock skew, invalid signatures). Custom implementations miss edge cases. |
| HTTP request validation | Manual `if (!body.objective)` checks | Fastify JSON Schema (TypeBox) | TypeBox schemas validate at the framework level before the handler is called. Manual validation is incomplete, untested, and produces inconsistent error messages. |
| Docker container lifecycle management | Raw HTTP calls to Docker daemon | dockerode | The Docker Remote API has many undocumented quirks around container state. dockerode handles stream management, JSON parsing, and error handling. |
| Pub/Sub payload validation | `typeof payload.botId === 'string'` | `@claw/event-schemas` Zod v4 schemas | Zod schemas are the canonical contract definition from Phase 1. Using them at the publish site ensures publishers and subscribers agree on shape. |

**Key insight:** BullMQ's stall detection eliminates the need to write any custom heartbeat or lease renewal code. The `lockDuration` + `stalledInterval` configuration is all that's needed for ORCH-03.

---

## Common Pitfalls

### Pitfall 1: IORedis `maxRetriesPerRequest` Must Be `null` for Workers

**What goes wrong:** Worker creates an ioredis connection with default `maxRetriesPerRequest` (20). When Redis temporarily drops and reconnects, the worker throws `Command timed out` after 20 retries and stops processing. Since this is a background worker, the failure is silent.

**Why it happens:** Worker's blocking commands (BRPOPLPUSH equivalent) need to wait indefinitely for Redis to be available. The default retry limit is designed for user-facing operations that need fast failure feedback.

**How to avoid:** Always create worker ioredis connections with `maxRetriesPerRequest: null`. Create separate connection instances for Queue (use default) and Worker (use null).

**Warning signs:** Worker stops processing after Redis restart; no error in logs; jobs pile up in waiting state.

### Pitfall 2: Dual-Write Consistency Between Postgres and BullMQ Queue

**What goes wrong:** The Planner writes tasks to `tasks` table and adds jobs to BullMQ. If the BullMQ `add` fails after the DB write succeeds, tasks exist in Postgres but are never queued. If the DB write fails after the BullMQ add succeeds, a job exists in the queue with no corresponding DB row.

**Why it happens:** These are two separate data stores with no two-phase commit.

**How to avoid:** Write to BullMQ first (Redis is ephemeral; if this fails, nothing is persisted). Then write to Postgres. If the Postgres write fails, the BullMQ job will be processed but the worker will find no DB row and fail the job — use `maxStalledCount` to control retry behavior. Alternatively, write to Postgres first and treat the BullMQ queue as a cache of pending DB rows (workers can query Postgres directly). For Phase 2, the simpler "write to Redis first, then Postgres" approach is acceptable — document the eventual consistency window.

**Warning signs:** Tasks visible in DB with status 'pending' but no corresponding BullMQ job; or BullMQ jobs completing with DB task still in 'pending' state.

### Pitfall 3: macOS Docker Socket Path Mismatch

**What goes wrong:** `new Docker()` defaults to `/var/run/docker.sock`. On macOS with Docker Desktop 4.18+, this path does not exist. The orchestrator fails with `ENOENT /var/run/docker.sock`.

**Why it happens:** Docker Desktop 4.18+ moved the socket to `$HOME/.docker/run/docker.sock` on macOS.

**How to avoid:** Use an environment variable for the socket path: `new Docker({ socketPath: process.env.DOCKER_SOCKET_PATH ?? '/var/run/docker.sock' })`. In `.env.local`, set `DOCKER_SOCKET_PATH=/Users/<user>/.docker/run/docker.sock`. Alternatively, set `DOCKER_HOST=unix:///var/run/docker.sock` which creates a symlink on newer Docker Desktop versions.

**Warning signs:** `Error: connect ENOENT /var/run/docker.sock` when running the orchestrator on macOS.

### Pitfall 4: Container `stop()` Does Not Remove Container Without `AutoRemove`

**What goes wrong:** `container.stop()` sends SIGTERM and halts the container but leaves it in "exited" state. Repeated test runs accumulate stopped containers. `docker ps -a` shows many `claw-bot-*` containers in `Exited` state.

**Why it happens:** `stop()` and `remove()` are separate operations. `AutoRemove: true` in HostConfig is the only way to ensure automatic cleanup.

**How to avoid:** Always set `AutoRemove: true` in `HostConfig` for bot containers. If `AutoRemove` is not used, call `container.remove()` after `container.stop()` in the orchestrator's cleanup path.

**Warning signs:** `docker ps -a | grep claw-bot` shows many exited containers; Docker complains about name conflicts when spawning a bot with the same ID.

### Pitfall 5: Fastify Plugin Encapsulation Breaks Shared DB Connection

**What goes wrong:** The `db` Drizzle client is registered in one Fastify plugin. Route handlers in another plugin cannot access it because Fastify's encapsulation isolates plugin scopes.

**Why it happens:** Fastify's `register()` creates a new scope. Decorators from a child scope are not visible to other plugins.

**How to avoid:** Use `fastify-plugin` to wrap the DB plugin, which disables encapsulation and makes `fastify.db` globally accessible:

```typescript
import fp from 'fastify-plugin';
import { db } from '@claw/db';

export default fp(async (fastify) => {
  fastify.decorate('db', db);
});
```

Then in route files, access via `fastify.db`. For Phase 2, it's simpler to just import `{ db }` from `@claw/db` directly in route handlers — avoid over-engineering with plugin decorators unless DI is explicitly needed.

**Warning signs:** `fastify.db is not a function` or TypeScript error `Property 'db' does not exist on type 'FastifyInstance'` in route handlers.

### Pitfall 6: BullMQ Stall Detection Only Works if `stalledInterval` Timer Fires

**What goes wrong:** Jobs are claimed but never completed; they should be reassigned after `lockDuration` expires. But stalled jobs are never reassigned because no process is running the stalled check.

**Why it happens:** In the standard `new Worker(name, processor, options)` pattern, BullMQ automatically runs the stall checker. But in the manual `getNextJob` pattern, `worker.startStalledCheckTimer()` must be called explicitly.

**How to avoid:** For Phase 2, use the standard Worker + processor pattern. The stall checker runs automatically. If manual processing is needed in Phase 3, remember to call `await worker.startStalledCheckTimer()`.

**Warning signs:** Jobs sit in "active" state indefinitely after a bot crash; `stalledInterval` timer is not visible in logs.

### Pitfall 7: Drizzle `noUncheckedIndexedAccess` and `.returning()` Result Handling

**What goes wrong:** Code does `const [row] = await db.update(...).returning()` and accesses `row.id`. With `noUncheckedIndexedAccess: true` in `tsconfig.base.json` (which this project uses), TypeScript infers `row` as `typeof result[0]` which is `undefined | Row`. Accessing `row.id` without a null check is a type error.

**Why it happens:** `noUncheckedIndexedAccess` makes array index access return `T | undefined`. This is enabled in the project's `tsconfig.base.json`.

**How to avoid:**

```typescript
const result = await db.update(executions).set(...).where(...).returning({ id: executions.id });
if (result.length === 0) throw new Error('State transition failed');
const row = result[0]!; // safe because we checked length > 0
```

Or use `result.at(0)` which returns `T | undefined` but is explicit about the possibility.

**Warning signs:** TypeScript error `Object is possibly 'undefined'` when destructuring from `.returning()` result.

---

## Code Examples

Verified patterns from official sources:

### Fastify App Bootstrap (ESM, TypeScript)

```typescript
// services/execution-service/src/app.ts
// Source: https://fastify.dev/docs/latest/Reference/TypeScript/
import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { executionsRoutes } from './routes/executions.js';

export function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  app.register(executionsRoutes, { prefix: '/executions' });

  return app;
}
```

```typescript
// services/execution-service/src/main.ts
import { buildApp } from './app.js';

const app = buildApp();
const port = Number(process.env.PORT ?? 3001);

try {
  await app.listen({ port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
```

### BullMQ Queue + Worker Setup with Connection Separation

```typescript
// services/execution-service/src/queue/task-queue.ts
// Source: https://docs.bullmq.io/guide/connections
import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// Queue connection: fast-fail for producers
export const queueConnection = new IORedis(REDIS_URL);

// Worker connection: infinite retry for background processing
export const workerConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

export interface TaskJobData {
  taskId: string;
  executionId: string;
  description: string;
}

export const taskQueue = new Queue<TaskJobData>('claw-tasks', {
  connection: queueConnection,
});

export function createTaskWorker(
  processor: (job: Job<TaskJobData>) => Promise<string>,
) {
  const worker = new Worker<TaskJobData, string>('claw-tasks', processor, {
    connection: workerConnection,
    lockDuration: 30_000,
    stalledInterval: 15_000,
    maxStalledCount: 2,
    concurrency: 1,
  });

  // CRITICAL: attach error handler
  worker.on('error', (err) => {
    console.error('[TaskWorker] Error:', err);
  });

  return worker;
}
```

### Execution Lifecycle Service (State Machine)

```typescript
// services/execution-service/src/services/execution.service.ts
// Source: https://orm.drizzle.team/docs/update
import { db, executions, tasks } from '@claw/db';
import { eq, and } from 'drizzle-orm';

export async function createExecution(input: {
  objective: string;
  maxBots: number;
  budgetCapCents: number | null;
  runtimeLimitSeconds: number | null;
  allowedTools: string[];
}): Promise<{ executionId: string; status: 'queued' }> {
  const [execution] = await db.insert(executions).values({
    objective: input.objective,
    maxBots: input.maxBots,
    budgetCapCents: input.budgetCapCents ?? 0,
    runtimeLimitSeconds: input.runtimeLimitSeconds ?? 3600,
    allowedTools: input.allowedTools,
    status: 'queued',
  }).returning({ id: executions.id });

  if (!execution) throw new Error('Failed to create execution');
  return { executionId: execution.id, status: 'queued' };
}

export async function transitionExecution(
  executionId: string,
  from: string,
  to: string,
): Promise<boolean> {
  const result = await db
    .update(executions)
    .set({ status: to as any, updatedAt: new Date() })
    .where(and(eq(executions.id, executionId), eq(executions.status, from as any)))
    .returning({ id: executions.id });
  return result.length === 1;
}
```

### Stub Planner (Deterministic, No LLM)

```typescript
// services/execution-service/src/services/planner.service.ts
// No LLM calls — Phase 2 stub only. Phase 3 replaces with real LLM decomposition.
export interface PlannedTask {
  description: string;
}

export function planObjective(objective: string, maxTasks = 3): PlannedTask[] {
  // Flat parallel split: N independent tasks derived from the objective
  // This is intentionally naive — the point is to produce N tasks for testing
  const baseDescription = objective.trim();
  return Array.from({ length: maxTasks }, (_, i) => ({
    description: `${baseDescription} (subtask ${i + 1} of ${maxTasks})`,
  }));
}
```

### Dockerode Bot Spawn

```typescript
// services/execution-service/src/orchestrator/bot-orchestrator.ts
// Source: https://github.com/apocas/dockerode
import Docker, { type Container } from 'dockerode';
import { mintBotJwt } from './jwt.js';

const docker = new Docker({
  socketPath: process.env.DOCKER_SOCKET_PATH ?? '/var/run/docker.sock',
});

export async function spawnBot(opts: {
  botId: string;
  executionId: string;
  imageTag: string;
  networkName: string;
}): Promise<string> {
  const jwtToken = await mintBotJwt(opts.botId, opts.executionId);

  const container = await docker.createContainer({
    Image: opts.imageTag,
    name: `claw-bot-${opts.botId}`,
    Env: [
      `BOT_ID=${opts.botId}`,
      `EXECUTION_ID=${opts.executionId}`,
      `BOT_JWT=${jwtToken}`,
      `REDIS_URL=${process.env.REDIS_URL}`,
      `DATABASE_URL=${process.env.DATABASE_URL}`,
    ],
    HostConfig: {
      Memory: 512 * 1024 * 1024,  // 512 MB
      NanoCpus: 1_000_000_000,    // 1 CPU
      NetworkMode: opts.networkName,
      AutoRemove: true,
    },
  });

  await container.start();
  const info = await container.inspect();
  return info.Id;
}

export async function stopBot(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);
  await container.stop({ t: 5 }); // 5-second grace period
  // AutoRemove: true handles container.remove() automatically
}
```

### POST /executions Route Handler

```typescript
// services/execution-service/src/routes/executions.ts
import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createExecution } from '../services/execution.service.js';
import { planObjective } from '../services/planner.service.js';
import { taskQueue } from '../queue/task-queue.js';
import { db, tasks } from '@claw/db';
import { spawnBot } from '../orchestrator/bot-orchestrator.js';

const CreateExecutionBody = Type.Object({
  objective: Type.String({ minLength: 1 }),
  maxBots: Type.Integer({ minimum: 1, maximum: 20 }),
  budgetCapCents: Type.Optional(Type.Integer({ minimum: 0 })),
  runtimeLimitSeconds: Type.Optional(Type.Integer({ minimum: 60 })),
  allowedTools: Type.Array(Type.String()),
});

const CreateExecutionReply = Type.Object({
  executionId: Type.String(),
  status: Type.Literal('queued'),
});

export const executionsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post('/', {
    schema: { body: CreateExecutionBody, response: { 201: CreateExecutionReply } },
  }, async (request, reply) => {
    const { objective, maxBots, budgetCapCents, runtimeLimitSeconds, allowedTools } = request.body;

    // 1. Create execution (status: 'queued')
    const { executionId } = await createExecution({
      objective, maxBots, budgetCapCents: budgetCapCents ?? null,
      runtimeLimitSeconds: runtimeLimitSeconds ?? null, allowedTools,
    });

    // 2. Plan tasks (stub — no LLM)
    const plannedTasks = planObjective(objective, maxBots);

    // 3. Write tasks to DB and queue (async — do not await in request handler)
    setImmediate(async () => {
      for (const planned of plannedTasks) {
        const [task] = await db.insert(tasks).values({
          executionId, description: planned.description,
        }).returning({ id: tasks.id });
        if (task) {
          await taskQueue.add('task', { taskId: task.id, executionId, description: planned.description });
        }
      }
      // 4. Transition to running and spawn bots
      // (orchestrator handles this in the full implementation)
    });

    return reply.code(201).send({ executionId, status: 'queued' });
  });

  fastify.get('/:id', {
    schema: { params: Type.Object({ id: Type.String() }) },
  }, async (request, reply) => {
    const { id } = request.params;
    const { db: drizzleDb, executions: executionsTable } = await import('@claw/db');
    const { eq } = await import('drizzle-orm');
    const [execution] = await drizzleDb.select().from(executionsTable).where(eq(executionsTable.id, id));
    if (!execution) return reply.code(404).send({ error: 'Not found' });
    return execution;
  });
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `bull` (npm) | BullMQ 5 | 2021 → maintained | bull is unmaintained; BullMQ is the successor with TypeScript-native API |
| Express for microservices | Fastify 5 | 2024 | Fastify 5 has `withTypeProvider` that eliminates manual generics on routes |
| `jsonwebtoken` for JWT | `jose` | 2022+ | jose is async-native, zero-dep, runs in all runtimes; jsonwebtoken is callback-based |
| Dockerfile CMD for secrets | Container Env injection | Always recommended | Never bake secrets into images; inject via environment at runtime |
| Single ioredis connection for all BullMQ instances | Separate connections for Queue vs Worker | BullMQ 4+ documented | Queue maxRetriesPerRequest defaults; Worker must use null |
| Cloud Run Jobs (long-term GCP target) | dockerode on local Docker (Phase 2 dev) | Pre-phase decision | Cloud Run Jobs has latency anomalies under API contention; local dockerode is sub-second for MVP |

**Deprecated/outdated:**
- `bull` (npm package): Unmaintained since 2021. BullMQ is the maintained successor by the same team.
- Fastify 4 `loggerInstance` option: Removed in Fastify 5. Use `logger: { ... }` options object instead.
- `bcrypt` + custom session for bot auth: Not applicable to short-lived bot JWTs; use `jose` with expiry.

---

## Open Questions

1. **Cloud Run Jobs vs dockerode on GCE VM (THE critical unresolved fork)**
   - What we know: Cloud Run Jobs API has documented latency anomalies (3s typical, up to 87s during gRPC queue timeout conditions, per user reports). dockerode on the local Docker socket is sub-second. The prior decisions section explicitly flags this as "NEEDS prototype validation in Phase 2."
   - What's unclear: Cloud Run Jobs startup latency under normal conditions with pre-built images already in Artifact Registry; whether the gRPC timeout issue is reproducible or a one-off; minimum warm-up latency for GCP-hosted containers.
   - Recommendation: Create an explicit prototype task in Plan 02-04 (or a separate spike plan) that provisions a Cloud Run Job via the Node.js `@google-cloud/run` client, measures p50/p95 job-start latency, and documents the finding. This prototype gates the Phase 3 GCP deployment decision. For Phase 2 local development, dockerode on the host socket is the only correct choice.

2. **Dual-write consistency between Postgres (tasks) and BullMQ (queue jobs)**
   - What we know: There is no distributed transaction between Redis and Postgres. Write order determines failure mode: BullMQ first → orphan job on Postgres failure (bot processes job with no DB row); Postgres first → orphan DB row on BullMQ failure (task in 'pending' forever).
   - What's unclear: Which failure mode is preferable for Phase 2. Both are recoverable.
   - Recommendation: Write to Postgres first (create task row). Then add to BullMQ queue. If BullMQ add fails, the task row remains in 'pending' — a background reconciler can re-enqueue pending tasks that are older than N seconds (simple polling query). This avoids orphan queue jobs with no DB record, which is the harder failure mode to detect. Document this in Plan 02-03.

3. **Bot container image for Phase 2 stub**
   - What we know: ORCH-01 requires spawning "stub bot containers." The container must be able to (a) start, (b) claim tasks from BullMQ, and (c) emit heartbeats. The Phase 2 bot is explicitly a stub — it doesn't use real LLMs.
   - What's unclear: Whether the stub bot is a TypeScript process (heavyweight) or a minimal shell script (lightweight). The success criteria says "all verifiable without real LLM calls."
   - Recommendation: Build the stub bot as a minimal Node.js TypeScript process that: (a) reads `BOT_JWT` from env, (b) connects to Redis and runs a BullMQ Worker, (c) claims tasks and marks them complete after a fixed delay (e.g., 1-2 seconds), (d) sends heartbeat via BullMQ's built-in lock renewal. A Dockerfile based on `node:20-alpine` is sufficient. The full bot implementation (real LLM, tool calls) is Phase 3.

4. **Whether tasks table `leaseExpiresAt` column is still needed with BullMQ**
   - What we know: BullMQ manages lease/lock state in Redis (not Postgres). The `tasks.leaseExpiresAt` Postgres column from Phase 1 schema was designed for a Postgres-based lease system.
   - What's unclear: Whether to write `leaseExpiresAt` to Postgres when a bot claims a task (duplicating Redis state) or treat it as Phase 4+ bookkeeping.
   - Recommendation: When a bot claims a task, write `leaseExpiresAt = now + lockDuration` to the tasks row as a soft audit field. This enables visibility in `GET /executions/:id` without querying Redis. Do not rely on it for actual lease enforcement — BullMQ Redis lock is the authoritative source.

5. **`setImmediate` vs background worker for orchestration triggers**
   - What we know: After POST /executions returns 201 (within 1 second per success criteria), the system must still decompose tasks, queue them, and spawn bots. If all this is done synchronously in the route handler, the 1-second SLA is at risk.
   - What's unclear: Whether to use `setImmediate` (fire-and-forget in-process), a separate BullMQ orchestration queue, or a separate process.
   - Recommendation: For Phase 2, use `setImmediate` or `process.nextTick` after returning 201. This keeps the architecture simple (single process for MVP). The risk is that in-process async work can fail silently. Add try/catch with `fastify.log.error()` inside the async block. A separate orchestration queue is the Phase 3+ improvement.

---

## Sources

### Primary (HIGH confidence)

- https://docs.bullmq.io/readme-1 — BullMQ Quick Start, Queue and Worker setup
- https://docs.bullmq.io/guide/workers/stalled-jobs — Stalled job detection mechanism, lockDuration, stalledInterval
- https://docs.bullmq.io/guide/connections — ioredis connection setup, maxRetriesPerRequest requirements
- https://docs.bullmq.io/patterns/manually-fetching-jobs — Manual getNextJob pattern and when NOT to use it
- https://api.docs.bullmq.io/interfaces/v4.WorkerOptions.html — WorkerOptions interface with all configuration fields and defaults
- https://orm.drizzle.team/docs/update — Drizzle UPDATE with WHERE + `.returning()` pattern
- https://orm.drizzle.team/docs/transactions — Drizzle transaction API with PostgreSQL isolation levels
- https://github.com/apocas/dockerode — dockerode README, createContainer API, HostConfig options
- https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/dockerode/index.d.ts — TypeScript types for dockerode ContainerCreateOptions and HostConfig
- https://github.com/panva/jose — jose JWT signing (SignJWT, jwtVerify) API
- https://fastify.dev/docs/latest/Reference/TypeScript/ — Fastify TypeScript patterns, route generics
- https://fastify.dev/docs/latest/Guides/Plugins-Guide/ — Fastify plugin architecture, encapsulation, fastify-plugin
- https://github.com/googleapis/nodejs-pubsub — Pub/Sub Node.js client, PUBSUB_EMULATOR_HOST

### Secondary (MEDIUM confidence)

- https://github.com/apocas/docker-modem/issues/156 — macOS Docker socket path change in Docker Desktop 4.18+
- https://discuss.google.dev/t/long-response-times-when-running-a-cloud-run-job-through-api/142552 — Cloud Run Jobs API latency anomalies (user-reported, not official benchmark)
- https://oneuptime.com/blog/post/2026-01-21-bullmq-unit-testing/view — BullMQ unit testing patterns with Vitest (2026, recently published)
- npm show outputs — Versions verified: bullmq@5.69.3, dockerode@4.0.9, fastify@5.7.4, jose@6.1.3, ioredis@5.9.3, @sinclair/typebox@0.34.48, vitest@4.0.18

### Tertiary (LOW confidence — validate before acting)

- Cloud Run Jobs startup latency under normal conditions: "1-3 seconds" for cold starts from multiple forum discussions, but no official Google benchmark data found. Must be validated via prototype.
- dockerode `NanoCpus` field behavior in Docker Desktop for Mac: Documented in Docker Remote API spec but not tested locally. Linux behavior well-documented.

---

## Metadata

**Confidence breakdown:**
- Standard stack (versions, packages): HIGH — verified via npm show and official docs
- BullMQ patterns (Worker, lockDuration, stalledInterval, connections): HIGH — verified from official BullMQ docs and API reference
- Drizzle state machine patterns (.returning(), transactions): HIGH — verified from official Drizzle docs
- dockerode API (createContainer, HostConfig): HIGH for core API; MEDIUM for macOS socket behavior (community-reported, PR merged)
- jose JWT signing: HIGH — verified from official GitHub README
- Fastify TypeScript + TypeBox: HIGH — verified from official Fastify docs
- Cloud Run Jobs vs dockerode latency comparison: LOW — user reports only, no official benchmark
- Dual-write consistency strategy: MEDIUM — standard distributed systems pattern, no Claw-specific validation

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (30 days — all libraries are stable; BullMQ 5.x and Fastify 5.x are not in major churn)
