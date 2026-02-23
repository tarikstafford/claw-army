# Phase 22: v3.0 Tech Debt Cleanup - Research

**Researched:** 2026-02-23
**Domain:** SvelteKit UI cleanup — dead CSS removal, Auth.js session wiring, ROADMAP housekeeping
**Confidence:** HIGH

## Summary

Phase 22 is a pure cleanup phase with three tightly scoped tasks, all of which are fully characterised by direct code inspection. No external libraries, APIs, or architectural decisions are involved. All findings are based on reading the actual source files.

The dead CSS in `report/+page.svelte` is confirmed: six CSS rule blocks (`.class-badge`, `.class-novice`, `.class-understudy`, `.class-artisan`, `.class-retired`, `.class-none`) exist at lines 377–415 of the file. The HTML template contains no references to any of these classes — they became orphaned when Phase 18-02 replaced the raw `<span class="class-badge ...">` with the `<SoulTierBadge>` component. Importantly, these class names ARE still live and in use in other files (`objectives/+page.svelte`, `objectives/[id]/+page.svelte`, `SoulInspectorPanel.svelte`) — the cleanup scope is strictly the one dead block in `report/+page.svelte`.

The hardcoded `userId="operator"` in `executions/[id]/+page.svelte` line 253 is the sole instance of this problem. The pattern to fix it is established and consistent across three other pages: `let userId = $derived(data.session?.user?.email ?? 'operator')`. The complication is that `executions/[id]/+page.svelte` currently does not destructure `data` from props — it uses `page` from `$app/state` instead. The fix requires adding `let { data } = $props()` alongside the existing imports, then deriving userId from `data.session`.

The ROADMAP.md Phase 15 plans section shows all four plans as unchecked `[ ]`, but three have SUMMARY files proving completion. The plan checkboxes for 15-01, 15-02, and 15-03 need to be flipped to `[x]`. The progress table row already correctly reads `3/4 | In Progress`.

**Primary recommendation:** Three surgical edits to two source files and one planning file — zero risk, zero new code.

---

## Finding 1: Dead CSS in report/+page.svelte

### Exact Location

File: `services/ui/src/routes/executions/[id]/report/+page.svelte`

The six dead CSS rule blocks are at lines 377–415 inside the `<style>` block:

```css
/* Lines 376–385: Agent class badges */
.class-badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.025em;
  text-transform: uppercase;
}

/* Lines 387–391 */
.class-novice {
  color: #3b82f6;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
}

/* Lines 393–397 */
.class-understudy {
  color: #8b5cf6;
  background: #f5f3ff;
  border: 1px solid #ddd6fe;
}

/* Lines 399–403 */
.class-artisan {
  color: #d97706;
  background: #fffbeb;
  border: 1px solid #fde68a;
}

/* Lines 405–409 */
.class-retired {
  color: #6b7280;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
}

/* Lines 411–415 */
.class-none {
  color: #6b7280;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
}
```

The comment block header `/* Agent class badges */` at line 376 should also be removed.

### Why They Are Dead

Phase 18-02 replaced the raw `<span class="class-badge class-{entry.agentClass?.toLowerCase() ?? 'none'}">` in the leaderboard table with `<SoulTierBadge agentClass={entry.agentClass} />`. After that replacement, the HTML template in `report/+page.svelte` contains zero references to `.class-badge`, `.class-novice`, `.class-understudy`, `.class-artisan`, `.class-retired`, or `.class-none`. The CSS rules are orphaned. Because SvelteKit uses Svelte's scoped CSS, these styles never escape to other components anyway.

**Confidence: HIGH** — verified by reading the entire HTML template (lines 1–190) and confirming no class attribute matches any of the six selectors.

### Other Files Using These Class Names (NOT to be touched)

These class names are actively live in other files. Do NOT remove their CSS:

| File | Uses |
|------|------|
| `services/ui/src/routes/objectives/+page.svelte` | `.class-badge`, `.class-novice`, `.class-understudy`, `.class-artisan`, `.class-retired` at lines 234–265 — used by `bestBotClass` display at line 64 |
| `services/ui/src/routes/objectives/[id]/+page.svelte` | `.class-badge`, `.class-novice`, `.class-understudy`, `.class-artisan`, `.class-retired` at lines 498–502 — used by DNA class breakdown spans at lines 227–239 |
| `services/ui/src/lib/components/SoulInspectorPanel.svelte` | `.class-badge` at line 344 — used by `agentClass` span at line 131 |

The scope of Phase 22 is exclusively the dead block inside `report/+page.svelte`.

### What to Delete

Remove lines 376–415 inclusive (the comment header plus all six rule blocks). Nothing else in the file needs changing.

---

## Finding 2: Hardcoded userId in VerdictConfirmPanel

### The Problem Location

File: `services/ui/src/routes/executions/[id]/+page.svelte`, line 253:

```svelte
<VerdictConfirmPanel
  verdict={selectedVerdict}
  userId="operator"          <!-- hardcoded string literal -->
  onResolved={() => { ... }}
  onClose={() => { ... }}
/>
```

