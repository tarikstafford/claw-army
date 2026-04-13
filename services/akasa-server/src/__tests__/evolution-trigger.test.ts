import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Top-level mocks (hoisted)
vi.mock('@claw/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
  bots: { id: 'id', paperclipAgentId: 'paperclip_agent_id', executionId: 'execution_id', soulId: 'soul_id' },
  councilVerdicts: { botId: 'bot_id', executionId: 'execution_id' },
  heartbeatRuns: {
    id: 'id',
    agentId: 'agent_id',
    companyId: 'company_id',
    usageJson: 'usage_json',
    resultJson: 'result_json',
    status: 'status',
    finishedAt: 'finished_at',
  },
}));

vi.mock('../council/council-runner.js', () => ({
  runCouncilForBot: vi.fn(),
}));

// ─── councilRouter tests ───────────────────────────────────────────────────────

describe('councilRouter', () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { db: mockDb } = await import('@claw/db');
    const { councilRouter } = await import('../routes/council.js');

    app = express();
    app.use(express.json());
    app.use('/api/akasa/verdicts', councilRouter());

    return { mockDb };
  });

  describe('GET /api/akasa/verdicts', () => {
    it('returns 400 if executionId is missing', async () => {
      const res = await request(app).get('/api/akasa/verdicts');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 200 with array of verdicts for given executionId', async () => {
      const { db: mockDb } = await import('@claw/db');
      const mockVerdicts = [
        { id: 'v-1', executionId: 'exec-1', botId: 'bot-1', verdictType: 'Maintain', status: 'pending', createdAt: new Date().toISOString() },
      ];
      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockVerdicts),
          }),
        }),
      } as never);

      const res = await request(app).get('/api/akasa/verdicts?executionId=exec-1');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/akasa/verdicts/:id', () => {
    it('returns 404 for non-existent verdict', async () => {
      const { db: mockDb } = await import('@claw/db');
      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

      const res = await request(app).get('/api/akasa/verdicts/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 200 with verdict for existing ID', async () => {
      const { db: mockDb } = await import('@claw/db');
      const mockVerdict = {
        id: 'v-1',
        executionId: 'exec-1',
        botId: 'bot-1',
        verdictType: 'Maintain',
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockVerdict]),
          }),
        }),
      } as never);

      const res = await request(app).get('/api/akasa/verdicts/v-1');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
    });
  });
});

// ─── checkAndTriggerCouncilEvaluations tests ─────────────────────────────────────

describe('checkAndTriggerCouncilEvaluations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { triggered: 0 } when no completed heartbeat_runs found', async () => {
    const akasaDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]), // no completed runs
        }),
      }),
    };

    const { checkAndTriggerCouncilEvaluations } = await import('../routes/evolution-trigger.js');
    const result = await checkAndTriggerCouncilEvaluations(
      akasaDb as never,
    );

    expect(result).toEqual({ triggered: 0 });
  });

  it('skips runs with no matching Akasa bot (no paperclipAgentId match)', async () => {
    let selectCallCount = 0;
    const akasaDb = {
      select: vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // heartbeat_runs query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { runId: 'run-1', agentId: 'agent-1', companyId: 'co-1', usageJson: null, resultJson: null },
              ]),
            }),
          };
        }
        // bots query - no match
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        };
      }),
    };

    const { checkAndTriggerCouncilEvaluations } = await import('../routes/evolution-trigger.js');
    const result = await checkAndTriggerCouncilEvaluations(
      akasaDb as never,
    );

    expect(result).toEqual({ triggered: 0 });
  });

  it('skips runs that already have a council verdict', async () => {
    let selectCallCount = 0;
    const akasaDb = {
      select: vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // heartbeat_runs query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { runId: 'run-1', agentId: 'agent-1', companyId: 'co-1', usageJson: null, resultJson: null },
              ]),
            }),
          };
        } else if (selectCallCount === 2) {
          // bots query - bot found
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  { id: 'bot-1', executionId: 'exec-1', soulId: 'soul-1' },
                ]),
              }),
            }),
          };
        } else {
          // verdict query - existing verdict
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: 'verdict-existing' }]),
              }),
            }),
          };
        }
      }),
    };

    const { checkAndTriggerCouncilEvaluations } = await import('../routes/evolution-trigger.js');
    const result = await checkAndTriggerCouncilEvaluations(
      akasaDb as never,
    );

    expect(result).toEqual({ triggered: 0 });
  });

  it('triggers council for completed runs with matching Akasa bot and no verdict', async () => {
    const { runCouncilForBot } = await import('../council/council-runner.js');
    vi.mocked(runCouncilForBot).mockResolvedValue({ id: 'verdict-new' } as never);

    let selectCallCount = 0;
    const akasaDb = {
      select: vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // heartbeat_runs query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { runId: 'run-1', agentId: 'agent-1', companyId: 'co-1', usageJson: null, resultJson: null },
              ]),
            }),
          };
        } else if (selectCallCount === 2) {
          // bots query - bot found
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  { id: 'bot-1', executionId: 'exec-1', soulId: 'soul-1' },
                ]),
              }),
            }),
          };
        } else {
          // verdict query - no existing verdict
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          };
        }
      }),
    };

    const { checkAndTriggerCouncilEvaluations } = await import('../routes/evolution-trigger.js');
    const result = await checkAndTriggerCouncilEvaluations(
      akasaDb as never,
    );

    expect(result.triggered).toBe(1);
  });
});

// ─── evolutionTriggerRouter — manual trigger route tests ─────────────────────────

describe('evolutionTriggerRouter', () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { evolutionTriggerRouter } = await import('../routes/evolution-trigger.js');
    app = express();
    app.use(express.json());
    app.use('/api/akasa/evolution', evolutionTriggerRouter());
  });

  describe('POST /api/akasa/evolution/trigger', () => {
    it('returns 200 with { triggered: N } on manual trigger', async () => {
      // Set up the db mock chain so checkAndTriggerCouncilEvaluations resolves
      const { db: mockDb } = await import('@claw/db');
      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]), // no completed runs
        }),
      } as never);

      const res = await request(app).post('/api/akasa/evolution/trigger').send({});
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('triggered');
      expect(typeof res.body.triggered).toBe('number');
    });
  });
});
