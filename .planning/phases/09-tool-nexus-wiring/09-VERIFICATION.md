---
phase: 09-tool-nexus-wiring
verified: 2026-03-30T11:40:00Z
status: human_needed
score: 6/6 must-haves verified (automated checks)
re_verification:
  previous_status: gaps_found
  previous_score: 4/6
  gaps_closed:
    - "Tool Nexus plugin transitions to ready status after akasa-server starts (build unblocked)"
    - "Agents can discover HubSpot, Slack, and Google Sheets tools via plugin tool dispatcher (build unblocked)"
    - "Plugin install is idempotent — second startup does not error or duplicate (accessSync guard now passable)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Verify plugin reaches ready status on server start"
    expected: "GET /api/plugins returns [{pluginKey: 'akasa.tool-nexus', status: 'ready'}] after akasa-server starts"
    why_human: "Requires running Paperclip server with plugin loader active; cannot verify programmatically from source alone"
  - test: "Verify agent can invoke hubspot.create_contact end-to-end"
    expected: "Agent session with Tool Nexus plugin loaded can call hubspot.create_contact and receive a response from HubSpot API"
    why_human: "Requires live OAuth credentials, running server, and agent session — cannot test from static analysis"
  - test: "Verify plugin install idempotency at runtime"
    expected: "Second akasa-server startup logs 'Tool Nexus plugin already ready' and does not POST /api/plugins/install again"
    why_human: "Requires two successive server starts against a running Paperclip instance"
---

# Phase 9: Tool Nexus Wiring Verification Report

**Phase Goal:** Agents can discover and invoke Tool Nexus connectors at runtime, and incoming webhooks dispatch to the correct agent via stored routing rules — closing the two unwired integration gaps from the v6.0 audit
**Verified:** 2026-03-30T11:40:00Z
**Status:** human_needed (all automated checks pass — 3 items require running server)
**Re-verification:** Yes — after gap closure via Plan 03 (esbuild switch + tsconfig path fix, commits 8c10420 and 6af115c)

## Re-Verification Summary

Previous verification (2026-03-30T10:51:00Z) found 3 failing/partial items, all caused by the plugin build being broken due to tsconfig paths pointing to non-existent `.d.ts` files. Plan 03 closed all three gaps:

1. **tsconfig.json paths** corrected from `packages/db/dist/index.d.ts` (no dist/) and `token-manager.d.ts` (no .d.ts files) to the actual `.ts` source files that exist on disk.
2. **Build toolchain switched from tsc to esbuild** — tsc with `rootDir: ./src` cannot compile path-mapped `.ts` files outside `src/`, so esbuild is used for JS emission (following the Paperclip plugin SDK pattern) while `tsc --noEmit` handles type-checking only.
3. **dist/worker.js now exists** (22KB, produced reproducibly) — `pnpm --filter @claw/plugin-tool-nexus build` exits with code 0.

