---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: Paperclip Foundation
status: Ready to plan
stopped_at: Completed 07-02-PLAN.md — Tool Catalog and Tool Belt pages
last_updated: "2026-03-25T04:37:31.949Z"
progress:
  total_phases: 8
  completed_phases: 6
  total_plans: 16
  completed_plans: 19
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** Users deploy a crew of AI bots that gets measurably smarter with every run — behavioral constitutions evolve through council-evaluated mutation, and the DNA library is the compounding moat no competitor can replicate without the run history.
**Current focus:** Phase 07 — tool-nexus-ui

## Current Position

Phase: 8
Plan: Not started

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*
| Phase 01-submodule-integration P01 | 2 | 2 tasks | 4 files |
| Phase 01 P02 | 2 | 2 tasks | 7 files |
| Phase 02-design-system-tokens-and-typography P01 | 2 | 2 tasks | 5 files |
| Phase 02-design-system-tokens-and-typography P02 | 2 | 3 tasks | 26 files |
| Phase 03-design-system-components-and-motion P01 | 94s | 2 tasks | 2 files |
| Phase 03-design-system-components-and-motion P03 | 67s | 2 tasks | 2 files |
| Phase 03-design-system-components-and-motion P02 | 10 | 2 tasks | 5 files |
| Phase 04-sveltekit-frontend-core P01 | 6 | 3 tasks | 12 files |
| Phase 04-sveltekit-frontend-core P03 | 201s | 3 tasks | 6 files |
| Phase 04-sveltekit-frontend-core P02 | 10 | 3 tasks | 19 files |
| Phase 04-sveltekit-frontend-core P04 | 45 | 2 tasks | 29 files |
| Phase 05 P01 | 326 | 2 tasks | 10 files |
| Phase 05 P02 | 461s | 2 tasks | 11 files |
| Phase 05 P03 | 318 | 2 tasks | 8 files |
| Phase 06-tool-nexus-backend P01 | 309 | 2 tasks | 11 files |
| Phase 06-tool-nexus-backend P03 | 161 | 2 tasks | 4 files |
| Phase 06-tool-nexus-backend P02 | 25 | 2 tasks | 15 files |
| Phase 06-tool-nexus-backend P04 | 15 | 2 tasks | 4 files |
| Phase 07-tool-nexus-ui P01 | 2 | 2 tasks | 11 files |
| Phase 07-tool-nexus-ui P03 | 4 | 2 tasks | 4 files |
| Phase 07-tool-nexus-ui P02 | 2 | 2 tasks | 8 files |

## Accumulated Context

### Decisions

All v1.0–v5.0 architectural decisions archived in PROJECT.md Key Decisions table.

v6.0 key architectural decisions:

