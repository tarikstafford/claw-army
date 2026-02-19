# PRD: Google Auth Gate for Mission Launch

## Introduction

Add Google OAuth authentication to the UI so that unauthenticated users cannot reach the `/new-execution` page (Mission Briefing). Unauthenticated users who attempt to navigate to `/new-execution` are redirected to a `/login` page. After signing in with Google, they are returned to `/new-execution`. The backend `POST /executions` endpoint is also protected so that only requests carrying a valid session token are accepted.

All other routes (home, `/executions/[id]`, `/billing`, etc.) remain publicly accessible.

## Goals

- Block access to `/new-execution` for unauthenticated users
- Provide a clean `/login` page with a single "Sign in with Google" button
- After successful Google sign-in, redirect the user back to `/new-execution`
- Show the authenticated user's avatar + name in the nav bar with a sign-out option
- Protect the `POST /executions` backend endpoint so unauthenticated API calls are rejected with `401`
- Leverage the existing Google Cloud project for OAuth credentials (no new GCP project needed)

## User Stories

### US-001: Install and configure Auth.js with Google provider
**Description:** As a developer, I need Auth.js (`@auth/sveltekit`) wired up with the Google provider so that session management works end-to-end.

**Acceptance Criteria:**
- [ ] `@auth/sveltekit` and `@auth/core` installed in `services/ui`
- [ ] `src/auth.ts` created with `SvelteKitAuth` using the Google provider
- [ ] `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` added to `.env.example` with placeholder values
- [ ] `src/hooks.server.ts` exports the Auth.js handle
- [ ] `GET /auth/[...auth]` and `POST /auth/[...auth]` catch-all routes created at `src/routes/auth/[...auth]/+server.ts`
- [ ] Typecheck passes

### US-002: Create `/login` page
**Description:** As an unauthenticated user, I want a dedicated login page so I know what action I need to take to proceed.

**Acceptance Criteria:**
- [ ] Route `src/routes/login/+page.svelte` created
- [ ] Page displays the Claw Army logo/brand mark and a brief heading (e.g., "Sign in to deploy your crew")
- [ ] Single "Sign in with Google" button that calls `signIn('google', { redirectTo: '/new-execution' })`
- [ ] Page is accessible without authentication (no redirect loop)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Protect `/new-execution` route with server-side redirect
**Description:** As an unauthenticated user, when I try to visit `/new-execution` I should be redirected to `/login` automatically.

**Acceptance Criteria:**
- [ ] `src/routes/new-execution/+page.server.ts` created with a `load` function
- [ ] `load` checks `locals.auth()` (Auth.js session); if no session, calls `redirect(303, '/login')`
- [ ] Authenticated users land on the page normally with no redirect
- [ ] The "Deploy Crew" nav CTA still links to `/new-execution` (redirect handled server-side)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill (test both logged-in and logged-out states)

### US-004: Show authenticated user in nav + sign-out
**Description:** As an authenticated user, I want to see who I'm signed in as and be able to sign out so I have control over my session.

**Acceptance Criteria:**
- [ ] `+layout.server.ts` created at `src/routes/` that exposes the session via `locals.auth()`
- [ ] Nav bar in `+layout.svelte` conditionally shows:
  - Unauthenticated: no user UI (existing nav unchanged)
  - Authenticated: user's Google profile picture (circular avatar, 28px) + display name + "Sign out" link
- [ ] "Sign out" calls `signOut()` and returns user to `/`
- [ ] Avatar falls back to user initials if image is unavailable
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Protect `POST /executions` on the backend
**Description:** As a system, I need the execution-service to reject unauthenticated launch requests so that the auth gate cannot be bypassed by calling the API directly.

**Acceptance Criteria:**
- [ ] `POST /executions` in `services/execution-service` requires a valid `Authorization: Bearer <token>` header
- [ ] Token is the Auth.js session token forwarded from the SvelteKit server-side `handleSubmit` (server action or `+page.server.ts` action)
- [ ] Missing or invalid token returns `401 Unauthorized`
- [ ] Valid token allows the request to proceed as before
- [ ] `AUTH_SECRET` shared between UI and execution-service for token verification (or a simpler shared secret header — see Open Questions)
- [ ] Typecheck passes

