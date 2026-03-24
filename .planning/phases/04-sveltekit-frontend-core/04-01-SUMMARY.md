---
phase: 04-sveltekit-frontend-core
plan: 01
subsystem: auth, ui, api
tags: [better-auth, google-oauth, sveltekit, websocket, paperclip, cookie-forwarding]

# Dependency graph
requires: []
provides:
  - BetterAuth session resolution via cookie forwarding from Paperclip Express
  - Route guards for /indra, /office, /chat, /sanctum — redirect to /auth when unauthenticated
  - services/ui/src/lib/auth-client.ts — BetterAuth client for OAuth redirect
  - services/ui/src/lib/api.ts — Paperclip domain API functions (agents, issues, chat, dashboard, costs, goals, projects)
  - services/ui/src/lib/ws.ts — WebSocket store with connectWebSocket/subscribeWS/getConnectionStatus
  - services/ui/src/routes/auth/+page.svelte — Screenplay-styled Google sign-in page
  - Cookie-forwarding API proxy to Paperclip Express (replaces EXECUTION_SERVICE_URL + Bearer token)
  - Vite dev server WebSocket upgrade proxy
affects:
  - 04-02 (OFFICE page — uses api.ts getAgents, ws.ts)
  - 04-03 (INDRA page — uses api.ts getDashboard, getSidebarBadges)
  - 04-04 (CHAT page — uses api.ts getChatThreads, sendChatMessage, ws.ts)

# Tech tracking
tech-stack:
  added:
    - better-auth@1.4.18 (replaces @auth/sveltekit)
  patterns:
    - Cookie-forwarding session pattern: hooks.server.ts fetches /api/auth/get-session with cookie header from request
    - Cookie-forwarding API proxy: proxy forwards cookie header not Bearer Authorization header
    - BetterAuth client: createAuthClient({ baseURL: '/api' }) routes through SvelteKit proxy
    - WebSocket store: module-level singleton with reconnect timer and listener array
    - Vite ws:true proxy: WS upgrades forwarded to Paperclip Express

key-files:
  created:
    - services/ui/src/lib/auth-client.ts
    - services/ui/src/lib/ws.ts
    - services/ui/src/routes/auth/+page.svelte
    - services/ui/src/routes/auth/+page.server.ts
  modified:
    - services/ui/src/hooks.server.ts
    - services/ui/src/app.d.ts
    - services/ui/src/routes/(app)/+layout.server.ts
    - services/ui/src/routes/(app)/+layout.svelte
    - services/ui/src/routes/api/[...path]/+server.ts
    - services/ui/src/lib/api.ts
    - services/ui/src/lib/types.ts
    - services/ui/vite.config.ts
    - paperclip/server/src/auth/better-auth.ts
    - services/ui/src/routes/(marketing)/login/+page.svelte
  deleted:
    - services/ui/src/auth.ts
    - services/ui/src/lib/sse.ts

key-decisions:
  - "Cookie forwarding replaces Bearer token extraction — API proxy copies cookie header from request to Paperclip Express; BetterAuth manages session cookies natively"
  - "hooks.server.ts resolves session by fetching /api/auth/get-session from PAPERCLIP_URL — not internal BetterAuth API, preserves separation"
  - "locals.session is null (not auth() function) — App.Locals rewritten to match BetterAuth session shape"
  - "companyId fetched in (app)/+layout.server.ts from /api/companies — single-tenant: take first company"
  - "WebSocket store uses module-level singleton — one connection per page load, reconnects on close with 3s timer"
  - "Marketing login page (v5 legacy) updated to use authClient.signIn.social — prevents @auth/sveltekit reference from breaking build"
  - "Old v5 page routes (objectives, new-execution) still reference EXECUTION_SERVICE_URL — out of scope for this plan, addressed in future Phase 4 sub-plans"

patterns-established:
  - "Auth pattern: hooks.server.ts -> PAPERCLIP_URL/api/auth/get-session -> event.locals.session"
  - "API proxy pattern: cookie forwarding (not Bearer) to PAPERCLIP_URL"
  - "API client pattern: apiFetch() helper with BASE='/api', grouped by domain with companyId"
  - "WebSocket pattern: connectWebSocket(companyId) in onMount, subscribeWS() for event handling"

requirements-completed: [UI-01, UI-02, UI-07]

# Metrics
duration: 5min
completed: 2026-03-24
---

# Phase 04 Plan 01: SvelteKit Frontend Core — Auth, API, WebSocket Summary

**BetterAuth replaces Auth.js with cookie-forwarding session resolution, Paperclip API client with typed domain functions, WebSocket store replacing SSE, and Screenplay-styled Google sign-in page**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-24T06:52:02Z
- **Completed:** 2026-03-24T06:56:52Z
- **Tasks:** 3
- **Files modified:** 12 (+ 2 deleted, 4 created)

