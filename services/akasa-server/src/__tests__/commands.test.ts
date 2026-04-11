import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('@claw/db', () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  return {
    db: mockDb,
    bots: { id: 'id', paperclipAgentId: 'paperclip_agent_id' },
    executions: { id: 'id', status: 'status' },
    councilVerdicts: { id: 'id', status: 'status' },
  };
});

vi.mock('@paperclipai/db', () => ({
  createDb: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  })),
}));

describe('commandsRouter', () => {
  let app: express.Express;
  let mockDb: ReturnType<typeof import('@claw/db')['db']>;

  beforeEach(async () => {
    vi.clearAllMocks();

    const dbModule = await import('@claw/db');
    mockDb = dbModule.db as unknown as typeof mockDb;

    const { commandsRouter } = await import('../routes/commands.js');
    app = express();
    app.use(express.json());
    app.use('/api/akasa/commands', commandsRouter());
  });

  describe('POST /api/akasa/commands/execute', () => {
    it('returns 400 if command is missing', async () => {
      const res = await request(app)
        .post('/api/akasa/commands/execute')
        .send({ args: [], companyId: 'company-1' });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('command is required');
    });

    it('returns 400 if companyId is missing', async () => {
      const res = await request(app)
        .post('/api/akasa/commands/execute')
        .send({ command: 'status', args: [] });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('companyId is required');
    });

    it('returns status for /status command', async () => {
      const countResult: Array<{ count: number }> = [{ count: 5 }];
      (mockDb as unknown as { limit: ReturnType<typeof vi.fn> }).limit = vi.fn()
        .mockResolvedValueOnce([{ count: 5 }])
        .mockResolvedValueOnce([{ count: 2 }])
        .mockResolvedValueOnce([{ count: 3 }]);

      const res = await request(app)
        .post('/api/akasa/commands/execute')
        .send({ command: 'status', args: [], companyId: 'company-1' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.message).toContain('5 active bots');
      expect(res.body.message).toContain('2 running executions');
      expect(res.body.message).toContain('3 pending verdicts');
    });

    it('returns error for unknown command', async () => {
      const res = await request(app)
        .post('/api/akasa/commands/execute')
        .send({ command: 'unknown', args: [], companyId: 'company-1' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(false);
      expect(res.body.message).toContain('Unknown command');
    });

    it('returns error for /assign without args', async () => {
      const res = await request(app)
        .post('/api/akasa/commands/execute')
        .send({ command: 'assign', args: [], companyId: 'company-1' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(false);
      expect(res.body.message).toContain('Usage: /assign');
    });
  });
});
