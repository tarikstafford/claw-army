import IORedis from 'ioredis';
import { db, toolInvocations } from '@claw/db';
import { eq, desc, and, sql } from 'drizzle-orm';
import { publishGuardrailTriggered } from './publisher';
import { stopBot } from '../orchestrator/bot-orchestrator';
import { botRegistry } from '../orchestrator/bot-registry';

// ──────────────────────────────────────────────────────────────────────────────
// Configuration constants (env-var configurable)
// ──────────────────────────────────────────────────────────────────────────────

/** Polling interval in milliseconds. Default: 10 seconds. */
const WATCHDOG_INTERVAL_MS = Number(process.env.WATCHDOG_INTERVAL_MS ?? 10_000);

/** Number of identical consecutive tool invocations that constitute a loop. Default: 5. */
const LOOP_DETECTION_WINDOW = Number(process.env.LOOP_DETECTION_WINDOW ?? 5);

/** TTL in seconds for the Redis deny-list key after a bot is revoked. Default: 1 hour. */
const GUARDRAIL_DENY_TTL_SECONDS = Number(process.env.GUARDRAIL_DENY_TTL_SECONDS ?? 3600);

/** Rate limit thresholds (mirroring tool-gateway/src/middleware/rate-limit.ts) */
const CALL_RATE_LIMIT = 60; // 60 calls per 60 seconds
const TOKEN_RATE_LIMIT = 100_000; // 100,000 tokens per 60 seconds

// ──────────────────────────────────────────────────────────────────────────────
// Redis client
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Dedicated Redis client for the Guardrail Watchdog.
 * Reads rate-limiter-flexible keys written by tool-gateway's rate-limiter.
 * Writes deny-list keys consumed by tool-gateway's /tool.invoke handler.
 * Uses default enableOfflineQueue: true (write-path should queue, not fail fast).
 */
const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379');

// ──────────────────────────────────────────────────────────────────────────────
// Core revocation function
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Revoke a bot by:
 * 1. Adding it to the Redis deny-list (blocks future tool invocations immediately)
 * 2. Stopping its container and updating Postgres
 * 3. Emitting a structured guardrail_triggered event to Pub/Sub
 *
 * Errors are caught and logged — the watchdog must survive individual revocation failures.
 *
 * @param botId - UUID of the bot to revoke
 * @param executionId - UUID of the execution this bot belongs to
 * @param reason - Why the bot is being revoked
 */