## Accomplishments
- Auth.js fully removed; BetterAuth wired with cookie-forwarding session resolution from Paperclip Express
- API proxy retargeted to PAPERCLIP_URL with cookie forwarding (not Bearer token)
- api.ts rewritten with typed Paperclip domain functions (companies, agents, issues, goals, projects, chat, dashboard, costs)
- WebSocket store created (connectWebSocket/subscribeWS/getConnectionStatus) with auto-reconnect
- SSE module deleted; app layout wired to WebSocket with toast notifications and disconnect banner
- Screenplay-styled /auth page with Google sign-in button

## Task Commits

Each task was committed atomically:

1. **Task 1: Auth migration — BetterAuth replaces Auth.js** - `07d3653` (feat)
2. **Task 2: API proxy retarget + api.ts rewrite + WebSocket store** - `d94e958` (feat)
3. **Task 3: App layout rewrite — WebSocket + toast + session wiring** - `01068f1` (feat)
4. **Chore: remove deleted auth.ts from git tracking** - `4817615` (chore)
5. **Chore: update pnpm-lock.yaml** - `6fbe3d7` (chore)

## Files Created/Modified
- `services/ui/src/hooks.server.ts` — BetterAuth session resolution via PAPERCLIP_URL cookie forwarding
- `services/ui/src/app.d.ts` — App.Locals rewritten: session object (not auth() function)
- `services/ui/src/lib/auth-client.ts` — BetterAuth client with baseURL: '/api'
- `services/ui/src/routes/auth/+page.svelte` — Screenplay Google sign-in page
- `services/ui/src/routes/auth/+page.server.ts` — Redirect to /indra if already authenticated
- `services/ui/src/routes/(app)/+layout.server.ts` — Reads locals.session, fetches companyId
- `services/ui/src/routes/(app)/+layout.svelte` — WebSocket + toast + disconnect banner; no SSE
- `services/ui/src/routes/api/[...path]/+server.ts` — Proxy uses PAPERCLIP_URL + cookie forwarding
- `services/ui/src/lib/api.ts` — Complete rewrite with all Paperclip domain functions
- `services/ui/src/lib/types.ts` — Old v5 types removed; only utility types remain
- `services/ui/src/lib/ws.ts` — WebSocket store (new)
- `services/ui/vite.config.ts` — Added ws: true to /api proxy
- `paperclip/server/src/auth/better-auth.ts` — Added socialProviders.google
- `services/ui/src/routes/(marketing)/login/+page.svelte` — Updated to use authClient (deviation fix)
- `services/ui/src/auth.ts` — DELETED (Auth.js entry point)
- `services/ui/src/lib/sse.ts` — DELETED (replaced by WebSocket)

## Decisions Made
- Cookie forwarding replaces Bearer token extraction — BetterAuth manages session cookies natively; proxy copies cookie header verbatim
- hooks.server.ts fetches `/api/auth/get-session` from PAPERCLIP_URL — not internal BetterAuth API, preserves clean separation
- `locals.session` is null by default (not an `auth()` function) — matches BetterAuth session shape
- `companyId` fetched in layout.server.ts from `/api/companies` — single-tenant: take first company
- WebSocket store uses module-level singleton — one connection per page load, 3s reconnect

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated marketing login page to use BetterAuth**
- **Found during:** Task 3 (App layout rewrite — reviewing @auth/sveltekit references)
- **Issue:** `services/ui/src/routes/(marketing)/login/+page.svelte` imported `signIn` from `@auth/sveltekit/client` which was removed from package.json. This would cause a build failure.
- **Fix:** Replaced `signIn('google', ...)` call with `authClient.signIn.social({ provider: 'google', callbackURL: '/indra' })` using the new BetterAuth client
- **Files modified:** `services/ui/src/routes/(marketing)/login/+page.svelte`
- **Committed in:** `01068f1` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required fix — build would fail without it. No scope creep.

## Issues Encountered
- `paperclip/` is a git submodule — cannot stage files from it using main repo `git add`. The `socialProviders` addition to `better-auth.ts` was made directly but committed via the submodule's own git context (change is tracked in the submodule, not the main repo staged files).

## Deferred Items
- Old v5 page routes (objectives, new-execution, marketing index) still reference `EXECUTION_SERVICE_URL` — these are pre-existing page route files outside this plan's scope. They will be replaced/updated in subsequent Phase 4 plans.

## User Setup Required
- `PAPERCLIP_URL` environment variable must be set in production (default: `http://localhost:3100`)
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` must be set for Paperclip's BetterAuth Google OAuth

## Next Phase Readiness
- Auth foundation complete — hooks.server.ts resolves session, protected routes redirect to /auth
- API proxy and typed api.ts client ready for all Phase 4 page plans (OFFICE, INDRA, CHAT, SANCTUM)
- WebSocket store ready for consumption in all app routes
- Auth page renders at /auth with styled Google sign-in button

---
*Phase: 04-sveltekit-frontend-core*
*Completed: 2026-03-24*
