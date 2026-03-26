import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Top-level mocks (hoisted before any imports)
vi.mock('@claw/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
  agentClasses: {
    id: 'id',
    botId: 'bot_id',
    taskCategory: 'task_category',
    currentClass: 'current_class',
    isPioneer: 'is_pioneer',
    lastVerdictId: 'last_verdict_id',
    lastTransitionAt: 'last_transition_at',
    artisanGraduationAt: 'artisan_graduation_at',
    updatedAt: 'updated_at',
    createdAt: 'created_at',
  },
  councilVerdicts: {
    id: 'id',
    botId: 'bot_id',
    executionId: 'execution_id',
    soulId: 'soul_id',
    verdictType: 'verdict_type',
    status: 'status',
    weightedConfidenceScore: 'weighted_confidence_score',
    requiresHumanConfirmation: 'requires_human_confirmation',
    hasUnresolvedDevilsAdvocate: 'has_unresolved_devils_advocate',
    verdictSummary: 'verdict_summary',
    performanceJudgeOutput: 'performance_judge_output',
    soulAnalystOutput: 'soul_analyst_output',
    devilsAdvocateOutput: 'devils_advocate_output',
    confirmedAt: 'confirmed_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  bots: {
    id: 'id',
    executionId: 'execution_id',
    status: 'status',
    compositeScore: 'composite_score',
    soulId: 'soul_id',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  botSouls: {
    id: 'id',
    isArchetype: 'is_archetype',
    archetypeName: 'archetype_name',
    botId: 'bot_id',
    executionId: 'execution_id',
    taskCategory: 'task_category',
    contentHash: 'content_hash',
    generation: 'generation',
    parentSoulId: 'parent_soul_id',
    dimensions: 'dimensions',
    createdAt: 'created_at',
  },
  categoryBenchmarks: {
    id: 'id',
    taskCategory: 'task_category',
    pioneerBotId: 'pioneer_bot_id',
    pioneerSoulId: 'pioneer_soul_id',
    pioneerExecutionId: 'pioneer_execution_id',
    baselineCompositeScore: 'baseline_composite_score',
    confirmedRunCount: 'confirmed_run_count',
    thinDataFlag: 'thin_data_flag',
    benchmarkMature: 'benchmark_mature',
    standardPromotion: 'standard_promotion',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  dnaStore: {
    id: 'id',
    botId: 'bot_id',
    executionId: 'execution_id',
    objectiveCategory: 'objective_category',
    version: 'version',
    compositeScore: 'composite_score',
    dnaPayload: 'dna_payload',
    capturedAt: 'captured_at',
    soulId: 'soul_id',
  },
}));

// ─── Helper: create test Express app ─────────────────────────────────────────

async function makeApp() {
  const app = express();
  app.use(express.json());
  const { evolutionDashboardRouter } = await import('../routes/evolution-dashboard.js');
  app.use('/', evolutionDashboardRouter());
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: err.message });
  });
  return app;
}

// ─── GET /fleet ───────────────────────────────────────────────────────────────