### The Established Pattern

The `userId` pattern is already solved in three other files, all using the same derivation:

```typescript
let userId = $derived(data.session?.user?.email ?? 'operator');
```

Sources:
- `services/ui/src/routes/verdicts/+page.svelte` line 15
- `services/ui/src/routes/verdicts/[verdictId]/+page.svelte` line 18

The `data.session` comes from the root layout server load function (`src/routes/+layout.server.ts`), which returns `session: await event.locals.auth()`. This makes `data.session` available to all pages as layout data.

### The Complication: No `data` Props in This File

`executions/[id]/+page.svelte` currently does NOT have `let { data } = $props()`. It imports `page` from `$app/state` and reads `page.params.id` directly. The session is NOT currently destructured from data.

In SvelteKit 2 with Svelte 5, layout data flows into child pages via the `data` prop. The `page` store from `$app/state` carries `page.data` which also contains the merged layout+page data, but the established pattern in this codebase uses `let { data } = $props()` (not `page.data`).

### The Fix

Two changes to `executions/[id]/+page.svelte`:

**Step 1:** Add `data` destructuring alongside the existing script. The page already uses `$props()` implicitly (no explicit destructure), so add:

```typescript
let { data } = $props();
```

**Step 2:** Add userId derivation:

```typescript
let userId = $derived(data.session?.user?.email ?? 'operator');
```

**Step 3:** Pass to VerdictConfirmPanel:

```svelte
<VerdictConfirmPanel
  verdict={selectedVerdict}
  userId={userId}
  onResolved={...}
  onClose={...}
/>
```

### No Changes Needed in VerdictConfirmPanel.svelte

The component already accepts `userId: string` as a prop (line 12) and passes it to `confirmVerdict` and `rejectVerdict`. No changes needed to the component itself.

**Confidence: HIGH** — pattern verified against three other pages in this codebase with identical session/email derivation.

### Auth.js Stack in This Codebase

- Library: `@auth/sveltekit@^1.11.1`
- Session provider: `event.locals.auth()` in `+layout.server.ts`
- Session shape: `{ user: { name, email, image } }` (standard Auth.js session)
- Email field: `session.user.email` — used as userId identifier
- Fallback: `?? 'operator'` — all three existing usages fall back to the literal `'operator'` when unauthenticated

---

## Finding 3: ROADMAP.md Phase 15 Status Correction

### Current State

In `.planning/ROADMAP.md`, the Phase 15 section (lines 56–73) shows:

```markdown
Plans:
- [ ] 15-01-PLAN.md — GCE startup script hardening + errorMessage DB column (BOT-01, BOT-02, BOT-04 foundation)
- [ ] 15-02-PLAN.md — Ready handler validation + spawn timeout (BOT-03, BOT-04)
- [ ] 15-03-PLAN.md — Dispatch round-trip validation + UI error surface (BOT-05, BOT-06)
- [ ] 15-04-PLAN.md — Fix spawn timeout status overwrite (gap closure)
```

All four show `[ ]` (unchecked).

### Evidence of Completion

The following SUMMARY files exist in `.planning/phases/15-bot-reliability/`:
- `15-01-SUMMARY.md` — exists (plan complete)
- `15-02-SUMMARY.md` — exists (plan complete)
- `15-03-SUMMARY.md` — exists (plan complete)
- `15-04-PLAN.md` — exists but NO `15-04-SUMMARY.md` (plan not yet executed)

The progress table at the bottom of ROADMAP.md (line 205) already correctly reads:
```
| 15. Bot Reliability | v3.0 | 3/4 | In Progress | - |
```

### Required Change

Flip the first three plan checkboxes from `[ ]` to `[x]`:

```markdown
Plans:
- [x] 15-01-PLAN.md — GCE startup script hardening + errorMessage DB column (BOT-01, BOT-02, BOT-04 foundation)
- [x] 15-02-PLAN.md — Ready handler validation + spawn timeout (BOT-03, BOT-04)
- [x] 15-03-PLAN.md — Dispatch round-trip validation + UI error surface (BOT-05, BOT-06)
- [ ] 15-04-PLAN.md — Fix spawn timeout status overwrite (gap closure)
```

The progress table row does NOT need changing — it already says `3/4 | In Progress`.

**Confidence: HIGH** — verified by listing the phase 15 directory and counting SUMMARY files.

---

## Architecture Patterns

### Svelte Scoped CSS Cleanup

In Svelte components, `<style>` blocks are scoped to the component. Removing CSS rules that have no matching HTML in the same file has zero risk — the rules cannot affect other components. No global stylesheet impact.

### SvelteKit Data Flow for Session

```
+layout.server.ts
  load() → returns { session: await event.locals.auth() }
      ↓
All child +page.svelte files
  let { data } = $props()   ← receives merged layout data
  data.session              ← Auth.js session object
  data.session?.user?.email ← the userId value
```

