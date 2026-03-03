# Phase 40: Landing Page and Platform Polish - Research

**Researched:** 2026-03-03
**Domain:** SvelteKit form actions, Fastify route extension, health checks, landing page UI wiring
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| POLISH-01 | "Request access" form on landing page captures email and stores it (or sends to a collection endpoint) | SvelteKit server action pattern established in Phase 37 (new objective); form already exists in `+page.svelte`; needs backend POST /waitlist endpoint + server action wiring |
| POLISH-02 | Footer links on landing page either point to real targets or are removed | Pure UI audit — links in `+page.svelte` footer currently all point to `#access` placeholder; fix by removing or replacing |
| POLISH-03 | `GET /admin/health` endpoint returns system health status (GCE, Cloud SQL, Redis, BullMQ) | `adminRoutes` registered under `/admin` prefix in `app.ts`; Redis, BullMQ, DB all accessible from execution-service; GCE check via `InstancesClient.list()` |
</phase_requirements>

---

## Summary

Phase 40 has three fully independent sub-tasks. POLISH-01 requires wiring the landing page email form (already rendered as a static `<input>`) to submit to a backend endpoint. POLISH-02 is a pure HTML audit — the footer contains six links all pointing to `#access` (Documentation, Status, Changelog, About, Contact, Privacy) that need to either resolve to real pages or be removed. POLISH-03 adds a `GET /admin/health` handler to the existing `adminRoutes` plugin that performs liveness probes on all four subsystems.

No new packages are needed. All four subsystems (GCE, Cloud SQL, Redis, BullMQ) are already instantiated in the execution-service codebase. The landing page already renders the email form — the only gap is SvelteKit server action wiring and the backend storage/forwarding endpoint.

**Primary recommendation:** Implement all three plans in parallel — they share no code. Deliver POLISH-01 as a SvelteKit form action + Fastify POST /waitlist (store to DB or log), POLISH-02 as a single file edit to `+page.svelte`, and POLISH-03 as an additive handler in `admin.ts`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SvelteKit Actions | ^2.52.0 | Server-side form handling for POLISH-01 | Established pattern in Phase 37 (`objectives/new/+page.server.ts`) |
| Fastify TypeBox | ^6.1.0 | Typed route handler for POLISH-03 `/admin/health` | Used throughout execution-service |
| ioredis | ^5.9.3 | Redis PING health check | Already imported in `metrics.ts`, `guardrail-watchdog.ts`, etc. |
| @google-cloud/compute | ^4.9.0 | GCE instance list/aggregate for health check | Already in `gce-bot-launcher.ts`, `bot-orchestrator.ts` |
| drizzle-orm | ^0.45.1 | Cloud SQL health check via simple query | Already used everywhere; `db.execute(sql\`SELECT 1\`)` pattern |
| bullmq Queue | ^5.69.3 | Queue metrics for health check | `taskQueue` already exported from `task-queue.ts` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @sinclair/typebox | ^0.34.48 | Schema for health response shape | POLISH-03 only |
| @sveltejs/kit fail/redirect | ^2.52.0 | SvelteKit action error handling | POLISH-01 server action |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DB storage for waitlist | Email forwarding (SendGrid/Resend) | No email service is configured; DB is simpler for now; can swap later |
| BullMQ queue.getJobCounts() | Custom Redis ping | queue.getJobCounts() is the BullMQ-idiomatic health check — prefer it |
| Full GCE instance count | Simple API call with timeout | List call with a short timeout sufficient; no need for a real metrics dashboard |

**Installation:** No new packages needed — all dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure

For POLISH-01:
```
services/ui/src/routes/
└── +page.svelte          # Add <form method="POST" action="?/requestAccess"> around existing input
└── +page.server.ts       # NEW — Actions: { requestAccess } server action

services/execution-service/src/routes/
└── admin.ts              # Add POST /waitlist (or keep in admin prefix)
```

For POLISH-03:
```
services/execution-service/src/routes/
└── admin.ts              # Add GET /health handler alongside existing POST /cleanup/decision-traces
```

### Pattern 1: SvelteKit Form Action (POLISH-01)

**What:** Convert the static `<input type="email">` + `<a href="#access">` button in the `#access` section into a real `<form>` with a server action. The server action POSTs email to the execution service's `/waitlist` endpoint (or stores directly).

**When to use:** Established pattern from Phase 37 (`objectives/new/+page.server.ts`).