### US-006: Forward auth token from UI to backend on execution create
**Description:** As a developer, I need the SvelteKit form submission to send the session token to the execution-service so that the backend can verify the user.

**Acceptance Criteria:**
- [ ] `/new-execution` form submission converted to a SvelteKit form action in `+page.server.ts` (or uses `fetch` with `Authorization` header set server-side)
- [ ] Session token extracted from `locals.auth()` and forwarded to `POST /executions`
- [ ] On success, server redirects to `/executions/{executionId}`
- [ ] On error, form action returns the error message displayed in the existing `.error-banner`
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- **FR-1:** Any unauthenticated `GET /new-execution` request must be redirected to `/login` with a `303` status before the page renders.
- **FR-2:** `/login` must render a "Sign in with Google" button using Auth.js `signIn('google')`.
- **FR-3:** After successful Google OAuth, Auth.js must redirect the user to `/new-execution`.
- **FR-4:** The nav bar must show the authenticated user's name and avatar when a session exists.
- **FR-5:** A "Sign out" action must clear the session and redirect to `/`.
- **FR-6:** `POST /executions` on the execution-service must return `401` when no valid auth token is present.
- **FR-7:** The UI must forward a session-derived token in the `Authorization` header when calling `POST /executions`.
- **FR-8:** All other existing routes (`/`, `/executions/[id]`, `/billing`, `/admin`, etc.) must remain accessible without authentication.

## Non-Goals

- No role-based access control (RBAC) — any authenticated Google account can launch
- No domain restriction — any Google account is accepted (not limited to a specific GSuite org)
- No user database / user table — session data lives in the Auth.js encrypted cookie only
- No email whitelist / invite system
- No authentication on routes other than `/new-execution`
- No mobile OAuth app flow — web browser only

## Design Considerations

- The `/login` page should match the existing dark theme (`var(--surface-1)`, `var(--signal)`, etc.)
- The "Sign in with Google" button should use Google's official branding guidelines (white button, Google logo, "Sign in with Google" text)
- The user avatar in the nav should be small and unobtrusive — 28px circle, positioned between "Billing" and "Deploy Crew"
- No full-page redesign needed — minimal additions to the existing layout

## Technical Considerations

- **Auth library:** `@auth/sveltekit` (Auth.js v5) with the built-in Google provider
- **Session storage:** Encrypted JWT cookie (stateless, no DB required) — Auth.js default
- **Google credentials:** Use the existing Google Cloud project. Create an OAuth 2.0 Client ID with:
  - Authorized redirect URI: `http://localhost:5173/auth/callback/google` (dev) + production URL
- **Backend token validation (US-005):** Two options — pick one during implementation:
  - Option A (simpler): Add a shared `X-Internal-Token` secret header checked by the execution-service; only the SvelteKit server can set this since client-side JS never touches it
  - Option B (proper): Decode the Auth.js session JWT in execution-service using the shared `AUTH_SECRET`
- **Form action vs. client fetch:** Converting `handleSubmit` to a SvelteKit server action is preferred because it keeps the auth token server-side and avoids exposing it to client JavaScript
- **SvelteKit version:** The project uses SvelteKit 2.x and Svelte 5 — Auth.js v5 is compatible

## Success Metrics

- Navigating to `/new-execution` while logged out redirects to `/login` every time
- After Google sign-in, user lands on `/new-execution` without an extra click
- Direct `POST` to `http://localhost:3001/executions` without auth returns `401`
- Authenticated users can launch a mission end-to-end with no change in UX beyond the initial sign-in

## Open Questions

- **Backend token strategy (US-005):** Option A (shared secret header) is simpler but less cryptographically sound. Option B (JWT decode) is more correct. Which does the team prefer?
- **Production redirect URI:** What is the production domain? Needs to be registered in the Google Cloud Console before deploying.
- **Session duration:** Auth.js default is 30 days. Is that acceptable, or should it be shorter?
