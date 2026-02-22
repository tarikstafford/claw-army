# Phase 12: Human Confirmation Gate - Research

**Researched:** 2026-02-22
**Domain:** Fastify route extension, Drizzle ORM update patterns, SvelteKit Svelte 5 runes, confirmation UI anti-rubber-stamp design, per-user statistics tracking
**Confidence:** HIGH

---

## Summary

Phase 12 adds a human gate between the Council's verdict and the God Layer's execution. When `council_verdicts.status = 'pending'` and `verdictType IN ('Promote','Retire')`, the God Layer (Phase 13) must not act until an operator calls `POST /verdicts/:verdictId/confirm`. Maintain, Monitor, and Demote verdicts execute automatically (no gate). The schema already has `status` (`pending`/`confirmed`/`rejected`), `confirmedAt`, `confirmedBy`, `requiresHumanConfirmation`, and all five judge output JSONB columns — no new migrations are required.

The feature has two surfaces: a **backend route** (`POST /verdicts/:verdictId/confirm` and `POST /verdicts/:verdictId/reject`, plus a `GET /verdicts/pending` list endpoint) on the Fastify execution service, and a **confirmation UI** on the SvelteKit frontend (a new `/verdicts` page plus a per-verdict detail page). The calibration warning (CONF-04) requires tracking time-on-screen and per-user confirmation rates — both computed and stored in-process or via a lightweight counter column rather than a dedicated table.

The primary technical nuance is how the confirmation gate feeds Phase 13. The God Layer must query `council_verdicts` and only act on rows with `status = 'confirmed'` (for Promote/Retire) or rows that never needed confirmation (`requiresHumanConfirmation = false`). This means the gate is implemented as a pre-condition the God Layer enforces at read time, not as a queue or lock — the council worker already writes `status = 'pending'` for all verdicts, so God Layer simply filters on `(status = 'confirmed' OR requiresHumanConfirmation = false)`.

**Primary recommendation:** Add a `verdicts` route plugin to the Fastify app (mirroring the admin/bots route conventions already established), build a two-page SvelteKit operator UI at `/verdicts` and `/verdicts/[verdictId]`, and track confirmation rate in a lightweight per-user JSON column or in-memory store flushed to the `council_verdicts` metadata. No new DB tables are required.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastify` | `^5.7.4` (installed) | New `/verdicts` route plugin | Project standard — all routes use Fastify plugins |
| `@fastify/type-provider-typebox` | `^6.1.0` (installed) | TypeBox schema validation on new routes | Identical to existing routes (executions, bots, admin) |
| `@sinclair/typebox` | `^0.34.48` (installed) | Request/response type schemas | Project standard for Fastify route schemas |
| `drizzle-orm` | `^0.45.1` (installed) | Update `council_verdicts.status`, query pending verdicts | Project standard ORM |
| `@claw/db` | `workspace:*` (installed) | `councilVerdicts` table + all enum types | Already exports `councilVerdicts`, `verdictTypeEnum`, `verdictStatusEnum` |
| `svelte` | `^5.51.3` (installed) | Confirmation UI pages | Project standard; uses Svelte 5 runes (`$state`, `$derived`, `$effect`) |
| `@sveltejs/kit` | `^2.52.0` (installed) | New `/verdicts` and `/verdicts/[verdictId]` pages | Project standard frontend framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `drizzle-orm eq, and, inArray` | built-in | Filter `councilVerdicts` by status, verdictType | Standard query building |
| `SvelteKit +page.server.ts` | built-in | Server-side data load for verdict list | Follow existing `+page.server.ts` pattern from `new-execution` route |
| `$lib/api.ts` | existing pattern | Add `getVerdicts`, `confirmVerdict`, `rejectVerdict` API helpers | Match existing `apiFetch` pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tracking confirm rate in council_verdicts metadata | New `confirmation_stats` table | New table adds migration complexity; JSON column on existing table is simpler and sufficient for MVP |
| Per-user confirmation rate via separate table | In-memory Map<userId, stats> reset on restart | In-memory is fragile across deploys; JSONB in council_verdicts meta or a simple counter table preferred |
| Modal dialog for confirmation | Full page `/verdicts/[verdictId]` | Full page allows time-on-screen tracking via `Date.now()` delta; modal is harder to measure |
| Polling for pending verdicts | SSE push from server | Polling at 15-30s intervals is simpler and sufficient; SSE adds complexity not justified for low-frequency operator action |

**Installation:** No new packages needed. All dependencies already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
services/execution-service/src/
├── routes/
│   ├── verdicts.ts              # NEW: Fastify plugin for /verdicts/* endpoints
│   └── ...existing routes...
└── app.ts                       # MODIFY: register verdicts routes at prefix '/verdicts'

services/ui/src/
├── lib/
│   ├── api.ts                   # MODIFY: add getVerdicts, getVerdict, confirmVerdict, rejectVerdict
│   └── types.ts                 # MODIFY: add CouncilVerdict, PendingVerdict types
└── routes/
    └── verdicts/
        ├── +page.svelte          # NEW: pending verdicts list (operator inbox)
        └── [verdictId]/
            └── +page.svelte      # NEW: single verdict detail + confirm/reject controls
```

