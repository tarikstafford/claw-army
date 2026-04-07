import { db, toolConnections } from '@claw/db';
import { eq } from 'drizzle-orm';
import { encryptCredential, decryptCredential } from './credential-encryption.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RefreshResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export type RefreshFn = (refreshToken: string) => Promise<RefreshResult>;

// ─── Constants ────────────────────────────────────────────────────────────────

/** Refresh proactively when token expires within this many milliseconds */
const PROACTIVE_REFRESH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// ─── Core function ───────────────────────────────────────────────────────────

/**
 * Returns a valid (non-expired) decrypted token for a connection.
 *
 * - For api_key connections: decrypts and returns the API key immediately.
 * - For oauth connections: checks tokenExpiresAt — if null or >5 min away, returns
 *   current access token. If within 5 minutes of expiry (or already expired), calls
 *   refreshFn to get a new token, re-encrypts, and updates the DB row.
 * - If refreshFn throws, sets connection status to 'expired' and re-throws.
 */
export async function getValidToken(connectionId: string, refreshFn: RefreshFn): Promise<string> {
  // Load connection row
  const rows = await db
    .select()
    .from(toolConnections)
    .where(eq(toolConnections.id, connectionId))
    .limit(1);

  const connection = rows[0];
  if (!connection) {
    throw new Error(`Tool connection not found: ${connectionId}`);
  }

  // ── API key connections: no expiry concept ──────────────────────────────────
  if (connection.connectionType === 'api_key') {
    if (!connection.encryptedApiKey || !connection.apiKeyIv || !connection.apiKeyTag) {
      throw new Error(`API key credential is not stored for connection ${connectionId}`);
    }
    return decryptCredential({
      ciphertext: connection.encryptedApiKey,
      iv: connection.apiKeyIv,
      tag: connection.apiKeyTag,
    });
  }

  // ── OAuth connections ───────────────────────────────────────────────────────
  if (!connection.encryptedAccessToken || !connection.tokenIv || !connection.tokenTag) {
    throw new Error(`Access token is not stored for connection ${connectionId}`);
  }

  const now = Date.now();
  const expiresAt = connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt).getTime() : null;

  // Token is fresh — return without refreshing
  const needsRefresh = expiresAt === null ? false : (expiresAt - now) < PROACTIVE_REFRESH_WINDOW_MS;

  if (!needsRefresh) {
    return decryptCredential({
      ciphertext: connection.encryptedAccessToken,
      iv: connection.tokenIv,
      tag: connection.tokenTag,
    });
  }

  // ── Needs refresh ───────────────────────────────────────────────────────────
  if (!connection.encryptedRefreshToken || !connection.refreshIv || !connection.refreshTag) {
    throw new Error(`Refresh token is not stored for connection ${connectionId}`);
  }

  const refreshToken = decryptCredential({
    ciphertext: connection.encryptedRefreshToken,
    iv: connection.refreshIv,
    tag: connection.refreshTag,
  });

  try {
    const result = await refreshFn(refreshToken);

    // Re-encrypt the new access token
    const encAccess = encryptCredential(result.accessToken);

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      encryptedAccessToken: encAccess.ciphertext,
      tokenIv: encAccess.iv,
      tokenTag: encAccess.tag,
      keyVersion: encAccess.keyVersion,
      status: 'connected',
      updatedAt: new Date(),
    };

    if (result.expiresAt) {
      updatePayload['tokenExpiresAt'] = result.expiresAt;
    }

    if (result.refreshToken) {
      const encRefresh = encryptCredential(result.refreshToken);
      updatePayload['encryptedRefreshToken'] = encRefresh.ciphertext;
      updatePayload['refreshIv'] = encRefresh.iv;
      updatePayload['refreshTag'] = encRefresh.tag;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db
      .update(toolConnections)
      .set(updatePayload as any)
      .where(eq(toolConnections.id, connectionId))
      .returning();

    return result.accessToken;
  } catch (err) {
    // Mark connection as expired on refresh failure — fire-and-forget style but we await
    await db
      .update(toolConnections)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(toolConnections.id, connectionId))
      .returning();

    throw err;
  }
}

// ─── Provider-specific refresh factories ─────────────────────────────────────

/**
 * Returns a refreshFn for HubSpot OAuth tokens.
 * Reads HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET from env.
 */
export function refreshHubSpotToken(
  clientId?: string,
  clientSecret?: string,
): RefreshFn {
  const id = clientId ?? process.env['HUBSPOT_CLIENT_ID'] ?? '';
  const secret = clientSecret ?? process.env['HUBSPOT_CLIENT_SECRET'] ?? '';

  return async (refreshToken: string): Promise<RefreshResult> => {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: id,
      client_secret: secret,
      refresh_token: refreshToken,
    });

    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`HubSpot token refresh failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  };
}

/**
 * Returns a refreshFn for Google OAuth tokens.
 * Reads GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from env.
 */
export function refreshGoogleToken(
  clientId?: string,
  clientSecret?: string,
): RefreshFn {
  const id = clientId ?? process.env['GOOGLE_CLIENT_ID'] ?? '';
  const secret = clientSecret ?? process.env['GOOGLE_CLIENT_SECRET'] ?? '';

  return async (refreshToken: string): Promise<RefreshResult> => {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: id,
      client_secret: secret,
      refresh_token: refreshToken,
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Google token refresh failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      access_token: string;
      expires_in?: number;
    };

    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  };
}

/**
 * Returns a refreshFn for Slack OAuth tokens.
 * Reads SLACK_CLIENT_ID and SLACK_CLIENT_SECRET from env.
 */
export function refreshSlackToken(
  clientId?: string,
  clientSecret?: string,
): RefreshFn {
  const id = clientId ?? process.env['SLACK_CLIENT_ID'] ?? '';
  const secret = clientSecret ?? process.env['SLACK_CLIENT_SECRET'] ?? '';

  return async (refreshToken: string): Promise<RefreshResult> => {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: id,
      client_secret: secret,
      refresh_token: refreshToken,
    });

    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Slack token refresh failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      access_token?: string;
      authed_user?: { access_token?: string; refresh_token?: string };
      refresh_token?: string;
      expires_in?: number;
      ok: boolean;
      error?: string;
    };

    if (!data.ok) {
      throw new Error(`Slack token refresh error: ${data.error ?? 'unknown'}`);
    }

    const accessToken = data.access_token ?? data.authed_user?.access_token ?? '';

    return {
      accessToken,
      refreshToken: data.refresh_token ?? data.authed_user?.refresh_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  };
}

/**
 * Returns a refreshFn for GitHub OAuth tokens.
 * GitHub OAuth tokens don't expire by default, so this is a no-op that returns
 * the current access token as-is. The token is re-encrypted (triggers key rotation check).
 * Reads GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET from env.
 */
export function refreshGitHubToken(
  clientId?: string,
  clientSecret?: string,
): RefreshFn {
  const id = clientId ?? process.env['GITHUB_CLIENT_ID'] ?? '';
  const secret = clientSecret ?? process.env['GITHUB_CLIENT_SECRET'] ?? '';

  return async (accessToken: string): Promise<RefreshResult> => {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: id,
      client_secret: secret,
      refresh_token: accessToken,
    });

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`GitHub token refresh failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  };
}
