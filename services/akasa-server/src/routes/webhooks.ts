import { Router, type Request, type Response, type NextFunction } from 'express';
import { createHash } from 'node:crypto';
import { db, toolConnections, toolInvocationLogs, webhookRoutingRules } from '@claw/db';
import { eq, and } from 'drizzle-orm';
import { verifyHubSpotSignature, verifySlackSignature } from '../services/webhook-verifier.js';

// ─── Routing rule helpers ─────────────────────────────────────────────────────

/**
 * Extract provider-specific event type from webhook payload.
 * HubSpot sends an array of subscription events; Slack sends a top-level type.
 */
export function extractEventType(toolId: string, payload: Record<string, unknown>): string {
  if (toolId === 'hubspot') {
    const events = payload['events'] as Array<{ subscriptionType?: string }> | undefined;
    return events?.[0]?.subscriptionType ?? 'unknown';
  }
  if (toolId === 'slack') {
    const event = payload['event'] as { type?: string } | undefined;
    return event?.type ?? (payload['type'] as string | undefined) ?? 'unknown';
  }
  return (payload['type'] as string | undefined) ?? 'unknown';
}

/**
 * Find the first routing rule that matches the given event type.
 * Supports exact match and wildcard ('*').
 */
export function evaluateRoutingRules(
  rules: Array<{ eventType: string; assignToAgentId: string | null; id: string }>,
  eventType: string,
): { eventType: string; assignToAgentId: string | null; id: string } | null {
  return rules.find((rule) => rule.eventType === eventType || rule.eventType === '*') ?? null;
}

// ─── Token derivation ─────────────────────────────────────────────────────────

/**
 * Deterministically derive a webhook URL token from a connectionId.
 * Uses SHA-256 HMAC with WEBHOOK_URL_SECRET so the token is stable across
 * restarts and never needs to be persisted.
 */
function deriveWebhookToken(connectionId: string): string {
  const webhookSecret = process.env['WEBHOOK_URL_SECRET']!;
  return createHash('sha256').update(connectionId + webhookSecret).digest('hex');
}

// ─── Router Factory ───────────────────────────────────────────────────────────

/**
 * Express router factory for webhook receiver endpoints.
 * Mount at /akasa/webhooks.
 */
