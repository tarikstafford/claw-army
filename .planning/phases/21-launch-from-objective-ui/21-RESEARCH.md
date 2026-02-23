# Phase 21: Launch-from-Objective UI - Research

**Researched:** 2026-02-23
**Domain:** SvelteKit URL params, form pre-fill, end-to-end objectiveId wiring
**Confidence:** HIGH

## Summary

Phase 21 closes a shallow but complete gap: the backend already fully supports `objectiveId` on executions (added in Phase 16), but the UI never passes it. Three discrete changes close the loop — add `objectiveId` to the `createExecution()` API call, read `objectiveId` from the request in the server action and forward it to the backend, and add a "Launch" affordance on the objective detail page that navigates to `/new-execution` with the objective's ID and default settings pre-wired.

The approach is URL-param based: the objective page sets `?objectiveId=<uuid>` (and optionally pre-fill params) on the link/navigate call; `new-execution/+page.server.ts` reads those from `event.url.searchParams`; `+page.svelte` reads them with `$page.url.searchParams` to initialize state. This is a proven SvelteKit pattern — no new stores, no session state, no cookies required.

All four success criteria map to exactly-three file changes plus one type change. No new dependencies. No new routes. No DB migration. The entire phase is pure wiring of existing infrastructure.

**Primary recommendation:** Use URL search params to carry `objectiveId` from the objective page to the new-execution page. Pre-fill form fields from the objective's defaults. Forward `objectiveId` through the server action to the backend POST. The backend does the rest.

---

## Current State Audit

### What already exists (do not change)

| Layer | Status | Evidence |
|-------|--------|----------|
| DB column `executions.objective_id` | EXISTS, nullable FK, ON DELETE SET NULL | `packages/db/src/schema/executions.ts` line 22 |
| `POST /executions` TypeBox schema accepts `objectiveId` | EXISTS | `routes/executions.ts` line 37 |
| `createExecution()` service validates objective exists and is not archived | EXISTS | `services/execution.service.ts` lines 26-39 |
| `services/execution.service.ts` writes `objectiveId ?? null` to INSERT | EXISTS | line 49 |
| `GET /objectives/:id` returns full objective including default settings | EXISTS | `routes/objectives.ts` lines 352-376 |
| `Objective` TypeScript type includes all default fields | EXISTS | `services/ui/src/lib/types.ts` lines 256-267 |
| `getObjective(id)` in `api.ts` | EXISTS | line 154 |
| `GET /objectives/:id/executions` filters by `objective_id` | EXISTS | `routes/objectives.ts` line 220 |
| Run history table on `/objectives/[id]` shows runs linked via `objectiveId` | EXISTS | `routes/objectives/[id]/+page.svelte` lines 174-206 |

### What is missing (the three gaps)

| Gap | File | What's Missing |
|-----|------|----------------|
| **GAP-1** | `services/ui/src/lib/api.ts` | `createExecution()` body does not include `objectiveId` |
| **GAP-2** | `services/ui/src/routes/new-execution/+page.server.ts` | Action does not read `objectiveId` from URL params or form, does not forward to backend |
| **GAP-3** | `services/ui/src/routes/objectives/[id]/+page.svelte` | No "Launch from this objective" button or link to `/new-execution` |

---

## Standard Stack

### Core (no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SvelteKit `$app/state` `page` | already in project | Read URL search params in components | Used elsewhere in this codebase (`objectives/[id]/+page.svelte` line 2) |
| SvelteKit `event.url.searchParams` | already in project | Read URL search params in server load/actions | Standard SvelteKit server API |
| SvelteKit `goto` from `$app/navigation` | already in project | Programmatic navigation with params | Alternative to anchor tag for button-based nav |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Project Structure

No new files. Changes touch:
```
services/ui/src/
├── lib/
│   └── api.ts                           # GAP-1: add objectiveId to createExecution()
├── routes/
│   ├── new-execution/
│   │   ├── +page.server.ts              # GAP-2: extract objectiveId, forward to backend
│   │   └── +page.svelte                 # Read objectiveId + default fields, pre-fill form
│   └── objectives/
│       └── [id]/
│           └── +page.svelte             # GAP-3: add Launch affordance
```