The four previously-passing webhook routing items (TOOL-07) show no regression — all 10 unit tests still pass.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Plugin build produces dist/worker.js reproducibly | ✓ VERIFIED | `pnpm --filter @claw/plugin-tool-nexus build` exits 0; `dist/worker.js` is 22KB; `dist/worker.js.map` is 47KB; fresh rebuild confirmed in re-verification run |
| 2 | Tool Nexus plugin transitions to ready status after akasa-server starts | ? HUMAN | Build artifact exists and accessSync guard will pass. `ensureToolNexusPlugin()` is wired at line 113 of `akasa-server/src/index.ts`. Runtime verification requires a running Paperclip server. |
| 3 | Agents can discover HubSpot, Slack, and Google Sheets tools via plugin tool dispatcher | ? HUMAN | All 7 tools compiled into worker.js: hubspot:create-contact, hubspot:search-contacts, hubspot:create-deal, slack:send-message, slack:list-channels, sheets:read-range, sheets:append-row. Runtime discovery requires running server + agent session. |
| 4 | Plugin install is idempotent — second startup does not error or duplicate | ? HUMAN | Idempotency logic verified in source (lines 30-38, 50-55 of index.ts). accessSync guard no longer blocks. Runtime confirmation requires two successive server starts. |
| 5 | When a webhook is received and a routing rule matches, dispatch decision is logged to tool_invocation_logs | ✓ VERIFIED | `webhook:${toolId}:dispatched` insert at webhooks.ts line 245; 10 unit tests pass (no regression). |
| 6 | When a webhook is received and no routing rule matches, a no_match entry is logged | ✓ VERIFIED | `webhook:${toolId}:no_match` insert at webhooks.ts line 232; unit tests pass (no regression). |
| 7 | Webhook routing evaluation never blocks the 200 response to the provider | ✓ VERIFIED | `res.json({ received: true })` precedes fire-and-forget async block. Unit tests confirm. No regression. |
| 8 | If an agent ID is assigned in the matched rule, a best-effort dispatch notification is attempted | ✓ VERIFIED | Heartbeat POST at webhooks.ts lines 260-274; failure logged as console.warn only. No regression. |

