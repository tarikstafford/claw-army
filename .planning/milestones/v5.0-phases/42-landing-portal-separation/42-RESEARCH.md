# Phase 42: Landing Portal Separation - Research

**Researched:** 2026-03-04
**Domain:** SvelteKit route groups, layout architecture, auth-aware navigation
**Confidence:** HIGH

## Summary

Phase 42 separates the public landing page (marketing site at `/`) from the authenticated crew portal (app routes like `/objectives`, `/executions`, `/souls`, etc.) using SvelteKit route groups. Currently a single root `+layout.svelte` serves both contexts, meaning the full portal nav (Objectives, Guide, Verdicts, Billing, Souls, Benchmarks, Signals + Deploy crew) renders on every page including the public landing. This is both a UX problem (marketing visitors see confusing app links) and a visual problem (the landing page nav should be minimal — logo + Login/Signup only).

The solution is to create two SvelteKit route groups: `(marketing)` for the landing page with a minimal layout, and `(app)` for all authenticated portal routes with the full nav. Route groups in SvelteKit use parenthesised directory names — they are invisible in the URL, affecting only which `+layout.svelte` applies.

The current root `+layout.svelte` contains significant logic: particle canvas animation, SSE lifecycle toast notifications, the nav, and all global CSS. The portal group layout must inherit or replicate this app-specific logic. The landing group layout can be much leaner — import `app.css`, render the canvas particles (visual brand element), but only show logo + login/signup in the nav.

**Primary recommendation:** Introduce `(marketing)` and `(app)` route groups. Move `/` into `(marketing)` with a minimal nav layout. Move all authenticated routes into `(app)` with the full nav + SSE toasts. The root layout becomes a bare shell that only loads the CSS and particle canvas (shared brand element), or is replaced entirely by each group's layout.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PORTAL-01 | Clean visual separation between marketing site and app portal | SvelteKit route groups provide layout isolation per URL group without URL change. Landing gets minimal nav (logo + Login/Signup), portal gets full nav (all management links + Deploy crew + SSE toasts). |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@sveltejs/kit` | `^2.52.0` (already installed) | Route groups, layouts | Project's current framework |
| `svelte` | `^5.51.3` (already installed) | Component model, `$state`, `$props`, `$effect` | Project's component runtime |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@auth/sveltekit` | Already installed | Session check in portal layout | Portal `+layout.server.ts` needs session |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Route groups | Conditional nav in root layout | Simpler but messy — requires route-matching logic in nav, doesn't cleanly separate layout concerns |
| Route groups | Separate SvelteKit apps | Far too heavy — single app is correct |

**Installation:** No new packages required — this is pure file structure + component work.

## Architecture Patterns

### Recommended Project Structure

**Current structure (problem):**
```
routes/
├── +layout.svelte          ← single layout: full nav + SSE toasts + particles
├── +layout.server.ts       ← loads session for all routes
├── +layout.js
├── +page.svelte            ← landing page
├── +page.server.ts         ← requestAccess form action
├── objectives/
├── executions/
├── souls/
├── ...all portal routes
```

**Target structure (solution):**
```
routes/
├── +layout.svelte          ← bare root: app.css import only (or nothing)
├── +layout.js              ← keep as-is (SSR enabled)
├── (marketing)/
│   ├── +layout.svelte      ← minimal: particles canvas + logo + Login/Signup nav
│   ├── +page.svelte        ← landing page (moved from root)
│   └── +page.server.ts     ← requestAccess action (moved from root)
└── (app)/
    ├── +layout.svelte      ← full: particles + full nav + SSE toasts
    ├── +layout.server.ts   ← session load (moved from root)
    ├── objectives/
    ├── executions/
    ├── souls/
    ├── guide/
    ├── verdicts/
    ├── billing/
    ├── category-benchmarks/
    ├── negative-signals/
    ├── new-execution/
    ├── login/              ← stays in (app) or gets own minimal layout — see below
    ├── admin/
    └── api/
```

### Pattern 1: SvelteKit Route Groups
**What:** Parenthesised directory names `(groupname)` that group routes for layout purposes without affecting the URL path.
**When to use:** When different sections of the app need different persistent layouts but share the same URL namespace.
**Example:**
```
// routes/(marketing)/+page.svelte renders at URL: /
// routes/(app)/objectives/+page.svelte renders at URL: /objectives
// The group name is invisible in the URL
```