async function revokeBot(
  botId: string,
  executionId: string,
  reason: 'rate_limit' | 'loop_detected',
): Promise<void> {
  try {
    // 1. Set deny-list key with TTL — tool-gateway checks this before all enforcement
    await redis.setex(`guardrail:denied:${botId}`, GUARDRAIL_DENY_TTL_SECONDS, '1');

    // 2. Stop the container and update Postgres (reason: 'terminated')
    await stopBot(botId, 'terminated');

    // 3. Emit guardrail_triggered event to Pub/Sub
    await publishGuardrailTriggered({
      type: 'guardrail_triggered',
      botId,
      executionId,
      reason,
      action: 'revoked',
      timestamp: new Date().toISOString(),
    });

    console.log('[guardrail-watchdog] Bot revoked:', { botId, executionId, reason });
  } catch (err) {
    // Never throw — watchdog must survive individual revocation failures
    console.error('[guardrail-watchdog] Error revoking bot (non-fatal):', {
      botId,
      executionId,
      reason,
      error: (err as Error).message,
    });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Rate violation detection
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Check all active bots for rate limit violations.
 * Uses Postgres tool_invocations queries (not rate-limiter-flexible internal keys)
 * for reliability — the rate-limiter-flexible key format is an internal detail.
 *
 * A bot is flagged if in the last 60 seconds it has:
 * - Made >= 60 tool invocations (call rate limit), OR
 * - Consumed >= 100,000 tokens (token rate limit)
 *
 * Flagged bots that are not already in the deny-list are revoked.
 */
async function checkRateViolations(): Promise<void> {
  const cutoff = new Date(Date.now() - 60_000);

  for (const entry of botRegistry.values()) {
    const { botId, executionId } = entry;

    try {
      // Check if already denied (avoid duplicate revocations)
      const alreadyDenied = await redis.get(`guardrail:denied:${botId}`);
      if (alreadyDenied) continue;

      // Query: count of tool invocations in the last 60 seconds
      const [callRow] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(toolInvocations)
        .where(
          and(
            eq(toolInvocations.botId, botId),
            sql`${toolInvocations.invokedAt} > ${cutoff}`,
          ),
        );

      const callCount = callRow?.count ?? 0;
      if (callCount >= CALL_RATE_LIMIT) {
        console.log('[guardrail-watchdog] Call rate violation detected:', {
          botId,
          callCount,
          limit: CALL_RATE_LIMIT,
        });
        await revokeBot(botId, executionId, 'rate_limit');
        continue; // Skip token check — bot already revoked
      }

      // Query: total tokens consumed in the last 60 seconds
      const [tokenRow] = await db
        .select({ total: sql<number>`cast(coalesce(sum(${toolInvocations.totalTokens}), 0) as int)` })
        .from(toolInvocations)
        .where(
          and(
            eq(toolInvocations.botId, botId),
            sql`${toolInvocations.invokedAt} > ${cutoff}`,
          ),
        );

      const tokenTotal = tokenRow?.total ?? 0;
      if (tokenTotal >= TOKEN_RATE_LIMIT) {
        console.log('[guardrail-watchdog] Token rate violation detected:', {
          botId,
          tokenTotal,
          limit: TOKEN_RATE_LIMIT,
        });
        await revokeBot(botId, executionId, 'rate_limit');
      }
    } catch (err) {
      // Per-bot errors must not break the loop for other bots
      console.error('[guardrail-watchdog] Error checking rate violations for bot (non-fatal):', {
        botId,
        error: (err as Error).message,
      });
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Loop detection
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Check all active bots for loop behavior.
 * A loop is defined as N identical consecutive tool invocations (same toolName
 * and requestSummary fingerprint for every entry in the sliding window).
 *
 * Bots exhibiting loop behavior that are not already in the deny-list are revoked.
 */
async function checkLoopBehavior(): Promise<void> {
  for (const entry of botRegistry.values()) {
    const { botId, executionId } = entry;

    try {
      // Check if already denied
      const alreadyDenied = await redis.get(`guardrail:denied:${botId}`);
      if (alreadyDenied) continue;

      // Fetch the last LOOP_DETECTION_WINDOW invocations ordered by most recent first
      const recent = await db
        .select({
          toolName: toolInvocations.toolName,
          requestSummary: toolInvocations.requestSummary,
        })
        .from(toolInvocations)
        .where(eq(toolInvocations.botId, botId))
        .orderBy(desc(toolInvocations.invokedAt))
        .limit(LOOP_DETECTION_WINDOW);

      // Not enough data to detect a loop
      if (recent.length < LOOP_DETECTION_WINDOW) continue;

      // Create fingerprints for each invocation
      const fingerprints = recent.map((row) =>
        JSON.stringify({ toolName: row.toolName, args: row.requestSummary }),
      );

      // If ALL fingerprints are identical, it's a loop
      const firstFingerprint = fingerprints[0];
      const isLoop = fingerprints.every((fp) => fp === firstFingerprint);

      if (isLoop) {
        console.log('[guardrail-watchdog] Loop behavior detected:', {
          botId,
          executionId,
          windowSize: LOOP_DETECTION_WINDOW,
          fingerprint: firstFingerprint?.slice(0, 100),
        });
        await revokeBot(botId, executionId, 'loop_detected');
      }
    } catch (err) {
      // Per-bot errors must not break the loop for other bots
      console.error('[guardrail-watchdog] Error checking loop behavior for bot (non-fatal):', {
        botId,
        error: (err as Error).message,
      });
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Watchdog lifecycle
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Start the Guardrail Watchdog.
 * Polls every WATCHDOG_INTERVAL_MS (default: 10s) for:
 * - Rate violations: bots exceeding call/token rate limits (GARD-02, GARD-03)
 * - Loop behavior: bots making N identical consecutive tool invocations (GARD-04)
 *
 * Revoked bots are blocked at the Tool Gateway via a Redis deny-list.
 * Revocations emit structured guardrail_triggered events to Pub/Sub.
 *
 * @returns The interval timer handle (pass to stopGuardrailWatchdog to clear)
 */
export function startGuardrailWatchdog(): NodeJS.Timeout {
  console.log('[guardrail-watchdog] Starting with interval', WATCHDOG_INTERVAL_MS, 'ms');
  return setInterval(async () => {
    try {
      await checkRateViolations();
      await checkLoopBehavior();
    } catch (err) {
      // Top-level catch — individual check functions also catch, but guard here too
      console.error('[guardrail-watchdog] Polling error (non-fatal):', err);
    }
  }, WATCHDOG_INTERVAL_MS);
}

/**
 * Stop the Guardrail Watchdog and clear its polling interval.
 * @param timer - The timer handle returned by startGuardrailWatchdog
 */
export function stopGuardrailWatchdog(timer: NodeJS.Timeout): void {
  clearInterval(timer);
  console.log('[guardrail-watchdog] Stopped.');
}

// ──────────────────────────────────────────────────────────────────────────────
// Exported test helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Check if a single bot exhibits loop behavior.
 * Queries the last LOOP_DETECTION_WINDOW tool_invocations for the bot and returns
 * true if all entries have identical fingerprints (toolName + requestSummary).
 *
 * Exported for direct testing in Phase 4 E2E test — allows verifying loop detection
 * logic without running the full watchdog polling cycle.
 *
 * @param botId - UUID of the bot to check
 * @returns true if loop behavior is detected, false otherwise
 */
export async function checkLoopForBot(botId: string): Promise<boolean> {
  const recent = await db
    .select({
      toolName: toolInvocations.toolName,
      requestSummary: toolInvocations.requestSummary,
    })
    .from(toolInvocations)
    .where(eq(toolInvocations.botId, botId))
    .orderBy(desc(toolInvocations.invokedAt))
    .limit(LOOP_DETECTION_WINDOW);

  if (recent.length < LOOP_DETECTION_WINDOW) return false;

  const fingerprints = recent.map((row) =>
    JSON.stringify({ toolName: row.toolName, args: row.requestSummary }),
  );

  const firstFingerprint = fingerprints[0];
  return fingerprints.every((fp) => fp === firstFingerprint);
}
