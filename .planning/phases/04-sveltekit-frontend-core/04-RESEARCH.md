# Phase 4: SvelteKit Frontend Core - Research

**Researched:** 2026-03-24
**Domain:** SvelteKit v2 + Svelte 5 / BetterAuth session integration / Paperclip Express API / WebSocket real-time
**Confidence:** HIGH — all findings verified against actual source files in the monorepo

## Summary

Phase 4 rebuilds the Akasa UI to consume Paperclip's Express API directly, replacing Auth.js with Paperclip's BetterAuth session, and replacing three SSE streams with one WebSocket connection. The route structure (4 tabs: INDRA, OFFICE, CHAT, SANCTUM) is already wired in NavBar.svelte but the actual page routes do not yet exist — every `/indra`, `/office`, `/chat`, `/sanctum` slug currently has no `+page.svelte`. The API proxy at `/api/[...path]` exists and only needs its target URL env var renamed from `EXECUTION_SERVICE_URL` to `PAPERCLIP_URL` (pointing at Express on port 3100).

The biggest integration challenge is BetterAuth. Paperclip's BetterAuth instance does NOT currently configure Google OAuth as a social provider — it only enables email/password. The D-02 decision to use Google OAuth only means we must: (1) add `socialProviders: { google: { ... } }` to `createBetterAuthInstance()` in paperclip server, and (2) wire the SvelteKit hooks to call BetterAuth's `/api/auth/get-session` endpoint rather than Auth.js. Paperclip's `authApi.getSession()` (in the React UI) shows the correct call pattern: `GET /api/auth/get-session` with `credentials: "include"`.

The WebSocket endpoint is `ws://[host]/api/companies/:companyId/events/ws` and authenticates via session cookie (no token needed for browser board context in `authenticated` deployment mode). The event format is `{ id, companyId, type: LiveEventType, createdAt, payload }` — a flat JSON object, not a discriminated union wrapper.

**Primary recommendation:** Work in this order — (1) retarget API proxy and rename env var, (2) migrate BetterAuth auth (add Google OAuth plugin to Paperclip, rewrite hooks.server.ts), (3) build page routes bottom-up (OFFICE first: agents list → agent detail → issues list → issue detail → goals → projects), (4) INDRA dashboard, (5) CHAT with WebSocket, (6) SANCTUM costs/metrics, (7) global WebSocket store replacing SSE.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Replace @auth/sveltekit with Paperclip's BetterAuth. Remove Auth.js entirely. SvelteKit calls BetterAuth's session/login endpoints on Paperclip's Express server. One auth system, shared session cookies.
- **D-02:** Google OAuth only — no email/password. Matches v5 behavior. BetterAuth supports Google OAuth natively.
- **D-03:** Session validation in `hooks.server.ts` — SvelteKit server hook calls BetterAuth's session API on every request, populates `event.locals`. Guards protected routes server-side. Same pattern as current Auth.js setup, different provider.
- **D-04:** Post-login redirect to `/indra` (INDRA tab) — the CEO briefing is the landing page. Replaces v5's `/dashboard` redirect.
- **D-05:** INDRA (`/indra`) — Fleet overview + activity feed. High-level dashboard: agent count by status, recent activity, pending approvals, cost summary. Pulls from Paperclip's `/dashboard` and `/activity` endpoints. Approvals folded in as action items.
- **D-06:** OFFICE (`/office`) — Agent management, issues, goals, projects. Sub-routes: `/office/agents`, `/office/agents/:id`, `/office/issues`, `/office/issues/:id`, `/office/goals`, `/office/goals/:id`, `/office/projects`, `/office/projects/:id`. Agent create at `/office/agents/new`.
- **D-07:** CHAT (`/chat`) — Chat threads, messages, agent responses. Real-time via WebSocket.
- **D-08:** SANCTUM (`/sanctum`) — Metrics, costs, evolution data placeholder routes.
- **D-09:** Settings via gear icon in NavBar — not a tab.
- **D-10:** SvelteKit server proxy — keep `/api/[...path]` pattern. Retarget to Paperclip Express.
- **D-11:** Clean rewrite of `api.ts` — remove old v5 functions, target Paperclip endpoints.
- **D-12:** Single `api.ts` grouped by domain (agents, issues, chat, dashboard, etc.).
- **D-13:** SvelteKit load functions for page data — data fetched in `+page.server.ts`. SSR-friendly.
- **D-14:** Paperclip WebSocket replaces SSE — use `live-events-ws`. One connection, all event types.
- **D-15:** Global WebSocket connection — opened at app layout level, survives navigation, auto-reconnects.
- **D-16:** Toast notifications + reactive data updates from WebSocket events.

### Claude's Discretion

