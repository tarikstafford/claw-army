# Phase 4: SvelteKit Frontend Core - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Rebuild all core Paperclip workflows in SvelteKit — authentication via BetterAuth (Google OAuth), agent management, issue/task views, chat, dashboard — replacing Paperclip's React UI entirely. The SvelteKit app communicates with Paperclip's Express API through a server-side proxy. Real-time updates use Paperclip's WebSocket live events.

Requirements covered: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07

</domain>

<decisions>
## Implementation Decisions

### Authentication
- **D-01:** Replace @auth/sveltekit with Paperclip's BetterAuth. Remove Auth.js entirely. SvelteKit calls BetterAuth's session/login endpoints on Paperclip's Express server. One auth system, shared session cookies.
- **D-02:** Google OAuth only — no email/password. Matches v5 behavior. BetterAuth supports Google OAuth natively.
- **D-03:** Session validation in `hooks.server.ts` — SvelteKit server hook calls BetterAuth's session API on every request, populates `event.locals`. Guards protected routes server-side. Same pattern as current Auth.js setup, different provider.
- **D-04:** Post-login redirect to `/indra` (INDRA tab) — the CEO briefing is the landing page. Replaces v5's `/dashboard` redirect.

### Route Structure (4-Tab Navigation)
- **D-05:** INDRA (`/indra`) — Fleet overview + activity feed. High-level dashboard: agent count by status, recent activity, pending approvals, cost summary. Pulls from Paperclip's `/dashboard` and `/activity` endpoints. Approvals folded in as action items (no separate approvals page).
- **D-06:** OFFICE (`/office`) — Agent management, issues, goals, projects. All Paperclip operational views live here. Sub-routes: `/office/agents`, `/office/agents/:id`, `/office/issues`, `/office/issues/:id`, `/office/goals`, `/office/goals/:id`, `/office/projects`, `/office/projects/:id`. Agent create at `/office/agents/new`.
- **D-07:** CHAT (`/chat`) — Chat threads, messages, agent responses. Replaces Paperclip's Chat page. Real-time via WebSocket.
- **D-08:** SANCTUM (`/sanctum`) — Metrics, costs, evolution data. Replaces v5's dashboard, billing, souls, and category-benchmarks pages. Evolution-specific views (soul library, DNA timeline, verdicts) also live here — though the data endpoints don't exist until Phase 5, the route structure is ready.
- **D-09:** Settings via gear icon in NavBar — not a tab. Separate slide panel or page for plugin manager, secrets, company settings, admin functions. Keeps the 4 tabs focused on core workflows.

### API Layer
- **D-10:** SvelteKit server proxy — keep the `/api/[...path]` pattern. SvelteKit server routes proxy all API calls to Paperclip's Express backend. Browser never talks to Express directly. Session cookies forwarded server-side.
- **D-11:** Clean rewrite of `api.ts` — new file built from scratch around Paperclip's Express endpoints. Old v5 functions (executions, bots, verdicts, army-builder, ring-leader) removed. Evolution endpoints come in Phase 5.
- **D-12:** Single `api.ts` file grouped by domain — agents section, issues section, chat section, dashboard section, etc. Same structural pattern as v5 but targeting Paperclip endpoints.
- **D-13:** SvelteKit load functions for page data — data fetched in `+page.server.ts` load functions. SSR-friendly, no loading spinners on navigation. Client-side fetch only for mutations and real-time updates.

### Real-Time Updates
- **D-14:** Paperclip WebSocket replaces SSE — use Paperclip's `live-events-ws` WebSocket. One connection, all event types multiplexed. Remove the 3 SSE EventSource streams entirely.
- **D-15:** Global WebSocket connection — opened at app layout level, survives navigation, auto-reconnects on drop. All pages receive events.
- **D-16:** Toast notifications + reactive data updates — events update page data reactively (agent status, new messages). Important events trigger toast notifications (same pattern as v5 lifecycle toasts).

### Claude's Discretion
- OFFICE sub-navigation pattern (sidebar, tabs, breadcrumbs) — whatever works best for the 4 sub-sections (agents, issues, goals, projects)
- Specific Paperclip API endpoint mapping — researcher to inspect `paperclip/server/src/routes/` for exact paths and response shapes
- WebSocket message format and event type handling — depends on Paperclip's live-events-ws protocol
- How to structure the BetterAuth integration in SvelteKit (client library import pattern)
- Loading/error states for pages using load functions
- Whether to build a shared WebSocket store or use Svelte 5 reactive primitives directly

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Paperclip Auth System
- `paperclip/server/src/auth/better-auth.ts` — BetterAuth configuration, session types, Google OAuth setup. Must understand this to wire SvelteKit auth.
- `paperclip/server/src/middleware/auth.ts` — Auth middleware that validates sessions on Express routes. SvelteKit proxy must forward cookies correctly.