**Example — `+page.server.ts`:**
```typescript
// Source: services/ui/src/routes/objectives/new/+page.server.ts (Phase 37 pattern)
import { fail } from '@sveltejs/kit';
import type { Actions } from '@sveltejs/kit';

export const actions: Actions = {
  requestAccess: async (event) => {
    const formData = await event.request.formData();
    const email = (formData.get('email') as string | null)?.trim();
    if (!email || !email.includes('@')) {
      return fail(400, { error: 'A valid email address is required.' });
    }

    const executionServiceUrl = process.env.EXECUTION_SERVICE_URL;
    if (!executionServiceUrl) {
      return fail(500, { error: 'Server configuration error.' });
    }

    let res: Response;
    try {
      res = await fetch(`${executionServiceUrl}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      return fail(503, { error: 'Could not reach server. Please try again.' });
    }

    if (!res.ok) {
      return fail(res.status, { error: 'Failed to submit. Please try again.' });
    }

    return { success: true };
  },
};
```

**Example — `+page.svelte` form replacement:**
```svelte
<!-- Replace the static .access-form div with: -->
<form method="POST" action="?/requestAccess" class="access-form r d1">
  <input
    type="email"
    name="email"
    class="access-input"
    placeholder="your@email.com"
    required
  />
  <button type="submit" class="btn-primary">Request access</button>