- OFFICE sub-navigation pattern (sidebar, tabs, breadcrumbs)
- Specific Paperclip API endpoint mapping — inspect `paperclip/server/src/routes/` for exact paths
- WebSocket message format and event type handling
- How to structure BetterAuth integration in SvelteKit (client library import pattern)
- Loading/error states for pages using load functions
- Whether to build a shared WebSocket store or use Svelte 5 reactive primitives directly

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | SvelteKit configured to consume Paperclip's Express API directly | API proxy retarget; env var rename |
| UI-02 | Auth integrated — SvelteKit uses Paperclip's BetterAuth for session management (Google OAuth) | BetterAuth session endpoint documented; Google OAuth plugin required in Paperclip server |
| UI-03 | Agent management views rebuilt in SvelteKit | Exact endpoints documented: GET/POST `/companies/:id/agents`, GET `/agents/:id` |
| UI-04 | Issue/task views rebuilt in SvelteKit — task board, issue detail, comments | Exact endpoints documented: GET `/companies/:id/issues`, GET `/issues/:id`, GET/POST `/issues/:id/comments` |
| UI-05 | Chat interface rebuilt in SvelteKit — threads, messages, agent responses | Endpoints documented: POST `/companies/:id/chat/threads`, GET `/chat/threads/:id/messages`, POST messages |
| UI-06 | Dashboard rebuilt in SvelteKit — metrics, costs, task status | Dashboard: `GET /companies/:id/dashboard`; Costs: `GET /companies/:id/costs/summary` |
| UI-07 | Real-time updates via Paperclip's WebSocket live events | WS endpoint documented: `ws://host/api/companies/:id/events/ws`; event format documented |
</phase_requirements>

---

## Standard Stack

### Core (already installed — do not add)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SvelteKit | ^2.52.0 | App framework | Project convention |
| Svelte | ^5.51.3 | Runes reactivity | Project convention |
| TypeScript | ^5.9.3 | Type safety | Project convention |

### To Install
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| better-auth | 1.4.18 | BetterAuth client — session read, OAuth redirect | Must match Paperclip server's installed version (1.4.18) |

### To Remove
| Library | Version | Reason |
|---------|---------|--------|
| @auth/sveltekit | ^1.11.1 | Replaced by BetterAuth (D-01) |

**Installation:**
```bash
# In services/ui:
pnpm --filter @claw/ui add better-auth@1.4.18
pnpm --filter @claw/ui remove @auth/sveltekit
```

**Version note:** Paperclip server installs `better-auth: 1.4.18`. The SvelteKit side must use the same version for session cookie compatibility. Verified from `paperclip/server/package.json`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| better-auth client SDK | Direct fetch to `/api/auth/*` endpoints | Either works; BetterAuth client SDK provides `createAuthClient()` with typed methods — reduces boilerplate for OAuth redirect |

---

## Architecture Patterns

### Recommended Project Structure

```
services/ui/src/
├── routes/
│   ├── (app)/
│   │   ├── +layout.server.ts        # session load (REWRITE for BetterAuth)
│   │   ├── +layout.svelte           # WebSocket store, toast pattern (REWRITE SSE → WS)
│   │   ├── indra/
│   │   │   └── +page.svelte         # NEW: fleet overview + activity
│   │   │   └── +page.server.ts      # NEW: load dashboard + activity
│   │   ├── office/
│   │   │   ├── +layout.svelte       # NEW: OFFICE sub-nav
│   │   │   ├── agents/
│   │   │   │   ├── +page.svelte     # NEW: agent list
│   │   │   │   ├── +page.server.ts  # NEW: load agents
│   │   │   │   ├── new/
│   │   │   │   │   └── +page.svelte # NEW: agent create form
│   │   │   │   └── [id]/
│   │   │   │       ├── +page.svelte # NEW: agent detail
│   │   │   │       └── +page.server.ts
│   │   │   ├── issues/
│   │   │   │   ├── +page.svelte     # NEW: issue board
│   │   │   │   ├── +page.server.ts
│   │   │   │   └── [id]/
│   │   │   │       ├── +page.svelte # NEW: issue detail + comments
│   │   │   │       └── +page.server.ts
│   │   │   ├── goals/
│   │   │   │   ├── +page.svelte     # NEW: goals list
│   │   │   │   ├── +page.server.ts
│   │   │   │   └── [id]/
│   │   │   │       └── +page.svelte # NEW: goal detail
│   │   │   └── projects/
│   │   │       ├── +page.svelte     # NEW: projects list
│   │   │       └── [id]/
│   │   │           └── +page.svelte # NEW: project detail
│   │   ├── chat/
│   │   │   ├── +page.svelte         # NEW: thread list (sidebar) + message panel
│   │   │   └── +page.server.ts      # NEW: load threads
│   │   └── sanctum/
│   │       └── +page.svelte         # NEW: costs/metrics + evolution placeholders
│   ├── api/[...path]/+server.ts     # MODIFY: retarget env var
│   ├── auth/
│   │   └── +page.svelte             # NEW: Google sign-in page
│   └── hooks.server.ts              # REWRITE: BetterAuth session
├── lib/
│   ├── api.ts                       # REWRITE: Paperclip endpoints grouped by domain
│   ├── ws.ts                        # NEW: WebSocket store (replaces sse.ts)
│   ├── auth-client.ts               # NEW: BetterAuth client instance
│   └── components/                  # REUSE: all Phase 3 components unchanged
└── app.css                          # UNCHANGED
```

