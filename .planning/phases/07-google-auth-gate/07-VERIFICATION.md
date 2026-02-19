---
phase: 07-google-auth-gate
verified: 2026-02-19T08:53:03Z
status: human_needed
score: 14/14 automated must-haves verified
re_verification: false
human_verification:
  - test: "Visit /new-execution in private/incognito browser while logged out"
    expected: "Immediately redirected to /login"
    why_human: "Server-side redirect requires a live SvelteKit server with Auth.js handle hook active"
  - test: "Observe the /login page appearance"
    expected: "Dark theme card with Claw Army logo, 'Sign in to deploy' heading, 'Sign in with Google' button with colored G icon"
    why_human: "Visual rendering requires a browser"
  - test: "Click 'Sign in with Google' on the /login page"
    expected: "Google OAuth popup/redirect opens. After authorizing, user is redirected to /new-execution"
    why_human: "OAuth flow requires real Google credentials and a browser"
  - test: "Observe the nav bar after Google OAuth login"
    expected: "28px circular avatar, user display name, and 'Sign out' text button. 'Deploy Crew' CTA is NOT shown"
    why_human: "Requires authenticated browser session and visual inspection"
  - test: "Submit the /new-execution form with a test objective while authenticated"
    expected: "Redirected to /executions/{id} with no 401 error. Execution created."
    why_human: "Requires live execution-service with AUTH_SECRET set and matching the UI's AUTH_SECRET"
  - test: "Run: curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3001/executions -H 'Content-Type: application/json' -d '{\"objective\":\"test\",\"maxBots\":1,\"allowedTools\":[]}'"
    expected: "Output: 401"
    why_human: "Requires live execution-service running locally with AUTH_SECRET configured"
  - test: "Click 'Sign out' in the nav"
    expected: "Redirected to /. Nav shows 'Deploy Crew' CTA. Visiting /new-execution redirects to /login again."
    why_human: "Requires live auth session and browser interaction"
---

# Phase 7: Google Auth Gate Verification Report

**Phase Goal:** Add Google OAuth authentication to the UI so unauthenticated users cannot access /new-execution. Includes /login page, nav user display, server-side route protection, and backend 401 enforcement on POST /executions.
**Verified:** 2026-02-19T08:53:03Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SvelteKit UI runs with a server runtime (adapter-vercel, no ssr=false) | VERIFIED | `svelte.config.js` imports from `@sveltejs/adapter-vercel`; `+layout.js` has no `export const ssr = false`; `@sveltejs/adapter-static` absent from `package.json` |
| 2 | The /api/:path* proxy rewrite is preserved in vercel.json | VERIFIED | `vercel.json` contains exactly `{ "source": "/api/:path*", "destination": "http://34.136.15.56:3001/:path*" }` |
| 3 | The SPA fallback rewrite is removed from vercel.json | VERIFIED | `vercel.json` has no `200.html` reference; only one rewrite entry |
| 4 | Auth.js handle hook is registered via hooks.server.ts | VERIFIED | `hooks.server.ts`: `export { handle } from './auth'`; `auth.ts` exports `handle` from `SvelteKitAuth({ providers: [Google] })` |
| 5 | locals.auth() is available in all server load functions | VERIFIED | `app.d.ts` declares `App.Locals.auth(): Promise<Session \| null>`; `+layout.server.ts` and `+page.server.ts` both call `event.locals.auth()` successfully |
| 6 | The /auth/callback/google route is handled by Auth.js | VERIFIED | In `@auth/sveltekit` v1.x, the `handle` hook in `hooks.server.ts` intercepts all `/auth/*` paths at the hook layer — no `+server.ts` catch-all needed. The `[...auth]` directory exists but is intentionally empty (v1.x design). |
| 7 | POST /executions returns 401 when Authorization header is missing or invalid | VERIFIED | `executions.ts` has `preHandler` calling `verifyAuthToken(request.headers.authorization)`; returns `reply.code(401).send({ error: 'Unauthorized' })` when token invalid; 401 declared in TypeBox response schema |
| 8 | AUTH_SECRET env var is read from environment (not hardcoded) | VERIFIED | `verify-auth-token.ts` line 31: `const secret = process.env.AUTH_SECRET;` with `throw new Error('AUTH_SECRET not configured')` if not set |
| 9 | HKDF+JWE verification tries both cookie salts | VERIFIED | `verify-auth-token.ts` iterates `['authjs.session-token', '__Secure-authjs.session-token']` with HKDF+compactDecrypt for each |
| 10 | /login page exists with Google sign-in button | VERIFIED | `login/+page.svelte` exists with full dark-themed card, SVG brand, `signIn('google', { redirectTo: '/new-execution' })` in `onclick` handler |
| 11 | Nav shows user avatar, name, and Sign out when authenticated | VERIFIED | `+layout.svelte` has `{#if session?.user}` block rendering 28px `user-avatar` img, `user-name` span, and `sign-out-btn` button with `signOut({ redirectTo: '/' })` |
| 12 | Server-side auth guard on /new-execution redirects unauthenticated users | VERIFIED | `+page.server.ts` load function: `if (!session?.user) { redirect(303, '/login'); }` — also double-checked in `actions.default` |
| 13 | Form submission uses server action with Bearer token forwarding | VERIFIED | `+page.svelte` uses `use:enhance` with `method="POST"`; `+page.server.ts` extracts cookie via `event.cookies.get()`, builds `Authorization: Bearer ${sessionToken}` header, fetches `${EXECUTION_SERVICE_URL}/executions` |
| 14 | allowedTools serialized correctly as multiple hidden inputs | VERIFIED | `+page.svelte`: `{#each allowedTools as tool}<input type="hidden" name="allowedTools" value={tool} />{/each}`; server reads via `formData.getAll('allowedTools')` |

