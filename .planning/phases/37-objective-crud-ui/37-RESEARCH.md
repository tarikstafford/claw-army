# Phase 37: Objective CRUD UI — Research

**Researched:** 2026-03-03
**Domain:** SvelteKit forms, API integration, UI patterns (Akasa design system)
**Confidence:** HIGH — all findings verified against actual source files in the codebase

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Create objective flow**
- Dedicated page at `/objectives/new` — consistent with existing `/new-execution` pattern
- Form shows all configurable fields: name, description, max bots, budget cap, runtime limit, allowed tools
- After creation, redirect to the new objective's detail page (`/objectives/:id`)
- Replace the "Deploy new crew" button on `/objectives` list with "New Objective" as primary CTA — deploying a crew happens from the objective detail page

**Edit objective flow**
- Edit button on the detail page (`/objectives/:id`) switches the header area into an editable inline form with Save/Cancel buttons
- All fields are always editable — these are defaults for future launches, not execution configs. No locking after runs.
- Explicit save button — user makes changes, clicks Save. Clear commit point. Matches existing form patterns.
- Row actions on the list page too — each row gets a kebab menu (three dots) for quick edit/archive. Detail page also has edit.

**Archive behavior**
- Archive only (soft delete) via PATCH isArchived=true — objective hidden from list but retained in DB. Run history preserved.
- Confirmation dialog before archiving: "Archive [objective name]? It will be hidden from your list." with Cancel/Archive buttons.
- Show archived toggle on `/objectives` — filter to reveal archived objectives, visually dimmed, with "Unarchive" action.
- Archive action available on both list (via kebab menu) and detail page.

**Form field defaults**
- Default max bots: 5 (matches DB default)
- Budget and runtime pre-filled: $10.00 budget, 60 min runtime — matches /new-execution defaults. User can clear to leave null (no limit).
- Validation errors inline under each field (red text below specific field that failed)
- Tool allowlist uses the same ENABLED badge toggle pattern from /new-execution for consistency

### Claude's Discretion
- Loading states during form submission
- Exact form layout and spacing within the Akasa design system
- Error handling for API failures (toast vs inline)
- Kebab menu component implementation details

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OBJ-01 | User can create a new named objective with default configuration (max bots, budget, tools, runtime) | POST /objectives endpoint verified; +page.server.ts pattern from /new-execution maps directly; all fields present in backend schema |
| OBJ-02 | User can edit an existing objective's name, description, and default configuration | PATCH /objectives/:id endpoint verified with partial updates; inline edit pattern enabled by `$state` rune toggling an `editMode` boolean |
| OBJ-03 | User can archive an objective (soft delete) from the objectives list | PATCH /objectives/:id with `{ isArchived: true }` verified; GET / already filters `isArchived = false`; unarchive via PATCH `{ isArchived: false }` |
</phase_requirements>

---

## Summary

Phase 37 is a pure UI integration phase — all backend CRUD endpoints are already live and verified. The work is entirely in `services/ui/`: three new/modified Svelte files, new API helper functions in `api.ts`, and a new server action file for the create form.

The codebase has strong, reusable patterns that make this phase straightforward. The `/new-execution` route provides the complete template for a dedicated form page: `+page.server.ts` for server actions, `use:enhance` with `$state` runes in the component, and the `panel`/`tool-toggle` CSS vocabulary from Akasa design system. These patterns transfer almost verbatim to `/objectives/new`.

The inline edit mode on the detail page is a well-established SvelteKit pattern: a `let editMode = $state(false)` boolean toggles between read view and an editable form. The confirmation dialog for archive is a simple modal implemented with a local `$state` boolean — no external dialog library needed, consistent with how the rest of the UI handles interactions.

**Primary recommendation:** Build each plan as a standalone unit. Plan 37-01 (create form) is fully self-contained. Plan 37-02 (edit form) modifies only the detail page. Plan 37-03 (archive) touches both list and detail pages but only adds small targeted UI elements.

---

## Standard Stack