### Pattern 1: Fastify Route Plugin (mirrors existing bots.ts / admin.ts)

**What:** Add a `verdicts.ts` route file exporting `FastifyPluginAsyncTypebox`, registered in `app.ts`.

**When to use:** Every new route group in this project follows this exact pattern.

```typescript
// Source: existing app.ts registration pattern
// services/execution-service/src/routes/verdicts.ts
import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { db, councilVerdicts } from '@claw/db';
import { eq, and, inArray } from 'drizzle-orm';

export const verdictsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // GET /verdicts/pending — list all verdicts awaiting human confirmation
  fastify.get('/pending', { schema: { response: { 200: Type.Array(...) } } },
    async (_req, reply) => {
      const rows = await db
        .select()
        .from(councilVerdicts)
        .where(
          and(
            inArray(councilVerdicts.verdictType, ['Promote', 'Retire']),
            eq(councilVerdicts.status, 'pending'),
          ),
        );
      return reply.send(rows);
    },
  );

  // POST /verdicts/:verdictId/confirm
  fastify.post('/:verdictId/confirm', { schema: { ... } }, async (request, reply) => {
    const { verdictId } = request.params;
    const userId = request.body.userId; // operator identity
    await db
      .update(councilVerdicts)
      .set({ status: 'confirmed', confirmedAt: new Date(), confirmedBy: userId, updatedAt: new Date() })
      .where(
        and(
          eq(councilVerdicts.id, verdictId),
          eq(councilVerdicts.status, 'pending'),
        ),
      );
    return reply.send({ ok: true });
  });

  // POST /verdicts/:verdictId/reject
  fastify.post('/:verdictId/reject', { schema: { ... } }, async (request, reply) => {
    const { verdictId } = request.params;
    await db
      .update(councilVerdicts)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(councilVerdicts.id, verdictId));
    return reply.send({ ok: true });
  });
};
```

```typescript
// app.ts MODIFY: add one line
app.register(verdictsRoutes, { prefix: '/verdicts' });
```

### Pattern 2: Status Pre-Condition for God Layer (Phase 13 integration contract)

**What:** The God Layer does not receive a separate signal — it reads `council_verdicts` and enforces the gate at query time. This is the correct pattern: the gate is the status column, not a queue.

**Contract:** God Layer should only act on a verdict row when:
- `verdictType NOT IN ('Promote', 'Retire')` (auto-execute: Maintain, Monitor, Demote), OR
- `status = 'confirmed'` (gate cleared by operator)

The council worker already writes `requiresHumanConfirmation = true/false`. God Layer can use this field too: act when `requiresHumanConfirmation = false` OR `status = 'confirmed'`.

### Pattern 3: SvelteKit Svelte 5 Runes Confirmation Page