**Key SvelteKit rule (HIGH confidence — official docs):** A route group directory `(name)` is ignored when computing the URL path. So `(marketing)/+page.svelte` is still served at `/` and `(app)/objectives/+page.svelte` is still served at `/objectives`.

### Pattern 2: Layout Inheritance Chain
**What:** Route group layouts extend their parent layout. The root `+layout.svelte` wraps both groups.
**Options:**

Option A — Minimal root, group-specific layouts:
- Root `+layout.svelte`: Only `<slot>` / `{@render children()}` with global CSS import
- `(marketing)/+layout.svelte`: Landing nav (logo + Login/Signup) + particles
- `(app)/+layout.svelte`: Full nav + SSE toasts + particles

Option B — Root layout for shared brand elements, groups extend it:
- Root `+layout.svelte`: Particles canvas + app.css
- `(marketing)/+layout.svelte`: Landing nav only
- `(app)/+layout.svelte`: Full nav + SSE toasts

**Recommendation: Option A** — cleaner separation. The particles canvas can be included in both group layouts independently since it is ~40 lines of self-contained code. Duplication here is preferable to complex inheritance.

### Pattern 3: Session Load Placement
**What:** The root `+layout.server.ts` currently provides `session` to all routes via `data.session`.
**Decision required:**
- Move `+layout.server.ts` to `(app)/+layout.server.ts` only — session is irrelevant to the marketing page
- The landing page's `+page.svelte` already handles the unauthenticated case correctly (shows "Request access" button) without needing session
- However the root `+layout.svelte` `nav` section uses `session?.user` to toggle "Deploy crew" vs "Request access" — this logic moves to group-specific layouts

**Verdict:** Move `+layout.server.ts` to `(app)/`. Landing page does not need session.

### Pattern 4: Login Route Placement
**What:** The `/login` route currently lives at root level with no auth check. It uses `@auth/sveltekit/client`'s `signIn`.
**Options:**
- Keep `/login` in `(app)/` — it gets the full app layout, which is odd (shows full nav when user is logging in)
- Move `/login` into `(marketing)/` — gives it the minimal nav (logo + Login/Signup), which is more appropriate for a login page
- Give `/login` its own layout (no group)

**Recommendation:** Move `/login` into `(marketing)/` or give it a dedicated minimal layout. The login card UI renders at full viewport height (`min-height: 100vh`) and the nav sitting on top of it is acceptable as long as it is minimal. Marketing nav (logo + Login/Signup) is cleaner than the full portal nav.

### Anti-Patterns to Avoid
- **Route group without layout file:** A route group directory must have a `+layout.svelte` to be useful — without it, the group still inherits the root layout only
- **Breaking existing +page.server.ts:** The landing `+page.server.ts` uses `requestAccess` form action. It must be co-located with the `+page.svelte` in `(marketing)/`
- **Forgetting to move all portal routes:** Any route left at root level (outside a group) will use the root layout only — missing the portal nav
- **`$types` import path breakage:** When routes move into a group subdirectory, `$types` imports still work because SvelteKit regenerates them from the new path. No manual updates needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL-invisible layout switching | Route-detection logic in root layout | SvelteKit route groups `(name)/` | Built-in, zero runtime cost, cleanly composable |
| Auth redirect on portal routes | Per-page auth checks in every `+page.server.ts` | Portal `+layout.server.ts` with redirect | Centralises guard; individual pages already have per-action checks as defence-in-depth |

**Key insight:** Route groups are the idiomatic SvelteKit solution to this exact problem. All other approaches are anti-patterns.

## Common Pitfalls

### Pitfall 1: Orphaned routes after group move
**What goes wrong:** A route directory is moved inside a group but its `+page.server.ts` still references stale import paths or SvelteKit type paths.
**Why it happens:** SvelteKit auto-generates `$types` from file location — moving files requires `svelte-kit sync` to regenerate.
**How to avoid:** After moving all route files, run `pnpm --filter @claw/ui exec svelte-kit sync` to regenerate types.
**Warning signs:** TypeScript errors on `$types` imports after the move.