**Score:** 14/14 automated truths verified

### Required Artifacts

| Artifact | Purpose | Exists | Substantive | Wired | Status |
|----------|---------|--------|-------------|-------|--------|
| `services/ui/svelte.config.js` | adapter-vercel configuration | Yes | Yes — imports and calls `adapter()` from `@sveltejs/adapter-vercel` | Yes — imported by SvelteKit build | VERIFIED |
| `services/ui/vercel.json` | Vercel routing without SPA fallback | Yes | Yes — one rewrite, no 200.html | Yes — Vercel deploys read this | VERIFIED |
| `services/ui/src/routes/+layout.js` | SSR enabled (no ssr=false) | Yes | Yes — comment + `export {}` | Yes — SvelteKit reads this | VERIFIED |
| `services/execution-service/src/lib/verify-auth-token.ts` | HKDF+JWE token verification | Yes | Yes — 73 lines, full implementation with dual-salt HKDF | Yes — imported in executions.ts | VERIFIED |
| `services/execution-service/src/routes/executions.ts` | Protected POST /executions | Yes | Yes — preHandler calls verifyAuthToken, 401 in TypeBox schema | Yes — registered Fastify route | VERIFIED |
| `services/ui/src/auth.ts` | SvelteKitAuth config with Google | Yes | Yes — exports handle, signIn, signOut | Yes — imported by hooks.server.ts and login page | VERIFIED |
| `services/ui/src/hooks.server.ts` | Auth.js handle hook | Yes | Yes — `export { handle } from './auth'` | Yes — SvelteKit hooks auto-loaded | VERIFIED |
| `services/ui/src/app.d.ts` | TypeScript locals.auth() type | Yes | Yes — `App.Locals.auth(): Promise<Session \| null>` | Yes — used in all server load functions | VERIFIED |
| `services/ui/src/routes/login/+page.svelte` | Google sign-in page | Yes | Yes — full dark-themed card with brand, heading, Google button | Yes — routable at /login | VERIFIED |
| `services/ui/src/routes/+layout.server.ts` | Session exposure to all pages | Yes | Yes — `LayoutServerLoad` returning `{ session: await event.locals.auth() }` | Yes — wired to +layout.svelte via data prop | VERIFIED |
| `services/ui/src/routes/+layout.svelte` | Nav with user display | Yes | Yes — conditional `{#if session?.user}` block with avatar, name, sign-out | Yes — root layout, rendered on every page | VERIFIED |
| `services/ui/src/routes/new-execution/+page.server.ts` | Auth guard + form action | Yes | Yes — load() redirects unauthenticated; actions.default() extracts cookie, POSTs with Bearer token | Yes — paired with +page.svelte via use:enhance | VERIFIED |
| `services/ui/src/routes/new-execution/+page.svelte` | Form with use:enhance | Yes | Yes — method=POST, use:enhance, all inputs named, hidden allowedTools, error via `$derived(form?.error)` | Yes — paired with +page.server.ts | VERIFIED |
| `services/ui/.env.example` | Auth env var documentation | Yes | Yes — AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_TRUST_HOST, EXECUTION_SERVICE_URL | Yes — reference for developers | VERIFIED |
| `services/execution-service/.env.example` | AUTH_SECRET documentation | Yes | Yes — AUTH_SECRET with shared-secret explanation | Yes — reference for developers | VERIFIED |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `hooks.server.ts` | `auth.ts` | `export { handle } from './auth'` | WIRED | Direct re-export confirmed in file |
| `executions.ts` | `verify-auth-token.ts` | `import { verifyAuthToken }` + preHandler | WIRED | Import on line 3; used on line 46 in preHandler |
| `verify-auth-token.ts` | `AUTH_SECRET` env var | `process.env.AUTH_SECRET` | WIRED | Line 31; throws if not set |
| `+layout.server.ts` | `locals.auth()` | `event.locals.auth()` | WIRED | Line 5; returns `{ session: ... }` |
| `+layout.svelte` | `data.session` | `let { children, data } = $props(); let session = $derived(data.session)` | WIRED | Session drives conditional `{#if session?.user}` block |
| `login/+page.svelte` | `@auth/sveltekit/client` | `signIn('google', { redirectTo: '/new-execution' })` | WIRED | Import on line 2; onclick on line 25 |
| `+page.server.ts` (load) | `locals.auth()` | `event.locals.auth()` + `redirect(303, '/login')` | WIRED | Two auth checks — in load and in actions.default |
| `+page.server.ts` (action) | `EXECUTION_SERVICE_URL` | `process.env.EXECUTION_SERVICE_URL` | WIRED | Line 38; fail(500) if not set |
| `+page.server.ts` (action) | `POST /executions` | `Authorization: Bearer ${sessionToken}` via `event.cookies.get()` | WIRED | Cookie dual-lookup on lines 34-36; header on line 49 |
| `+page.svelte` | `+page.server.ts` | `use:enhance` + `method="POST"` | WIRED | Form element has both; enhance callback manages submitting state |