**What:** Operator inbox at `/verdicts` shows pending Promote/Retire verdicts. Clicking one opens `/verdicts/[verdictId]` which shows the evidence (Devil's Advocate challenges from `devilsAdvocateOutput`, or a tool call sequence from `performanceJudgeOutput`) before revealing confirm/reject buttons.

**Evidence rendering sequence (CONF-02):**
1. Surface verdict summary text
2. Show at least one concrete evidence item — DA challenges if `hasUnresolvedDevilsAdvocate = true`, else the performance judge's top evidence from `performanceJudgeOutput`
3. Only then render confirm/reject controls

**Time-on-screen tracking (CONF-04):**
```typescript
// In the verdict detail page
let arrivedAt = $state(Date.now());
// On confirm or reject action:
const timeOnScreen = Date.now() - arrivedAt; // ms
// POST to backend with timeOnScreen in body
```

**Pattern:** Matches existing admin/+page.svelte overlay dialog pattern for confirmation — same `.overlay` + `.dialog` CSS classes, same `confirmId` state, same two-button layout.

```svelte
<!-- The reject button must match the confirm button's visual weight (CONF-03) -->
<div class="dialog-actions equal-weight">
  <button class="reject-btn" onclick={doReject}>
    Reject — Your feedback teaches the army
  </button>
  <button class="confirm-btn" onclick={doConfirm}>
    Confirm Verdict
  </button>
</div>
```

### Pattern 4: Calibration Warning (CONF-04)

**What:** Track per-user `{ confirmed: number, total: number }` and surface a warning banner when `confirmed / total > 0.95 AND total >= 10`.

**Where to store:** The simplest approach given the existing schema is to compute this live from `council_verdicts` at `/verdicts` load time. Query `WHERE confirmedBy = userId` and calculate the rate. No new column or table is needed.

```typescript
// Backend: GET /verdicts/calibration?userId=...
const userVerdicts = await db
  .select({ status: councilVerdicts.status })
  .from(councilVerdicts)
  .where(
    and(
      eq(councilVerdicts.confirmedBy, userId),
      inArray(councilVerdicts.status, ['confirmed', 'rejected']),
    ),
  );
const total = userVerdicts.length;
const confirmed = userVerdicts.filter(v => v.status === 'confirmed').length;
const rate = total > 0 ? confirmed / total : 0;
return { total, confirmed, rate, warningTriggered: total >= 10 && rate > 0.95 };
```

### Anti-Patterns to Avoid

- **Status gate on wrong side:** Do not implement the gate as a BullMQ job block or a lock — the gate is simply the `status` column. God Layer reads it. Simple.
- **Rubber-stamp by default:** Do not place the confirm button above the evidence. CONF-02 requires evidence to appear first. Never render confirm/reject before the evidence block.
- **Unequal button weight:** The reject button must not be visually subordinate (no ghost/text-only vs. filled primary). Both buttons get the same visual weight and size. Only labels and colors differ. (CONF-03)
- **Missing time tracking:** Time-on-screen is required by CONF-04. Record `Date.now()` on page mount and send delta on submit. Do not skip this — it's needed for the calibration warning.
- **Auto-acting on 'pending' Promote/Retire:** God Layer must guard against acting on a `pending` Promote or Retire verdict. The council worker writes `status = 'pending'` for all verdicts. God Layer must check the status before acting.
- **CORS mismatch:** All new `/verdicts/*` Fastify routes go through the existing SvelteKit proxy (`/api/[...path]/+server.ts`). The proxy forwards POST bodies — already tested for `executions/stop`. No additional proxy config needed.
- **Rejecting a non-pending verdict:** The reject endpoint must guard `WHERE status = 'pending'` to prevent double-transitions. The confirm endpoint already shows this pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Route validation | Custom type guards | TypeBox `Type.Object()` + `@fastify/type-provider-typebox` | Existing pattern; compile-time + runtime safety |
| ORM updates | Raw SQL UPDATE | `db.update(councilVerdicts).set(...).where(...)` | Drizzle pattern used in all existing routes |
| Frontend state | Custom stores | Svelte 5 `$state`, `$derived`, `$effect` runes | Entire UI codebase uses runes — no legacy Svelte stores |
| Rate computation | External analytics | Inline DB query at page load | Simple enough; total confirmations per operator will be <100 for MVP |

**Key insight:** The confirmation gate is architecturally simple because the schema was designed for it. Phase 11 already wrote all the required columns. Phase 12 just needs to expose the status transition via HTTP and build the operator UI.

---

## Common Pitfalls

### Pitfall 1: Confirming a non-Promote/Retire verdict

**What goes wrong:** The backend allows confirming any verdict, not just Promote/Retire.

**Why it happens:** Developer writes a generic confirm endpoint without checking `verdictType`.

**How to avoid:** The confirm endpoint should validate that the target verdict's `verdictType` is `IN ('Promote', 'Retire')`. Or alternatively, add a guard in the WHERE clause: `WHERE id = $1 AND status = 'pending' AND verdict_type IN ('Promote', 'Retire')`. Return 409 if no rows matched.

**Warning signs:** If Maintain/Monitor/Demote verdicts appear in the pending list, the list query is wrong (should filter `verdictType IN ('Promote', 'Retire')`).

### Pitfall 2: Evidence not surfaced before controls

**What goes wrong:** The page renders a spinner, then immediately shows confirm/reject buttons.

**Why it happens:** Evidence loaded asynchronously; developer forgets to gate button render on evidence loaded.

**How to avoid:** Use a `let evidenceLoaded = $state(false)` flag. Set it to `true` only after verdict data (including at least one DA challenge or performance evidence item) is loaded and rendered. Gate confirm/reject on `{#if evidenceLoaded}`.

**Warning signs:** Buttons visible while verdict data is still loading.

### Pitfall 3: Double-confirmation race condition

**What goes wrong:** Two operator tabs confirm the same verdict. Second call errors or transitions an already-confirmed verdict to confirmed again.

**Why it happens:** No idempotency guard on the update.

**How to avoid:** The WHERE clause on the UPDATE must include `AND status = 'pending'`. If the UPDATE returns 0 rows affected, return 409 Conflict. Drizzle's `.returning()` can verify rows affected:
```typescript
const result = await db.update(councilVerdicts)
  .set({ status: 'confirmed', ... })
  .where(and(eq(councilVerdicts.id, verdictId), eq(councilVerdicts.status, 'pending')))
  .returning({ id: councilVerdicts.id });
if (result.length === 0) return reply.code(409).send({ error: 'Verdict already resolved' });
```

**Warning signs:** `confirmedAt` timestamps on confirmed rows that are suspiciously close together.

### Pitfall 4: Calibration warning based on wrong denominator

**What goes wrong:** The denominator includes `pending` verdicts not yet acted on, which inflates the total and suppresses the warning.

**Why it happens:** Developer queries all verdicts for the user instead of only resolved ones.

**How to avoid:** Filter `WHERE status IN ('confirmed', 'rejected')` when computing the confirmation rate. Only resolved verdicts count.

**Warning signs:** Rate appears lower than expected because many pending verdicts are in the count.

### Pitfall 5: Missing userId on confirmation

**What goes wrong:** `confirmedBy` column stays null because the UI doesn't send a user identifier.

**Why it happens:** Auth context not threaded from SvelteKit session to API call.

**How to avoid:** The project uses `@auth/sveltekit` (installed, `src/auth.ts` and `hooks.server.ts` exist). The SvelteKit proxy at `/api/[...path]/+server.ts` already forwards the `authorization` header. The confirm/reject POST body should include a `userId` field (the operator's email or sub from the session), which the UI reads from the SvelteKit session via `page.data.session`.

**Warning signs:** All `confirmedBy` rows are `null` after confirmations.

---

## Code Examples

### GET /verdicts/pending — Fastify route query

```typescript
// Source: verified against existing council_verdicts schema + drizzle-orm patterns in project
const pendingRows = await db
  .select({
    id: councilVerdicts.id,
    botId: councilVerdicts.botId,
    executionId: councilVerdicts.executionId,
    verdictType: councilVerdicts.verdictType,
    weightedConfidenceScore: councilVerdicts.weightedConfidenceScore,
    verdictSummary: councilVerdicts.verdictSummary,
    hasUnresolvedDevilsAdvocate: councilVerdicts.hasUnresolvedDevilsAdvocate,
    devilsAdvocateOutput: councilVerdicts.devilsAdvocateOutput,
    performanceJudgeOutput: councilVerdicts.performanceJudgeOutput,
    createdAt: councilVerdicts.createdAt,
  })
  .from(councilVerdicts)
  .where(
    and(
      inArray(councilVerdicts.verdictType, ['Promote', 'Retire']),
      eq(councilVerdicts.status, 'pending'),
    ),
  )
  .orderBy(councilVerdicts.createdAt);
```

### POST /verdicts/:verdictId/confirm — idempotent update

```typescript
// Source: drizzle-orm .update().returning() pattern — safe idempotent confirm
const updated = await db
  .update(councilVerdicts)
  .set({
    status: 'confirmed',
    confirmedAt: new Date(),
    confirmedBy: userId,
    updatedAt: new Date(),
  })
  .where(
    and(
      eq(councilVerdicts.id, verdictId),
      eq(councilVerdicts.status, 'pending'),
    ),
  )
  .returning({ id: councilVerdicts.id });
// If updated.length === 0 → 409 (already confirmed or rejected)
```

### Svelte 5 verdict detail page — time-on-screen + evidence gating

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { getVerdict, confirmVerdict, rejectVerdict } from '$lib/api';

  const verdictId = $derived(page.params.verdictId ?? '');
  let verdict = $state<PendingVerdict | null>(null);
  let loading = $state(true);
  let arrivedAt = $state(0);  // ms timestamp set on load

  $effect(() => {
    if (!browser) return;
    arrivedAt = Date.now();
    getVerdict(verdictId)
      .then(v => { verdict = v; loading = false; })
      .catch(err => { /* ... */ loading = false; });
  });

  async function doConfirm() {
    const timeOnScreenMs = Date.now() - arrivedAt;
    await confirmVerdict(verdictId, { userId, timeOnScreenMs });
    // navigate to /verdicts
  }

  async function doReject() {
    const timeOnScreenMs = Date.now() - arrivedAt;
    await rejectVerdict(verdictId, { userId, timeOnScreenMs });
    // navigate to /verdicts
  }
</script>

<!-- Evidence MUST render before controls -->
{#if verdict}
  <div class="evidence-block">
    <p>{verdict.verdictSummary}</p>
    {#if verdict.hasUnresolvedDevilsAdvocate}
      <!-- Show DA challenges -->
      {#each verdict.devilsAdvocateOutput.challenges.filter(c => c.severity === 'strong') as challenge}
        <div class="challenge-card">
          <strong>{challenge.claim}</strong>
          <p>{challenge.counterArgument}</p>
        </div>
      {/each}
    {:else}
      <!-- Show performance evidence -->
      <p class="evidence">Performance Evidence: {verdict.performanceJudgeOutput?.summary}</p>
    {/if}
  </div>

  <!-- Controls only after evidence rendered -->
  <div class="dialog-actions">
    <button class="reject-btn" onclick={doReject}>
      Reject — Your feedback teaches the army
    </button>
    <button class="confirm-btn" onclick={doConfirm}>
      Confirm Verdict
    </button>
  </div>
{/if}
```

### Calibration warning computation

```typescript
// Source: drizzle-orm patterns verified against existing routes
// GET /verdicts/calibration — returns per-user confirmation rate
const userDecisions = await db
  .select({ status: councilVerdicts.status })
  .from(councilVerdicts)
  .where(
    and(
      eq(councilVerdicts.confirmedBy, userId),
      inArray(councilVerdicts.status, ['confirmed', 'rejected']),
    ),
  );
const total = userDecisions.length;
const confirmed = userDecisions.filter(v => v.status === 'confirmed').length;
const rate = total > 0 ? confirmed / total : 0;
const warningTriggered = total >= 10 && rate > 0.95;
return { total, confirmed, rate, warningTriggered };
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Svelte 4 reactive stores (`$store`) | Svelte 5 runes (`$state`, `$derived`, `$effect`) | Svelte 5 (project uses v5.51.3) | All new UI components must use runes; no legacy stores |
| `generateObject` in Vercel AI SDK | `generateText` + `Output.object()` | AI SDK v6 | The council judges already use the correct v6 pattern — copy exactly |
| Drizzle `db.update().set().where()` with no returning | `.returning({ id: table.id })` for idempotency | N/A — project-specific pattern | Use `.returning()` to detect 0-row updates and return 409 |

**Deprecated/outdated:**
- `vercel.json` rewrites: Confirmed non-functional with adapter-vercel. All routing goes through SvelteKit `+server.ts` proxy — already established in CLAUDE.md.

---

## Open Questions

1. **userId source for calibration tracking**
   - What we know: `@auth/sveltekit` is installed (`src/auth.ts`, `hooks.server.ts` exist). The proxy forwards `authorization` header.
   - What's unclear: Whether the session exposes `user.email` or `user.sub` as the stable identifier on the frontend; and whether `confirmedBy` should be the email or a sub/id.
   - Recommendation: Use `session.user.email` as the `confirmedBy` string. It is human-readable in the DB and uniquely identifies the operator for the calibration query. If auth is bypassed in dev (no session), pass a fallback like `'operator'`.

2. **timeOnScreenMs storage**
   - What we know: CONF-04 requires tracking time-on-confirmation-screen. There is no dedicated column for this in `council_verdicts`.
   - What's unclear: Whether to add a `timeOnScreenMs integer` column via a new migration, or log it server-side only (console/no persistence).
   - Recommendation: Add a `timeOnScreenMs` column (nullable integer) to `council_verdicts` via a new Drizzle migration. This enables future analytics and satisfies the spirit of CONF-04 without heroics. Migration is a two-line SQL `ALTER TABLE`.

3. **Navigation to pending verdicts from admin UI**
   - What we know: The existing `/admin` page lists executions. No link to `/verdicts` exists.
   - What's unclear: Should the admin page show a badge/count of pending verdicts?
   - Recommendation: Add a `/verdicts` navigation link to `+layout.svelte` alongside the existing links. A simple count badge is optional and can be added to Phase 12 scope if it doesn't bloat the plan.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase — `packages/db/src/schema/council-verdicts.ts` — schema with all required columns confirmed present (status enum, confirmedAt, confirmedBy, requiresHumanConfirmation, devilsAdvocateOutput JSONB, performanceJudgeOutput JSONB)
- Existing codebase — `services/execution-service/src/routes/bots.ts`, `executions.ts`, `admin.ts` — Fastify `FastifyPluginAsyncTypebox` route plugin pattern; TypeBox schema shapes; `db.update().set().where()` Drizzle pattern
- Existing codebase — `services/execution-service/src/app.ts` — `app.register(route, { prefix })` pattern confirmed
- Existing codebase — `services/ui/src/routes/api/[...path]/+server.ts` — proxy forwards all HTTP methods including POST with body; no changes needed
- Existing codebase — `services/ui/src/routes/admin/+page.svelte` — confirmed Svelte 5 runes, `.overlay`/`.dialog` pattern, confirm dialog with two equal-weight buttons
- Phase 11 verification — `11-VERIFICATION.md` — council_worker writes `status = 'pending'` for ALL verdicts; `requiresHumanConfirmation` flag set correctly; all JSONB output columns populated

### Secondary (MEDIUM confidence)
- Existing codebase — `services/ui/package.json` — `svelte ^5.51.3`, `@sveltejs/kit ^2.52.0`, `@auth/sveltekit ^1.11.1` confirmed installed; no additional packages needed
- Existing codebase — `services/execution-service/package.json` — drizzle-orm `^0.45.1`, typebox `^0.34.48`, fastify `^5.7.4` all confirmed installed

### Tertiary (LOW confidence)
- None — all findings verified against actual codebase files.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified as already installed in package.json files
- Architecture: HIGH — route plugin pattern, Svelte 5 rune patterns, and proxy behavior all verified against existing codebase files
- Pitfalls: HIGH — double-confirm race condition and evidence-gating requirement derived from requirements spec and schema inspection; userId thread-through derived from existing auth infrastructure

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (30 days — stable dependencies, no fast-moving external APIs)