### Pattern 1: URL Search Param Handoff

**What:** Objective page navigates to `/new-execution?objectiveId=<uuid>&maxBots=5&...`; new-execution page reads params on mount to initialize form state.

**When to use:** When data needs to survive a page navigation without a server round-trip and without a shared store. One-directional, stateless, bookmarkable.

**Example — objective page link:**
```svelte
<!-- In /objectives/[id]/+page.svelte -->
<a
  href="/new-execution?objectiveId={objectiveId}&maxBots={objective?.defaultMaxBots ?? 3}"
  class="launch-btn"
>
  Launch from this objective
</a>
```

**Example — new-execution page reading params (Svelte 5 $effect):**
```svelte
<script lang="ts">
  import { page } from '$app/state';

  // Read once on mount; $page.url.searchParams is reactive
  const urlObjectiveId = $derived(page.url.searchParams.get('objectiveId') ?? '');
  const urlMaxBots     = $derived(Number(page.url.searchParams.get('maxBots') ?? '3'));

  let objectiveId = $state('');
  let maxBots     = $state(3);

  $effect(() => {
    if (urlObjectiveId) {
      objectiveId = urlObjectiveId;
      maxBots     = urlMaxBots || 3;
    }
  });
</script>
<!-- hidden input to carry objectiveId through the form POST -->
<input type="hidden" name="objectiveId" value={objectiveId} />
```

**Important:** `page` from `$app/state` (Svelte 5 rune-based) is already used in this codebase at `objectives/[id]/+page.svelte` line 2 — use the same import, not `$app/stores`.

### Pattern 2: Server Action Extraction

**What:** Server action reads `objectiveId` from either `formData` (hidden input) or `event.url.searchParams` as fallback, then includes it in the fetch body.

**When to use:** Always — the server action is the trust boundary. The UI's hidden field is the primary carrier; URL params are the fallback.

**Example:**
```typescript
// In new-execution/+page.server.ts actions.default
const objectiveId = (formData.get('objectiveId') as string | null)?.trim() || null;

// In the fetch body:
body: JSON.stringify({
  objective,
  maxBots,
  budgetCapCents,
  llmProvider,
  allowedDomains,
  ...(objectiveId ? { objectiveId } : {}),
}),
```

**Why spread conditional:** Sending `objectiveId: null` vs. `objectiveId: undefined` vs. omitting it — the backend accepts `Type.Optional(Type.String({ format: 'uuid' }))`, so omitting is cleanest when there is no objectiveId. Sending `objectiveId: null` would fail TypeBox UUID validation. Spread conditional keeps the body clean.

### Pattern 3: api.ts createExecution Signature Update

**What:** Add optional `objectiveId` field to the request body type.

**Example:**
```typescript
// In services/ui/src/lib/api.ts
export async function createExecution(body: {
  objective: string;
  maxBots: number;
  budgetCapCents: number;
  allowedTools: string[];
  objectiveId?: string;         // add this
}): Promise<{ executionId: string; status: 'queued' }> {
  return apiFetch(`${BASE}/executions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
