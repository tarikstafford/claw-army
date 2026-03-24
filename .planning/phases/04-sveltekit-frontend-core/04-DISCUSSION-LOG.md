# Phase 4: SvelteKit Frontend Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 04-sveltekit-frontend-core
**Areas discussed:** Auth strategy, Route-to-tab mapping, API layer rewrite, Real-time updates

---

## Auth Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Switch to BetterAuth | Replace @auth/sveltekit entirely. SvelteKit calls Paperclip's BetterAuth endpoints. One auth system, shared session cookies. | ✓ |
| Keep Auth.js, bridge sessions | Keep @auth/sveltekit, create parallel BetterAuth session. Two auth systems in sync. | |
| Auth.js front, token forwarding | Keep Auth.js for UX, SvelteKit proxy injects service token for Paperclip calls. | |

**User's choice:** Switch to BetterAuth
**Notes:** Clean replacement, not a bridge. One auth system.

| Option | Description | Selected |
|--------|-------------|----------|
| Google OAuth only | Keep it simple, matches v5 behavior. | ✓ |
| Google + email/password | BetterAuth supports both. Broader access but more UI. | |

**User's choice:** Google OAuth only

| Option | Description | Selected |
|--------|-------------|----------|
| SvelteKit hooks.server.ts | Server hook calls BetterAuth session API on every request. Guards routes server-side. | ✓ |
| Client-side check only | Pages load freely, client JS checks and redirects. Flash of protected content. | |

**User's choice:** SvelteKit hooks.server.ts

| Option | Description | Selected |
|--------|-------------|----------|
| INDRA (CEO briefing) | Fleet overview / CEO briefing page as landing. | ✓ |
| OFFICE (agent cards) | Virtual office showing agents immediately. | |
| SANCTUM (dashboard) | Metrics and karma. Current v5 behavior. | |

**User's choice:** INDRA (CEO briefing)

---

## Route-to-Tab Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| OFFICE tab | Agents list, detail, create all under /office. Virtual office IS the agent roster. | ✓ |
| INDRA tab | Agents as part of CEO briefing. | |
| Split across tabs | Overview in INDRA, management in OFFICE. | |

**User's choice:** OFFICE tab for agents

| Option | Description | Selected |
|--------|-------------|----------|
| OFFICE tab | Issues/tasks, goals, projects all under /office as sub-routes. | ✓ |
| INDRA tab | Goals/projects in INDRA as strategic, issues in OFFICE as operational. | |
| Dedicated sub-nav | OFFICE gets secondary nav: Agents, Issues, Goals, Projects. | |

**User's choice:** OFFICE tab for issues/goals/projects

| Option | Description | Selected |
|--------|-------------|----------|
| Fleet overview + activity feed | High-level dashboard: agent count, recent activity, pending approvals, cost summary. | ✓ |
| Conversational CEO interface | Chat-first: talk to Indra, get briefing. | |
| You decide | Claude's discretion. | |

**User's choice:** Fleet overview + activity feed for INDRA

| Option | Description | Selected |
|--------|-------------|----------|
| Metrics + costs + evolution | Karma scores, cost tracking, soul evolution, category benchmarks, DNA library. | ✓ |
| Metrics + settings combined | Both analytics and platform settings. | |
| You decide | Claude's discretion. | |

**User's choice:** Metrics + costs + evolution for SANCTUM

| Option | Description | Selected |
|--------|-------------|----------|
| Gear icon in NavBar | Settings as separate panel/page via gear icon. 4 tabs stay focused. | ✓ |
| Under SANCTUM | SANCTUM sub-nav: Metrics, Evolution, Settings. | |
| Separate /admin route | Keep v5 /admin, not in tab nav. | |

**User's choice:** Gear icon in NavBar for settings

| Option | Description | Selected |
|--------|-------------|----------|
| Fold into INDRA | Pending approvals as action items in CEO briefing. | ✓ |
| Separate view under OFFICE | Approvals as sub-route alongside Issues. | |

**User's choice:** Fold approvals into INDRA

---

## API Layer Rewrite

| Option | Description | Selected |
|--------|-------------|----------|
| SvelteKit server proxy | Keep /api/[...path] pattern. Browser never talks to Express directly. | ✓ |
| Client-direct to Express | Browser calls Express directly with CORS. | |
| Mixed server/client | Auth via proxy, data reads direct. | |

**User's choice:** SvelteKit server proxy

| Option | Description | Selected |
|--------|-------------|----------|
| Clean rewrite | New api.ts from scratch around Paperclip endpoints. Old v5 functions removed. | ✓ |
| Incremental replacement | Keep existing, add Paperclip functions alongside. | |
| Dual api files | Separate paperclip-api.ts and evolution-api.ts. | |

**User's choice:** Clean rewrite

| Option | Description | Selected |
|--------|-------------|----------|
| Load functions for pages | Data in +page.server.ts. SSR-friendly, no spinners. Client fetch for mutations only. | ✓ |
| Client-side fetch everywhere | All data fetched in components. Loading state on every page. | |
| Hybrid per-route | Some load functions, some client-side. Claude decides. | |

**User's choice:** Load functions for pages

| Option | Description | Selected |
|--------|-------------|----------|
| Single api.ts, grouped by domain | One file with sections: agents, issues, chat, dashboard. | ✓ |
| Split by domain | Separate files per domain. More files, clearer boundaries. | |

**User's choice:** Single api.ts grouped by domain

---

## Real-Time Updates

| Option | Description | Selected |
|--------|-------------|----------|
| Paperclip WebSocket | Use live-events-ws. One connection, all events multiplexed. Replace SSE entirely. | ✓ |
| Keep SSE alongside WebSocket | WebSocket for Paperclip events, SSE for Akasa evolution events. | |
| SSE for everything | Proxy WebSocket through SvelteKit SSE endpoint. | |

**User's choice:** Paperclip WebSocket

| Option | Description | Selected |
|--------|-------------|----------|
| Toast notifications + live data | Events update page data reactively. Important events trigger toasts. | ✓ |
| Dedicated activity sidebar | Persistent activity feed sidebar. | |
| You decide | Claude's discretion. | |

**User's choice:** Toast notifications + live data

| Option | Description | Selected |
|--------|-------------|----------|
| Global, always connected | Single WebSocket at app layout level. Survives navigation. Auto-reconnect. | ✓ |
| Per-page connections | WebSocket only on pages needing real-time. | |

**User's choice:** Global, always connected

---

## Claude's Discretion

- OFFICE sub-navigation pattern (sidebar, tabs, breadcrumbs)
- Specific Paperclip API endpoint mapping (researcher inspects routes)
- WebSocket message format and event type handling
- BetterAuth SvelteKit integration pattern
- Loading/error states for pages
- WebSocket store vs Svelte 5 reactive primitives

## Deferred Ideas

None — discussion stayed within phase scope