</form>
{#if form?.success}
  <p class="access-note r d2" style="color: var(--teal);">
    You're on the list. We'll reach out when your place is ready.
  </p>
{:else if form?.error}
  <p class="access-note r d2" style="color: var(--rose);">{form.error}</p>
{:else}
  <p class="access-note r d2">No commitment. We will reach out when your place is ready.</p>
{/if}
```

**Important:** The `+page.svelte` uses `<script lang="ts">` (not `<script lang="ts" module>`). The `form` prop must be added:
```svelte
<script lang="ts">
  // SvelteKit injects 'form' when actions return data
  let { form } = $props();
  // ... existing onMount code
</script>
```

### Pattern 2: Waitlist Backend Endpoint (POLISH-01 backend)

**What:** Simple `POST /waitlist` in the existing `adminRoutes` (or as a standalone route). The minimal viable approach: store email in a new DB table or log it to the application logger. A `waitlist_entries` table or a simple `console.log` is acceptable for v5.0 — the requirement says "stores it or forwards it."

**Decision point:** The project uses Drizzle + Postgres. Adding a `waitlist_entries` table requires a migration. The simplest path is either:
1. **Log only**: `app.log.info({ email }, 'waitlist signup')` — zero new schema, email is visible in Cloud Logging. Acceptable for v5.0.
2. **New table**: `CREATE TABLE waitlist_entries (id uuid, email text, created_at timestamptz)`. Requires migration 0014.

Given the project pattern of "avoids migration churn" (see STATE.md decisions), **logging to application logger** is the minimal path. However, since POLISH-01 says "stores or forwards (no silent failure)", a log entry with `app.log.info` satisfies the requirement — Cloud Logging on GCP captures it.

**Example — admin.ts addition:**
```typescript
// POST /admin/waitlist — capture early access email
app.post('/waitlist', {
  schema: {
    body: Type.Object({ email: Type.String({ format: 'email' }) }),
    response: {
      200: Type.Object({ ok: Type.Boolean() }),
      400: Type.Object({ error: Type.String() }),
    },
  },
}, async (request, reply) => {
  const { email } = request.body;
  // Log to application logger (captured by Cloud Logging in production)
  request.log.info({ email }, 'waitlist signup');
  return reply.code(200).send({ ok: true });
});
```

**Note:** The route is registered as `app.register(adminRoutes, { prefix: '/admin' })` in `app.ts`, so the full path is `POST /admin/waitlist`. The UI server action calls `${executionServiceUrl}/waitlist` — adjust to `/admin/waitlist`.

### Pattern 3: GET /admin/health (POLISH-03)

**What:** Health check that probes GCE, Cloud SQL, Redis, and BullMQ. Returns 200 when all healthy, 503 when any subsystem is degraded.

**Pattern for each subsystem:**

```typescript
// Source: execution-service patterns from metrics.ts, guardrail-watchdog.ts, gce-bot-launcher.ts

// Redis health: create a new Redis instance with a short timeout, ping it
import IORedis from 'ioredis';
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

async function checkRedis(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const client = new IORedis(redisUrl, { connectTimeout: 2000, lazyConnect: true });
  try {
    const t0 = Date.now();
    await client.connect();
    await client.ping();
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    client.disconnect();
  }
}

// Cloud SQL health: simple SELECT 1 via drizzle
import { db } from '@claw/db';
import { sql } from 'drizzle-orm';

async function checkCloudSQL(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  try {
    const t0 = Date.now();
    await db.execute(sql`SELECT 1`);
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// BullMQ health: use taskQueue.getJobCounts() — if Redis is up, this succeeds
import { taskQueue } from '../queue/task-queue';

async function checkBullMQ(): Promise<{ ok: boolean; counts?: object; error?: string }> {
  try {
    const counts = await taskQueue.getJobCounts('waiting', 'active', 'failed');
    return { ok: true, counts };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// GCE health: list instances in project/zone with a count check
import { InstancesClient } from '@google-cloud/compute';
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID ?? 'claw-local';
const GCP_ZONE = process.env.GCP_ZONE ?? 'us-central1-a';

async function checkGCE(): Promise<{ ok: boolean; instanceCount?: number; error?: string }> {
  const client = new InstancesClient();
  try {
    const [instances] = await client.list({ project: GCP_PROJECT_ID, zone: GCP_ZONE });
    return { ok: true, instanceCount: instances.length };
  } catch (err) {
    // In local dev without GCP credentials, this will fail — treat as degraded
    return { ok: false, error: String(err) };
  }
}
```

**Full handler in admin.ts:**
```typescript
app.get('/health', {
  schema: {
    response: {
      200: Type.Object({
        status: Type.Literal('healthy'),
        subsystems: Type.Object({
          gce: Type.Object({ ok: Type.Boolean() }),
          cloudSQL: Type.Object({ ok: Type.Boolean() }),
          redis: Type.Object({ ok: Type.Boolean() }),
          bullMQ: Type.Object({ ok: Type.Boolean() }),
        }),
      }),
      503: Type.Object({
        status: Type.Literal('degraded'),
        subsystems: Type.Object({
          gce: Type.Object({ ok: Type.Boolean() }),
          cloudSQL: Type.Object({ ok: Type.Boolean() }),
          redis: Type.Object({ ok: Type.Boolean() }),
          bullMQ: Type.Object({ ok: Type.Boolean() }),
        }),
      }),
    },
  },
}, async (_request, reply) => {
  const [gce, cloudSQL, redis, bullMQ] = await Promise.allSettled([
    checkGCE(),
    checkCloudSQL(),
    checkRedis(),
    checkBullMQ(),
  ]);

  const subsystems = {
    gce: gce.status === 'fulfilled' ? gce.value : { ok: false, error: String(gce.reason) },
    cloudSQL: cloudSQL.status === 'fulfilled' ? cloudSQL.value : { ok: false, error: String(cloudSQL.reason) },
    redis: redis.status === 'fulfilled' ? redis.value : { ok: false, error: String(redis.reason) },
    bullMQ: bullMQ.status === 'fulfilled' ? bullMQ.value : { ok: false, error: String(bullMQ.reason) },
  };

  const allHealthy = Object.values(subsystems).every(s => s.ok);
  const statusCode = allHealthy ? 200 : 503;
  const status = allHealthy ? 'healthy' : 'degraded';

  return reply.code(statusCode).send({ status, subsystems });
});
```

### Pattern 4: Footer Link Audit (POLISH-02)

**What:** The footer in `services/ui/src/routes/+page.svelte` (lines 319–345) has three groups: Platform, Resources, Company. Platform links (`#how`, `#soul`, `#humans`, `#agents`) are anchor links on the same page — these are valid. Resources and Company all point to `#access`:

```
Resources: Documentation → #access, Status → #access, Changelog → #access
Company: About → #access, Contact → #access, Privacy → #access
```

**Decision:** Remove the Resources and Company nav groups entirely OR replace them with anchor links. The simplest fix: remove the entire Resources and Company `<div class="footer-nav-group">` blocks. This eliminates all dead links. The Platform group remains and is fully functional.

### Anti-Patterns to Avoid
- **Creating a new route file for waitlist:** Add to `admin.ts` — it already exists and is already registered under `/admin`. A separate file adds unnecessary complexity for a single endpoint.
- **New Redis connection singleton for health check:** Create a fresh connection per health check request with a short timeout, disconnect after use. Don't create a module-level singleton just for health (it would stay connected, consuming resources).
- **Using `Promise.all` for health checks:** Use `Promise.allSettled` — health checks must complete even if one throws. `Promise.all` would short-circuit on first failure.
- **Crashing health check if GCE API is unavailable:** In local dev, `GCP_PROJECT_ID` defaults to `'claw-local'` — GCE will fail. The health handler must catch this and mark GCE as degraded without crashing.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| BullMQ job count check | Custom Redis keys scan | `taskQueue.getJobCounts()` | BullMQ's own method reads the internal key structure correctly |
| Redis connection test | Manual socket probe | `IORedis.ping()` | ioredis is already installed; ping is idiomatic |
| Email validation | Custom regex | TypeBox `{ format: 'email' }` on the TypeBox schema | Already validated by @sinclair/typebox via Fastify |
| Form state in Svelte | Custom $state management | SvelteKit `form` prop from Actions | Actions return value is automatically injected as `form` |

**Key insight:** All health check mechanics (Redis, BullMQ, DB, GCE) are already available from existing imports in the codebase. This phase is purely additive — no new abstractions needed.

---

## Common Pitfalls

### Pitfall 1: SvelteKit `form` prop missing in `+page.svelte`
**What goes wrong:** `$props()` in the landing page currently only destructures `{}` — after adding a server action, the `form` prop must be explicitly added or it will be `undefined`.
**Why it happens:** SvelteKit injects `form` automatically from Actions return values, but it only appears in the component if destructured from `$props()`.
**How to avoid:** Add `let { form } = $props();` to the script block. The page currently has `onMount` for intersection observers — the props declaration is additive.
**Warning signs:** `form` is always `undefined` even after successful submission.

### Pitfall 2: Fastify schema validation rejects email format
**What goes wrong:** TypeBox `{ format: 'email' }` may not be enabled by default in Fastify — format validation requires `{ ajv: { customOptions: { formats: ... } } }` or `@fastify/ajv-compiler`.
**Why it happens:** AJV disables format validation by default since AJV v8.
**How to avoid:** Keep validation simple — just `Type.String()` and validate the `@` presence in the handler code. Or use `Type.String({ minLength: 5 })`. Don't rely on `format: 'email'` unless ajv-formats is configured.
**Warning signs:** TypeBox schema with `format: 'email'` passes all strings including invalid ones (format ignored) or throws schema compilation error.

### Pitfall 3: GCE health check creates InstancesClient per request
**What goes wrong:** Creating `new InstancesClient()` on every health check call opens a new gRPC channel each time, which is slow and leaks connections.
**Why it happens:** The existing code in `gce-bot-launcher.ts` creates a singleton at module level (`const instancesClient = new InstancesClient()`).
**How to avoid:** Create a module-level singleton `InstancesClient` for the health check too, or call the existing `instancesClient` via a shared import.
**Warning signs:** Health endpoint is slow (>2s response) and GCP logs show many new gRPC connections.

### Pitfall 4: Landing page is a single-page layout — `+page.server.ts` may conflict with layout auth
**What goes wrong:** The layout `+layout.server.ts` checks `event.locals.auth()` — it returns a session (may be null). The landing page is public. The new `+page.server.ts` must NOT redirect unauthenticated users.
**Why it happens:** The Phase 37 pattern (objectives/new) redirects to `/login` when no session — the landing page must not do this.
**How to avoid:** In the `requestAccess` action, do not check for session. The landing page is intentionally public.

### Pitfall 5: Footer links in nav also contain placeholder hrefs
**What goes wrong:** The nav bar (`+layout.svelte`) has `<a href="#access" class="btn-nav">Request access</a>` for unauthenticated users — this is an anchor link to the access section and IS valid (it scrolls on the landing page). Don't remove it.
**Why it happens:** Conflating footer nav links with the top nav.
**How to avoid:** Only audit the `<footer>` section in `+page.svelte` (lines 293–352), not the nav in `+layout.svelte`.

---

## Code Examples

Verified patterns from the codebase:

### Existing admin.ts structure (add alongside `POST /cleanup/decision-traces`)
```typescript
// Source: services/execution-service/src/routes/admin.ts
import type { FastifyInstance } from 'fastify';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.post('/cleanup/decision-traces', async (_request, reply) => { ... });
  // ADD: app.post('/waitlist', ...) here
  // ADD: app.get('/health', ...) here
}
```

### TypeBox-typed health response (POLISH-03)
```typescript
// Source: pattern from services/execution-service/src/routes/negative-signals.ts
import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

const SubsystemSchema = Type.Object({
  ok: Type.Boolean(),
  latencyMs: Type.Optional(Type.Number()),
  error: Type.Optional(Type.String()),
});

// admin.ts will use FastifyInstance (not FastifyPluginAsyncTypebox)
// since it's already typed as async (app: FastifyInstance)
// Use Type.Object for inline schema, not FastifyPluginAsyncTypebox
```

### SvelteKit form prop with $props (POLISH-01)
```svelte
<!-- Source: established SvelteKit 5 pattern (Svelte 5 runes mode) -->
<script lang="ts">
  import { onMount } from 'svelte';
  // Add form to existing props:
  let { form } = $props();

  onMount(() => {
    // ... existing intersection observer code
  });
</script>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Svelte 4 `export let form` | Svelte 5 `let { form } = $props()` | Svelte 5 migration | Must use runes-style props — project is already on Svelte 5.51.3 |
| Form with `use:enhance` | Plain `method="POST"` with server action | SvelteKit standard | `use:enhance` adds JS-powered UX (no full reload); acceptable without it for v5.0 |

**Deprecated/outdated:**
- `export let form` in Svelte 5 runes mode: replaced by `$props()` destructuring (project already uses this pattern consistently).

---

## Open Questions

1. **Waitlist storage: log vs DB table**
   - What we know: POLISH-01 says "stores it or forwards it." The project avoids migration churn.
   - What's unclear: Whether structured storage (queryable) is needed or just capture.
   - Recommendation: Use `request.log.info({ email }, 'waitlist signup')` — Cloud Logging captures it in prod. If the planner judges a DB table more appropriate, migration `0014` would be `CREATE TABLE waitlist_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`.

2. **GCE health check scope**
   - What we know: `InstancesClient.list({ project, zone })` returns all bot VMs in the zone.
   - What's unclear: Whether GCE "healthy" means API is reachable (good enough) or requires a specific VM to be running.
   - Recommendation: GCE "ok" = API call returns without error, regardless of instance count. The health check is an operator ping, not a bot census.

3. **`use:enhance` for the waitlist form**
   - What we know: Without `use:enhance`, form submission triggers a full page reload. With it, the server action response is handled client-side.
   - What's unclear: Whether UX polish is in scope for v5.0 or deferred.
   - Recommendation: Add `use:enhance` from `$app/forms` for a better UX (no page flash). It's one import and one directive — minimal effort.

---

## Sources

### Primary (HIGH confidence)
- **Codebase: `services/ui/src/routes/+page.svelte`** — verified footer links, form structure (all links in Resources + Company groups point to `#access`)
- **Codebase: `services/execution-service/src/routes/admin.ts`** — verified existing route structure; `POST /cleanup/decision-traces` is the only handler
- **Codebase: `services/execution-service/src/app.ts`** — verified `adminRoutes` registered at `/admin` prefix
- **Codebase: `services/execution-service/src/queue/task-queue.ts`** — verified `taskQueue` is an exported Queue instance with `queueConnection`
- **Codebase: `services/execution-service/src/routes/metrics.ts`** — verified IORedis instantiation pattern
- **Codebase: `services/execution-service/src/orchestrator/gce-bot-launcher.ts`** — verified `InstancesClient` import and usage
- **Codebase: `services/ui/src/routes/objectives/new/+page.server.ts`** — verified server action pattern (Phase 37)
- **Codebase: `services/execution-service/src/orchestrator/bot-orchestrator.ts`** — verified `GCP_PROJECT_ID` and `GCP_ZONE` env var names

### Secondary (MEDIUM confidence)
- SvelteKit documentation for `form` prop injection from Actions — standard behavior, confirmed by project's use of Phase 37 action return values

---

## Metadata

**Confidence breakdown:**
- POLISH-01 (form wiring): HIGH — form already exists in HTML; server action pattern is copy-paste from Phase 37
- POLISH-02 (footer audit): HIGH — all dead links identified by direct file read; fix is a deletion
- POLISH-03 (health endpoint): HIGH — all four subsystem clients are in the codebase; `Promise.allSettled` pattern is standard
- Architecture: HIGH — all routes, prefixes, env vars verified from codebase

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable stack — SvelteKit, Fastify, BullMQ versions pinned)
