---
phase: 20-spawn-timeout-error-preservation
verified: 2026-02-23T01:32:41Z
status: passed
score: 3/3 must-haves verified
re_verification: false
---

# Phase 20: Spawn Timeout Error Preservation Verification Report

**Phase Goal:** Bots that time out during spawn show as 'failed' with a human-readable error message in the UI — not silently overwritten to 'stopped'
**Verified:** 2026-02-23T01:32:41Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A bot that times out during spawn has status 'failed' and a non-null errorMessage in the DB after the timeout fires | VERIFIED | `startSpawnTimeoutChecker()` writes `status: 'failed'` and `errorMessage: 'Spawn timeout — VM did not call /ready within ${timeoutMinutes}m...'` (lines 381-387 of bot-orchestrator.ts) before calling `stopBot()`. The `stopBot()` call passes `{ skipDbUpdate: true }` so those values are not overwritten. |
| 2 | stopBot() called from the spawn-timeout path does NOT overwrite the failed status or errorMessage | VERIFIED | `stopBot()` signature accepts `options?: { skipDbUpdate?: boolean }` (line 188). Guard `if (!options?.skipDbUpdate)` (line 216) wraps the entire `db.update(bots).set({ status: 'stopped', ... })` call. The spawn-timeout call site passes `{ skipDbUpdate: true }` (line 390). All other callers — `startIdleChecker()` (line 318), `executions.ts` (line 658), `billing-engine.ts` (line 231), `guardrail-watchdog.ts` (line 63) — pass no third argument, so `skipDbUpdate` is `undefined` (falsy) and the DB write proceeds as before. |
| 3 | The bot card in the UI displays the human-readable timeout error message for a timed-out bot | VERIFIED | Full data pipeline confirmed: (a) DB schema `bots.errorMessage: text('error_message')` exists and is nullable (packages/db/src/schema/bots.ts line 41). (b) `/executions/:executionId/bots` route selects `errorMessage: bots.errorMessage` from the DB and includes it in the response schema (bots.ts lines 46, 71). (c) `ExecutionBot` type defines `errorMessage: string | null` (ui/src/lib/types.ts line 142). (d) The Svelte page renders `{#if bot.status === 'failed' && bot.errorMessage}<div class="bot-error-msg">{bot.errorMessage}</div>{/if}` (page.svelte lines 238-240), with dedicated `.bot-error-msg` CSS styling (lines 484-498). |

**Score:** 3/3 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `services/execution-service/src/orchestrator/bot-orchestrator.ts` | stopBot() with skipDbUpdate option + spawn-timeout call site fix | VERIFIED | File exists, 469 lines. Contains `options?: { skipDbUpdate?: boolean }` parameter on `stopBot()` (line 188), guard `if (!options?.skipDbUpdate)` (line 216), and `stopBot(entry.botId, 'failed', { skipDbUpdate: true })` at the spawn-timeout call site (line 390). |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `startSpawnTimeoutChecker()` | `stopBot()` | third argument `{ skipDbUpdate: true }` | WIRED | Line 390: `await stopBot(entry.botId, 'failed', { skipDbUpdate: true })` — exact pattern specified in PLAN frontmatter present verbatim. The comment on line 389 also documents intent: "skip DB update so the 'failed' status + errorMessage above are preserved". |
| DB `bots.errorMessage` | Svelte bot card | `getExecutionBots()` API route selecting `errorMessage` | WIRED | bots.ts selects `errorMessage: bots.errorMessage` (line 71), includes it in response schema (line 46). UI api.ts calls `/executions/{id}/bots`. page.svelte renders it conditionally at lines 238-240. |

---

### Requirements Coverage

No REQUIREMENTS.md entries mapped to this phase. The phase is scoped to closing gap BOT-04 as identified in the prior verification cycle.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | None found |

Scanned `bot-orchestrator.ts` for TODO/FIXME, placeholder returns, stub handlers. No anti-patterns present. All cleanup actions (disconnect, terminateVM, unregisterBot, publishBotStopped) remain unconditional as designed — only the DB write is conditionally skipped.

---

### TypeScript Compilation

`services/execution-service/node_modules/.bin/tsc --noEmit -p services/execution-service/tsconfig.json` exits 0 with zero errors. The optional third parameter on `stopBot()` is type-safe; all four other call sites (`startIdleChecker`, `executions.ts`, `billing-engine.ts`, `guardrail-watchdog.ts`) pass only two arguments and are unaffected.

---

### Human Verification Required

One item cannot be verified programmatically:

**1. End-to-end spawn timeout display**

**Test:** Trigger an actual spawn timeout (or mock SPAWN_TIMEOUT_MS=0 in a dev environment) and observe the bot card in the execution UI.
**Expected:** Bot card shows `status: failed` pill + red border styling + the error message text "Spawn timeout — VM did not call /ready within Xm. The startup script may have failed silently or the VM may not have booted." rendered inside the `.bot-error-msg` div.
**Why human:** The data pipeline is fully wired and verified in code, but confirming the rendered output requires a browser with a real (or simulated) timed-out bot.

---

### Summary

All three observable truths are fully verified at all three levels (exists, substantive, wired):

1. The spawn-timeout path in `startSpawnTimeoutChecker()` writes `status: 'failed'` and a human-readable `errorMessage` to the DB before calling `stopBot()`.
2. The new `skipDbUpdate: true` option on `stopBot()` prevents that write from being overwritten — the guard is correctly placed and all other callers are unaffected.
3. The full data chain from DB column to UI render is wired: the API route selects and returns `errorMessage`, the TypeScript type includes it, and the Svelte bot card conditionally renders it with dedicated error styling.

TypeScript compiles with zero errors. No anti-patterns, stubs, or orphaned artifacts were found.

---

_Verified: 2026-02-23T01:32:41Z_
_Verifier: Claude (gsd-verifier)_