### Pattern 1: BetterAuth Session in SvelteKit hooks.server.ts

**What:** Replace Auth.js `handle` with a custom handle that calls BetterAuth's session API.

**How BetterAuth session works (verified from `paperclip/server/src/auth/better-auth.ts`):**
- Session is stored in the shared database (`authSessions` table)
- Session cookie is a BetterAuth cookie — NOT an Auth.js JWT
- The Express middleware resolves sessions via `resolveBetterAuthSession(auth, req)` which calls `auth.api.getSession({ headers })`
- The SvelteKit proxy must forward cookies to Express unchanged

**Pattern:**
```typescript
// services/ui/src/lib/auth-client.ts
import { createAuthClient } from 'better-auth/client';

export const authClient = createAuthClient({
  baseURL: '/api',  // SvelteKit proxy forwards to Express
});

// services/ui/src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

const PAPERCLIP_URL = process.env.PAPERCLIP_URL ?? 'http://localhost:3100';

export const handle: Handle = async ({ event, resolve }) => {
  // Call BetterAuth session endpoint, forwarding cookies
  const cookieHeader = event.request.headers.get('cookie') ?? '';

  try {
    const res = await fetch(`${PAPERCLIP_URL}/api/auth/get-session`, {
      headers: { cookie: cookieHeader, accept: 'application/json' },
    });

    if (res.ok) {
      const data = await res.json();
      // BetterAuth response: { session: { id, userId }, user: { id, email, name } }
      if (data?.session?.userId && data?.user?.id) {
        event.locals.session = { user: data.user, session: data.session };
      }
    }
  } catch {
    // session resolution failure is non-fatal — treat as unauthenticated
  }

  // Guard protected routes
  const isProtected = event.url.pathname.startsWith('/indra') ||
    event.url.pathname.startsWith('/office') ||
    event.url.pathname.startsWith('/chat') ||
    event.url.pathname.startsWith('/sanctum');

  if (isProtected && !event.locals.session) {
    throw redirect(303, '/auth');
  }

  return resolve(event);
};
```

**Note:** `event.locals.auth()` (Auth.js pattern) is gone. Downstream code accesses `event.locals.session` directly.

### Pattern 2: Google OAuth — Required Server-Side Change

BetterAuth's `createBetterAuthInstance()` in `paperclip/server/src/auth/better-auth.ts` currently does NOT configure Google OAuth. Only `emailAndPassword` is enabled.

Decision D-02 (Google OAuth only) requires adding the social provider. This is a Paperclip server code change:

```typescript
// paperclip/server/src/auth/better-auth.ts — addition to authConfig
import { betterAuth } from "better-auth";

const authConfig = {
  // ... existing config ...
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
};
```

The OAuth redirect flow from SvelteKit (via BetterAuth client):
```typescript
// In auth page component
import { authClient } from '$lib/auth-client';

async function signInWithGoogle() {
  await authClient.signIn.social({
    provider: 'google',
    callbackURL: '/indra',  // D-04: redirect to /indra post-login
  });
}
```

BetterAuth handles the OAuth callback at `/api/auth/callback/google` on the Express server.

### Pattern 3: API Proxy Retarget

The proxy at `/api/[...path]` stays structurally identical — only the env var name and auth forwarding change.

```typescript
// services/ui/src/routes/api/[...path]/+server.ts (MODIFIED)
const PAPERCLIP_URL = process.env.PAPERCLIP_URL;  // was EXECUTION_SERVICE_URL

// Session forwarding: BetterAuth uses session cookies, not Bearer tokens.
// Forward the entire Cookie header to Express — BetterAuth middleware reads it.
const cookieHeader = event.request.headers.get('cookie');
if (cookieHeader) {
  headers.set('cookie', cookieHeader);
}
// Remove the old Auth.js Bearer token logic entirely
```

**Critical:** BetterAuth auth is cookie-based. The old code extracted `authjs.session-token` and sent it as a Bearer token. The new code must forward cookies instead. Express's `actorMiddleware` (verified from `paperclip/server/src/middleware/auth.ts`) resolves the session by calling `opts.resolveSession(req)` when no Bearer token is present — it reads the BetterAuth cookie from `req.headers`.