describe('GET /fleet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns classCounts with all four classes defaulting to 0', async () => {
    const { db: mockDb } = await import('@claw/db');

    // Return only Novice and Artisan (Understudy, Retired should default to 0)
    vi.mocked(mockDb.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockResolvedValue([
            { currentClass: 'Novice', rowCount: '3' },
            { currentClass: 'Artisan', rowCount: '1' },
          ]),
        }),
      } as any)
      // Score history query
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      } as any)
      // Average score query
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ avgScore: '0.75' }]),
        }),
      } as any)
      // Pending verdict count query
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ pendingCount: '2' }]),
        }),
      } as any);

    const app = await makeApp();
    const res = await request(app).get('/fleet');

    expect(res.status).toBe(200);
    expect(res.body.classCounts).toBeDefined();
    expect(res.body.classCounts.Novice).toBeGreaterThanOrEqual(0);
    expect(res.body.classCounts.Understudy).toBe(0);
    expect(res.body.classCounts.Artisan).toBeGreaterThanOrEqual(0);
    expect(res.body.classCounts.Retired).toBe(0);
  });

  it('returns scoreHistory array from council_verdicts ordered by createdAt', async () => {
    const { db: mockDb } = await import('@claw/db');

    const scoreHistoryRows = [
      { date: '2026-01-01', score: '0.70' },
      { date: '2026-01-02', score: '0.72' },
      { date: '2026-01-03', score: '0.75' },
      { date: '2026-01-04', score: '0.78' },
      { date: '2026-01-05', score: '0.80' },
    ];

    vi.mocked(mockDb.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockResolvedValue([]),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(scoreHistoryRows),
              }),
            }),
          }),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ avgScore: null }]),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ pendingCount: '0' }]),
        }),
      } as any);

    const app = await makeApp();
    const res = await request(app).get('/fleet');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.scoreHistory)).toBe(true);
    expect(res.body.scoreHistory).toHaveLength(5);
    expect(res.body.scoreHistory[0]).toHaveProperty('date');
    expect(res.body.scoreHistory[0]).toHaveProperty('score');
  });

  it('computes averageCompositeScore from bots with non-null scores', async () => {
    const { db: mockDb } = await import('@claw/db');

    vi.mocked(mockDb.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockResolvedValue([]),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ avgScore: '0.75' }]),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ pendingCount: '0' }]),
        }),
      } as any);

    const app = await makeApp();
    const res = await request(app).get('/fleet');

    expect(res.status).toBe(200);
    expect(res.body.averageCompositeScore).toBe('0.75');
  });

  it('returns pendingVerdictCount for requiresHumanConfirmation=true AND status=pending', async () => {
    const { db: mockDb } = await import('@claw/db');

    vi.mocked(mockDb.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockResolvedValue([]),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ avgScore: null }]),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ pendingCount: '2' }]),
        }),
      } as any);

    const app = await makeApp();
    const res = await request(app).get('/fleet');

    expect(res.status).toBe(200);
    expect(res.body.pendingVerdictCount).toBe(2);
  });
});

// ─── GET /agents ──────────────────────────────────────────────────────────────

describe('GET /agents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns agents array with botId, currentClass, compositeScore, isPioneer, lastVerdictAt', async () => {
    const { db: mockDb } = await import('@claw/db');

    vi.mocked(mockDb.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([
                  {
                    botId: 'bot-1',
                    currentClass: 'Artisan',
                    compositeScore: '0.88',
                    isPioneer: true,
                    taskCategory: 'web-research',
                    lastVerdictAt: '2026-03-01T00:00:00Z',
                  },
                  {
                    botId: 'bot-2',
                    currentClass: 'Novice',
                    compositeScore: '0.62',
                    isPioneer: false,
                    taskCategory: 'data-analysis',
                    lastVerdictAt: null,
                  },
                ]),
              }),
            }),
          }),
        }),
      } as any);

    const app = await makeApp();
    const res = await request(app).get('/agents');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('botId');
    expect(res.body[0]).toHaveProperty('currentClass');
    expect(res.body[0]).toHaveProperty('compositeScore');
    expect(res.body[0]).toHaveProperty('isPioneer');
    expect(res.body[0]).toHaveProperty('lastVerdictAt');
  });

  it('returns empty array when no agent_classes rows exist', async () => {
    const { db: mockDb } = await import('@claw/db');

    vi.mocked(mockDb.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    } as any);

    const app = await makeApp();
    const res = await request(app).get('/agents');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─── GET /bots/:botId/timeline ────────────────────────────────────────────────

describe('GET /bots/:botId/timeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merges verdict, class_transition, and dna_capture events sorted by timestamp DESC', async () => {
    const { db: mockDb } = await import('@claw/db');

    vi.mocked(mockDb.select)
      // Verdict query
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 'v-1',
              verdictType: 'Promote',
              status: 'confirmed',
              weightedConfidenceScore: '0.88',
              verdictSummary: 'Outstanding performance',
              createdAt: new Date('2026-03-03T12:00:00Z'),
            },
          ]),
        }),
      } as any)
      // Class transitions query
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 'ac-1',
              currentClass: 'Artisan',
              lastTransitionAt: new Date('2026-03-03T12:01:00Z'),
              taskCategory: 'web-research',
            },
          ]),
        }),
      } as any)
      // DNA captures query
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 'dna-1',
              objectiveCategory: 'web-research',
              compositeScore: '0.88',
              capturedAt: new Date('2026-03-03T12:02:00Z'),
            },
          ]),
        }),
      } as any);

    const app = await makeApp();
    const res = await request(app).get('/bots/bot-1/timeline');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(3);

    // Should be sorted DESC by timestamp — most recent first
    const types = res.body.map((e: { type: string }) => e.type);
    expect(types).toContain('verdict');
    expect(types).toContain('class_transition');
    expect(types).toContain('dna_capture');

    // First item should be latest (dna_capture at 12:02)
    expect(res.body[0].type).toBe('dna_capture');
  });

  it('returns empty array for unknown botId', async () => {
    const { db: mockDb } = await import('@claw/db');

    vi.mocked(mockDb.select)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) } as any)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) } as any)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) } as any);

    const app = await makeApp();
    const res = await request(app).get('/bots/unknown-bot/timeline');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─── GET /bots/:botId/lineage ─────────────────────────────────────────────────

