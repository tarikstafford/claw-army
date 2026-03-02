import type { RingLeaderEvent } from '@claw/event-schemas';
import { publishRingLeaderEvent } from '../events/publisher';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CoordinationLogEntry {
  type: RingLeaderEvent['type'];
  timestamp: string;
  payload: RingLeaderEvent;
}

// ─── In-memory event log ───────────────────────────────────────────────────────

/**
 * Module-level coordination event log keyed by ringLeaderRunId.
 * Each value is an ordered array of events that occurred during the run.
 */
const coordinationLog = new Map<string, CoordinationLogEntry[]>();

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Append a Ring Leader event to the in-memory log, publish it via the event
 * infrastructure, and log it to stdout with a [coordination] prefix.
 *
 * @param runId       - ringLeaderRunId that this event belongs to
 * @param executionId - executionId for log context (not stored separately)
 * @param event       - The full typed RingLeaderEvent to record
 */
export async function logCoordinationEvent(
  runId: string,
  executionId: string,
  event: RingLeaderEvent,
): Promise<void> {
  const entry: CoordinationLogEntry = {
    type: event.type,
    timestamp: new Date().toISOString(),
    payload: event,
  };

  // Append to in-memory log
  const existing = coordinationLog.get(runId) ?? [];
  existing.push(entry);
  coordinationLog.set(runId, existing);

  // Publish via event infrastructure (non-fatal — publisher swallows errors internally)
  await publishRingLeaderEvent(event);

  console.info(
    `[coordination] runId=${runId} executionId=${executionId} event=${event.type}`,
  );
}

/**
 * Return all coordination events recorded for a given run.
 * Returns an empty array if no events have been logged yet.
 *
 * @param runId - ringLeaderRunId
 */
export function getCoordinationLog(runId: string): CoordinationLogEntry[] {
  return coordinationLog.get(runId) ?? [];
}

/**
 * Remove the coordination event log for a completed run to prevent memory leaks.
 * Should be called from stopCoordinationLoop after a run terminates.
 *
 * @param runId - ringLeaderRunId
 */
export function clearCoordinationLog(runId: string): void {
  coordinationLog.delete(runId);
  console.info(`[coordination] Log cleared for runId=${runId}`);
}
