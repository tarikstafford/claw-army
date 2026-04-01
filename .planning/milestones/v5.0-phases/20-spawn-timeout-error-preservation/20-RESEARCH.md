# Phase 20: Spawn Timeout Error Preservation - Research

**Researched:** 2026-02-23
**Domain:** TypeScript backend — in-process bot lifecycle state management
**Confidence:** HIGH

## Summary

Phase 20 is a narrow, surgical bug fix with a single root cause: `stopBot()` unconditionally writes `status: 'stopped'` to the DB, overwriting the `status: 'failed'` and `errorMessage` that `startSpawnTimeoutChecker()` writes immediately before calling `stopBot()`. The result is that timed-out bots land in the DB as `stopped` (no error) instead of `failed` (with error message), making the failure invisible in the UI.

The fix is the pre-specced `skipDbUpdate` option on `stopBot()`. The spawn-timeout path calls `stopBot({ skipDbUpdate: true })` to terminate the VM and clean up the registry without touching the DB row — leaving the `failed` status and `errorMessage` that were already written intact.

The UI (`+page.svelte`) already renders `bot.errorMessage` for `bot.status === 'failed'` bots. No frontend changes are required. The `errorMessage` column (`text`, nullable) and `status: 'failed'` enum variant already exist in the DB schema. No migrations are required.

**Primary recommendation:** Add `options?: { skipDbUpdate?: boolean }` to `stopBot()` and call it with `{ skipDbUpdate: true }` from `startSpawnTimeoutChecker()` after writing the failed state.

---

## Standard Stack

### Core (already in use — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | existing | Postgres ORM for bot row updates | Already the project ORM |
| @claw/db | workspace | `bots` table schema + `db` client | Shared internal package |
| Node.js built-in `setInterval` | built-in | Spawn timeout checker interval | No external dep needed |

### Supporting
No new packages are required for this phase.

**Installation:**
```bash
# No new packages
```

---

## Architecture Patterns

### Current spawn-timeout flow (the bug)

```
startSpawnTimeoutChecker() interval fires
  │
  ├─ entry.openclawClient === null && entry.internalIp === null (still spawning)
  ├─ now - entry.startedAt > SPAWN_TIMEOUT_MS
  │
  ├─ [STEP 1] db.update(bots).set({ status: 'failed', errorMessage: '...', updatedAt })
  │            ← CORRECT: bot is now failed in DB
  │
  └─ [STEP 2] await stopBot(entry.botId, 'failed')
               └─ stopBot() calls db.update(bots).set({ status: 'stopped', stoppedAt, updatedAt })
                  ← BUG: overwrites 'failed' → 'stopped', errorMessage survives but status is wrong
```

### Fixed spawn-timeout flow (after this phase)

```
startSpawnTimeoutChecker() interval fires
  │
  ├─ [STEP 1] db.update(bots).set({ status: 'failed', errorMessage: '...', updatedAt })
  │            ← CORRECT: bot is failed in DB
  │
  └─ [STEP 2] await stopBot(entry.botId, 'failed', { skipDbUpdate: true })
               ├─ disconnects openclawClient (if any)
               ├─ fires terminateBotVM() (fire-and-forget)
               ├─ unregisterBot(botId)
               ├─ publishBotStopped(...)
               └─ SKIPS db.update (skipDbUpdate: true)
                  ← FIX: DB row stays failed with errorMessage intact
```

### Pattern: optional parameter guard for conditional DB write

```typescript
// Source: codebase pattern — existing stopBot signature
export async function stopBot(
  botId: string,
  reason: 'completed' | 'terminated' | 'failed' | 'idle_timeout',
  options?: { skipDbUpdate?: boolean },  // ADD THIS
): Promise<void> {
  const botEntry = getBot(botId);
  if (!botEntry) {
    console.warn('[bot-orchestrator] stopBot called for unknown botId:', botId);
    return;
  }

  if (botEntry.openclawClient) {
    botEntry.openclawClient.disconnect();
  }

  terminateBotVM({ ... }).catch(...);

  // MODIFIED: Only write DB if not skipped
  if (!options?.skipDbUpdate) {
    await db
      .update(bots)
      .set({ status: 'stopped', stoppedAt: new Date(), updatedAt: new Date() })
      .where(eq(bots.id, botId));
  }

  unregisterBot(botId);

  await publishBotStopped({ ... });
}
```

### Call site change in startSpawnTimeoutChecker()

```typescript
// BEFORE
await stopBot(entry.botId, 'failed');

// AFTER
await stopBot(entry.botId, 'failed', { skipDbUpdate: true });
```