### Core (already in project — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SvelteKit | 2.x | Routing, server actions, SSR | Project foundation |
| Svelte 5 | 5.x | Reactive state via runes (`$state`, `$derived`, `$effect`) | Project uses Svelte 5 runes throughout |
| `@auth/sveltekit` | in use | Session auth in server actions | Pattern established in /new-execution/+page.server.ts |
| `$app/forms` `enhance` | built-in | Progressive enhancement for form submission | Used in /new-execution |
| `$app/navigation` `goto` | built-in | Client-side redirect after form success | Used in /new-execution |

### Supporting (no new installs needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `$app/state` `page` | built-in | Read URL params | For pre-populating forms from query strings |
| `$app/environment` `browser` | built-in | Guard SSR-only effects | Already used in objectives pages |
| `$lib/api` `apiFetch` | project | Typed API calls | For client-side PATCH/archive calls from kebab menu |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended File Structure

```
services/ui/src/routes/
├── objectives/
│   ├── +page.svelte                 # MODIFY: replace CTA, add kebab menu, archived toggle
│   ├── new/
│   │   ├── +page.svelte             # CREATE: objective create form
│   │   └── +page.server.ts          # CREATE: server action for POST /objectives
│   └── [id]/
│       └── +page.svelte             # MODIFY: add inline edit mode, archive button
services/ui/src/lib/
└── api.ts                           # MODIFY: add createObjective, updateObjective, archiveObjective
```

### Pattern 1: Server Action for Create Form (37-01)

The `/new-execution/+page.server.ts` is the direct model. Auth is verified twice (load + action), `formData` is parsed, token extracted from cookies, and a `fetch` call made to `EXECUTION_SERVICE_URL`.

For objectives, the URL is `${EXECUTION_SERVICE_URL}/objectives` and the body maps to:
```typescript
// Source: services/execution-service/src/routes/objectives.ts
{
  name: string,                        // required, minLength: 1, maxLength: 255
  description?: string,
  defaultMaxBots: number,              // integer, minimum: 3, maximum: 20
  defaultBudgetCapCents?: number,      // integer, minimum: 0 (null = no limit)
  defaultRuntimeLimitSeconds?: number, // integer, minimum: 60 (null = no limit)
  defaultAllowedTools?: string[],      // array of tool IDs
}
```

On success (201), redirect to `/objectives/${created.id}`.

```typescript
// +page.server.ts pattern (from services/ui/src/routes/new-execution/+page.server.ts)
export const actions: Actions = {
  default: async (event) => {
    const session = await event.locals.auth();
    if (!session?.user) redirect(303, '/login');

    const formData = await event.request.formData();
    const name = (formData.get('name') as string | null)?.trim();
    if (!name) return fail(400, { error: 'Name is required.' });

    const sessionToken =
      event.cookies.get('__Secure-authjs.session-token') ??
      event.cookies.get('authjs.session-token');

    const budgetCapDollars = formData.get('budgetCapDollars');
    const budgetCapCents = budgetCapDollars
      ? Math.round(Number(budgetCapDollars) * 100)
      : null;

    const runtimeLimitMinutes = formData.get('runtimeLimitMinutes');
    const runtimeLimitSeconds = runtimeLimitMinutes
      ? Number(runtimeLimitMinutes) * 60
      : null;

    const allowedTools = formData.getAll('allowedTools') as string[];

    const res = await fetch(`${process.env.EXECUTION_SERVICE_URL}/objectives`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify({
        name,
        description: (formData.get('description') as string | null)?.trim() || undefined,
        defaultMaxBots: Number(formData.get('defaultMaxBots') ?? 5),
        ...(budgetCapCents !== null ? { defaultBudgetCapCents: budgetCapCents } : {}),
        ...(runtimeLimitSeconds !== null ? { defaultRuntimeLimitSeconds: runtimeLimitSeconds } : {}),
        defaultAllowedTools: allowedTools,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return fail(res.status, { error: text || 'Failed to create objective.' });
    }

    const created = await res.json() as { id: string };
    redirect(303, `/objectives/${created.id}`);
  },
};
```