```

Note: `api.ts` `createExecution()` is not called by `new-execution/+page.server.ts` — the server action calls the execution service directly via `fetch()`. The `api.ts` function is the client-side helper, used if the UI ever calls `createExecution()` directly (e.g. from a `.svelte` file). Update it for completeness and to satisfy success criterion 1 literally.

### Pattern 4: Pre-filling Form Defaults from Objective

**What:** When `objectiveId` is present, optionally fetch the objective to populate `maxBots`, `budgetCapDollars`, `allowedDomains` from the objective's defaults.

**Options for pre-fill:**

**Option A — URL params only (simpler):** Objective page embeds default values directly in the URL query string. No extra fetch needed on the new-execution page. Downside: URL can get long with many defaults.

**Option B — Client-side fetch on mount (one round-trip):** New-execution page detects `objectiveId` param, calls `getObjective(id)` to fetch defaults, populates form state. Clean separation — new-execution page doesn't trust URL params for defaults.

**Option C — Load function (SSR-safe):** `+page.server.ts` load function reads `objectiveId` from URL, fetches objective, returns defaults in `data`. Form action is separate. Adds complexity.

**Recommendation: Option A** — embed key defaults (`maxBots`, `budgetCapDollars`) in the URL from the objective page. This is the simplest path, consistent with how the codebase passes data around (URL params), and satisfies the success criterion of "default settings pre-filled". The objective page already has `objective.defaultMaxBots`, `objective.defaultBudgetCapCents`, `objective.defaultAllowedTools` in scope.

For the objective text itself: the objective page has `objective.name` and `objective.description`. The new-execution form's "objective" textarea is a mission description, not the objective's name. Pre-filling with the objective name is reasonable but not required by the success criteria. Leave it to the planner to decide, or pre-fill with the objective's name as a starting point that the user can override.

### Anti-Patterns to Avoid

- **Don't use a Svelte store for objectiveId handoff.** The store does not survive navigation to a new page unless it is persistent (e.g. localStorage-backed). URL params are the right tool for cross-page state that should survive a browser refresh.
- **Don't send `objectiveId: null` in the JSON body.** TypeBox's `Type.String({ format: 'uuid' })` will reject `null`. Either omit the field or send a valid UUID string.
- **Don't use `$app/stores` `page` import.** This codebase uses Svelte 5 rune-based `page` from `$app/state`. See `objectives/[id]/+page.svelte` line 2: `import { page } from '$app/state'`.
- **Don't add a new load function to new-execution/+page.server.ts just for pre-fill.** The existing page has no `load` function (only `actions`). Adding one purely for pre-fill is fine if Option B is chosen but adds surface area. Option A (URL params) avoids this.
- **Don't forget the hidden `<input>` in the form.** The server action reads from `formData`, not from URL params directly (URL params are not included in `formData`). The objectiveId MUST be carried as a hidden form field so it survives the form POST.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID validation before sending | Custom regex | TypeBox on server already validates | Server already rejects invalid UUIDs with 400 |
| Objective existence check on UI | Client-side lookup before navigation | Backend `createExecution()` service already validates | Server throws 'Objective not found or archived', route catches it and returns 400 |
| Persistent cross-page state | Custom Svelte store / localStorage | URL search params | Stateless, shareable, no lifecycle management |

**Key insight:** The backend already does all the hard work (FK validation, archive check, NULL handling). The UI just needs to wire the `objectiveId` through without losing it.

---

## Common Pitfalls

### Pitfall 1: objectiveId Lost at Form POST Boundary

**What goes wrong:** URL params are not included in HTML form `formData`. If `objectiveId` is only in the URL (`?objectiveId=...`) and there is no hidden `<input name="objectiveId">`, the server action's `formData.get('objectiveId')` returns `null`, and `objectiveId` is silently dropped from the backend request.

**Why it happens:** HTML form POST sends only form fields, not the current URL's query string.

**How to avoid:** Always add `<input type="hidden" name="objectiveId" value={objectiveId} />` inside the `<form>` element when `objectiveId` is non-empty. Bind `objectiveId` state to the hidden input's value, initialized from URL params.

**Warning signs:** `objectiveId` present in URL, form submits successfully, but execution is created without `objectiveId` in DB. Run appears in "All executions" but NOT in the objective's run history table.

### Pitfall 2: Svelte 5 $derived vs $effect for URL Param Initialization

**What goes wrong:** Using `$derived` to initialize mutable state from URL params creates a read-only binding. If the user later changes the form value, the derived rune will fight the change or prevent it.

**Why it happens:** `$derived` is for computed/read-only reactive values. Form field state must be mutable `$state`.

**How to avoid:** Use `$state` for the form field values (so users can override them). Use `$effect` to read URL params once on mount and set the initial state values. See decision 17-03 for the same pattern with `activeRunId`.

**Example (correct):**
```svelte
let objectiveId = $state('');
let maxBots = $state(3);