**Score:** 5/8 fully verified automatically; 3/8 require human verification (all runtime, no code gaps)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/plugins/akasa-tool-nexus/dist/worker.js` | Compiled plugin entry point for Paperclip worker manager | ✓ VERIFIED | Exists at 22KB. Contains `definePlugin` (2 occurrences), all 3 connector modules compiled in, credential-bridge and invocation-logger wired. `dist/worker.js.map` also present (47KB). Produced by `node esbuild.config.mjs`. |
| `packages/plugins/akasa-tool-nexus/tsconfig.json` | Correct paths for type-checking (noEmit: true) | ✓ VERIFIED | `noEmit: true` set. Paths: `@claw/db` → `packages/db/src/index.ts`; `@claw/akasa-server/services/token-manager` → `services/akasa-server/src/services/token-manager.ts`; `@claw/akasa-server/services/credential-encryption` → `services/akasa-server/src/services/credential-encryption.ts`. All three files exist on disk. |
| `packages/plugins/akasa-tool-nexus/esbuild.config.mjs` | esbuild config for JS emission | ✓ VERIFIED | New file (created by Plan 03). Bundles `src/worker.ts` and `src/manifest.ts` to `dist/`. Externalizes `@claw/db`, `@claw/akasa-server`, `@paperclipai/plugin-sdk`, `@paperclipai/shared`, `drizzle-orm` for runtime resolution. ESM output, node20 target. |
| `packages/plugins/akasa-tool-nexus/package.json` | Build script using esbuild | ✓ VERIFIED | `"build": "node esbuild.config.mjs"` (changed from `tsc`); `"typecheck": "tsc --noEmit"` (new); esbuild `^0.27.3` in devDependencies. |
| `services/akasa-server/src/index.ts` | Post-startup plugin install hook | ✓ VERIFIED | Unchanged and correct. `ensureToolNexusPlugin()` at line 13; accessSync guard at lines 21-27; idempotency check at lines 30-38; install POST at lines 41-55; `void ensureToolNexusPlugin(config.port).catch(...)` at line 113. |
| `services/akasa-server/src/routes/webhooks.ts` | Webhook routing rule evaluation + dispatch | ✓ VERIFIED | Unchanged. All patterns present. 10/10 unit tests pass. |
| `services/akasa-server/src/__tests__/webhook-routing.test.ts` | Unit tests for routing rule evaluation | ✓ VERIFIED | 10 tests, all pass. No regression. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/plugins/akasa-tool-nexus/tsconfig.json` | `packages/db/src/index.ts` | paths block `@claw/db` entry | ✓ WIRED | `"@claw/db": ["../../../packages/db/src/index.ts"]` — file exists |
| `packages/plugins/akasa-tool-nexus/tsconfig.json` | `services/akasa-server/src/services/token-manager.ts` | paths block `@claw/akasa-server/services/token-manager` entry | ✓ WIRED | `"@claw/akasa-server/services/token-manager": ["../../../services/akasa-server/src/services/token-manager.ts"]` — file exists |
| `packages/plugins/akasa-tool-nexus/dist/worker.js` | Paperclip PluginWorkerManager | `manifest.json entrypoints.worker` | ✓ WIRED | `dist/manifest.js` declares `entrypoints: { worker: "./dist/worker.js" }`; `dist/worker.js` exists at that path |
| `services/akasa-server/src/index.ts` | `POST /api/plugins/install` | `fetch` after `server.listen()` | ✓ WIRED | fetch to `/api/plugins/install` at line 42; `void ensureToolNexusPlugin(config.port)` at line 113; accessSync guard now passable |
| `services/akasa-server/src/routes/webhooks.ts` | `packages/db/src/schema/webhook-routing-rules.ts` | drizzle select on `webhookRoutingRules` | ✓ WIRED | No change from previous verification. |
| `services/akasa-server/src/routes/webhooks.ts` | `packages/db/src/schema/tool-invocation-logs.ts` | drizzle insert for dispatch/no_match logging | ✓ WIRED | No change from previous verification. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `webhooks.ts` (routing block) | `rules` | `db.select().from(webhookRoutingRules).where(and(...))` | Yes — live drizzle query filtered by userId + toolId + isActive | ✓ FLOWING |
| `webhooks.ts` (routing block) | `matchedRule` | `evaluateRoutingRules(rules, eventType)` | Yes — pure function operating on real DB results | ✓ FLOWING |
| `dist/worker.js` (credential-bridge) | `connection` | `db.select().from(toolConnections).where(and(...)).limit(1)` | Yes — live drizzle query for user tool connection | ✓ FLOWING |
| `index.ts` (plugin install) | plugin install | `fetch` to Paperclip API at `http://localhost:${port}/api/plugins` | Unverifiable without running server — code path is correct and unblocked | ? HUMAN |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `extractEventType` and `evaluateRoutingRules` — 10 test cases | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/webhook-routing.test.ts` | 10/10 tests pass (2ms) | ✓ PASS |
| Plugin build produces dist/worker.js | `pnpm --filter @claw/plugin-tool-nexus build` | Exit code 0; dist/worker.js produced (22KB) | ✓ PASS |
| dist/worker.js contains definePlugin entry point | `grep -c 'definePlugin' dist/worker.js` | 2 occurrences | ✓ PASS |
| dist/worker.js contains all 3 connector tool names | grep for hubspot/slack/sheets in dist/worker.js | All 7 tool names present | ✓ PASS |
| Build is reproducible (clean rebuild) | `pnpm --filter @claw/plugin-tool-nexus build` run a second time during re-verification | Exit code 0; fresh artifacts in dist/ with updated timestamps | ✓ PASS |
| Commits from Plan 03 exist in git history | `git log --oneline 8c10420 6af115c` | Both commits present and correctly labeled | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TOOL-01 | 09-01-PLAN.md | Tool Nexus connectors built as Paperclip plugins — each connector registers tools with the plugin tool dispatcher | ✓ SATISFIED (automated) / ? HUMAN (runtime) | Plugin TypeScript source complete; dist/worker.js produced (22KB); all 7 tools registered via `ctx.tools.register()` in worker.js (hubspot.ts, slack.ts, google-sheets.ts compiled in). Runtime loading into Paperclip requires human verification. |
| TOOL-06 | 09-01-PLAN.md | Starter connectors shipped — minimum 3 integrations (HubSpot, Slack, Google Sheets) as working Paperclip plugins | ✓ SATISFIED (code-level) / ? HUMAN (runtime) | 3 connectors compiled into worker.js: HubSpot (3 tools), Slack (2 tools), Google Sheets (2 tools). credential-bridge resolves OAuth tokens from tool_connections at runtime. Invocation-logger writes to tool_invocation_logs. End-to-end invocation requires human verification. |
| TOOL-07 | 09-02-PLAN.md | Webhook receiver — unique URL per user per tool, signature verification, incoming payloads routed to appropriate agent/objective | ✓ SATISFIED | extractEventType + evaluateRoutingRules exported; fire-and-forget routing queries webhook_routing_rules; dispatched/no_match logged to tool_invocation_logs; 200 response before routing evaluation; best-effort heartbeat on match; 10/10 unit tests pass. No regression. |

**Orphaned requirements check:** No REQUIREMENTS.md entries for this phase outside the three declared in plan frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | No TODO/FIXME/placeholder patterns in modified files | — | — |

The previously-blocking anti-pattern (tsconfig paths referencing non-existent .d.ts files) has been resolved. No new anti-patterns introduced by Plan 03.

### Human Verification Required

#### 1. Plugin Ready Status on Server Start

**Test:** Start akasa-server with Paperclip running. After server logs "Tool Nexus plugin installed successfully", hit `GET http://localhost:PORT/api/plugins`
**Expected:** Response contains `{ pluginKey: 'akasa.tool-nexus', status: 'ready' }` and lists all 7 tools
**Why human:** Requires running Paperclip server with plugin loader active in `local_trusted` mode; cannot verify from static file analysis