The `executions/[id]/+page.svelte` will need `let { data } = $props()` added. This is safe — adding a destructure does not break the existing `page` import or any other state.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session userId | Custom auth cookie parsing | `data.session?.user?.email` | Already wired via Auth.js layout server load |

---

## Common Pitfalls

### Pitfall 1: Removing CSS From the Wrong File

**What goes wrong:** Deleting the class-badge rules from `objectives/+page.svelte` or `objectives/[id]/+page.svelte` instead of (or in addition to) `report/+page.svelte`.
**Why it happens:** The class names appear in multiple files; a global search shows many matches.
**How to avoid:** The cleanup scope is ONLY `services/ui/src/routes/executions/[id]/report/+page.svelte`. Confirm the HTML template in that file has zero references to these class names before deleting.

### Pitfall 2: Using `page.data.session` Instead of `data.session`

**What goes wrong:** Deriving session from `page.data.session` (via the `page` store) rather than `data.session` (from `$props()`).
**Why it happens:** `executions/[id]/+page.svelte` already imports `page` from `$app/state` and uses `page.params.id`.
**How to avoid:** Follow the established pattern — all other pages in this codebase use `let { data } = $props()` for session access. Svelte's `page` store is used for route params only in this codebase, not for layout data.

### Pitfall 3: Updating the ROADMAP Progress Table Row (Redundant)

**What goes wrong:** Editing the progress table row for Phase 15 even though it already says `3/4 | In Progress`.
**Why it happens:** The success criterion says "reflect 3/4 plans complete" which sounds like the table needs updating.
**How to avoid:** The progress table already says `3/4`. The only thing that needs changing is the four `[ ]` plan bullets in the Phase 15 section — three become `[x]`.

---

## Code Examples

### Pattern: Deriving userId from Auth.js Session (from `verdicts/+page.svelte`)

```typescript
// Source: services/ui/src/routes/verdicts/+page.svelte lines 6, 15
let { data } = $props();
let userId = $derived(data.session?.user?.email ?? 'operator');
```

### Pattern: How to Add `data` Destructuring Alongside Existing `page` Import

The `executions/[id]/+page.svelte` currently starts with:

```typescript
import { page } from '$app/state';
import { browser } from '$app/environment';
// ... other imports
const executionId = $derived(page.params.id ?? '');
// ... existing state
```

After the fix it should include:

```typescript
import { page } from '$app/state';
import { browser } from '$app/environment';
// ... other imports

let { data } = $props();
const executionId = $derived(page.params.id ?? '');
let userId = $derived(data.session?.user?.email ?? 'operator');
// ... existing state unchanged
```

Then pass `userId={userId}` to `VerdictConfirmPanel` (removing the string literal `"operator"`).

---

## Files to Modify

| File | Change |
|------|--------|
| `services/ui/src/routes/executions/[id]/report/+page.svelte` | Delete lines 376–415 (dead CSS comment + 6 rule blocks) |
| `services/ui/src/routes/executions/[id]/+page.svelte` | Add `let { data } = $props()`, add `let userId = $derived(...)`, change `userId="operator"` to `userId={userId}` |
| `.planning/ROADMAP.md` | Flip 15-01, 15-02, 15-03 plan bullets from `[ ]` to `[x]` |

No other files need changes.

---

## Open Questions

None. All three tasks are fully characterised by direct code inspection with no ambiguity.

---

## Sources

### Primary (HIGH confidence)

- Direct file read: `services/ui/src/routes/executions/[id]/report/+page.svelte` — full file read, confirmed CSS rules at lines 377–415 with no matching HTML references
- Direct file read: `services/ui/src/routes/executions/[id]/+page.svelte` — confirmed `userId="operator"` at line 253, confirmed no `let { data } = $props()` exists
- Direct file read: `services/ui/src/lib/components/VerdictConfirmPanel.svelte` — confirmed `userId: string` prop interface
- Direct file read: `services/ui/src/routes/verdicts/+page.svelte` — confirmed `data.session?.user?.email ?? 'operator'` pattern
- Direct file read: `services/ui/src/routes/verdicts/[verdictId]/+page.svelte` — confirmed same pattern
- Direct file read: `services/ui/src/routes/+layout.server.ts` — confirmed session returned from `event.locals.auth()`
- Direct file read: `.planning/ROADMAP.md` — confirmed Phase 15 plan bullets all `[ ]`, progress table already `3/4`
- Directory listing: `.planning/phases/15-bot-reliability/` — confirmed 15-01/02/03 SUMMARY files exist, 15-04 does not

---

## Metadata

**Confidence breakdown:**
- Dead CSS location and scope: HIGH — read the file directly, counted zero HTML references
- userId fix pattern: HIGH — three existing pages use identical pattern
- ROADMAP correction: HIGH — directory listing confirms 3 summaries, 1 missing

**Research date:** 2026-02-23
**Valid until:** This is a point-in-time snapshot of the codebase. Valid until any of the three target files are modified.
