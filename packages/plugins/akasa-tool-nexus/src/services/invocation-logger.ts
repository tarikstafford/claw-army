import { db, toolInvocationLogs } from '@claw/db';

const MAX_SUMMARY_LENGTH = 500;

export interface InvocationData {
  toolId: string;
  action: string;
  agentId: string | null;
  userId: string;
  connectionId: string;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
  requestSummary?: string;
  responseSummary?: string;
}

/**
 * Logs a tool invocation to the tool_invocation_logs table.
 * Fire-and-forget: errors are caught and logged but never re-thrown.
 */
export async function logInvocation(data: InvocationData): Promise<void> {
  try {
    await db.insert(toolInvocationLogs).values({
      toolId: data.toolId,
      action: data.action,
      agentId: data.agentId,
      userId: data.userId,
      connectionId: data.connectionId,
      latencyMs: data.latencyMs,
      success: data.success,
      errorMessage: data.errorMessage,
      requestSummary: data.requestSummary
        ? data.requestSummary.slice(0, MAX_SUMMARY_LENGTH)
        : undefined,
      responseSummary: data.responseSummary
        ? data.responseSummary.slice(0, MAX_SUMMARY_LENGTH)
        : undefined,
    });
  } catch (err) {
    console.error('[invocation-logger] Failed to log tool invocation:', {
      toolId: data.toolId,
      action: data.action,
      error: (err as Error).message,
    });
  }
}