#### 2. Plugin Install Idempotency at Runtime

**Test:** Start akasa-server twice in succession against a running Paperclip instance
**Expected:** First start: logs "Tool Nexus plugin installed successfully". Second start: logs "Tool Nexus plugin already ready" — no duplicate install attempt, no error
**Why human:** Requires two successive server starts against a live Paperclip instance

#### 3. Agent Tool Discovery via Plugin Dispatcher

**Test:** Invoke `toolDispatcher.listToolsForAgent(agentId)` from an authenticated agent session after plugin loads
**Expected:** HubSpot, Slack, and Google Sheets tool actions are listed with their parameter schemas
**Why human:** Requires live agent session connected to Paperclip runtime

#### 4. End-to-End Tool Invocation (TOOL-06 runtime verification)

**Test:** Connect HubSpot via OAuth in Tool Belt UI, spawn an agent, have it invoke `hubspot.create_contact`
**Expected:** Tool executes, credential-bridge retrieves token from tool_connections, HubSpot API call succeeds, result returned to agent, invocation logged to tool_invocation_logs
**Why human:** Requires live OAuth credentials and running infrastructure

### Gaps Summary

**All three gaps from the previous verification are now closed by Plan 03.**

Root cause fix: The tsconfig paths block was corrected to reference existing `.ts` source files instead of non-existent `.d.ts` declaration files. Additionally, the build toolchain was switched from `tsc` (which enforces `rootDir` across all program-graph files, making cross-package `.ts` path resolution impossible) to `esbuild` (which bundles correctly, externalizing workspace packages for runtime resolution). This follows the Paperclip plugin SDK's own example plugin pattern.

**What changed (Plan 03, commits 8c10420 and 6af115c):**
- `packages/plugins/akasa-tool-nexus/tsconfig.json` — paths corrected to `.ts` source files; `noEmit: true` added (tsc is now typecheck-only)
- `packages/plugins/akasa-tool-nexus/esbuild.config.mjs` — new file; bundles worker.ts and manifest.ts to dist/; externalizes @claw/* and paperclip packages
- `packages/plugins/akasa-tool-nexus/package.json` — build script changed to `node esbuild.config.mjs`; `typecheck` script added; `esbuild ^0.27.3` added to devDependencies

**Remaining items are runtime-only human checks** — no code gaps remain. The accessSync guard in `ensureToolNexusPlugin()` will now pass on every startup, allowing the plugin install flow to proceed.

---

_Verified: 2026-03-30T11:40:00Z_
_Verifier: Claude (gsd-verifier)_