### Paperclip API Routes
- `paperclip/server/src/routes/index.ts` — Route index (agents, issues, chat, dashboard, goals, projects, approvals, costs, activity, sidebar-badges, access, llms, secrets, plugins)
- `paperclip/server/src/routes/agents.ts` — Agent CRUD endpoints
- `paperclip/server/src/routes/issues.ts` — Issue/task endpoints
- `paperclip/server/src/routes/chat.ts` — Chat thread/message endpoints
- `paperclip/server/src/routes/dashboard.ts` — Dashboard data endpoints
- `paperclip/server/src/routes/goals.ts` — Goals endpoints
- `paperclip/server/src/routes/projects.ts` — Project endpoints
- `paperclip/server/src/routes/approvals.ts` — Approval endpoints
- `paperclip/server/src/routes/costs.ts` — Cost/billing endpoints
- `paperclip/server/src/routes/activity.ts` — Activity feed endpoints

### Paperclip Real-Time
- `paperclip/server/src/realtime/live-events-ws.ts` — WebSocket live events implementation. Must understand protocol, event types, and auth to connect from SvelteKit.

### Paperclip React UI (reference for feature parity)
- `paperclip/ui/src/pages/` — All React pages being replaced. Reference for what each view shows and how data is used.
- `paperclip/ui/src/hooks/` — React hooks that reveal data fetching patterns and API contracts.
- `paperclip/ui/src/api/` — React API client — shows exact endpoint paths and request/response shapes.

### Existing SvelteKit Code
- `services/ui/src/auth.ts` — Current Auth.js config (being replaced)
- `services/ui/src/hooks.server.ts` — Current hooks (being rewritten for BetterAuth)
- `services/ui/src/lib/api.ts` — Current API client (being rewritten)
- `services/ui/src/lib/sse.ts` — Current SSE client (being replaced by WebSocket)
- `services/ui/src/routes/(app)/+layout.svelte` — App layout with NavBar, session, notifications
- `services/ui/src/routes/api/[...path]/` — Current API proxy (retargeting to Express)

### Design System (completed, use in new pages)
- `tasks/akasa-design-guide-v2.md` — Visual language reference for all new pages
- `services/ui/src/app.css` — Token system (Front Office + Back Office)
- `services/ui/src/lib/components/` — Phase 3 component library (NavBar, MechanicCard, Accordion, SlidePanel, Modal, ChatBubble, MetricTile, KarmaCallout)

### Architecture
- `.planning/PROJECT.md` — v6.0 architecture: Path C submodule, shared DB, one backend
- `tasks/prd-akasa-mvp.md` — Full product requirements including domain glossary

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **NavBar** (`lib/components/NavBar.svelte`): Already has 4 tabs (INDRA, OFFICE, CHAT, SANCTUM) with mode toggle. Phase 4 wires actual routes.
- **ChatBubble** (`lib/components/ChatBubble.svelte`): Ready for chat thread UI.
- **MechanicCard** (`lib/components/MechanicCard.svelte`): Can be used for agent cards in OFFICE.
- **MetricTile** (`lib/components/MetricTile.svelte`): Ready for INDRA fleet overview and SANCTUM metrics.
- **Modal, SlidePanel, Accordion**: Available for agent detail, settings, expandable sections.
- **KarmaCallout**: Ready for SANCTUM karma displays.
- **`mode.ts`**: World toggle utility — works with the design system.

### Established Patterns
- **Route groups**: `(app)` for authenticated routes, `(marketing)` for public. Auth guard in `(app)/+layout.server.ts`.
- **API proxy**: `/api/[...path]` catch-all server route proxies to backend. Pattern stays, target changes.
- **Session in layout**: `(app)/+layout.server.ts` loads session, passes to all child routes via `data.session`.
- **Lifecycle notifications**: Toast pattern with `$state` array, auto-dismiss, in app layout. Reuse for WebSocket events.

### Integration Points
- **`hooks.server.ts`**: Replace Auth.js handle with BetterAuth session validation.
- **`(app)/+layout.svelte`**: Replace SSE connection with WebSocket. Update session handling for BetterAuth.
- **`/api/[...path]`**: Retarget proxy from Fastify to Paperclip Express.
- **NavBar tabs**: Wire `href` props to actual route paths (`/indra`, `/office`, `/chat`, `/sanctum`).

</code_context>

<specifics>
## Specific Ideas

- INDRA as the CEO briefing: fleet overview with agent status counts, recent activity feed, pending approvals as action items — not a chat interface, a dashboard-style briefing
- OFFICE houses all operational Paperclip features: agents, issues, goals, projects — needs sub-navigation
- Approvals don't get their own page — they surface as action items in INDRA
- Settings/admin accessed via gear icon, not a tab — keeps tabs focused on workflows

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-sveltekit-frontend-core*
*Context gathered: 2026-03-24*
