import { Router, type Request, type Response, type NextFunction } from 'express';
import { db, toolConnections } from '@claw/db';
import { eq, and } from 'drizzle-orm';
import { encryptCredential } from '../services/credential-encryption.js';
import { getOAuthProvider } from '../services/oauth-providers.js';

// ─── Router Factory ───────────────────────────────────────────────────────────

/**
 * Express router factory for OAuth authorization code flow.
 * Mount at /akasa/tool-connections (alongside toolConnectionsRouter).
 *
 * Routes:
 *   GET /oauth/:toolId/start    — redirect user to provider authorization page
 *   GET /oauth/:toolId/callback — exchange code for tokens, persist connection
 */
export function oauthFlowRouter(): Router {
  const router = Router();

  // ── GET /oauth/:toolId/start ─────────────────────────────────────────────────
  router.get('/oauth/:toolId/start', (req: Request, res: Response) => {
    const { toolId } = req.params;
    const userId = req.query['userId'] as string | undefined;
    const redirectUri = (req.query['redirectUri'] as string | undefined)
      ?? `${process.env['AKASA_BASE_URL'] ?? 'http://localhost:5173'}/tools/callback`;

    if (!userId) {
      res.status(400).json({ error: 'userId query parameter is required' });
      return;
    }

    const provider = getOAuthProvider(toolId ?? '');
    if (!provider) {
      res.status(404).json({ error: `Unknown OAuth provider: ${toolId}` });
      return;
    }

    const clientId = process.env[provider.clientIdEnv];
    if (!clientId) {
      res.status(500).json({ error: `OAuth not configured for ${toolId}` });
      return;
    }

    // Encode context in the state parameter (browser callback will POST it back)
    const statePayload = JSON.stringify({ userId, toolId, redirectUri });
    const state = Buffer.from(statePayload).toString('base64url');

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: provider.scopes.join(' '),
      state,
    });

    // Append any provider-specific extra params
    if (provider.extraAuthorizeParams) {
      for (const [key, value] of Object.entries(provider.extraAuthorizeParams)) {
        params.set(key, value);
      }
    }

    const authUrl = `${provider.authorizeUrl}?${params.toString()}`;
    res.redirect(302, authUrl);
  });

  // ── GET /oauth/:toolId/callback ──────────────────────────────────────────────
  router.get('/oauth/:toolId/callback', async (req: Request, res: Response, next: NextFunction) => {
    const { toolId: routeToolId } = req.params;
    const code = req.query['code'] as string | undefined;
    const stateParam = req.query['state'] as string | undefined;

    const baseUrl = process.env['AKASA_BASE_URL'] ?? 'http://localhost:5173';

    if (!code) {
      res.status(400).json({ error: 'code query parameter is required' });
      return;
    }

    // Decode state
    let userId: string;
    let toolId: string;
    let redirectUri: string;
    try {
      const decoded = Buffer.from(stateParam ?? '', 'base64url').toString('utf8');
      const parsed = JSON.parse(decoded) as { userId: string; toolId: string; redirectUri: string };
      userId = parsed.userId;
      toolId = parsed.toolId;
      redirectUri = parsed.redirectUri;
    } catch {
      res.status(400).json({ error: 'Invalid state parameter' });
      return;
    }

    // Prefer state's toolId (state is source of truth), but fallback to route param
    const resolvedToolId = toolId || routeToolId || '';

    const provider = getOAuthProvider(resolvedToolId);
    if (!provider) {
      res.status(404).json({ error: `Unknown OAuth provider: ${resolvedToolId}` });
      return;
    }

    const clientId = process.env[provider.clientIdEnv];
    const clientSecret = process.env[provider.clientSecretEnv];
    if (!clientId || !clientSecret) {
      res.status(500).json({ error: `OAuth not configured for ${resolvedToolId}` });
      return;
    }

    try {
      // Exchange authorization code for tokens
      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      });

      const tokenResponse = await fetch(provider.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString(),
      });

      const data = await tokenResponse.json() as Record<string, unknown>;

      // Parse tokens (provider-specific)
      let accessToken: string;
      let refreshToken: string | undefined;
      let expiresIn: number | undefined;

      if (resolvedToolId === 'slack') {
        // Slack wraps the token in data.ok
        if (!data['ok']) {
          throw new Error(`Slack token exchange failed: ${data['error'] ?? 'unknown'}`);
        }
        const slackAccess = (data['access_token'] as string | undefined)
          ?? ((data['authed_user'] as Record<string, unknown> | undefined)?.['access_token'] as string | undefined);
        if (!slackAccess) {
          throw new Error('Slack did not return an access token');
        }
        accessToken = slackAccess;
        // Slack tokens don't expire by default (no expires_in)
      } else {
        // HubSpot / Google standard OAuth response
        if (!data['access_token']) {
          throw new Error(`Token exchange failed for ${resolvedToolId}`);
        }
        accessToken = data['access_token'] as string;
        refreshToken = data['refresh_token'] as string | undefined;
        expiresIn = data['expires_in'] as number | undefined;
      }

      // Encrypt access token
      const encAccess = encryptCredential(accessToken);

      // Build insert payload
      const insert: typeof toolConnections.$inferInsert = {
        userId,
        toolId: resolvedToolId,
        connectionType: 'oauth',
        status: 'connected',
        encryptedAccessToken: encAccess.ciphertext,
        tokenIv: encAccess.iv,
        tokenTag: encAccess.tag,
        keyVersion: encAccess.keyVersion,
        scopes: provider.scopes.join(' '),
        displayLabel: `OAuth: ${resolvedToolId}`,
      };

      if (refreshToken) {
        const encRefresh = encryptCredential(refreshToken);
        insert.encryptedRefreshToken = encRefresh.ciphertext;
        insert.refreshIv = encRefresh.iv;
        insert.refreshTag = encRefresh.tag;
      }

      if (expiresIn != null) {
        insert.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
      }

      // Upsert: try insert first, fall back to update on unique constraint violation
      try {
        await db.insert(toolConnections).values(insert).returning();
      } catch (insertErr) {
        const msg = (insertErr as Error).message ?? '';
        if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('UNIQUE')) {
          // Update existing connection
          await db
            .update(toolConnections)
            .set({
              status: 'connected',
              encryptedAccessToken: insert.encryptedAccessToken,
              tokenIv: insert.tokenIv,
              tokenTag: insert.tokenTag,
              keyVersion: insert.keyVersion,
              encryptedRefreshToken: insert.encryptedRefreshToken ?? null,
              refreshIv: insert.refreshIv ?? null,
              refreshTag: insert.refreshTag ?? null,
              tokenExpiresAt: insert.tokenExpiresAt ?? null,
              scopes: insert.scopes ?? null,
              updatedAt: new Date(),
            })
            .where(and(
              eq(toolConnections.userId, userId),
              eq(toolConnections.toolId, resolvedToolId),
            ))
            .returning();
        } else {
          throw insertErr;
        }
      }

      // Redirect to success page
      res.redirect(302, `${baseUrl}/tools?connected=${resolvedToolId}`);
    } catch (err) {
      // On error, redirect to failure page rather than crashing
      console.error('[oauth-flow] Token exchange or persistence failed:', {
        toolId: resolvedToolId,
        error: (err as Error).message,
      });
      res.redirect(302, `${baseUrl}/tools?error=oauth_failed&tool=${resolvedToolId}`);
      next(err);
    }
  });

  return router;
}