- Path C (submodule): claw-paper-clip imported as git submodule, not merged — preserves repo independence
- Paperclip's Express server = primary backend; Akasa mounts evolution routes alongside it
- SvelteKit replaces Paperclip's React UI entirely — one frontend, two-world design system
- Design system: Front Office (`--fo-*`) and Back Office (`--bo-*`) tokens; `body.back-office` class toggle; Front Office is default
- Old token names (`--h-*`, `--d-*`, `--ak-*`) must be removed atomically before new component work begins (Pitfall 3)
- Tool Nexus connectors as Paperclip plugins — OAuth with key versioning mandatory before first credential is persisted (Pitfall 5)
- Phase 2 (DS tokens) before Phase 4 (UI) — zombie token risk if incremental
- [Phase 01-submodule-integration]: strictPeerDependencies: false added to handle cross-repo zod v3/v4 and drizzle-orm version mismatches between Akasa and Paperclip workspaces
- [Phase 01-submodule-integration]: Akasa migration journal renamed to __akasa_migrations — fresh v6.0 database assumed, no row migration from __drizzle_migrations needed
- [Phase 01]: Approach B (replicate startup sequence): akasa-server imports createApp directly rather than calling startServer — preserves Paperclip startServer as unmodified while letting Akasa control the extraApiRouter injection
- [Phase 01]: Port 3100 not 3000: Paperclip default port is 3100 (config.ts), not 3000 as assumed in plan — SvelteKit proxy target corrected accordingly
- [Phase 02]: Clean slate app.css replacement — no backward compat shims for v5 tokens (D-01)
- [Phase 02]: Semantic aliases default to Front Office in :root, overridden to Back Office in body.back-office block (D-02)
- [Phase 02]: localStorage 'akasa-mode' key with blocking inline script in app.html for zero-flash mode persistence (D-03)
- [Phase 02-design-system-tokens-and-typography]: guide/+page.svelte required explicit migration pass — initial grep on 300-line limit missed tokens below line 300
- [Phase 03]: NavBar uses :global(body.back-office) scoped overrides for dual-world styling — avoids Svelte 5 reactivity issues with body class reads
- [Phase 03-design-system-components-and-motion]: ChatBubble sender label uses 5px Press Start 2P per design guide §6.8 — design-guide-prescribed exception to 6-8px rule
- [Phase 03-design-system-components-and-motion]: MetricTile value uses 20px Press Start 2P per §6.9 — only exception to 6-8px label rule for large display numbers
- [Phase 03-design-system-components-and-motion]: MetricTile background literal #fff (not --fo-card) per design guide §6.9 verbatim
- [Phase 03-02]: All 5 Back Office components use --bo-* tokens directly (world-native per D-03), no cross-world color usage
- [Phase 03-02]: Accordion max-height transition (not GPU height) is spec-prescribed exception per DS-11 motion contract
- [Phase 03-02]: Modal uses {#if open} for conditional render; SlidePanel uses translateX — both avoid display:none anti-pattern
- [Phase 04-sveltekit-frontend-core]: Cookie forwarding replaces Bearer token in API proxy — BetterAuth manages session cookies natively; proxy copies cookie header verbatim to Paperclip Express
- [Phase 04-sveltekit-frontend-core]: hooks.server.ts resolves session via GET PAPERCLIP_URL/api/auth/get-session with cookie forwarding; locals.session is null by default (not auth() function)
- [Phase 04-sveltekit-frontend-core]: INDRA fleet stats use null-safe field mapping with -- fallback per UI-SPEC (show -- not zero when data unavailable)
- [Phase 04-sveltekit-frontend-core]: Chat messages fetched client-side only (not SSR) because thread selection is interactive
- [Phase 04-sveltekit-frontend-core]: Optimistic UI for chat send - replace optimistic message with confirmed on success, restore input on failure
- [Phase 04-sveltekit-frontend-core]: Task 1 files committed by parallel 04-03 agent in 7787ad4 — verified acceptance criteria passed, proceeded to Tasks 2-3
- [Phase 04-sveltekit-frontend-core]: Promise.allSettled for issue+comments parallel fetch — comment failure shows empty list rather than breaking page
- [Phase 04-sveltekit-frontend-core]: Marketing layout BetterAuth migration gap fixed — event.locals.session replaces getServerSession(@auth/sveltekit)
- [Phase 04-sveltekit-frontend-core]: Nav links updated /dashboard→/indra and /login→/auth after v5 route deletion
- [Phase 05]: vitest.config.ts requires both @claw/source conditions AND path aliases — conditions alone insufficient; Vite cannot resolve workspace packages without explicit alias fallbacks (matched execution-service pattern)
- [Phase 05]: Migration placed in packages/db/migrations/akasa/ subdirectory per plan spec — distinct from main Drizzle migration journal, applied manually via psql
- [Phase 05]: Devil's Advocate uses @ai-sdk/openai gpt-4o-mini (OpenAI family) NOT @ai-sdk/google as in execution-service — plan spec says OpenAI, satisfies CLAUDE.md heterogeneous provider requirement
- [Phase 05]: Council runner weights 0.5/0.3/0.2 (PJ/SA/DA); Promote and Retire set requiresHumanConfirmation=true; partial judge failures handled via renormalized weights
- [Phase 05]: class-machine simplified for akasa-server: computeClassTransition(currentClass, verdictType) -> { newClass, transitioned } pure function without run counters — simpler interface for God Layer HTTP context vs BullMQ worker context
- [Phase 05]: godLayerRouter mounts at /akasa/verdicts alongside councilRouter — coexist cleanly (GET vs PATCH method separation)
- [Phase 06-tool-nexus-backend]: AES-256-GCM credential encryption uses node:crypto with TOOL_ENCRYPTION_KEY (falls back to PAPERCLIP_SECRETS_MASTER_KEY) — no external crypto packages
- [Phase 06-tool-nexus-backend]: In-memory Map rate limiter acceptable for single-process akasa-server; Redis migration path documented in code comment
- [Phase 06-tool-nexus-backend]: Deterministic webhook token derivation (SHA-256 of connectionId + WEBHOOK_URL_SECRET) avoids DB schema change and keeps tokens stable across restarts
- [Phase 06-tool-nexus-backend]: moduleResolution: Bundler for plugin tsconfig — avoids NodeNext .js extension requirement on workspace source files
- [Phase 06-tool-nexus-backend]: @claw/akasa-server exports added for token-manager/credential-encryption — enables clean workspace import instead of fragile relative path
- [Phase 06-tool-nexus-backend]: resolveCredential() returns {token, connectionId} tuple — avoids second DB query for audit logging in connectors
- [Phase 06-tool-nexus-backend]: base64url encodes JSON state (userId+toolId+redirectUri) for OAuth flow — server-only use, no separate CSRF session needed
- [Phase 06-tool-nexus-backend]: OAuth upsert: try insert first, catch unique violation, fallback to update — consistent with tool-connections.ts approach
- [Phase 07-tool-nexus-ui]: webhook_routing_rules connectionId uses logical FK (no references()) to avoid circular TypeScript inference — consistent with CLAUDE.md pattern
- [Phase 07-tool-nexus-ui]: Tools layout enforces Back Office world via onMount setMode with previousMode capture and cleanup restore
- [Phase 07-tool-nexus-ui]: TOOL_CATALOG is static (3 tools) in tool-catalog.ts — no backend catalog endpoint, live status overlaid from API
- [Phase 07-tool-nexus-ui]: WebhookLogEntry uses inline accordion instead of Accordion.svelte — Accordion API (label/color/children) incompatible with log entry header layout needing tool name + action + timestamp left / dot + latency right
- [Phase 07-tool-nexus-ui]: StatusBadge uses inline style attribute for border/color from derived colorMap — avoids dynamic class names
- [Phase 07-tool-nexus-ui]: ToolCard renders Re-authorise button only when status === expired per UI-SPEC copywriting contract

### Pending Todos

None.

### Blockers/Concerns

- [Pre-Phase 5]: Paperclip API endpoint paths and auth mechanism unverified against live instance — must inspect `claw-paper-clip/server/` before implementing evolution routes
- [Pre-Phase 1]: pgvector extension must be confirmed on Cloud SQL before running migrations
- [Pre-Phase 1]: Run archetype seed after migration: `cd packages/db && npx tsx src/seed/archetypes.ts`

## Session Continuity

Last session: 2026-03-25T04:32:32.706Z
Stopped at: Completed 07-02-PLAN.md — Tool Catalog and Tool Belt pages
Resume file: None
