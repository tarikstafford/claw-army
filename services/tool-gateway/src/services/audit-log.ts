import { db, toolInvocations } from '@claw/db';

const MAX_SUMMARY_CHARS = 2000;

function truncateSummary(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  const str = JSON.stringify(value);
  if (str.length <= MAX_SUMMARY_CHARS) return value;
  return { _truncated: true, preview: str.slice(0, MAX_SUMMARY_CHARS) };
}

export interface AuditLogEntry {
  executionId: string;
  botId: string;
  toolName: string;
  invocationId: string;
  rejected: boolean;
  rejectionReason?: string;
  durationMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  requestSummary?: unknown;
  responseSummary?: unknown;
}

/**
 * Write an audit log entry to the tool_invocations table.
 * Failures are logged to console.error and do NOT crash the caller.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await db.insert(toolInvocations).values({
      executionId: entry.executionId,
      botId: entry.botId,
      toolName: entry.toolName,
      invocationId: entry.invocationId,
      rejected: entry.rejected,
      rejectionReason: entry.rejectionReason ?? null,
      durationMs: entry.durationMs ?? null,
      promptTokens: entry.promptTokens ?? null,
      completionTokens: entry.completionTokens ?? null,
      totalTokens: entry.totalTokens ?? null,
      requestSummary: entry.requestSummary !== undefined
        ? truncateSummary(entry.requestSummary)
        : null,
      responseSummary: entry.responseSummary !== undefined
        ? truncateSummary(entry.responseSummary)
        : null,
    });
  } catch (err) {
    console.error('[audit-log] Failed to write audit log entry:', err);
  }
}