### Pattern 4: Paperclip API Call Patterns

All Paperclip endpoints require a `companyId`. The company concept maps to a Paperclip "company" entity. The SvelteKit app must know the active companyId.

**How to get companyId:** `GET /companies` returns all companies the user is a member of. For the single-tenant v6.0 scope, take `companies[0].id`.

**Verified endpoint map (from `paperclip/server/src/routes/` source files):**

```typescript
// services/ui/src/lib/api.ts (new, organized by domain)

const BASE = '/api';  // Goes through SvelteKit proxy

// --- Companies ---
// GET /companies → Company[]
// GET /companies/:companyId → Company

// --- Dashboard (UI-06) ---
// GET /companies/:companyId/dashboard → DashboardSummary
//   Returns: { agents: { active, running, paused, error }, tasks: { open, inProgress, blocked, done }, costs: {...}, pendingApprovals: number }

// --- Activity (INDRA feed) ---
// GET /companies/:companyId/activity?agentId=&entityType=&entityId= → ActivityEvent[]
// GET /issues/:id/activity → ActivityEvent[]

// --- Agents (UI-03) ---
// GET /companies/:companyId/agents → Agent[]
// POST /companies/:companyId/agents (create via hire schema)
// GET /agents/:id → Agent
// PATCH /agents/:id → Agent
// GET /companies/:companyId/org → OrgNode[]  (org chart)

// --- Issues / Tasks (UI-04) ---
// GET /companies/:companyId/issues?status=&projectId=&assigneeAgentId=&q= → Issue[]
// POST /companies/:companyId/issues → Issue
// GET /issues/:id → Issue  (also accepts identifier like "PROJ-1")
// PATCH /issues/:id → Issue
// GET /issues/:id/comments → IssueComment[]
// POST /issues/:id/comments { body, reopen?, interrupt? } → IssueComment

// --- Goals ---
// GET /companies/:companyId/goals → Goal[]
// POST /companies/:companyId/goals → Goal
// GET /goals/:id → Goal
// PATCH /goals/:id → Goal

// --- Projects ---
// GET /companies/:companyId/projects → Project[]
// POST /companies/:companyId/projects → Project
// GET /projects/:id → Project
// PATCH /projects/:id → Project

// --- Chat (UI-05) ---
// POST /companies/:companyId/chat/threads { agentId, title? } → ChatThread (201)
// GET /companies/:companyId/chat/threads → ChatThread[] (filtered by actor)
// GET /chat/threads/:threadId/messages?after=&limit= → { messages, nextCursor }
// POST /chat/threads/:threadId/messages { body, senderType? } → ChatMessage (201)
//   Side effect: wakes agent via heartbeat if senderType === 'user'

// --- Costs (SANCTUM) ---
// GET /companies/:companyId/costs/summary → CostSummary
// GET /companies/:companyId/costs/by-agent → CostByAgent[]
// GET /companies/:companyId/costs/by-provider → CostByProvider[]
// GET /companies/:companyId/budgets/overview → BudgetOverview

// --- Sidebar badges (for NavBar badge counts) ---
// GET /companies/:companyId/sidebar-badges → SidebarBadges
//   Returns: { approvals, inbox, failedRuns, ... }

// --- Approvals (folded into INDRA) ---
// GET /companies/:companyId/approvals → Approval[]
```

### Pattern 5: WebSocket Real-Time (UI-07)

**Endpoint (verified from `paperclip/server/src/realtime/live-events-ws.ts`):**
```
ws://localhost:3100/api/companies/:companyId/events/ws
```

**Auth:** In `authenticated` deployment mode, the server calls `resolveBetterAuthSession()` from the cookies on the upgrade request. The browser's WebSocket API sends cookies automatically for same-origin connections. Via the SvelteKit dev server proxy, this requires careful handling — the WebSocket upgrade must be proxied or the WS connection must go directly to Express on port 3100.

**Auth fallback:** Pass `?token=AGENT_API_KEY` in query string (for agent contexts). For browser board context, no token is needed if cookies are forwarded.

**Event format (verified from `paperclip/server/src/services/live-events.ts`):**
```typescript
interface LiveEvent {
  id: number;          // incrementing integer, server-assigned
  companyId: string;
  type: LiveEventType; // string literal type
  createdAt: string;   // ISO datetime
  payload: Record<string, unknown>;
}
```

**Known event types (from `paperclip/server/src/routes/chat.ts` and live-events usage):**
- `chat.message.created` — payload: `{ threadId, messageId, agentId }`
- Additional types emitted by heartbeat, agents, issues — see `@paperclipai/shared` `LiveEventType`

