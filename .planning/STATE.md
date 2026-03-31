---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: Paperclip Foundation
status: Milestone complete
stopped_at: Completed Phase 12 Plan 01 — evolution routes verification VERIFICATION.md created
last_updated: "2026-03-31T07:11:53.771Z"
progress:
  total_phases: 9
  completed_phases: 8
  total_plans: 23
  completed_plans: 26
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** Users deploy a crew of AI bots that gets measurably smarter with every run — behavioral constitutions evolve through council-evaluated mutation, and the DNA library is the compounding moat no competitor can replicate without the run history.
**Current focus:** Phase 12 — evolution-routes-verification

## Current Position

Phase: 12
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
| Phase 08-evolution-dashboard P01 | 6 | 4 tasks | 16 files |
| Phase 08-evolution-dashboard P02 | 8 | 2 tasks | 3 files |
| Phase 08-evolution-dashboard P03 | 8 | 2 tasks | 6 files |
| Phase 08 P04 | 4 | 1 tasks | 2 files |
| Phase 09 P02 | 5 | 1 tasks | 2 files |
| Phase 09-tool-nexus-wiring P01 | 5 | 1 tasks | 3 files |
| Phase 09 P03 | 173 | 2 tasks | 4 files |
| Phase 10-v6-tech-debt-cleanup P01 | 5 | 2 tasks | 8 files |
| Phase 11-tool-nexus-integration-fixes P01 | 15 | 3 tasks | 7 files |
| Phase 11 P02 | 15 | 2 tasks | 7 files |
| Phase 12 P01 | 5 | 1 tasks | 1 files |

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
- [Phase 08-evolution-dashboard]: Evolution sub-nav uses violet active indicator not rose — evolution is violet-domain per UI-SPEC
- [Phase 08-evolution-dashboard]: FLEET tab uses exact pathname match, AGENTS/BENCHMARKS use startsWith — avoids FLEET being perpetually active
- [Phase 08-evolution-dashboard]: keepDiscard: confirmed Promote/Maintain=keep, confirmed Demote/Retire=discard, all other=pending
- [Phase 08-evolution-dashboard]: MetricTile reuse avoided in FleetOverview — inline Press Start 2P 20px count used directly; MetricTile has Front Office token defaults incompatible with Back Office world
- [Phase 08-evolution-dashboard]: CSS sparkline bar heights computed as percentage of maxScore in array — relative proportions preserved even when all scores are low
- [Phase 08-evolution-dashboard]: VerdictConfirm fade-out defers onaction 200ms — allows animation to complete before parent removes row from list
- [Phase 08-03]: d3-hierarchy layout computed in $derived.by() not $effect() — reactive derived value prevents stale layout on prop change
- [Phase 08-03]: Flat soul chain converted to nested tree via buildTree() before hierarchy() — API returns root-first flat array, d3 needs nested structure
- [Phase 08-03]: Inline tooltip preferred over SlidePanel for lineage node info — read-only soul inspection per UI-SPEC
- [Phase 08]: groupBy includes bots.compositeScore because it is a selected non-aggregate column from a joined table; lastVerdictAt uses MAX() so it is excluded; both JOINs are LEFT JOIN to preserve agent_classes rows for bots with no verdicts
- [Phase 09]: extractEventType and evaluateRoutingRules exported as named exports for unit testability — pure functions with no DB dependency
- [Phase 09]: Fire-and-forget void async IIFE for routing evaluation — 200 response always fires before routing evaluation (Pitfall 4 prevention)
- [Phase 09-tool-nexus-wiring]: Plugin install via Paperclip HTTP API (POST /api/plugins/install) not private loader import — local_trusted mode allows unauthenticated install calls from localhost
- [Phase 09-tool-nexus-wiring]: tsconfig cross-package paths: point to .d.ts type files not .ts source files to maintain rootDir: ./src integrity for correct dist/worker.js output
- [Phase 09]: Switch from tsc to esbuild for plugin build — tsc rootDir violation with cross-package .ts path resolution is unfixable; esbuild bundles correctly with workspace externals following Paperclip plugin SDK pattern
- [Phase 10-v6-tech-debt-cleanup]: WEBHOOK_URL_SECRET uses non-null assertion not fallback — no predictable secrets in production
- [Phase 10-v6-tech-debt-cleanup]: executionId added as 5th parameter to checkAndRecordPioneer — pioneer tracker now records correct execution reference
- [Phase 10-v6-tech-debt-cleanup]: /evolution added to isProtected in hooks.server.ts — consistent with existing route guard pattern
- [Phase 11-tool-nexus-integration-fixes]: OAuth redirectUri must point to Express callback handler at /api/akasa/tool-connections/oauth/:toolId/callback, not the SvelteKit /tools page
- [Phase 11-tool-nexus-integration-fixes]: Internal endpoints rely on local_trusted mode for security (no auth tokens) — localhost-only processes only
- [Phase 11-tool-nexus-integration-fixes]: Webhook dispatch uses /api/agents/:id/wakeup with source+triggerDetail+payload body (Paperclip v2 API)
- [Phase 11]: credential-bridge second param renamed from userId to companyId — reflects Paperclip company UUID not BetterAuth userId
- [Phase 11]: invocation-logger refactored to HTTP (POST /akasa/internal/log-invocation) — no @claw/db in plugin bundle; @claw/db removed from esbuild external list
- [Phase 11]: postPluginConfig called in all install paths using pluginDbId (UUID id field, not pluginKey) for Paperclip config endpoint
- [Phase 12]: EVO-06 uses 60s DB polling of heartbeat_runs not Paperclip push events — documented as SATISFIED MEDIUM confidence with architectural note

### Pending Todos

None.

### Blockers/Concerns

- [Pre-Phase 5]: Paperclip API endpoint paths and auth mechanism unverified against live instance — must inspect `claw-paper-clip/server/` before implementing evolution routes
- [Pre-Phase 1]: pgvector extension must be confirmed on Cloud SQL before running migrations
- [Pre-Phase 1]: Run archetype seed after migration: `cd packages/db && npx tsx src/seed/archetypes.ts`

## Session Continuity

Last session: 2026-03-31T07:08:38.347Z
Stopped at: Completed Phase 12 Plan 01 — evolution routes verification VERIFICATION.md created
Resume file: None
