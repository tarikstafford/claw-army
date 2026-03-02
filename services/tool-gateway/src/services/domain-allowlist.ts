import { db, executions } from '@claw/db';
import { eq } from 'drizzle-orm';

/**
 * In-memory TTL cache for per-execution allowed domains.
 * allowedDomains is set at execution creation and never changes,
 * so 60s TTL is a safety net, not a freshness requirement.
 */
const cache = new Map<string, { domains: string[] | null; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

/**
 * Look up the per-execution allowedDomains from the executions table.
 * Returns string[] if the execution has specific domains, null if not set.
 * Caller should fall back to global allowlist when null is returned.
 */
export async function getExecutionAllowedDomains(
  executionId: string,
): Promise<string[] | null> {
  const now = Date.now();
  const cached = cache.get(executionId);
  if (cached && cached.expiresAt > now) {
    return cached.domains;
  }

  const rows = await db
    .select({ allowedDomains: executions.allowedDomains })
    .from(executions)
    .where(eq(executions.id, executionId));

  const domains = rows[0]?.allowedDomains ?? null;
  cache.set(executionId, { domains, expiresAt: now + CACHE_TTL_MS });
  return domains;
}
