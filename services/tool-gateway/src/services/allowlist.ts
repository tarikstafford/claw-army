import { db, executions } from '@claw/db';
import { eq } from 'drizzle-orm';

export type AllowlistResult =
  | { allowed: true }
  | { allowed: false; allowedTools: string[] };

/**
 * Check if a tool is in the execution's allowed_tools list.
 *
 * @param executionId - UUID of the execution
 * @param toolName - Name of the tool being requested
 * @returns { allowed: true } if allowed, or { allowed: false, allowedTools } if not
 */
export async function checkAllowlist(
  executionId: string,
  toolName: string,
): Promise<AllowlistResult> {
  const rows = await db
    .select({ allowedTools: executions.allowedTools })
    .from(executions)
    .where(eq(executions.id, executionId));

  const row = rows[0];
  if (!row) {
    // Execution not found — treat as not allowed
    return { allowed: false, allowedTools: [] };
  }

  const allowedTools = row.allowedTools;

  if (allowedTools.includes(toolName)) {
    return { allowed: true };
  }

  return { allowed: false, allowedTools };
}