### Anti-Patterns to Avoid

- **Status-last writes:** Writing the terminal status AFTER calling `stopBot()` would still race with `stopBot()`'s DB write. The correct order is: write failed state first, then call `stopBot({ skipDbUpdate: true })`.
- **Two-phase update within stopBot:** Conditionally setting `status: 'failed'` inside `stopBot()` via the `reason` param would bloat `stopBot()` with caller-specific logic. The cleaner design keeps `stopBot()` as a cleanup utility and lets the caller own failure state.
- **Deleting errorMessage in stopBot:** The current `stopBot()` only sets `status` and `stoppedAt`, not `errorMessage`. Even without `skipDbUpdate`, `errorMessage` would survive the overwrite — but status is the problem. This must not be changed (do not add `errorMessage: null` to the stopBot update set).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Race condition guard | A separate mutex or lock on bot state | `skipDbUpdate: true` option | The interval is single-threaded in Node.js event loop; no concurrent write race exists here |
| Status machine validation | A full state machine library | Existing if-guards in `stopBot` | Overkill for a two-state guard |

**Key insight:** Node.js `setInterval` callbacks are serialized on the event loop — there is no concurrent execution of two `startSpawnTimeoutChecker` intervals. The only write-ordering problem is within a single interval iteration, which the `skipDbUpdate` option solves cleanly.

---

## Common Pitfalls

### Pitfall 1: stoppedAt not written for timed-out bots

**What goes wrong:** The current `stopBot()` writes `stoppedAt` as part of the DB update. If `skipDbUpdate: true`, `stoppedAt` is also skipped. A timed-out bot would have `stoppedAt: null` in the DB.

**Why it happens:** `stoppedAt` is bundled into the same `db.update()` call as `status: 'stopped'`.

**How to avoid:** Two options — (a) accept that `stoppedAt` is null for failed bots (reasonable, since `stoppedAt` semantically belongs to graceful stops), or (b) write `stoppedAt` in the spawn-timeout path before calling `stopBot`. Option (a) is simpler and consistent with the existing failure paths (GCE launch failure at line 115-123 does not set `stoppedAt` either).

**Recommendation:** Accept `stoppedAt: null` for timed-out bots. The `errorMessage` and `status: 'failed'` are the important fields. If `stoppedAt` matters, set it explicitly in the timeout path alongside the failed state write.

### Pitfall 2: publishBotStopped still fires with reason='failed'

**What goes wrong:** Even with `skipDbUpdate: true`, `stopBot()` still calls `publishBotStopped` with `reason: 'failed'`. This is correct behavior — the VM is being stopped — but verifying this is intentional.

**Why it happens:** Pub/Sub event publish is not gated by `skipDbUpdate`.

**How to avoid:** No action needed. Firing the stop event is correct: the VM is being terminated. The `reason: 'failed'` correctly conveys why.

### Pitfall 3: unregisterBot not called if stopBot is bypassed

**What goes wrong:** If the spawn-timeout path skips calling `stopBot()` entirely (wrong approach), `unregisterBot()` would not be called, and the bot would remain in the in-memory registry forever, causing the spawn-timeout checker to re-fire on the same bot every interval.

**Why it happens:** `unregisterBot()` lives inside `stopBot()`.

**How to avoid:** Always call `stopBot()` from the spawn-timeout path — just with `{ skipDbUpdate: true }`. Do NOT skip the `stopBot()` call.

### Pitfall 4: Other callers of stopBot unintentionally affected

**What goes wrong:** Changing the `stopBot()` signature could affect `startIdleChecker()`, the openclaw-dispatcher, or other callers.

**Why it happens:** `stopBot()` is a shared utility.

**How to avoid:** The `options` parameter is optional with a default of `undefined` (falsy), so `options?.skipDbUpdate` evaluates to `false` for all existing callers. No changes needed at other call sites. Verify: `stopBot(entry.botId, 'idle_timeout')` in `startIdleChecker()` — no third arg, so `skipDbUpdate` is undefined = false = DB write proceeds as normal.

---

## Code Examples

### Full modified stopBot signature and guard

