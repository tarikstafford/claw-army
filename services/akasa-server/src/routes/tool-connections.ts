import { Router, type Request, type Response, type NextFunction } from 'express';
import { db, toolConnections, toolInvocationLogs } from '@claw/db';
import { eq, and, desc } from 'drizzle-orm';
import { encryptCredential, decryptCredential } from '../services/credential-encryption.js';

// ─── Types ────────────────────────────────────────────────────────────────────

type ConnectionStatus = 'connected' | 'expired' | 'rate_limited' | 'errored' | 'disconnected';

interface CreateConnectionBody {
  userId: string;
  toolId: string;
  connectionType: 'oauth' | 'api_key';
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  displayLabel?: string;
  tokenExpiresAt?: string;
  scopes?: string;
}

interface RefreshTokenBody {
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a connection record with all encrypted fields removed,
 * safe for returning to clients.
 */
function stripEncryptedFields(row: typeof toolConnections.$inferSelect) {
  const {
    encryptedAccessToken: _eat,
    encryptedRefreshToken: _ert,
    encryptedApiKey: _eak,
    tokenIv: _tiv,
    tokenTag: _ttag,
    refreshIv: _riv,
    refreshTag: _rtag,
    apiKeyIv: _akiv,
    apiKeyTag: _aktag,
    ...safe
  } = row;
  return safe;
}

// ─── Router Factory ───────────────────────────────────────────────────────────

/**
 * Express router factory for tool connection CRUD.
 * Mount at /akasa/tool-connections.
 */
export function toolConnectionsRouter(): Router {
  const router = Router();

  // ── GET / — list all connections for a user ──────────────────────────────────
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.query['userId'] as string | undefined;
      if (!userId) {
        res.status(400).json({ error: 'userId query parameter is required' });
        return;
      }

      const rows = await db
        .select()
        .from(toolConnections)
        .where(eq(toolConnections.userId, userId))
        .orderBy(desc(toolConnections.createdAt));

      res.json(rows.map(stripEncryptedFields));
    } catch (err) {
      next(err);
    }
  });

  // ── POST / — create a new connection ─────────────────────────────────────────
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CreateConnectionBody;

      if (!body.userId || !body.toolId || !body.connectionType) {
        res.status(400).json({ error: 'userId, toolId, and connectionType are required' });
        return;
      }

      if (!['oauth', 'api_key'].includes(body.connectionType)) {
        res.status(400).json({ error: 'connectionType must be "oauth" or "api_key"' });
        return;
      }

      // Build insert payload
      const insert: typeof toolConnections.$inferInsert = {
        userId: body.userId,
        toolId: body.toolId,
        connectionType: body.connectionType,
        status: 'connected' as ConnectionStatus,
        displayLabel: body.displayLabel ?? null,
        scopes: body.scopes ?? null,
      };

      if (body.connectionType === 'oauth') {
        if (!body.accessToken) {
          res.status(400).json({ error: 'accessToken is required for OAuth connections' });
          return;
        }
        const encAccess = encryptCredential(body.accessToken);
        insert.encryptedAccessToken = encAccess.ciphertext;
        insert.tokenIv = encAccess.iv;
        insert.tokenTag = encAccess.tag;
        insert.keyVersion = encAccess.keyVersion;

        if (body.refreshToken) {
          const encRefresh = encryptCredential(body.refreshToken);
          insert.encryptedRefreshToken = encRefresh.ciphertext;
          insert.refreshIv = encRefresh.iv;
          insert.refreshTag = encRefresh.tag;
        }

        if (body.tokenExpiresAt) {
          insert.tokenExpiresAt = new Date(body.tokenExpiresAt);
        }
      } else {
        // api_key
        if (!body.apiKey) {
          res.status(400).json({ error: 'apiKey is required for API key connections' });
          return;
        }
        const encKey = encryptCredential(body.apiKey);
        insert.encryptedApiKey = encKey.ciphertext;
        insert.apiKeyIv = encKey.iv;
        insert.apiKeyTag = encKey.tag;
        insert.keyVersion = encKey.keyVersion;

        // Auto-generate masked display label if not provided
        if (!insert.displayLabel) {
          const masked =
            body.apiKey.length > 8
              ? `${body.apiKey.slice(0, 4)}...${body.apiKey.slice(-4)}`
              : `${body.apiKey.slice(0, 2)}...`;
          insert.displayLabel = masked;
        }
      }

      try {
        const rows = await db.insert(toolConnections).values(insert).returning();
        const created = rows[0];
        if (!created) {
          res.status(500).json({ error: 'Failed to create connection' });
          return;
        }
        res.status(201).json(stripEncryptedFields(created));
      } catch (insertErr) {
        // Unique constraint violation
        const msg = (insertErr as Error).message ?? '';
        if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('UNIQUE')) {
          res.status(409).json({ error: `Connection for tool "${body.toolId}" already exists for this user` });
          return;
        }
        throw insertErr;
      }
    } catch (err) {
      next(err);
    }
  });

  // ── DELETE /:id — remove a connection ────────────────────────────────────────
  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Connection ID is required' });
        return;
      }

      const deleted = await db
        .delete(toolConnections)
        .where(eq(toolConnections.id, id))
        .returning();

      if (deleted.length === 0) {
        res.status(404).json({ error: 'Connection not found' });
        return;
      }

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // ── PATCH /:id/refresh — update OAuth tokens after refresh ──────────────────
  router.patch('/:id/refresh', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Connection ID is required' });
        return;
      }

      const body = req.body as RefreshTokenBody;
      if (!body.accessToken) {
        res.status(400).json({ error: 'accessToken is required' });
        return;
      }

      // Re-encrypt new access token
      const encAccess = encryptCredential(body.accessToken);
      const updatePayload: Partial<typeof toolConnections.$inferInsert> & { status: string } = {
        encryptedAccessToken: encAccess.ciphertext,
        tokenIv: encAccess.iv,
        tokenTag: encAccess.tag,
        keyVersion: encAccess.keyVersion,
        status: 'connected',
        updatedAt: new Date(),
      };

      if (body.tokenExpiresAt) {
        updatePayload.tokenExpiresAt = new Date(body.tokenExpiresAt);
      }

      if (body.refreshToken) {
        const encRefresh = encryptCredential(body.refreshToken);
        updatePayload.encryptedRefreshToken = encRefresh.ciphertext;
        updatePayload.refreshIv = encRefresh.iv;
        updatePayload.refreshTag = encRefresh.tag;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updated = await db
        .update(toolConnections)
        .set(updatePayload as any)
        .where(eq(toolConnections.id, id))
        .returning();

      if (updated.length === 0) {
        res.status(404).json({ error: 'Connection not found' });
        return;
      }

      res.json(stripEncryptedFields(updated[0]!));
    } catch (err) {
      next(err);
    }
  });

  // ── POST /:id/test — test connection by verifying decryption ─────────────────
  router.post('/:id/test', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Connection ID is required' });
        return;
      }

      const rows = await db
        .select()
        .from(toolConnections)
        .where(eq(toolConnections.id, id))
        .limit(1);

      const connection = rows[0];
      if (!connection) {
        res.status(404).json({ error: 'Connection not found' });
        return;
      }

      try {
        // Test decryption based on connection type
        if (connection.connectionType === 'api_key') {
          if (!connection.encryptedApiKey || !connection.apiKeyIv || !connection.apiKeyTag) {
            throw new Error('API key credential is not stored');
          }
          decryptCredential({
            ciphertext: connection.encryptedApiKey,
            iv: connection.apiKeyIv,
            tag: connection.apiKeyTag,
          });
        } else {
          if (!connection.encryptedAccessToken || !connection.tokenIv || !connection.tokenTag) {
            throw new Error('Access token credential is not stored');
          }
          decryptCredential({
            ciphertext: connection.encryptedAccessToken,
            iv: connection.tokenIv,
            tag: connection.tokenTag,
          });
        }

        // Update lastUsedAt on success
        await db
          .update(toolConnections)
          .set({ lastUsedAt: new Date(), updatedAt: new Date() })
          .where(eq(toolConnections.id, id));

        res.json({ success: true, toolId: connection.toolId, connectionType: connection.connectionType });
      } catch (decryptErr) {
        // Update status to errored
        await db
          .update(toolConnections)
          .set({ status: 'errored', updatedAt: new Date() })
          .where(eq(toolConnections.id, id));

        res.json({ success: false, error: 'Credential decryption failed' });
      }
    } catch (err) {
      next(err);
    }
  });

  // ── GET /:id/logs — get invocation logs for a connection ─────────────────────
  router.get('/:id/logs', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Connection ID is required' });
        return;
      }

      const logs = await db
        .select()
        .from(toolInvocationLogs)
        .where(eq(toolInvocationLogs.connectionId, id))
        .orderBy(desc(toolInvocationLogs.createdAt))
        .limit(100);

      res.json(logs);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