export function webhooksRouter(): Router {
  const router = Router();

  // ── POST /generate-url — generate a unique webhook URL for a tool connection ─
  router.post(
    '/generate-url',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { connectionId } = req.body as { connectionId?: string };
        if (!connectionId) {
          res.status(400).json({ error: 'connectionId is required' });
          return;
        }

        // Look up the connection to validate it exists
        const rows = await db
          .select()
          .from(toolConnections)
          .where(eq(toolConnections.id, connectionId))
          .limit(1);

        const connection = rows[0];
        if (!connection) {
          res.status(404).json({ error: 'Connection not found' });
          return;
        }

        // Derive a deterministic token from connectionId + server secret
        const token = deriveWebhookToken(connectionId);
        const webhookUrl = `/api/akasa/webhooks/${connection.toolId}/${token}`;

        res.json({ webhookUrl, token, toolId: connection.toolId });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── POST /:toolId/:token — receive an incoming webhook ────────────────────────
  //
  // Uses express.raw() as route-level middleware to capture the raw body
  // as a Buffer for signature verification before JSON parsing.
  router.post(
    '/:toolId/:token',
    // Capture raw body for HMAC verification
    (req: Request, res: Response, next: NextFunction) => {
      // If body has already been parsed (non-buffer), skip raw capture
      if (Buffer.isBuffer(req.body)) {
        next();
        return;
      }
      // Parse as raw buffer for this route
      import('express').then(({ default: express }) => {
        express.raw({ type: '*/*' })(req, res, next);
      }).catch(next);
    },
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { toolId, token } = req.params as { toolId: string; token: string };

        // Resolve raw body to string for verification
        const rawBodyBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
        const rawBody = rawBodyBuffer.toString('utf8');

        // ── Validate token: find the connection whose derived token matches ─────
        // We fetch all connections for this toolId and check each derived token.
        // Using HMAC-derived tokens avoids storing tokens in the DB.
        const connections = await db
          .select()
          .from(toolConnections)
          .where(eq(toolConnections.toolId, toolId));

        let matchedConnection: typeof connections[0] | undefined;
        for (const conn of connections) {
          if (deriveWebhookToken(conn.id) === token) {
            matchedConnection = conn;
            break;
          }
        }

        if (!matchedConnection) {
          res.status(401).json({ error: 'Invalid webhook token' });
          return;
        }

        const userId = matchedConnection.userId;
        const connectionId = matchedConnection.id;

        // ── Signature verification ────────────────────────────────────────────
        let signatureValid = true;
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

        if (toolId === 'hubspot') {
          const signature = req.get('X-HubSpot-Signature-v3') ?? '';
          const timestamp = req.get('X-HubSpot-Request-Timestamp') ?? '';
          const clientSecret = process.env['HUBSPOT_CLIENT_SECRET'] ?? '';

          signatureValid = verifyHubSpotSignature({
            rawBody,
            signature,
            timestamp,
            clientSecret,
            requestMethod: req.method,
            requestUrl: fullUrl,
          });
        } else if (toolId === 'slack') {
          const signature = req.get('X-Slack-Signature') ?? '';
          const timestamp = req.get('X-Slack-Request-Timestamp') ?? '';
          const signingSecret = process.env['SLACK_SIGNING_SECRET'] ?? '';

          signatureValid = verifySlackSignature({
            rawBody,
            signature,
            timestamp,
            signingSecret,
          });
        } else {
          // Unknown tool — skip signature verification but log a warning
          console.warn(
            `[webhooks] No signature verification implemented for tool "${toolId}" — accepting payload`,
          );
        }

        if (!signatureValid) {
          res.status(401).json({ error: 'Invalid webhook signature' });
          return;
        }

        // ── Log the webhook receipt to tool_invocation_logs ───────────────────
        await db.insert(toolInvocationLogs).values({
          toolId,
          action: `webhook:${toolId}`,
          userId,
          connectionId,
          success: true,
          requestSummary: rawBody.slice(0, 500),
        });

        console.log(`[webhooks] Received ${toolId} webhook for user ${userId}`);

        // ── Handle Slack URL verification challenge ───────────────────────────
        if (toolId === 'slack' && rawBody.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(rawBody) as { type?: string; challenge?: string };
            if (parsed.type === 'url_verification' && parsed.challenge) {
              res.json({ challenge: parsed.challenge });
              return;
            }
          } catch {
            // Not JSON — continue to normal 200 response
          }
        }

        // Return 200 immediately — routing evaluation is fire-and-forget
        res.json({ received: true });

        // ── Routing rule evaluation (fire-and-forget) ─────────────────────────
        let parsedPayload: Record<string, unknown> = {};
        try { parsedPayload = JSON.parse(rawBody) as Record<string, unknown>; } catch { /* not JSON */ }

        const eventType = extractEventType(toolId, parsedPayload);

        void (async () => {
          try {
            const rules = await db
              .select()
              .from(webhookRoutingRules)
              .where(
                and(
                  eq(webhookRoutingRules.userId, userId),
                  eq(webhookRoutingRules.toolId, toolId),
                  eq(webhookRoutingRules.isActive, true),
                ),
              );

            const matchedRule = evaluateRoutingRules(rules, eventType);

            if (!matchedRule) {
              await db.insert(toolInvocationLogs).values({
                toolId,
                action: `webhook:${toolId}:no_match`,
                userId,
                connectionId,
                success: true,
                requestSummary: `no_match event_type=${eventType}`.slice(0, 500),
              });
              console.log(`[webhooks] No routing rule matched for ${toolId} event_type=${eventType}`);
              return;
            }

            // Log dispatch decision
            await db.insert(toolInvocationLogs).values({
              toolId,
              action: `webhook:${toolId}:dispatched`,
              agentId: matchedRule.assignToAgentId,
              userId,
              connectionId,
              success: true,
              requestSummary: `dispatched to agentId=${matchedRule.assignToAgentId} event_type=${eventType} ruleId=${matchedRule.id}`.slice(0, 500),
            });

            console.log(`[webhooks] Dispatched ${toolId} event_type=${eventType} to agent ${matchedRule.assignToAgentId}`);

            // Best-effort agent notification via Paperclip wakeup API
            if (matchedRule.assignToAgentId) {
              const port = Number(process.env['PORT'] ?? '3100');
              const wakeupRes = await fetch(
                `http://localhost:${port}/api/agents/${matchedRule.assignToAgentId}/wakeup`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    source: 'webhook',
                    triggerDetail: `webhook:${toolId}:event_type=${eventType}`,
                    payload: parsedPayload,
                  }),
                },
              );
              if (!wakeupRes.ok) {
                console.warn(`[webhooks] Agent wakeup notification failed: ${wakeupRes.status}`);
              }
            }
          } catch (err) {
            console.error('[webhooks] Routing evaluation error:', (err as Error).message);
          }
        })();
      } catch (err) {
        next(err);
      }
    },
  );

  // ── POST /:toolId/simulate — dry-run webhook routing rule evaluation ───────────
  router.post(
    '/:toolId/simulate',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { toolId } = req.params as { toolId: string };
        const { userId, eventType, payload } = req.body as {
          userId?: string;
          eventType?: string;
          payload?: Record<string, unknown>;
        };

        if (!userId || !eventType) {
          res.status(400).json({ error: 'userId and eventType are required' });
          return;
        }

        const rules = await db
          .select()
          .from(webhookRoutingRules)
          .where(
            and(
              eq(webhookRoutingRules.userId, userId),
              eq(webhookRoutingRules.toolId, toolId),
              eq(webhookRoutingRules.isActive, true),
            ),
          );

        const resolvedEventType = eventType ?? extractEventType(toolId, payload ?? {});
        const matchedRule = evaluateRoutingRules(rules, resolvedEventType);

        const allRules = rules.map((r) => ({
          id: r.id,
          eventType: r.eventType,
          condition: r.condition,
          assignToAgentId: r.assignToAgentId,
          isMatch: matchedRule?.id === r.id,
        }));

        res.json({
          eventType: resolvedEventType,
          matchedRuleId: matchedRule?.id ?? null,
          assignToAgentId: matchedRule?.assignToAgentId ?? null,
          rules: allRules,
          dryRun: true,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