describe('GET /bots/:botId/lineage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('walks parentSoulId chain up to maxDepth=10 and returns root-first array', async () => {
    const { db: mockDb } = await import('@claw/db');

    // Bot has soulId soul-3
    vi.mocked(mockDb.select)
      // Bot query to get soulId
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ soulId: 'soul-3' }]),
          }),
        }),
      } as any)
      // soul-3 query
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'soul-3',
              parentSoulId: 'soul-2',
              isArchetype: false,
              archetypeName: null,
              generation: 3,
              contentHash: 'abc123def456',
            }]),
          }),
        }),
      } as any)
      // soul-2 query
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'soul-2',
              parentSoulId: 'soul-1',
              isArchetype: false,
              archetypeName: null,
              generation: 2,
              contentHash: 'def456abc789',
            }]),
          }),
        }),
      } as any)
      // soul-1 query (root archetype)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'soul-1',
              parentSoulId: null,
              isArchetype: true,
              archetypeName: 'Cautious Verifier',
              generation: 1,
              contentHash: 'ghi789jkl012',
            }]),
          }),
        }),
      } as any);

    const app = await makeApp();
    const res = await request(app).get('/bots/bot-1/lineage');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(3);

    // Root-first order: soul-1, soul-2, soul-3
    expect(res.body[0].id).toBe('soul-1');
    expect(res.body[0].isArchetype).toBe(true);
    expect(res.body[0].label).toBe('Cautious Verifier');
    expect(res.body[1].id).toBe('soul-2');
    expect(res.body[2].id).toBe('soul-3');
  });

  it('returns empty array when bot has no soulId', async () => {
    const { db: mockDb } = await import('@claw/db');

    vi.mocked(mockDb.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ soulId: null }]),
        }),
      }),
    } as any);

    const app = await makeApp();
    const res = await request(app).get('/bots/bot-no-soul/lineage');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─── GET /bots/:botId/ledger ──────────────────────────────────────────────────

describe('GET /bots/:botId/ledger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes scoreDelta with null for first row', async () => {
    const { db: mockDb } = await import('@claw/db');

    vi.mocked(mockDb.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([
            {
              id: 'v-1',
              executionId: 'exec-1',
              verdictType: 'Maintain',
              status: 'confirmed',
              weightedConfidenceScore: '0.70',
              createdAt: new Date('2026-02-01T10:00:00Z'),
              soulId: 'soul-1',
            },
            {
              id: 'v-2',
              executionId: 'exec-2',
              verdictType: 'Promote',
              status: 'confirmed',
              weightedConfidenceScore: '0.80',
              createdAt: new Date('2026-02-05T10:00:00Z'),
              soulId: 'soul-2',
            },
            {
              id: 'v-3',
              executionId: 'exec-3',
              verdictType: 'Maintain',
              status: 'confirmed',
              weightedConfidenceScore: '0.82',
              createdAt: new Date('2026-02-10T10:00:00Z'),
              soulId: 'soul-3',
            },
          ]),
        }),
      }),
    } as any);

    const app = await makeApp();
    const res = await request(app).get('/bots/bot-1/ledger');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(3);

    // First row has null scoreDelta
    expect(res.body[0].scoreDelta).toBeNull();

    // Second row has delta computed
    expect(res.body[1].scoreDelta).toBeDefined();
    expect(parseFloat(res.body[1].scoreDelta)).toBeCloseTo(0.10, 2);

    // Third row has delta computed
    expect(res.body[2].scoreDelta).toBeDefined();
    expect(parseFloat(res.body[2].scoreDelta)).toBeCloseTo(0.02, 2);
  });

  it('determines keepDiscard from status and verdictType', async () => {
    const { db: mockDb } = await import('@claw/db');

    vi.mocked(mockDb.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([
            {
              id: 'v-1',
              executionId: 'exec-1',
              verdictType: 'Promote',
              status: 'confirmed',
              weightedConfidenceScore: '0.88',
              createdAt: new Date('2026-02-01T10:00:00Z'),
              soulId: 'soul-1',
            },
            {
              id: 'v-2',
              executionId: 'exec-2',
              verdictType: 'Retire',
              status: 'confirmed',
              weightedConfidenceScore: '0.20',
              createdAt: new Date('2026-02-05T10:00:00Z'),
              soulId: 'soul-1',
            },
            {
              id: 'v-3',
              executionId: 'exec-3',
              verdictType: 'Monitor',
              status: 'pending',
              weightedConfidenceScore: '0.55',
              createdAt: new Date('2026-02-10T10:00:00Z'),
              soulId: 'soul-1',
            },
          ]),
        }),
      }),
    } as any);

    const app = await makeApp();
    const res = await request(app).get('/bots/bot-1/ledger');

    expect(res.status).toBe(200);

    // confirmed Promote -> 'keep'
    expect(res.body[0].keepDiscard).toBe('keep');
    // confirmed Retire -> 'discard'
    expect(res.body[1].keepDiscard).toBe('discard');
    // pending -> 'pending'
    expect(res.body[2].keepDiscard).toBe('pending');
  });
});