### Pitfall 2: root `+layout.server.ts` still serving session to landing page
**What goes wrong:** If `+layout.server.ts` stays at root, every landing page visit hits the database/Auth.js session lookup unnecessarily.
**Why it happens:** Root layout data is inherited by all child routes including marketing group.
**How to avoid:** Move `+layout.server.ts` entirely into `(app)/`. Remove session from root layout completely.

### Pitfall 3: Session not available in `(app)` child routes
**What goes wrong:** Portal routes like `/objectives` that previously received `data.session` from root layout now need it from `(app)/+layout.server.ts`.
**Why it happens:** Layout data flows down from the nearest ancestor layout that provides it.
**How to avoid:** Ensure `(app)/+layout.server.ts` exports `session` in its return value. The `(app)/+layout.svelte` uses `data.session` for the nav. Child pages like `new-execution/+page.server.ts` already call `event.locals.auth()` directly — no change needed there.

### Pitfall 4: Particle canvas duplication
**What goes wrong:** Copying the `Particle` class and canvas setup into both group layouts creates two maintenance points.
**Why it happens:** Both landing and portal use particles for brand continuity.
**How to avoid:** Extract the particle canvas into a `$lib/components/ParticleCanvas.svelte` component. Both group layouts import it.

### Pitfall 5: SSE lifecycle connection on landing page
**What goes wrong:** The current root layout wires up `connectLifecycleSSE()` for all routes including the unauthenticated landing page.
**Why it happens:** SSE code is in root `+layout.svelte`.
**How to avoid:** Move the SSE `$effect` and lifecycle toast markup to `(app)/+layout.svelte` only. The landing page doesn't need real-time bot notifications.

### Pitfall 6: `admin/` and `api/` route placement
**What goes wrong:** `admin/` and `api/` routes left outside any group will use only the bare root layout (correct for `api/` — no UI), but `admin/` may need consideration.
**Why it happens:** Not all routes need a UI layout.
**How to avoid:** `api/` routes have no visual layout — leave at root or put in `(app)/`. `admin/` if it has UI should go in `(app)/`. Check current contents.

## Code Examples

Verified patterns from SvelteKit route groups (HIGH confidence — official SvelteKit docs):

### Route Group Directory Naming
```
// Directory structure → URL mapping:
routes/(marketing)/+page.svelte          → /
routes/(marketing)/login/+page.svelte    → /login
routes/(app)/objectives/+page.svelte     → /objectives
routes/(app)/executions/[id]/+page.svelte → /executions/[id]
// The (marketing) and (app) segments are invisible in URLs
```

### (marketing) Layout — Minimal Nav
```svelte
<!-- routes/(marketing)/+layout.svelte -->
<script lang="ts">
  import '../../app.css';
  import { onMount } from 'svelte';
  // ... Particle class definition (or import ParticleCanvas component)

  let { children } = $props();
</script>

<canvas id="particles"></canvas>

<nav id="nav" bind:this={navEl}>
  <div class="w">
    <div class="nav-row">
      <a href="/" class="logo">
        <!-- Akasa logo SVG -->
      </a>
      <div class="nav-right">
        <a href="/login" class="btn-nav">Login</a>
        <a href="#access" class="btn-nav btn-primary">Sign up</a>
      </div>
    </div>
  </div>
</nav>

<main>
  {@render children()}
</main>
```

### (app) Layout — Full Nav with Session
```svelte
<!-- routes/(app)/+layout.svelte -->
<script lang="ts">
  import '../../app.css';
  import { signOut } from '@auth/sveltekit/client';
  import { connectLifecycleSSE } from '$lib/sse';
  // ... full nav + SSE toast logic

  let { children, data } = $props();
  let session = $derived(data.session);
</script>
<!-- full nav, SSE toasts, particles -->
```

### (app) Layout Server — Session Guard
```typescript
// routes/(app)/+layout.server.ts
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
  return {
    session: await event.locals.auth(),
  };
};
```

### Root Layout — Bare Shell
```svelte
<!-- routes/+layout.svelte -->
<script lang="ts">
  let { children } = $props();
</script>

{@render children()}
```
Note: `app.css` import moves to each group layout. Root `+layout.js` stays as-is (SSR export).