### Anti-Patterns Found

No anti-patterns detected. Specific checks performed:

| File | Check | Result |
|------|-------|--------|
| All key files | TODO/FIXME/PLACEHOLDER comments | None found |
| `+page.server.ts` load() | `return {}` — checked in context | Not a stub — correct pattern for guard-only load after auth check passes |
| `verify-auth-token.ts` | Empty implementations | None — full 73-line HKDF+JWE implementation |
| `+layout.server.ts` | Stub return | None — substantive `event.locals.auth()` call |
| `login/+page.svelte` | Placeholder UI | None — complete dark-themed page with real Google OAuth call |

### Important Deviation: [...auth] Route (v1.x design)

The plan (07-03) specified creating `src/routes/auth/[...auth]/+server.ts` — a v0.x `@auth/sveltekit` pattern. In v1.x, `SvelteKitAuth` does not export `GET` or `POST`. The `[...auth]` directory exists but is empty.

The v1.x fix is correct and verified: the `handle` hook in `hooks.server.ts` intercepts all `/auth/*` paths at the hook layer, including `/auth/callback/google`. This satisfies the must-have truth "The /auth/callback/google route is handled by Auth.js (not a 404)" via a different mechanism than the plan's +server.ts approach.

### Human Verification Required

All 7 end-to-end auth gate flows require a live browser and configured Google OAuth credentials. These cannot be verified programmatically:

**1. Unauthenticated Redirect**
**Test:** Open `http://localhost:5173/new-execution` in a private/incognito browser window.
**Expected:** Immediately redirected to `http://localhost:5173/login`
**Why human:** Server-side redirect requires live SvelteKit server with Auth.js hook active.

**2. Login Page Appearance**
**Test:** Observe the /login page.
**Expected:** Dark theme consistent with rest of UI. Claw Army hexagon logo, heading "Sign in to deploy", subtext, "Sign in with Google" button with colored Google G icon.
**Why human:** Visual rendering requires a browser.

**3. Google OAuth Flow**
**Test:** Click "Sign in with Google".
**Expected:** Google OAuth popup/redirect opens. After selecting Google account and authorizing, user is redirected to `/new-execution`.
**Why human:** Requires real Google OAuth credentials and browser session.

**4. Authenticated Nav**
**Test:** Observe the nav bar after OAuth login.
**Expected:** Shows Google profile picture (28px circle), display name, "Sign out" text button. "Deploy Crew" CTA is NOT shown.
**Why human:** Requires authenticated browser session and visual inspection.

**5. Form Submission**
**Test:** Fill in /new-execution form with test objective, click "Launch Mission".
**Expected:** Redirected to `/executions/{id}`. No 401 error. Execution created successfully.
**Why human:** Requires live execution-service with matching AUTH_SECRET configured.

**6. Backend 401 Enforcement**
**Test:** Run `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/executions -H "Content-Type: application/json" -d '{"objective":"test","maxBots":1,"allowedTools":[]}'`
**Expected:** Output is `401`
**Why human:** Requires live execution-service running locally with AUTH_SECRET set.

**7. Sign Out**
**Test:** Click "Sign out" in the nav.
**Expected:** Redirected to `/`. Nav shows "Deploy Crew" CTA again. Visiting `/new-execution` redirects to `/login`.
**Why human:** Requires live auth session and browser interaction.

**Prerequisites before testing:**
- `services/ui/.env` must contain: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_TRUST_HOST=true`, `EXECUTION_SERVICE_URL=http://localhost:3001`
- `services/execution-service/.env` must contain the same `AUTH_SECRET` value
- Both services started: `pnpm dev` in each service directory
- Google Cloud Console: OAuth 2.0 Client ID created with `http://localhost:5173/auth/callback/google` as authorized redirect URI

### Gaps Summary

No code-level gaps found. All 14 automated must-haves are fully verified. The only outstanding work is human testing of the live OAuth flow — all code paths that would make that flow work are correctly implemented and wired.

---

_Verified: 2026-02-19T08:53:03Z_
_Verifier: Claude (gsd-verifier)_