// ─── GET /benchmarks ──────────────────────────────────────────────────────────

describe('GET /benchmarks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all categoryBenchmarks rows with thinDataFlag and benchmarkMature', async () => {
    const { db: mockDb } = await import('@claw/db');

    vi.mocked(mockDb.select).mockReturnValueOnce({
      from: vi.fn().mockResolvedValue([
        {
          id: 'cb-1',
          taskCategory: 'web-research',
          pioneerBotId: 'bot-1',
          pioneerSoulId: 'soul-1',
          baselineCompositeScore: '0.75',
          confirmedRunCount: 2,
          thinDataFlag: true,
          benchmarkMature: false,
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
        {
          id: 'cb-2',
          taskCategory: 'data-analysis',
          pioneerBotId: 'bot-2',
          pioneerSoulId: 'soul-2',
          baselineCompositeScore: '0.82',
          confirmedRunCount: 7,
          thinDataFlag: false,
          benchmarkMature: true,
          createdAt: new Date('2026-01-15T00:00:00Z'),
        },
      ]),
    } as any);

    const app = await makeApp();
    const res = await request(app).get('/benchmarks');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('taskCategory');
    expect(res.body[0]).toHaveProperty('thinDataFlag');
    expect(res.body[0]).toHaveProperty('benchmarkMature');
    expect(res.body[0].thinDataFlag).toBe(true);
    expect(res.body[1].benchmarkMature).toBe(true);
  });
});

// ─── GET /pending ─────────────────────────────────────────────────────────────

describe('GET /pending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters verdicts to requiresHumanConfirmation=true AND status=pending', async () => {
    const { db: mockDb } = await import('@claw/db');

    vi.mocked(mockDb.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([
            {
              id: 'v-pending-1',
              botId: 'bot-1',
              verdictType: 'Promote',
              status: 'pending',
              weightedConfidenceScore: '0.90',
              requiresHumanConfirmation: true,
              verdictSummary: 'Ready for promotion',
              performanceJudgeOutput: null,
              soulAnalystOutput: null,
              devilsAdvocateOutput: null,
              createdAt: new Date('2026-03-01T00:00:00Z'),
            },
            {
              id: 'v-pending-2',
              botId: 'bot-2',
              verdictType: 'Retire',
              status: 'pending',
              weightedConfidenceScore: '0.15',
              requiresHumanConfirmation: true,
              verdictSummary: 'Consistent failure pattern',
              performanceJudgeOutput: null,
              soulAnalystOutput: null,
              devilsAdvocateOutput: null,
              createdAt: new Date('2026-03-02T00:00:00Z'),
            },
          ]),
        }),
      }),
    } as any);

    const app = await makeApp();
    const res = await request(app).get('/pending');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('botId');
    expect(res.body[0]).toHaveProperty('verdictType');
    expect(res.body[0]).toHaveProperty('verdictSummary');
  });

  it('returns empty array when no pending verdicts', async () => {
    const { db: mockDb } = await import('@claw/db');

    vi.mocked(mockDb.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    const app = await makeApp();
    const res = await request(app).get('/pending');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
