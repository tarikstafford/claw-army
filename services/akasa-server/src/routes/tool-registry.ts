import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  parseOpenApiSpec,
  importEndpoints,
  listToolRegistry,
  deleteSpec,
  toggleEndpoint,
} from '../services/openapi-import.js';

/**
 * Express router factory for OpenAPI/Swagger tool import and registry management.
 * Mount at /akasa/tool-registry.
 */
export function toolRegistryRouter(): Router {
  const router = Router();

  // ── POST /preview — parse spec and return discovered endpoints (no persistence) ──
  router.post('/preview', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { specUrl, specJson } = req.body as {
        specUrl?: string;
        specJson?: Record<string, unknown>;
      };

      if (!specUrl && !specJson) {
        res.status(400).json({ error: 'Provide either specUrl or specJson' });
        return;
      }

      const input = specUrl ?? specJson!;
      const parsed = await parseOpenApiSpec(input);
      res.json(parsed);
    } catch (err) {
      res.status(422).json({ error: `Failed to parse OpenAPI spec: ${(err as Error).message}` });
    }
  });

  // ── POST /import — import selected endpoints from a spec ─────────────────────
  router.post('/import', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, specUrl, specJson, selectedEndpoints } = req.body as {
        userId: string;
        specUrl?: string;
        specJson?: Record<string, unknown>;
        selectedEndpoints?: Array<{ method: string; path: string }>;
      };

      if (!userId) {
        res.status(400).json({ error: 'userId is required' });
        return;
      }

      if (!specUrl && !specJson) {
        res.status(400).json({ error: 'Provide either specUrl or specJson' });
        return;
      }

      const input = specUrl ?? specJson!;
      const parsed = await parseOpenApiSpec(input);
      const imported = await importEndpoints(userId, parsed, specUrl ?? null, selectedEndpoints);
      res.status(201).json(imported);
    } catch (err) {
      res.status(422).json({ error: `Import failed: ${(err as Error).message}` });
    }
  });

  // ── GET / — list all imported tool endpoints for a user ──────────────────────
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.query['userId'] as string | undefined;
      if (!userId) {
        res.status(400).json({ error: 'userId query parameter is required' });
        return;
      }

      const entries = await listToolRegistry(userId);
      res.json(entries);
    } catch (err) {
      next(err);
    }
  });

  // ── DELETE /:specId — remove all endpoints from a specific import ────────────
  router.delete('/:specId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { specId } = req.params;
      const userId = req.query['userId'] as string | undefined;

      if (!specId || !userId) {
        res.status(400).json({ error: 'specId param and userId query parameter are required' });
        return;
      }

      const count = await deleteSpec(userId, specId as string);
      res.json({ deleted: count });
    } catch (err) {
      next(err);
    }
  });

  // ── PATCH /:id/toggle — enable or disable a specific endpoint ────────────────
  router.patch('/:id/toggle', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { userId, isEnabled } = req.body as { userId: string; isEnabled: boolean };

      if (!id || !userId || isEnabled === undefined) {
        res.status(400).json({ error: 'id param, userId, and isEnabled are required' });
        return;
      }

      const updated = await toggleEndpoint(userId, id as string, isEnabled);
      if (!updated) {
        res.status(404).json({ error: 'Registry entry not found' });
        return;
      }

      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