### Pattern 2: Inline Edit Mode (37-02)

Toggle a `$state` boolean to swap between read and edit views in the objective detail page. No separate route needed — the edit form replaces the header area in place.

```typescript
// In services/ui/src/routes/objectives/[id]/+page.svelte
let editMode = $state(false);
let editName = $state('');
let editDescription = $state('');
let editMaxBots = $state(5);
let editBudgetCapDollars = $state<number | null>(null);
let editRuntimeLimitMinutes = $state<number | null>(null);
let editSelectedTools = $state<Set<string>>(new Set());
let saving = $state(false);
let saveError = $state<string | null>(null);

function enterEditMode() {
  if (!objective) return;
  editName = objective.name;
  editDescription = objective.description ?? '';
  editMaxBots = objective.defaultMaxBots;
  editBudgetCapDollars = objective.defaultBudgetCapCents
    ? objective.defaultBudgetCapCents / 100
    : null;
  editRuntimeLimitMinutes = objective.defaultRuntimeLimitSeconds
    ? objective.defaultRuntimeLimitSeconds / 60
    : null;
  editSelectedTools = new Set(objective.defaultAllowedTools);
  editMode = true;
}

async function handleSave() {
  saving = true;
  saveError = null;
  try {
    const updated = await updateObjective(objectiveId, {
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      defaultMaxBots: editMaxBots,
      defaultBudgetCapCents: editBudgetCapDollars !== null
        ? Math.round(editBudgetCapDollars * 100)
        : undefined,
      defaultRuntimeLimitSeconds: editRuntimeLimitMinutes !== null
        ? editRuntimeLimitMinutes * 60
        : undefined,
      defaultAllowedTools: [...editSelectedTools],
    });
    objective = updated;
    editMode = false;
  } catch (e) {
    saveError = 'Failed to save. Please try again.';
  } finally {
    saving = false;
  }
}
```

The save calls `updateObjective()` from `$lib/api.ts` — a new client-side function that sends `PATCH /objectives/:id` with a JSON body.

### Pattern 3: Archive with Confirmation Dialog (37-03)

Use a local `$state` boolean to control a confirmation dialog overlay. No external library needed.

```typescript
// In objectives list or detail page
let archivingObjectiveId = $state<string | null>(null);
let archiveName = $state('');
let archiving = $state(false);

function requestArchive(id: string, name: string) {
  archivingObjectiveId = id;
  archiveName = name;
}

async function confirmArchive() {
  if (!archivingObjectiveId) return;
  archiving = true;
  try {
    await archiveObjective(archivingObjectiveId);
    objectives = objectives.filter(o => o.id !== archivingObjectiveId);
    archivingObjectiveId = null;
  } catch (e) {
    // show inline error
  } finally {
    archiving = false;
  }
}
```

### Pattern 4: New API Functions (api.ts additions)

