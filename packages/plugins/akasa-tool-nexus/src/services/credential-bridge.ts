import { db, toolConnections } from '@claw/db';
import { eq, and } from 'drizzle-orm';
import {
  getValidToken,
  refreshHubSpotToken,
  refreshSlackToken,
  refreshGoogleToken,
  type RefreshFn,
} from '@claw/akasa-server/services/token-manager';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResolvedCredential {
  token: string;
  connectionId: string;
}

// ─── Credential resolution ────────────────────────────────────────────────────

/**
 * Resolves a valid access token for the given tool and user from Akasa's
 * tool_connections table. Handles auto-refresh for OAuth tokens.
 *
 * This bridges the Paperclip plugin context to Akasa's credential store.
 * Do NOT use ctx.secrets.resolve() — Paperclip secrets is a separate store
 * that does not contain Akasa tool_connections data.
 *
 * @param toolId - Tool identifier, e.g. 'hubspot', 'slack', 'google-sheets'
 * @param userId - User ID whose connection to resolve
 * @returns The decrypted, valid access token and the connection ID (for audit logging)
 */
export async function resolveCredential(toolId: string, userId: string): Promise<ResolvedCredential> {
  const rows = await db
    .select()
    .from(toolConnections)
    .where(and(eq(toolConnections.userId, userId), eq(toolConnections.toolId, toolId)))
    .limit(1);

  const connection = rows[0];
  if (!connection) {
    throw new Error(
      `No connected ${toolId} account for user ${userId}. Connect via Tool Belt.`,
    );
  }

  if (connection.status !== 'connected') {
    throw new Error(
      `${toolId} connection is not active (status: ${connection.status}). Reconnect via Tool Belt.`,
    );
  }

  const refreshFn = getRefreshFn(toolId);
  const token = await getValidToken(connection.id, refreshFn);

  return { token, connectionId: connection.id };
}

// ─── Provider-specific refresh function selection ─────────────────────────────

function getRefreshFn(toolId: string): RefreshFn {
  switch (toolId) {
    case 'hubspot':
      return refreshHubSpotToken();
    case 'slack':
      return refreshSlackToken();
    case 'google-sheets':
      return refreshGoogleToken();
    default:
      // For API key connections, the refresh function is never called
      // (getValidToken handles api_key type without calling refreshFn)
      return async (_refreshToken: string) => {
        throw new Error(`No token refresh configured for tool: ${toolId}`);
      };
  }
}