### Extracting Particle Canvas as Component
```svelte
<!-- src/lib/components/ParticleCanvas.svelte -->
<script lang="ts" module>
  // Particle class definition here (moved from root layout)
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  // canvas setup, resize, animation loop
</script>

<canvas id="particles"></canvas>

<style>
  :global(canvas#particles) {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 1;
  }
</style>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Conditional `{#if route === '/'}` in single layout | SvelteKit route groups `(name)/` | SvelteKit 1.x+ | Clean separation, no route-matching JS |
| Named slots for layout injection | `{@render children()}` in Svelte 5 | Svelte 5 | Project already uses this pattern |

**Deprecated/outdated:**
- `<slot>` in SvelteKit layouts: replaced by `{@render children()}` in Svelte 5 — project already uses Svelte 5 pattern throughout

## Open Questions

1. **Does the `login` route get the marketing or app layout?**
   - What we know: Login page shows a centered card, full-viewport-height. It currently inherits the full root layout (all nav links visible but user is not authenticated).
   - What's unclear: The requirement says "portal gets the full nav bar" — login is a transition state, not portal nor pure marketing.
   - Recommendation: Put `login/` inside `(marketing)/` for a minimal, clean sign-in experience. The marketing nav (logo only visible, Login/Signup) is appropriate context for the login page.

2. **Should `admin/` routes go in `(app)/`?**
   - What we know: `admin/` exists as a route, primarily API-style (waitlist endpoint handled server-side). If it has no UI, route placement doesn't matter for nav.
   - Recommendation: Move `admin/` into `(app)/` for consistency. If admin routes have no UI pages, no visible difference.

3. **Should `api/` routes go in a group?**
   - What we know: `api/` routes under SvelteKit are server-only route handlers with no layouts.
   - Recommendation: `api/` can stay at root level — group layouts don't affect server-only routes in any user-visible way.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — project uses manual verification and smoke tests |
| Config file | None |
| Quick run command | `pnpm --filter @claw/ui check` (TypeScript/Svelte check) |
| Full suite command | `pnpm --filter @claw/ui check` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PORTAL-01 | Landing page at `/` shows only logo + Login/Signup nav | manual-only | Visual inspection at `http://localhost:5173/` | N/A |
| PORTAL-01 | Portal pages (e.g. `/objectives`) show full nav | manual-only | Visual inspection at `http://localhost:5173/objectives` | N/A |
| PORTAL-01 | No TypeScript errors after route move | smoke | `pnpm --filter @claw/ui check` | ✅ (svelte-check exists) |
| PORTAL-01 | Routes still accessible at same URLs | smoke | Manual navigation check | N/A |

**Manual-only justification:** Layout rendering and visual separation cannot be tested without a running browser. The project has no e2e test framework (no Playwright/Cypress detected).

### Sampling Rate
- **Per task commit:** `pnpm --filter @claw/ui check`
- **Per wave merge:** `pnpm --filter @claw/ui check`
- **Phase gate:** Full check green + manual visual verification before `/gsd:verify-work`

### Wave 0 Gaps
None — existing `svelte-check` infrastructure covers TypeScript validation. No new test files needed.

## Sources

### Primary (HIGH confidence)
- SvelteKit official docs — Route groups: https://kit.svelte.dev/docs/advanced-routing#advanced-layouts-group
- Direct code inspection: `/services/ui/src/routes/+layout.svelte` (current layout)
- Direct code inspection: `/services/ui/src/routes/+layout.server.ts` (session load)
- Direct code inspection: `/services/ui/src/routes/+page.svelte` (landing page)
- Direct code inspection: `/services/ui/src/routes/new-execution/+page.server.ts` (auth guard pattern)
- `@sveltejs/kit` version `^2.52.0` — route groups available since SvelteKit 1.x

### Secondary (MEDIUM confidence)
- SvelteKit changelog — Route groups stable in SvelteKit 1.0 (2023), no breaking changes in 2.x

### Tertiary (LOW confidence)
- None required — route groups are well-documented and the codebase is fully inspected

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — SvelteKit route groups are the official mechanism, no external library needed
- Architecture: HIGH — full codebase inspected, current layout structure is clear, SvelteKit docs verified
- Pitfalls: HIGH — pitfalls derived from direct code reading (session in root layout, SSE in root layout, particles duplication) combined with SvelteKit routing rules

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (SvelteKit 2.x is stable; route groups API is not changing)
