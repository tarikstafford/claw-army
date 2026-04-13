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
    bots: { id: 'id', paperclipAgentId: 'paperclip_agent_id', status: 'status', executionId: 'execution_id' },
    executions: { id: 'id', status: 'status', updatedAt: 'updated_at' },
    councilVerdicts: { id: 'id', status: 'status' },
    paperclipAgents: { id: 'id', companyId: 'company_id', name: 'name' },
    issues: { id: 'id', assigneeAgentId: 'assignee_agent_id', updatedAt: 'updated_at' },
  };
});

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  count: vi.fn(() => 'count'),
  sql: Object.assign(vi.fn(() => 'sql'), {
    // Support tagged template literal usage: sql`...`
    raw: vi.fn(() => 'sql-raw'),
  }),
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
      // handleStatus uses db.select({count}).from(table).where(cond) — no .limit()
      // where() must resolve to an array since the result is destructured with const [...] = await ...
      (mockDb as unknown as { where: ReturnType<typeof vi.fn> }).where = vi.fn()
        .mockResolvedValueOnce([{ count: 5 }])   // active bots
        .mockResolvedValueOnce([{ count: 2 }])   // running executions
        .mockResolvedValueOnce([{ count: 3 }]);  // pending verdicts

      const res = await request(app)
        .post('/api/akasa/commands/execute')
        .send({ command: 'status', args: [], companyId: 'company-1' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.message).toContain('5 active bot');
      expect(res.body.message).toContain('2 running execution');
      expect(res.body.message).toContain('3 pending verdict');
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
