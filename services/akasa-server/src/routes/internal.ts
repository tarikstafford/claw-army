import { Router, type Request, type Response, type NextFunction } from 'express';
import { eq, and } from 'drizzle-orm';
import { db, companyMemberships, toolConnections, toolInvocationLogs } from '@claw/db';
import {
  getValidToken,
  refreshHubSpotToken,
  refreshSlackToken,
  refreshGoogleToken,
  type RefreshFn,
} from '../services/token-manager.js';
import { fleetEventBus, type FleetEventPayload } from '../services/fleet-event-bus.js';

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

  // ─── Endpoint 1: Translate companyId → BetterAuth userId ─────────
  // Used by Tool Nexus plugin worker to resolve credential ownership
  // No auth required — localhost-only in local_trusted mode
  router.get('/user-by-company/:companyId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { companyId } = req.params as { companyId: string };
      const rows = await db
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

  // ─── Endpoint 3: Log tool invocation from plugin worker ─────────────────────
  // Used by Tool Nexus plugin worker — replaces @claw/db import in invocation-logger
  // Fire-and-forget from caller side; errors are logged but don't affect tool execution
  router.post('/log-invocation', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as {
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
      };

      const MAX_SUMMARY_LENGTH = 500;
      await db.insert(toolInvocationLogs).values({
        toolId: body.toolId,
        action: body.action,
        agentId: body.agentId,
        userId: body.userId,
        connectionId: body.connectionId,
        latencyMs: body.latencyMs,
        success: body.success,
        errorMessage: body.errorMessage,
        requestSummary: body.requestSummary
          ? body.requestSummary.slice(0, MAX_SUMMARY_LENGTH)
          : undefined,
        responseSummary: body.responseSummary
          ? body.responseSummary.slice(0, MAX_SUMMARY_LENGTH)
          : undefined,
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // ─── Endpoint 4: Receive fleet events from execution-service God Layer worker ─────
  // Used by God Layer worker in execution-service to emit fleet events via WS
  // No auth required — localhost-only in local_trusted mode
  router.post('/fleet-event', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as FleetEventPayload & { companyId?: string };

      if (!body.type || !body.description) {
        res.status(400).json({ error: 'type and description are required' });
        return;
      }

      const event = {
        id: `fleet-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type: body.type,
        botId: body.botId,
        executionId: body.executionId,
        soulId: body.soulId,
        taskCategory: body.taskCategory,
        verdictType: body.verdictType,
        fromClass: body.fromClass,
        toClass: body.toClass,
        transitionType: body.transitionType,
        compositeScore: body.compositeScore,
        isPioneer: body.isPioneer,
        description: body.description,
        timestamp: new Date().toISOString(),
      };

      fleetEventBus.emitFleetEvent(event);

      console.log('[internal] Fleet event emitted:', event.type, event.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