**Global WebSocket store pattern (Svelte 5 runes):**
```typescript
// services/ui/src/lib/ws.ts
import { browser } from '$app/environment';

let ws: WebSocket | null = null;
let listeners = $state<Array<(event: LiveEvent) => void>>([]);
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function connectWebSocket(companyId: string) {
  if (!browser) return;

  const url = `ws://localhost:3100/api/companies/${companyId}/events/ws`;

  ws = new WebSocket(url);

  ws.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data) as LiveEvent;
      for (const listener of listeners) listener(event);
    } catch { /* ignore malformed */ }
  };

  ws.onclose = () => {
    // Auto-reconnect with 3s delay
    reconnectTimer = setTimeout(() => connectWebSocket(companyId), 3000);
  };

  return () => {
    ws?.close();
    if (reconnectTimer) clearTimeout(reconnectTimer);
  };
}

export function subscribeWS(fn: (event: LiveEvent) => void) {
  listeners = [...listeners, fn];
  return () => { listeners = listeners.filter(l => l !== fn); };
}
```

**CRITICAL — WebSocket proxy gap:** SvelteKit's dev server (`vite dev`) does not automatically proxy WebSocket upgrades. The SvelteKit `vite.config.ts` proxy config handles HTTP but WebSocket upgrades require explicit `ws: true` in the Vite proxy configuration. The production deployment must also handle WS passthrough.

```typescript
// services/ui/vite.config.ts — add ws proxy
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3100',
      changeOrigin: true,
      ws: true,  // REQUIRED for WebSocket upgrade proxying
    }
  }
}
```

With this, the browser can connect to `/api/companies/:companyId/events/ws` and Vite will proxy the upgrade to Express on port 3100, forwarding cookies correctly.

### Pattern 6: Layout load function (BetterAuth session)

```typescript
// services/ui/src/routes/(app)/+layout.server.ts (REWRITE)
import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = async (event) => {
  // session is populated by hooks.server.ts
  if (!event.locals.session) {
    throw redirect(303, '/auth');
  }
  return {
    session: event.locals.session,
    // companyId resolved here for child routes to use
    // See: fetch /api/companies to get first company
  };
};
```

The existing `(app)/+layout.server.ts` uses `event.locals.auth()` which is Auth.js API. This must become `event.locals.session` (set by the new hooks).

### Pattern 7: OFFICE sub-navigation

Recommended approach: a persistent left sidebar within the OFFICE route group layout.

```svelte
<!-- services/ui/src/routes/(app)/office/+layout.svelte -->
<script lang="ts">
  let { children } = $props();
</script>

<div class="office-layout">
  <nav class="office-subnav">
    <a href="/office/agents">Agents</a>
    <a href="/office/issues">Issues</a>
    <a href="/office/goals">Goals</a>
    <a href="/office/projects">Projects</a>
  </nav>
  <div class="office-content">
    {@render children()}
  </div>
