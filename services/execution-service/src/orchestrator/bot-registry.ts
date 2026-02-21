import type { OpenClawClient } from './openclaw-client';

/**
 * Represents an active bot VM tracked in the registry.
 * This is the runtime state — not the Postgres bot row.
 *
 * Replaces the Docker-based BotEntry (containerId + container) with
 * GCE-based fields (instanceName + internalIp + openclawClient).
 */
export interface BotEntry {
  botId: string;
  executionId: string;
  instanceName: string;          // GCE instance name (e.g. bot-abc12345-1700000000000)
  internalIp: string | null;     // VPC-internal IP — null until VM startup completes
  gatewayToken: string | null;   // OpenClaw Gateway auth token — null until /ready callback
  openclawClient: OpenClawClient | null; // WebSocket client — null until /ready callback
  currentJobId: string | null;   // BullMQ job ID being processed; null = idle
  startedAt: number;             // Date.now() — epoch ms when VM was provisioned
  lastTaskClaimedAt: number;     // Date.now() — reset when bot (or sibling) claims a task
}

/**
 * In-memory registry of active bot VMs.
 * Keyed by botId (UUID). Single source of truth for which bots are running in this process.
 *
 * NOTE: This is process-local state. If the execution-service restarts, the registry is lost.
 * Bot VMs continue running but won't appear here until re-registered. The Postgres bots
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

/**
 * Find an idle bot for the given execution that has an active OpenClaw connection.
 * Marks it as claimed (sets currentJobId) atomically (JS single-threaded = safe).
 * Returns null if no idle bots are available.
 */
export function acquireIdleBot(executionId: string, jobId: string): BotEntry | null {
  for (const entry of botRegistry.values()) {
    if (
      entry.executionId === executionId &&
      entry.openclawClient?.isConnected &&
      entry.currentJobId === null
    ) {
      entry.currentJobId = jobId;
      return entry;
    }
  }
  return null;
}

/**
 * Release a bot back to idle state after a task completes or fails.
 */
export function releaseBot(botId: string): void {
  const entry = botRegistry.get(botId);
  if (entry) {
    entry.currentJobId = null;
  }
}