```typescript
// Source: services/execution-service/src/routes/objectives.ts — verified schema
export async function createObjective(body: {
  name: string;
  description?: string;
  defaultMaxBots: number;
  defaultBudgetCapCents?: number;
  defaultRuntimeLimitSeconds?: number;
  defaultAllowedTools?: string[];
}): Promise<Objective> {
  return apiFetch(`${BASE}/objectives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function updateObjective(
  id: string,
  body: Partial<{
    name: string;
    description: string;
    defaultMaxBots: number;
    defaultBudgetCapCents: number;
    defaultRuntimeLimitSeconds: number;
    defaultAllowedTools: string[];
    isArchived: boolean;
  }>,
): Promise<Objective> {
  return apiFetch(`${BASE}/objectives/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function archiveObjective(id: string): Promise<Objective> {
  return updateObjective(id, { isArchived: true });
}

export async function unarchiveObjective(id: string): Promise<Objective> {
  return updateObjective(id, { isArchived: false });
}
```

**Note:** `updateObjective` and `archiveObjective` do NOT need auth headers here because `apiFetch` is called from the browser without the httpOnly session cookie. Looking at the backend, `PATCH /:id` requires `verifyAuthToken`. This is how other client-side calls currently work in the project — the browser calls go to `/api` which is a proxy. Verify whether the objectives PATCH endpoint is exposed through the proxy or needs a server action. See Open Questions section.

### Pattern 5: Kebab Menu (37-03)

The kebab menu has no existing precedent in the codebase. Claude's discretion per CONTEXT.md. Recommend a simple local `$state<string | null>(null)` for `openMenuId` — when it matches the row ID, show the dropdown. Close on outside click via a Svelte action or `onclick` on a backdrop element. No third-party component needed.

```svelte
<!-- Minimal kebab menu pattern -->
<div class="row-actions">
  <button
    class="kebab-btn"
    onclick={(e) => { e.stopPropagation(); openMenuId = openMenuId === obj.id ? null : obj.id; }}
    aria-label="Row actions"
  >
    ···
  </button>
  {#if openMenuId === obj.id}
    <div class="kebab-dropdown">
      <button onclick={() => { openMenuId = null; /* navigate to edit */ }}>Edit</button>
      <button onclick={() => { openMenuId = null; requestArchive(obj.id, obj.name); }}>Archive</button>
    </div>
  {/if}
</div>
```

### Pattern 6: Archived Toggle (37-03)

The list page currently fetches `getObjectives()` which filters `isArchived = false`. Adding an "archived" view requires:
1. A `$state` boolean `showArchived`
2. When `showArchived` is true, call a new `getArchivedObjectives()` function (or modify the backend endpoint to accept `?includeArchived=true`)

**Critical finding:** The current `GET /objectives` endpoint hardcodes `WHERE isArchived = false`. There is no query parameter support. To show archived objectives, the UI must either:
- Call `GET /objectives/:id` individually (not practical for a list), or
- The planner must decide: add a `?archived=true` backend query param, or use a separate client-side fetch approach

**Recommendation:** Add a second API call — when `showArchived` is toggled on, call a new function that fetches all objectives (or just archived ones). Since the backend GET / filters non-archived only, either modify the backend or implement a practical workaround. Given the phase constraint of "no backend work needed," this may need a minor backend addition (single line: make the WHERE clause conditional on a query param). The planner should resolve this. See Open Questions.

### Anti-Patterns to Avoid

- **Separate edit route:** Do not create `/objectives/:id/edit` as a separate route. The decision is inline edit on the detail page. Separate route adds navigation complexity for no benefit.
- **Full-page reload on save:** Use client-side `apiFetch` PATCH for the edit save. Do not use a server action POST/PATCH that redirects — the inline edit should update `objective` state in-place without navigation.
- **`use:enhance` for inline edit:** Server actions + `enhance` are for the create form (which navigates to a new page on success). Inline edit and archive should use direct client-side `apiFetch` calls for in-place state updates.
- **Omitting null handling for budget/runtime:** Both fields are optional (null = no limit). Form inputs must allow clearing to null, not just setting a value.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form state management | Custom event bus | Svelte 5 `$state` runes | Runes provide fine-grained reactivity with no boilerplate |
| Tool multi-select | Custom checkbox system | Copy tool-toggle pattern from /new-execution | Pattern already verified, CSS already defined |
| Confirmation dialog | External modal library (e.g., svelte-modals) | Local `$state` boolean + inline dialog markup | No new dependencies; existing project does this pattern for confirmation (see pre-flight confirm/cancel) |
| Type validation | Custom validators | Backend TypeBox validation (min: 3, max: 20 for maxBots, min: 0 for budget cents, min: 60 for runtime seconds) | Backend validates authoritatively; UI validation is UX-only |

---

## Common Pitfalls

### Pitfall 1: Budget/Runtime null vs undefined vs empty string

**What goes wrong:** User clears the budget field. `Number('')` is `0`, not `null`. Sending `0` would fail backend validation (`minimum: 0` passes, but semantics differ from "no limit").

**Why it happens:** HTML number inputs return empty string when cleared. JavaScript `Number('')` returns `0`.

**How to avoid:** Check `formData.get('budgetCapDollars') === ''` or `=== null` before converting. If empty, send `undefined` in the JSON body (omit the field entirely), which the backend TypeBox partial schema treats as "leave unchanged" for PATCH, or as "null/no limit" for POST.

**Warning signs:** Budget field showing $0.00 after save when user intended no limit.

### Pitfall 2: defaultMaxBots backend constraint (min: 3)

**What goes wrong:** CONTEXT.md says "Default max bots: 5 (matches DB default)" but the backend enforces `minimum: 3, maximum: 20`. The /new-execution form uses a range slider from 1–20. The create objective form must use 3–20 as its range.

**Why it happens:** Execution bots and objective default bots have different minimum constraints.

**How to avoid:** Set `min="3"` on the range/number input. Display range labels "3" and "20 max" (not "1" and "20").

**Warning signs:** 400 error from POST /objectives when user sets bots to 1 or 2.

### Pitfall 3: PATCH endpoint requires auth, client-side calls lack httpOnly cookie

**What goes wrong:** `apiFetch` from the browser can call GET endpoints freely (no auth required on GET /objectives and GET /objectives/:id per the backend code). However, PATCH /:id has a `verifyAuthToken` preHandler. Client-side `apiFetch` does not have access to the httpOnly session cookie to send as Bearer token.

**Why it happens:** The session token is in a httpOnly cookie, inaccessible to JavaScript. Server actions can read it via `event.cookies.get(...)`.

**How to avoid:** Either (a) implement edit/archive as server actions (form POST) rather than client-side fetch, or (b) verify that the proxy layer (`/api` prefix) forwards the cookie as an Authorization header automatically. Check the existing API proxy configuration. The GET /objectives currently works from the browser, suggesting GET routes don't need auth — but PATCH does. See Open Questions.

**Warning signs:** 401 Unauthorized response from PATCH /objectives/:id when called from browser.

### Pitfall 4: Archived objectives list — backend filter hardcoded

**What goes wrong:** GET /objectives always WHERE isArchived = false. There is no way to fetch archived objectives without either (a) a backend change or (b) knowing all objective IDs in advance.

**How to avoid:** The planner must decide whether to add `?includeArchived=true` query param support to the backend (simple one-line WHERE clause change) or scope the archived toggle differently (e.g., archive action only, no "view archived" list).

**Warning signs:** Empty list when showArchived toggle is clicked, because there's no endpoint to fetch archived objectives.

### Pitfall 5: Svelte 5 `$derived` vs `$effect` for URL params

**What goes wrong:** Using `$effect` to read `page.params.id` causes re-runs on every reactive update inside the effect, leading to infinite loops.

**Why it happens:** `page` from `$app/state` is reactive. Reading it inside `$effect` without capturing creates a dependency that triggers on every page update.

**How to avoid:** Use `$derived` for URL-derived values (as the existing detail page does: `const objectiveId = $derived(page.params.id ?? '')`). Use `$effect` only for side effects (data fetching) keyed on that derived value.

---

## Code Examples

### Backend API Contract (verified from source)

```typescript
// Source: services/execution-service/src/routes/objectives.ts

// POST /objectives — create
// Body:
{
  name: string,              // required, minLength: 1, maxLength: 255
  description?: string,
  defaultMaxBots: number,    // integer, minimum: 3, maximum: 20
  defaultBudgetCapCents?: number,       // integer, minimum: 0
  defaultRuntimeLimitSeconds?: number,  // integer, minimum: 60
  defaultAllowedTools?: string[],       // defaults to []
}
// Response 201: Objective object

// PATCH /objectives/:id — update
// Body: any subset of above fields + isArchived: boolean
// All fields optional (TypeBox.Partial)
// Response 200: Updated Objective object
// Requires: Authorization: Bearer <session-token>

// GET /objectives — list non-archived
// No auth required
// Response 200: ObjectiveListItem[] (includes lastRunStatus, runCount, totalSpendCents, bestBotClass)

// GET /objectives/:id — single objective
// No auth required
// Response 200: Objective object
```

### Objective Type (verified from types.ts)

```typescript
// Source: services/ui/src/lib/types.ts
export interface Objective {
  id: string;
  name: string;
  description: string | null;
  defaultMaxBots: number;
  defaultBudgetCapCents: number | null;
  defaultRuntimeLimitSeconds: number | null;
  defaultAllowedTools: string[];
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ObjectiveListItem extends Objective {
  lastRunStatus: string | null;
  runCount: number;
  totalSpendCents: number;
  bestBotClass: 'Novice' | 'Understudy' | 'Artisan' | 'Retired' | null;
}
```

### AVAILABLE_TOOLS constant (verified from /new-execution)

```typescript
// Source: services/ui/src/routes/new-execution/+page.svelte
const AVAILABLE_TOOLS: { id: string; label: string; description: string }[] = [
  { id: 'bash',       label: 'Bash',       description: 'Execute shell commands' },
  { id: 'file_read',  label: 'File Read',  description: 'Read files from the filesystem' },
  { id: 'file_write', label: 'File Write', description: 'Write files to the filesystem' },
  { id: 'web_search', label: 'Web Search', description: 'Search the web' },
  { id: 'web_fetch',  label: 'Web Fetch',  description: 'Fetch content from URLs' },
];
// Copy this constant to /objectives/new/+page.svelte — same tools apply
```

### Akasa Design Tokens (verified from app.css)

```css
/* Source: services/ui/src/app.css */
--bg:        #07060f;
--bg-2:      #0c0b18;
--bg-3:      #100f1e;
--bg-card:   #131224;
--border:     rgba(148,110,255,0.10);
--border-mid: rgba(148,110,255,0.20);
--border-hi:  rgba(148,110,255,0.32);
--text:       #ece8ff;
--text-muted: rgba(236,232,255,0.50);
--text-faint: rgba(236,232,255,0.22);
--violet:        #7c3aed;
--violet-bright: #a78bfa;
--violet-dim:    rgba(124,58,237,0.14);
--error:     #f87171;
--error-dim: rgba(248,113,113,0.10);
--font-display: 'Clash Display', 'Inter', system-ui, sans-serif;
--font-body:    'Inter', system-ui, sans-serif;
--font-mono:    'JetBrains Mono', monospace;
```

### Create Form Page Structure (adapted from /new-execution)

```
/objectives/new/+page.svelte structure:
- .briefing wrapper (max-width: 760px, same as /new-execution)
- .briefing-header with back link to /objectives, MISSION BRIEFING tag, h1
- <form method="POST" use:enhance>
  - Panel 01: Name (text input, required)
  - Panel 02: Description (textarea, optional)
  - Panel 03: Crew Size (range slider 3–20, default 5)
  - Panel 04: Budget Cap (number input with $ prefix, nullable)
  - Panel 05: Runtime Limit (number input with "min" suffix, nullable)
  - Panel 06: Tool Allowlist (ENABLED badge toggles — same pattern as /new-execution panel 07)
  - Error banner (if form?.error)
  - Submit button "Create Objective"
```

### Inline Edit Mode Toggle (detail page)

```svelte
<!-- Source pattern adapted from services/ui/src/routes/objectives/[id]/+page.svelte -->
{#if editMode}
  <!-- Edit form area replaces the header -->
  <div class="edit-form">
    <input type="text" bind:value={editName} class="edit-name-input" />
    <textarea bind:value={editDescription}></textarea>
    <!-- ... other fields ... -->
    {#if saveError}
      <p class="field-error">{saveError}</p>
    {/if}
    <div class="edit-actions">
      <button onclick={() => { editMode = false; }} class="btn-cancel">Cancel</button>
      <button onclick={handleSave} disabled={saving} class="btn-save">
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  </div>
{:else}
  <!-- Read view: existing header with Edit button -->
  <h1>{objective?.name}</h1>
  <!-- ... existing content ... -->
  <button onclick={enterEditMode} class="btn-edit">Edit</button>
{/if}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Svelte stores + `writable()` | Svelte 5 `$state` runes | Svelte 5 (in use) | Simpler, no store imports needed |
| `$page.params` store subscription | `$derived(page.params.id)` from `$app/state` | Svelte 5 (in use) | Cleaner reactive derivation |
| Server-rendered forms with full redirect | `use:enhance` with in-place update | SvelteKit 2.x | Faster UX without full page reload |

**Deprecated/outdated in this codebase:**
- `writable` Svelte stores: Not used anywhere in the UI routes — all reactive state uses `$state` runes
- `$page` store import from `$app/stores`: The project uses `page` from `$app/state` (Svelte 5 approach)

---

## Open Questions

1. **Client-side PATCH auth: does apiFetch work for PATCH /objectives/:id?**
   - What we know: GET /objectives and GET /objectives/:id have no preHandler (no auth). PATCH /:id has `verifyAuthToken` preHandler. Existing client-side `apiFetch` calls in the UI (getBillingHistory, getObjectives) work without sending auth headers.
   - What's unclear: Whether the proxy at `/api` injects the Authorization header from the session cookie for mutating requests. The existing `api.ts` `apiFetch` function sends no headers at all — it relies on the browser cookie being forwarded.
   - Recommendation: Check `services/ui` proxy/server config before building inline edit. If client-side PATCH doesn't have auth, implement edit/archive as server actions (form POST to a `?/update` action). This adds a server round-trip but is the secure pattern.

2. **Archived objectives list: backend endpoint support**
   - What we know: GET /objectives hardcodes `WHERE isArchived = false` with no query param support. The CONTEXT.md locked decision requires an archived toggle showing archived objectives visually dimmed.
   - What's unclear: Whether a backend change is acceptable in this "UI-only" phase, or if the planner should scope the toggle to "hide the archived toggle until Phase 38" or similar.
   - Recommendation: Add a single-line backend change to accept `?archived=true` param — this is a 5-line change to objectives.ts and is unavoidable to fulfill the locked decision. Flag to user if backend is truly off-limits.

3. **Kebab menu close-on-outside-click behavior**
   - What we know: No existing kebab menu in the codebase. CONTEXT.md marks implementation details as Claude's discretion.
   - What's unclear: Whether a Svelte `use:` action (clickOutside) is warranted or if a simpler backdrop approach suffices.
   - Recommendation: Use a simple `window.addEventListener('click', ...)` inside an `$effect` that clears `openMenuId` — runs on every outside click. Simpler than a custom action.

---

## Sources

### Primary (HIGH confidence)
- `services/execution-service/src/routes/objectives.ts` — full backend API contract verified: POST, PATCH, GET endpoints, TypeBox validation schemas, auth requirements
- `services/ui/src/routes/new-execution/+page.svelte` — complete form pattern: panels, tool-toggle, range slider, budget input, `use:enhance`, `$state` runes
- `services/ui/src/routes/new-execution/+page.server.ts` — server action pattern: auth check, formData parsing, cookie extraction, fetch to execution service, redirect
- `services/ui/src/routes/objectives/+page.svelte` — list page patterns: table, status badges, class badges, CTA button to replace
- `services/ui/src/routes/objectives/[id]/+page.svelte` — detail page: header structure, stats grid, SSE, existing data loading pattern
- `services/ui/src/lib/api.ts` — existing API helper: `apiFetch`, all existing objective read functions
- `services/ui/src/lib/types.ts` — `Objective`, `ObjectiveListItem` types fully verified
- `services/ui/src/app.css` — complete Akasa design token set: all CSS custom properties

### Secondary (MEDIUM confidence)
- None required — all critical findings sourced from project code

### Tertiary (LOW confidence)
- None — no WebSearch required for this phase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json and all existing route files
- Architecture patterns: HIGH — copied directly from working code in the same project
- Backend API contract: HIGH — read directly from objectives.ts source
- Pitfalls: HIGH — identified from actual code constraints and TypeBox schema validation rules
- Auth on PATCH: MEDIUM — proxy behavior not directly verified, flagged as open question

**Research date:** 2026-03-03
**Valid until:** Stable — no external dependencies to expire. Valid as long as objectives.ts and ui source files are unchanged.