</div>
```

This uses the existing Svelte 5 `{@render children()}` pattern from the app layout.

### Anti-Patterns to Avoid

- **Sending Auth.js Bearer tokens to Paperclip:** The old proxy extracted `authjs.session-token` and sent `Authorization: Bearer <token>`. Paperclip Express doesn't validate Auth.js JWTs — it reads BetterAuth session cookies. Remove Bearer forwarding, add cookie forwarding.
- **Direct Express calls from browser:** All API calls go via `/api/[...path]` proxy. Browser never calls `localhost:3100` directly.
- **Client-side session fetch in load functions:** Use server-side `+page.server.ts` for all initial data loads. Client-side fetch only for mutations and real-time updates.
- **Multiple WebSocket connections:** One connection at app layout level, never per-page.
- **Using `$page.data.session` before route group guarantees it:** Child layouts can trust `data.session` once `(app)/+layout.server.ts` validates it.
- **Re-implementing TypeScript types:** Use `@paperclipai/shared` types (already available in workspace) for Agent, Issue, Company, Goal, Project etc.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session validation | Custom JWT parsing | BetterAuth's `/api/auth/get-session` endpoint | Paperclip owns the session; we're consumers |
| OAuth flow | Custom Google OAuth redirect/callback | BetterAuth `socialProviders.google` + `authClient.signIn.social()` | BetterAuth handles PKCE, state, callback |
| Request types for Paperclip | Re-declaring Agent, Issue, etc. | `@paperclipai/shared` types (workspace dep) | Already available; `import type { Agent } from '@paperclipai/shared'` |
| WebSocket reconnect logic | Custom state machine | Simple `onclose` setTimeout (see Pattern 5) | This domain doesn't need exponential backoff at v1 |
| Company selection UI | Multi-tenant picker | Take `companies[0]` — single-tenant for v6.0 | Scope constraint from CLAUDE.md |

---

## Common Pitfalls

### Pitfall 1: Cookie Forwarding in API Proxy

**What goes wrong:** The existing proxy sends `Authorization: Bearer <authjs-token>` to Express. With BetterAuth, Express auth middleware checks for Bearer token first — if present and invalid, it will not fall back to cookie-based session resolution. Request arrives as unauthenticated (`actor.type = 'none'`).

**Why it happens:** The old Auth.js setup used JWT tokens. BetterAuth uses server-side session cookies.

**How to avoid:** In the rewritten proxy, forward the `cookie` header from the incoming SvelteKit request to Express. Remove the Bearer token extraction entirely.

**Warning signs:** All API calls return 401/403 even when the user appears logged in.

### Pitfall 2: WebSocket Upgrade Through SvelteKit Dev Server

**What goes wrong:** `new WebSocket('/api/companies/:id/events/ws')` fails to connect. Browser shows `WebSocket connection failed` 404 or connection refused.

**Why it happens:** Vite's proxy config handles HTTP by default. WebSocket upgrades need explicit `ws: true` in the proxy config.

**How to avoid:** Add `ws: true` to the `/api` proxy target in `vite.config.ts` (see Pattern 5). In production, ensure the reverse proxy (Railway/nginx) passes WebSocket upgrades to the SvelteKit server, which in turn passes to Express.

**Warning signs:** WS connection attempt appears in Network tab as HTTP 200 or 404, never upgrades.

### Pitfall 3: Google OAuth Not Configured in Paperclip Server

**What goes wrong:** `authClient.signIn.social({ provider: 'google' })` redirects to Express's BetterAuth OAuth handler, which returns an error because `socialProviders.google` is not configured in `createBetterAuthInstance()`.

**Why it happens:** BetterAuth's `createBetterAuthInstance` in `paperclip/server/src/auth/better-auth.ts` currently only configures `emailAndPassword`. Google OAuth requires adding the `socialProviders` block AND setting `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` env vars.

**How to avoid:** This is a two-part task: (1) modify `createBetterAuthInstance()` to include Google social provider, (2) add env vars. This is a Paperclip server code change — it lives in the submodule (`paperclip/server/src/auth/better-auth.ts`).

**Warning signs:** OAuth redirect results in a 400 or 404 from Express.

### Pitfall 4: TypeScript Type Errors on `event.locals.session`

**What goes wrong:** TypeScript errors saying `Property 'session' does not exist on type 'Locals'`.

**Why it happens:** The existing `app.d.ts` declares `locals: { auth(): Promise<Session | null> }` for Auth.js. After migration, the type must be updated.

**How to avoid:** Update `services/ui/src/app.d.ts`:
```typescript
// src/app.d.ts
import type { BetterAuthSessionResult } from 'better-auth';

declare global {
  namespace App {
    interface Locals {
      session: { user: { id: string; email: string | null; name: string | null }; session: { id: string; userId: string } } | null;
    }
  }
}
```

**Warning signs:** TypeScript errors on `event.locals.session` in hooks.server.ts and layout server files.

### Pitfall 5: companyId Availability in Load Functions

**What goes wrong:** Child page load functions need `companyId` but it's not passed down. Pages must make a separate API call to `/companies` on every page load.

**How to avoid:** Fetch `/companies` once in `(app)/+layout.server.ts`, take `companies[0].id`, and pass it as part of the layout data. All child routes receive it via `data.companyId` from the parent layout.

### Pitfall 6: Chat Message Sending Wakes Agent

**What goes wrong:** Posting a user message to `POST /chat/threads/:threadId/messages` immediately triggers a heartbeat to wake the assigned agent. In dev, if no agent is running, this generates noise in logs and may cause side effects.

**Why it happens:** By design — see `paperclip/server/src/routes/chat.ts` lines 115-133. The `senderType === 'user'` branch calls `heartbeat.wakeup()`.

**How to avoid:** This is expected behavior. In dev, have a live agent or stub-bot running. Do not suppress on the frontend.

---

## Code Examples

### Loading agents list in a server load function
```typescript
// services/ui/src/routes/(app)/office/agents/+page.server.ts
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { companyId } = await parent();  // from (app)/+layout.server.ts

  const res = await fetch(`/api/companies/${companyId}/agents`);
  if (!res.ok) throw error(res.status, 'Failed to load agents');

  const agents = await res.json();
  return { agents };
};
```

### Posting a comment from a form action
```typescript
// services/ui/src/routes/(app)/office/issues/[id]/+page.server.ts
import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';