```typescript
// Source: services/execution-service/src/orchestrator/bot-orchestrator.ts (lines 181-227)
export async function stopBot(
  botId: string,
  reason: 'completed' | 'terminated' | 'failed' | 'idle_timeout',
  options?: { skipDbUpdate?: boolean },
): Promise<void> {
  const botEntry = getBot(botId);

  if (!botEntry) {
    console.warn('[bot-orchestrator] stopBot called for unknown botId:', botId);
    return;
  }

  // Disconnect OpenClaw WebSocket client if connected
  if (botEntry.openclawClient) {
    botEntry.openclawClient.disconnect();
  }

  // Fire-and-forget GCE instance deletion (deletion is eventual, ~30-60s)
  terminateBotVM({
    projectId: GCP_PROJECT_ID,
    zone: GCP_ZONE,
    instanceName: botEntry.instanceName,
  }).catch((err: Error) => {
    console.error('[bot-orchestrator] Error terminating VM (non-fatal):', {
      botId,
      instanceName: botEntry.instanceName,
      error: err.message,
    });
  });

  // Update bot row in Postgres — skip if caller has already written terminal state
  if (!options?.skipDbUpdate) {
    await db
      .update(bots)
      .set({ status: 'stopped', stoppedAt: new Date(), updatedAt: new Date() })
      .where(eq(bots.id, botId));
  }

  // Remove from in-memory registry
  unregisterBot(botId);

  // Publish bot_stopped event
  await publishBotStopped({
    type: 'bot_stopped',
    botId,
    executionId: botEntry.executionId,
    timestamp: new Date().toISOString(),
    reason,
  });
}
```

### Modified call site in startSpawnTimeoutChecker()

```typescript
// Source: services/execution-service/src/orchestrator/bot-orchestrator.ts (lines 382-384)
// BEFORE:
await stopBot(entry.botId, 'failed');

// AFTER:
await stopBot(entry.botId, 'failed', { skipDbUpdate: true });
```

### UI rendering (already correct — no changes needed)

```svelte
<!-- Source: services/ui/src/routes/executions/[id]/+page.svelte (lines 238-240) -->
{#if bot.status === 'failed' && bot.errorMessage}
  <div class="bot-error-msg">{bot.errorMessage}</div>
{/if}
```

### DB schema (already supports this — no migration needed)

```typescript
// Source: packages/db/src/schema/bots.ts (lines 41-42)
errorMessage: text('error_message'),           // nullable text — already exists
// botStatusEnum includes 'failed' — already exists
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| Write `failed` state then unconditionally call `stopBot()` (overwrites to `stopped`) | Write `failed` state then call `stopBot({ skipDbUpdate: true })` (preserves `failed`) | Bot card shows error message in UI |

---

## Open Questions

1. **Should stoppedAt be written for timed-out bots?**
   - What we know: Current timeout path does not write `stoppedAt`; current GCE launch failure path also does not write `stoppedAt`
   - What's unclear: Whether any query or UI feature depends on `stoppedAt` being non-null for failed bots
   - Recommendation: Leave `stoppedAt` null for failed bots (consistent with other failure paths). If needed, write it explicitly in the timeout path as part of the `status: 'failed'` update.

2. **Should publishBotStopped be suppressed for spawn-timeout path?**
   - What we know: `stopBot()` always publishes `bot_stopped` with `reason: 'failed'`
   - What's unclear: Whether the activity feed or other consumers interpret `bot_stopped reason=failed` differently from the `failed` DB status
   - Recommendation: Keep publishing — the VM is actually being stopped. The event accurately reflects infrastructure state.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read: `services/execution-service/src/orchestrator/bot-orchestrator.ts` — full `stopBot()` and `startSpawnTimeoutChecker()` implementation
- Direct codebase read: `services/ui/src/routes/executions/[id]/+page.svelte` — bot card error rendering (lines 238-240)
- Direct codebase read: `packages/db/src/schema/bots.ts` — `errorMessage` column and `botStatusEnum` confirmed
- Direct codebase read: `services/ui/src/lib/types.ts` — `ExecutionBot.errorMessage: string | null` confirmed

### Secondary
- Phase description and prior decisions in additional_context — informs pre-specced fix approach

---

## Metadata

**Confidence breakdown:**
- Bug root cause: HIGH — directly observed in code: `stopBot()` unconditionally writes `status: 'stopped'` at line 213
- Fix approach (skipDbUpdate option): HIGH — pre-specced in phase plan, straightforward TypeScript optional parameter
- UI impact: HIGH — UI already renders `bot.errorMessage` for `failed` bots; no changes needed
- DB schema impact: HIGH — `errorMessage` column and `failed` enum variant exist; no migration needed
- Pitfalls: HIGH — all derived from direct code reading

**Research date:** 2026-02-23
**Valid until:** 2026-03-25 (stable internal codebase — low churn expected)
