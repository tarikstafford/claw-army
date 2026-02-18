import type { Container } from 'dockerode';

/**
 * Represents an active bot container tracked in the registry.
 * This is the runtime state — not the Postgres bot row.
 */
export interface BotEntry {
  botId: string;
  executionId: string;
  containerId: string;
  container: Container;
  startedAt: number; // Date.now() — epoch ms when bot was spawned
  lastTaskClaimedAt: number; // Date.now() — reset when bot (or sibling) claims a task
}

/**
 * In-memory registry of active bot containers.
 * Keyed by botId (UUID). Single source of truth for which bots are running in this process.
 *
 * NOTE: This is process-local state. If the execution-service restarts, the registry is lost.
 * Active bots continue running but won't appear here until re-registered. The Postgres bots
 * table is the durable source of truth; the registry is for fast in-process lookups.
 */
export const botRegistry = new Map<string, BotEntry>();

/**
 * Register a new bot in the registry.
 */
export function registerBot(entry: BotEntry): void {
  botRegistry.set(entry.botId, entry);
}

/**
 * Remove a bot from the registry (called on stop/termination).
 */
export function unregisterBot(botId: string): void {
  botRegistry.delete(botId);
}

/**
 * Retrieve a single bot entry by botId.
 * Returns undefined if not found (bot may have stopped or never been registered).
 */
export function getBot(botId: string): BotEntry | undefined {
  return botRegistry.get(botId);
}

/**
 * Get all active bots belonging to a specific execution.
 * Used for:
 * - Updating lastTaskClaimedAt on all sibling bots when any task in the execution becomes active
 * - Stopping all bots when an execution terminates
 */
export function getBotsForExecution(executionId: string): BotEntry[] {
  return Array.from(botRegistry.values()).filter(
    (entry) => entry.executionId === executionId,
  );
}

/**
 * Count the number of active bots for a given execution.
 * Used by max_bots enforcement in spawnBotsForExecution.
 */
export function getActiveBotCount(executionId: string): number {
  return getBotsForExecution(executionId).length;
}
