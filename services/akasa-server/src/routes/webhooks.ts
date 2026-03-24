import { Router, type Request, type Response, type NextFunction } from 'express';
import { createHash } from 'node:crypto';
import { db, toolConnections, toolInvocationLogs } from '@claw/db';
import { eq } from 'drizzle-orm';
import { verifyHubSpotSignature, verifySlackSignature } from '../services/webhook-verifier.js';

// ─── Token derivation ─────────────────────────────────────────────────────────

/**
 * Deterministically derive a webhook URL token from a connectionId.
 * Uses SHA-256 HMAC with WEBHOOK_URL_SECRET so the token is stable across
 * restarts and never needs to be persisted.
 */
function deriveWebhookToken(connectionId: string): string {
  const webhookSecret = process.env['WEBHOOK_URL_SECRET'] ?? 'dev-webhook-secret';
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

        res.json({ received: true });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