export const actions: Actions = {
  addComment: async ({ request, fetch, params }) => {
    const form = await request.formData();
    const body = form.get('body') as string;

    const res = await fetch(`/api/issues/${params.id}/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    });

    if (!res.ok) return fail(res.status, { error: 'Failed to post comment' });
    return { success: true };
  }
};
```

### Connecting WebSocket in app layout
```svelte
<!-- services/ui/src/routes/(app)/+layout.svelte (REWRITE) -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import NavBar from '$lib/components/NavBar.svelte';

  let { children, data } = $props();

  let notifications = $state<Array<{ id: string; type: string; text: string }>>([]);

  onMount(() => {
    if (!browser || !data.companyId) return;

    const ws = new WebSocket(`/api/companies/${data.companyId}/events/ws`);

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        // Route events to appropriate handlers
        if (event.type === 'chat.message.created') {
          // signal reactive chat store
        }
        // Add toast for notable events
        addToast(event);
      } catch { /* ignore */ }
    };

    // Auto-reconnect
    ws.onclose = () => setTimeout(() => {/* re-init */}, 3000);

    return () => ws.close();
  });
</script>
```

### BetterAuth client for Google sign-in page
```svelte
<!-- services/ui/src/routes/auth/+page.svelte -->
<script lang="ts">
  import { authClient } from '$lib/auth-client';

  async function signIn() {
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/indra',
    });
  }
</script>

<button onclick={signIn}>Sign in with Google</button>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Auth.js (SvelteKit) for Google OAuth | BetterAuth (via Paperclip) for session | Phase 4 | hooks.server.ts rewrites; `event.locals.auth()` becomes `event.locals.session` |
| 3 SSE EventSource streams | 1 WebSocket with multiplexed events | Phase 4 | `sse.ts` deleted; `ws.ts` created |
| Fastify execution-service as backend | Paperclip Express (port 3100) as backend | Phase 4 (started Phase 1) | `EXECUTION_SERVICE_URL` → `PAPERCLIP_URL` env var |
| `/dashboard` post-login redirect | `/indra` post-login redirect | Phase 4 | Auth redirect target |

**Deprecated:**
- `services/ui/src/lib/sse.ts` — entire file deleted, replaced by WebSocket
- `services/ui/src/auth.ts` — entire file deleted, Auth.js removed
- Old API functions (executions, bots, verdicts, army-builder, ring-leader) — deleted from `api.ts`

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Paperclip Express server | All API calls | Must be running | Port 3100 (verified from Phase 1) | — (blocking) |
| Google OAuth credentials | UI-02 | Needs env vars | GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET | — |
| PAPERCLIP_URL env var | API proxy retarget | Must set | `http://localhost:3100` in dev | — |
| better-auth npm package | BetterAuth client | Not yet installed in @claw/ui | 1.4.18 | — |

**Missing dependencies requiring action before execution:**

- `PAPERCLIP_URL` env var: must be added to `.env` in `services/ui/`. Rename from `EXECUTION_SERVICE_URL`.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: must be set for Express BetterAuth config.
- `better-auth@1.4.18`: must be installed in `@claw/ui`.
- Google OAuth must be added to `createBetterAuthInstance()` in `paperclip/server/src/auth/better-auth.ts`.
- Vite proxy must add `ws: true` for WebSocket upgrade proxying.

---

## Validation Architecture

> `workflow.nyquist_validation` not explicitly set to `false` in config.json — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (inferred from CLAUDE.md `pnpm exec vitest run`) |
| Config file | none detected in `services/ui/` — tests likely not yet set up |
| Quick run command | `pnpm --filter @claw/ui exec vitest run` |
| Full suite command | `pnpm --filter @claw/ui exec vitest run --reporter=verbose` |

**Note:** The existing test infrastructure referenced in CLAUDE.md is in `execution-service` (`src/__tests__/`). The `services/ui/` package has no test files — Phase 4 is primarily UI construction without a testing harness in place. Vitest can be added, but E2E tests require running services.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | API proxy forwards to PAPERCLIP_URL | manual smoke | visit `/api/companies` in browser | ❌ Wave 0 |
| UI-02 | Google OAuth session persists across refresh | manual smoke | sign in, refresh, check session | ❌ Wave 0 |
| UI-03 | Agent list renders, create works | manual smoke | navigate to `/office/agents` | ❌ Wave 0 |
| UI-04 | Issue list, detail, comment post | manual smoke | navigate to `/office/issues/:id`, post comment | ❌ Wave 0 |
| UI-05 | Chat thread, send message, agent responds | manual smoke | navigate to `/chat`, create thread, send message | ❌ Wave 0 |
| UI-06 | Dashboard metrics render | manual smoke | navigate to `/indra`, verify agent counts | ❌ Wave 0 |
| UI-07 | WebSocket receives live events | manual smoke | open DevTools Network tab, verify WS frames | ❌ Wave 0 |

**Rationale for manual-only:** Phase 4 requirements are UI rendering and network integration — these cannot be meaningfully unit-tested without a running Paperclip server. Smoke tests via browser are the appropriate validation method.

### Sampling Rate
- **Per task commit:** Open the relevant page in browser, verify no console errors, basic render works
- **Per wave merge:** Full navigation walkthrough (sign in → INDRA → OFFICE agents → OFFICE issues → CHAT → SANCTUM)
- **Phase gate:** All 4 tabs navigate without errors; WebSocket shows connected in DevTools; comment post roundtrips

### Wave 0 Gaps
- [ ] No test files exist in `services/ui/src/` — E2E infrastructure out of scope for this phase
- [ ] Vitest config not present in `services/ui/` — not required for manual smoke validation

---

## Open Questions

1. **BetterAuth client-side `createAuthClient()` baseURL**
   - What we know: Paperclip's React UI calls `/api/auth/get-session` directly (no SDK). The `authApi` module uses plain fetch with `credentials: "include"`.
   - What's unclear: Does `better-auth/client`'s `createAuthClient()` work correctly when `baseURL` is `/api` (relative, via Vite proxy) vs `http://localhost:3100/api` (direct)?
   - Recommendation: Start with direct fetch to `/api/auth/get-session` (matching Paperclip's React UI pattern). Adopt `createAuthClient()` if OAuth redirect flow needs it.

2. **companyId for the Akasa single-tenant scenario**
   - What we know: Paperclip supports multiple companies per instance. The Akasa v6.0 scope is single-tenant — one company per user.
   - What's unclear: Does a company record exist when a new user signs in for the first time? Does BetterAuth create one automatically?
   - Recommendation: After first Google OAuth sign-in, check `GET /companies`. If empty, show an onboarding prompt to create a company. This is a Phase 4 edge case to handle.

3. **WebSocket in production (Railway)**
   - What we know: SvelteKit dev server with `ws: true` proxy handles WS upgrade. Railway routes HTTP.
   - What's unclear: Whether the SvelteKit SSR production server (running on Railway) correctly passes WebSocket upgrades through to Express.
   - Recommendation: Test WS connection in production build early. Fallback: direct WS connection to `wss://paperclip.example.com/api/companies/:id/events/ws` if proxy doesn't work.

---

## Sources

### Primary (HIGH confidence)
- `paperclip/server/src/auth/better-auth.ts` — BetterAuth instance creation, session types, missing Google OAuth config
- `paperclip/server/src/middleware/auth.ts` — Express auth middleware, cookie-based session resolution
- `paperclip/server/src/realtime/live-events-ws.ts` — WebSocket endpoint, auth flow, event format
- `paperclip/server/src/services/live-events.ts` — Event type and payload structure
- `paperclip/server/src/routes/chat.ts` — Chat endpoint paths and request/response shapes
- `paperclip/server/src/routes/agents.ts` (partial) — Agent endpoint paths
- `paperclip/server/src/routes/dashboard.ts` — Dashboard summary endpoint
- `paperclip/server/src/routes/costs.ts` — Cost/budget endpoint paths
- `paperclip/server/src/routes/goals.ts` — Goals endpoint paths
- `paperclip/server/src/routes/activity.ts` — Activity endpoint paths
- `paperclip/server/src/routes/sidebar-badges.ts` — Badge count endpoint
- `paperclip/ui/src/api/agents.ts` — Paperclip React API client (verified endpoint paths)
- `paperclip/ui/src/api/issues.ts` — Issues API (verified endpoint paths and filter params)
- `paperclip/ui/src/api/auth.ts` — BetterAuth session fetch pattern from React UI
- `paperclip/ui/src/api/companies.ts` — Companies endpoint paths
- `paperclip/ui/src/api/client.ts` — Cookie-based credentials pattern
- `services/ui/src/routes/api/[...path]/+server.ts` — Existing proxy structure
- `services/ui/src/routes/(app)/+layout.svelte` — SSE pattern being replaced
- `services/ui/src/lib/sse.ts` — SSE implementation being replaced
- `services/ui/src/auth.ts` — Auth.js config being removed
- `services/ui/src/lib/components/NavBar.svelte` — 4-tab navigation already wired
- `services/ui/package.json` — Current deps; `@auth/sveltekit` present, `better-auth` absent

### Secondary (MEDIUM confidence)
- BetterAuth docs (training data, v1.4.x): `createAuthClient()`, `signIn.social()`, social providers config

---

## Metadata

**Confidence breakdown:**
- Paperclip API endpoints: HIGH — verified from Express route source files
- BetterAuth session integration: HIGH — verified from both server and React UI source files
- Google OAuth gap: HIGH — confirmed missing from `createBetterAuthInstance()` source
- WebSocket protocol: HIGH — verified from `live-events-ws.ts` and `live-events.ts`
- WebSocket Vite proxy config: MEDIUM — standard Vite feature, not verified against project's current vite.config.ts
- BetterAuth client SDK (`createAuthClient`): MEDIUM — training data; React UI doesn't use SDK, uses plain fetch

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable domain — Paperclip source code verified directly)
