import { Router, type Request, type Response, type NextFunction } from 'express';
import { eq, and } from 'drizzle-orm';
import { createDb, companyMemberships } from '@paperclipai/db';
import { db } from '@claw/db';
import { toolConnections } from '@claw/db';
import {
  getValidToken,
  refreshHubSpotToken,
  refreshSlackToken,
  refreshGoogleToken,
  type RefreshFn,
} from '../services/token-manager.js';

// ─── Lazy Paperclip DB singleton ─────────────────────────────────────────────

let _pcDb: ReturnType<typeof createDb> | null = null;
function getPaperclipDb() {
  if (!_pcDb) _pcDb = createDb(process.env['DATABASE_URL']!);
  return _pcDb;
}

// ─── Refresh function selection ──────────────────────────────────────────────

function getRefreshFn(toolId: string): RefreshFn {
  switch (toolId) {
    case 'hubspot':
      return refreshHubSpotToken();
    case 'slack':
      return refreshSlackToken();
    case 'google-sheets':
      return refreshGoogleToken();
    default:
      return async (_refreshToken: string) => {
        throw new Error(`No token refresh configured for tool: ${toolId}`);
      };
  }
}

// ─── Router Factory ───────────────────────────────────────────────────────────

/**
 * Express router factory for internal cross-service lookup endpoints.
 * Mount at /akasa/internal.
 *
 * WARNING: No auth — relies on local_trusted mode (localhost-only access).
 * These endpoints must NOT be exposed on a public interface without auth middleware.
 */
export function internalRouter(): Router {
  const router = Router();

  // ─── Endpoint 1: Translate Paperclip companyId → BetterAuth userId ─────────
  // Used by Tool Nexus plugin worker to resolve credential ownership
  // No auth required — localhost-only in local_trusted mode
  router.get('/user-by-company/:companyId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { companyId } = req.params as { companyId: string };
      const pcDb = getPaperclipDb();
      const rows = await pcDb
        .select({ userId: companyMemberships.principalId })
        .from(companyMemberships)
        .where(
          and(
            eq(companyMemberships.companyId, companyId),
            eq(companyMemberships.principalType, 'user'),
            eq(companyMemberships.status, 'active'),
          )
        )
        .limit(1);

      const userId = rows[0]?.userId;
      if (!userId) {
        res.status(404).json({ error: `No user found for company ${companyId}` });
        return;
      }
      res.json({ userId });
    } catch (err) {
      next(err);
    }
  });

  // ─── Endpoint 2: Resolve valid tool credential for userId + toolId ─────────
  // Used by Tool Nexus plugin worker — replaces @claw/db import in credential-bridge
  // Handles token refresh transparently; returns ready-to-use access token
  router.get('/tool-credential/:userId/:toolId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, toolId } = req.params as { userId: string; toolId: string };

      const rows = await db
        .select()
        .from(toolConnections)
        .where(and(eq(toolConnections.userId, userId), eq(toolConnections.toolId, toolId)))
        .limit(1);

      const connection = rows[0];
      if (!connection) {
        res.status(404).json({ error: `No ${toolId} connection for user ${userId}` });
        return;
      }

      if (connection.status !== 'connected') {
        res.status(410).json({ error: `${toolId} connection is not active (status: ${connection.status})` });
        return;
      }

      const refreshFn = getRefreshFn(toolId);
      const token = await getValidToken(connection.id, refreshFn);

      res.json({ token, connectionId: connection.id });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
