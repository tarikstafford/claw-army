// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResolvedCredential {
  token: string;
  connectionId: string;
}

// ─── Akasa server port for internal HTTP calls ───────────────────────────────

let _akasaPort = '3100';

export function setAkasaPort(port: string): void {
  _akasaPort = port;
}

/** Returns the current akasa-server port. Used by other services in this package. */
export function _akasaPortRef(): string {
  return _akasaPort;
}

// ─── Company → User ID resolution via HTTP ──────────────────────────────────

async function resolveUserId(companyId: string): Promise<string> {
  const resp = await fetch(
    `http://localhost:${_akasaPort}/api/akasa/internal/user-by-company/${companyId}`
  );
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ error: 'unknown' })) as { error?: string };
    throw new Error(
      `Failed to resolve userId for company ${companyId}: ${resp.status} ${body.error ?? ''}`
    );
  }
  const data = await resp.json() as { userId: string };
  return data.userId;
}

// ─── Tool credential resolution via HTTP ─────────────────────────────────────

async function fetchToolCredential(userId: string, toolId: string): Promise<ResolvedCredential> {
  const resp = await fetch(
    `http://localhost:${_akasaPort}/api/akasa/internal/tool-credential/${userId}/${toolId}`
  );
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ error: 'unknown' })) as { error?: string };
    throw new Error(
      `Failed to resolve credential for ${toolId} (user ${userId}): ${resp.status} ${body.error ?? ''}`
    );
  }
  const data = await resp.json() as { token: string; connectionId: string };
  return { token: data.token, connectionId: data.connectionId };
}

// ─── Credential resolution ────────────────────────────────────────────────────

/**
 * Resolves a valid access token for the given tool and Paperclip company.
 *
 * Two-step HTTP resolution (plugin worker has no DB access):
 * 1. Calls akasa-server GET /akasa/internal/user-by-company/:companyId → { userId }
 * 2. Calls akasa-server GET /akasa/internal/tool-credential/:userId/:toolId → { token, connectionId }
 *
 * @param toolId - Tool identifier, e.g. 'hubspot', 'slack', 'google-sheets'
 * @param companyId - Paperclip company UUID from ToolRunContext.companyId
 * @returns The decrypted, valid access token and the connection ID (for audit logging)
 */
export async function resolveCredential(toolId: string, companyId: string): Promise<ResolvedCredential> {
  const userId = await resolveUserId(companyId);
  return fetchToolCredential(userId, toolId);
}
