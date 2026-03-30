import { _akasaPortRef } from './credential-bridge.js';

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
 * Logs a tool invocation to the tool_invocation_logs table via akasa-server internal HTTP.
 * Fire-and-forget: errors are caught and logged but never re-thrown.
 * Plugin worker has no DB access — routes all logging through akasa-server.
 */
export async function logInvocation(data: InvocationData): Promise<void> {
  try {
    const body = {
      ...data,
      requestSummary: data.requestSummary
        ? data.requestSummary.slice(0, MAX_SUMMARY_LENGTH)
        : undefined,
      responseSummary: data.responseSummary
        ? data.responseSummary.slice(0, MAX_SUMMARY_LENGTH)
        : undefined,
    };
    await fetch(`http://localhost:${_akasaPortRef()}/api/akasa/internal/log-invocation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error('[invocation-logger] Failed to log tool invocation:', {
      toolId: data.toolId,
      action: data.action,
      error: (err as Error).message,
    });
  }
}