// Read URL params once, set state
const urlObjectiveId = $derived(page.url.searchParams.get('objectiveId') ?? '');
$effect(() => {
  if (urlObjectiveId) {
    objectiveId = urlObjectiveId;
  }
});
```

### Pitfall 3: Sending objectiveId from api.ts vs server action

**What goes wrong:** The `api.ts` `createExecution()` function is a client-side helper and is NOT called by `new-execution/+page.server.ts`. The server action calls the execution service directly via `fetch()`. Updating only `api.ts` without updating the server action body means `objectiveId` is never actually sent.

**Why it happens:** Two code paths exist: the client `api.ts` function and the server action's direct fetch. They look similar but are separate.

**How to avoid:** Update both. `api.ts` for completeness (satisfies SC1). The server action's `JSON.stringify({...})` for actual functionality (satisfies SC2).

### Pitfall 4: Objective Text vs Objective Name Confusion

**What goes wrong:** The new-execution form's `objective` textarea is the "mission objective" (the text the LLM plans from). The `Objective` model's `name` field is a short identifier, not a full mission description. Pre-filling the textarea with `objective.name` may give a useless one-line string where a full mission description is expected.

**Why it happens:** Two different concepts both named "objective" in the same codebase.

**How to avoid:** Pre-fill the textarea with `objective.description` if available, fall back to `objective.name`. Or leave the textarea empty and let the user write the mission objective fresh. Clarify in the plan. The success criteria do NOT require pre-filling the objective textarea — just that the run appears in the hub's history.

### Pitfall 5: objectiveId Not in the Execution's Run History After Launch

**What goes wrong:** Launch appears to work (redirects to `/executions/:id`), but the new run does NOT appear in `/objectives/:id`'s run history table.

**Why it happens:** `objectiveId` was not forwarded (pitfall 1), so the execution was created with `objectiveId = NULL`. The run history query (`GET /objectives/:id/executions`) filters `WHERE e.objective_id = :id` and naturally excludes it.

**How to avoid:** After implementing, verify by checking the DB: `SELECT id, objective_id FROM executions ORDER BY created_at DESC LIMIT 1`. If `objective_id` is NULL after a launch-from-objective, the hidden input or server action wiring is broken.

---

## Code Examples

### GAP-1: api.ts createExecution() with objectiveId

```typescript
// Source: services/ui/src/lib/api.ts (current lines 32-43, add objectiveId)
export async function createExecution(body: {
  objective: string;
  maxBots: number;
  budgetCapCents: number;
  allowedTools: string[];
  objectiveId?: string;
}): Promise<{ executionId: string; status: 'queued' }> {
  return apiFetch(`${BASE}/executions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
```

### GAP-2: new-execution/+page.server.ts action with objectiveId

```typescript
// Source: services/ui/src/routes/new-execution/+page.server.ts (current lines 12-67)
// Add after extracting other form fields:
const objectiveId = (formData.get('objectiveId') as string | null)?.trim() || null;

// In the fetch body (change existing JSON.stringify):
body: JSON.stringify({
  objective,
  maxBots,
  budgetCapCents,
  llmProvider,
  allowedDomains,
  ...(objectiveId ? { objectiveId } : {}),
}),
```

### GAP-3: Launch affordance on objectives/[id]/+page.svelte

The button/link must be in the loaded state block (not in the loading/error blocks). The objective is already in scope as `objective` state. The simplest affordance is a plain anchor styled as a button:

```svelte
<!-- After the page header section, above or alongside the stats section -->
<div class="launch-row">
  <a
    href="/new-execution?objectiveId={objectiveId}&maxBots={objective?.defaultMaxBots ?? 3}"
    class="launch-objective-btn"
  >
    Launch from this objective
    <svg ...arrow icon.../>
  </a>
</div>
```

Where `objectiveId` is the existing `$derived(page.params.id ?? '')` already in the component.

### New-execution +page.svelte: reading URL params and hidden input

```svelte
<script lang="ts">
  import { page } from '$app/state';   // already used in this codebase

  // Mutable state for pre-filled values (user can override)
  let objectiveId = $state('');

  // Read URL params — $derived keeps it reactive if URL changes
  const urlObjectiveId = $derived(page.url.searchParams.get('objectiveId') ?? '');
  const urlMaxBots = $derived(Number(page.url.searchParams.get('maxBots') ?? '0'));

  // One-time initialization from URL params
  $effect(() => {
    if (urlObjectiveId && !objectiveId) {
      objectiveId = urlObjectiveId;
    }
    if (urlMaxBots > 0 && maxBots === 3) {
      maxBots = urlMaxBots;
    }
  });
</script>

<!-- Inside the <form> element, before submit button -->
{#if objectiveId}
  <input type="hidden" name="objectiveId" value={objectiveId} />
{/if}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `page` from `$app/stores` | `page` from `$app/state` (Svelte 5) | Svelte 5 migration | `page.url.searchParams` is now accessed as a plain property on the rune-based `page` object |
| N/A — no objectiveId support | Backend accepts `objectiveId` on POST /executions | Phase 16 | The entire UI gap exists because backend was added first; now closing the UI side |

**Deprecated/outdated:**
- `$app/stores` page import: This codebase uses Svelte 5. `objectives/[id]/+page.svelte` imports `{ page } from '$app/state'`. Use the same pattern.

---

## Open Questions

1. **Should the new-execution form's objective textarea be pre-filled from the objective's data?**
   - What we know: Success criteria do NOT require it. The `Objective.description` field is available. The form textarea is the mission instruction to the LLM.
   - What's unclear: Whether pre-filling `description` (or `name`) as a starting point is helpful UX.
   - Recommendation: Pre-fill with `objective.description ?? objective.name` only if objectiveId is present. User can override. But this requires an additional `getObjective()` fetch on the new-execution page (Option B pattern). Keep this as a planner decision.

2. **How much to pre-fill?**
   - What we know: The objective has `defaultMaxBots`, `defaultBudgetCapCents`, `defaultRuntimeLimitSeconds`, `defaultAllowedTools`.
   - What's unclear: Success criteria say "default settings pre-filled, all fields overridable before submission" (OBJ-02). This implies all fields should be pre-filled.
   - Recommendation: Pre-fill `maxBots` from `defaultMaxBots` via URL param (Option A). `budgetCapDollars` from `defaultBudgetCapCents / 100`. `allowedDomains` is trickier via URL (it's an array). Either include it serialized in the URL, or use Option B (client fetch). Planner decision.

3. **Where exactly should the "Launch from this objective" button appear on the objective detail page?**
   - What we know: The page has: header (name/description/meta), stats, live run panel (conditional), run history table, DNA evolution section.
   - What's unclear: Visual hierarchy — should it be in the header area (primary action) or near the run history table ("run again")?
   - Recommendation: Place it in the header section, immediately after the meta paragraph, as a primary action. This is a planner/design decision.

---

## Sources

### Primary (HIGH confidence)

- Codebase direct read — `services/ui/src/lib/api.ts`: current `createExecution()` signature confirmed missing `objectiveId`
- Codebase direct read — `services/ui/src/routes/new-execution/+page.server.ts`: confirmed no `objectiveId` extraction
- Codebase direct read — `services/ui/src/routes/objectives/[id]/+page.svelte`: confirmed no launch affordance
- Codebase direct read — `services/execution-service/src/routes/executions.ts` line 37: TypeBox schema already accepts `objectiveId: Type.Optional(Type.String({ format: 'uuid' }))`
- Codebase direct read — `services/execution-service/src/services/execution.service.ts`: backend fully validates and inserts `objectiveId`
- Codebase direct read — `packages/db/src/schema/executions.ts` line 22: `objectiveId` FK column exists with `onDelete: 'set null'`
- Codebase direct read — `services/ui/src/lib/types.ts` lines 256-267: `Objective` type has all default fields

### Secondary (MEDIUM confidence)

- SvelteKit URL search params pattern: `event.url.searchParams` in server load/actions and `page.url.searchParams` in components is standard SvelteKit API, consistent with project's existing usage of `page` from `$app/state`.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; patterns verified directly from codebase
- Architecture: HIGH — three-gap analysis is definitive from direct code inspection
- Pitfalls: HIGH — pitfall 1 (hidden input), pitfall 3 (two code paths) are confirmed from reading both files; pitfall 2 is confirmed from decision 17-03 in project memory

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable codebase, no fast-moving deps)
