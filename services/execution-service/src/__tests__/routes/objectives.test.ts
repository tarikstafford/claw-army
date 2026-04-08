import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

const mockVerifyAuthToken = vi.fn().mockResolvedValue(true);

const mockDbSelect = vi.fn();
const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();
const mockDbOrderBy = vi.fn();
const mockDbInsert = vi.fn();
const mockDbValues = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbSet = vi.fn();
const mockDbReturning = vi.fn();
const mockDbInnerJoin = vi.fn();
const mockDbLeftJoin = vi.fn();
const mockDbDelete = vi.fn();
const mockDbLimit = vi.fn();
const mockDbGroupBy = vi.fn();
const mockDbAs = vi.fn();
const mockDbAnd = vi.fn();

const mockDb = {
  select: mockDbSelect,
  insert: mockDbInsert,
  update: mockDbUpdate,
  delete: mockDbDelete,
  from: mockDbFrom,
  where: mockDbWhere,
  orderBy: mockDbOrderBy,
  returning: mockDbReturning,
  set: mockDbSet,
  innerJoin: mockDbInnerJoin,
  leftJoin: mockDbLeftJoin,
  limit: mockDbLimit,
  groupBy: mockDbGroupBy,
  as: mockDbAs,
  and: mockDbAnd,
};

vi.mock('@claw/db', () => ({
  db: mockDb,
  executions: { id: Symbol('executions.id'), objectiveId: Symbol('executions.objectiveId'), status: Symbol('executions.status'), createdAt: Symbol('executions.createdAt') },
  tasks: { id: Symbol('tasks.id'), executionId: Symbol('tasks.executionId'), status: Symbol('tasks.status'), claimedByBotId: Symbol('tasks.claimedByBotId') },
  bots: { id: Symbol('bots.id'), executionId: Symbol('bots.executionId'), status: Symbol('bots.status'), compositeScore: Symbol('bots.compositeScore') },
  telemetry: { id: Symbol('telemetry.id'), executionId: Symbol('telemetry.executionId'), metricName: Symbol('telemetry.metricName'), metricValue: Symbol('telemetry.metricValue'), botId: Symbol('telemetry.botId') },
  agentClasses: { id: Symbol('agentClasses.id'), botId: Symbol('agentClasses.botId'), currentClass: Symbol('agentClasses.currentClass'), isPioneer: Symbol('agentClasses.isPioneer'), taskCategory: Symbol('agentClasses.task_category') },
  councilVerdicts: { id: Symbol('councilVerdicts.id'), botId: Symbol('councilVerdicts.botId'), executionId: Symbol('councilVerdicts.executionId'), verdictType: Symbol('councilVerdicts.verdictType'), status: Symbol('councilVerdicts.status'), createdAt: Symbol('councilVerdicts.createdAt'), weightedConfidenceScore: Symbol('councilVerdicts.weightedConfidenceScore'), verdictSummary: Symbol('councilVerdicts.verdictSummary') },
  ringLeaderRuns: { id: Symbol('ringLeaderRuns.id'), executionId: Symbol('ringLeaderRuns.executionId'), status: Symbol('ringLeaderRuns.status'), populationManifest: Symbol('ringLeaderRuns.populationManifest'), missionBrief: Symbol('ringLeaderRuns.missionBrief') },
  executionStatusEnum: { enumValues: ['pre_flight', 'queued', 'running', 'paused', 'stopped', 'completed', 'failed'] },
  objectives: { id: Symbol('objectives.id'), isArchived: Symbol('objectives.isArchived'), projectId: Symbol('objectives.projectId'), name: Symbol('objectives.name'), description: Symbol('objectives.description'), defaultMaxBots: Symbol('objectives.defaultMaxBots'), defaultBudgetCapCents: Symbol('objectives.defaultBudgetCapCents'), defaultRuntimeLimitSeconds: Symbol('objectives.defaultRuntimeLimitSeconds'), defaultAllowedTools: Symbol('objectives.defaultAllowedTools'), createdAt: Symbol('objectives.createdAt'), updatedAt: Symbol('objectives.updatedAt') },
  billingEvents: { id: Symbol('billingEvents.id'), executionId: Symbol('billingEvents.executionId'), eventType: Symbol('billingEvents.eventType'), amountCents: Symbol('billingEvents.amount_cents') },
  dnaStore: { id: Symbol('dnaStore.id'), botId: Symbol('dnaStore.bot_id'), executionId: Symbol('dnaStore.execution_id'), compositeScore: Symbol('dnaStore.composite_score'), mutationLineage: Symbol('dnaStore.mutation_lineage') },
  categoryBenchmarks: { id: Symbol('categoryBenchmarks.id'), pioneerBotId: Symbol('categoryBenchmarks.pioneerBotId'), pioneerExecutionId: Symbol('categoryBenchmarks.pioneerExecutionId'), baselineCompositeScore: Symbol('categoryBenchmarks.baselineCompositeScore'), createdAt: Symbol('categoryBenchmarks.createdAt'), taskCategory: Symbol('categoryBenchmarks.taskCategory') },
  authUsers: { id: Symbol('authUsers.id'), email: Symbol('authUsers.email') },
  authSessions: { id: Symbol('authSessions.id') },
  authAccounts: { id: Symbol('authAccounts.id') },
  authVerifications: { id: Symbol('authVerifications.id') },
}));

vi.mock('../lib/verify-auth-token.js', () => ({
  verifyAuthToken: () => mockVerifyAuthToken(),
}));

vi.mock('../../services/paperclip-client.js', () => ({
  getProject: vi.fn().mockResolvedValue({ id: randomUUID(), name: 'Test Project' }),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  sql: vi.fn((template, ...values) => ({ type: 'sql', template, values })),
  desc: vi.fn((col) => ({ type: 'desc', col })),
  inArray: vi.fn((col, values) => ({ type: 'inArray', col, values })),
}));

const mockObjective = (overrides = {}) => ({
  id: randomUUID(),
  name: 'Test Objective',
  description: 'Test description',
  defaultMaxBots: 5,
  defaultBudgetCapCents: 10000,
  defaultRuntimeLimitSeconds: 3600,
  defaultAllowedTools: [] as string[],
  isArchived: false,
  projectId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

let app: FastifyInstance | null = null;

beforeAll(async () => {
  try {
    const { buildApp } = await import('../../app.js');
    app = await buildApp();
    await app.ready();
  } catch (err) {
    console.warn('[objectives.test] buildApp failed:', err);
    app = null;
  }
}, 30_000);

afterAll(async () => {
  if (app) await app.close();
});

describe('Objectives Routes', () => {
  if (!app) {
    it('skip all tests if app failed to build', () => { expect(app).toBeTruthy(); });
    return;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuthToken.mockResolvedValue(true);
  });

  describe('GET /objectives', () => {
    it('returns list of objectives', async () => {
      const objectives = [mockObjective(), mockObjective()];

      mockDbSelect.mockReturnValue({
        from: mockDbFrom.mockReturnValue({
          where: mockDbWhere.mockReturnValue({
            orderBy: mockDbOrderBy.mockResolvedValue(objectives),
          }),
        }),
      });

      const res = await app!.inject({
        method: 'GET',
        url: '/objectives',
      });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });

    it('filters by archived=true query param', async () => {
      mockDbSelect.mockReturnValue({
        from: mockDbFrom.mockReturnValue({
          where: mockDbWhere.mockReturnValue({
            orderBy: mockDbOrderBy.mockResolvedValue([mockObjective({ isArchived: true })]),
          }),
        }),
      });

      const res = await app!.inject({
        method: 'GET',
        url: '/objectives?archived=true',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
    });

    it('filters by projectId query param', async () => {
      const projectId = randomUUID();

      mockDbSelect.mockReturnValue({
        from: mockDbFrom.mockReturnValue({
          where: mockDbWhere.mockReturnValue({
            orderBy: mockDbOrderBy.mockResolvedValue([mockObjective({ projectId })]),
          }),
        }),
      });

      const res = await app!.inject({
        method: 'GET',
        url: `/objectives?projectId=${projectId}`,
      });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });
  });

  describe('GET /objectives/:id', () => {
    it('returns 404 when objective not found', async () => {
      mockDbSelect.mockResolvedValue([]);

      const res = await app!.inject({
        method: 'GET',
        url: `/objectives/${randomUUID()}`,
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns objective when found', async () => {
      const obj = mockObjective();

      mockDbSelect.mockResolvedValue([obj]);

      const res = await app!.inject({
        method: 'GET',
        url: `/objectives/${obj.id}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe(obj.id);
      expect(body.name).toBe(obj.name);
    });

    it('returns 400 for invalid UUID format', async () => {
      const res = await app!.inject({
        method: 'GET',
        url: '/objectives/not-a-uuid',
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /objectives', () => {
    it('returns 401 without auth', async () => {
      mockVerifyAuthToken.mockResolvedValue(false);

      const res = await app!.inject({
        method: 'POST',
        url: '/objectives',
        payload: {
          name: 'New Objective',
          defaultMaxBots: 5,
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 400 when required fields missing', async () => {
      const res = await app!.inject({
        method: 'POST',
        url: '/objectives',
        payload: {},
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when projectId does not exist', async () => {
      const { getProject } = await import('../../services/paperclip-client.js');
      vi.mocked(getProject).mockResolvedValue(null);

      const res = await app!.inject({
        method: 'POST',
        url: '/objectives',
        payload: {
          name: 'New Objective',
          defaultMaxBots: 5,
          projectId: randomUUID(),
        },
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toHaveProperty('error', 'Project not found');
    });

    it('creates objective with valid input', async () => {
      const { getProject } = await import('../../services/paperclip-client.js');
      vi.mocked(getProject).mockResolvedValue({ id: randomUUID(), name: 'Test Project' });

      const newObj = mockObjective();
      mockDbInsert.mockReturnValue({
        values: mockDbValues.mockReturnThis(),
        returning: mockDbReturning.mockResolvedValue([newObj]),
      });

      const res = await app!.inject({
        method: 'POST',
        url: '/objectives',
        payload: {
          name: 'New Objective',
          defaultMaxBots: 5,
        },
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body).toHaveProperty('id');
    });
  });

  describe('DELETE /objectives/:id', () => {
    it('returns 401 without auth', async () => {
      mockVerifyAuthToken.mockResolvedValue(false);

      const res = await app!.inject({
        method: 'DELETE',
        url: `/objectives/${randomUUID()}`,
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 404 when objective not found', async () => {
      mockDbDelete.mockReturnValue({
        where: mockDbWhere.mockReturnValue({
          returning: mockDbReturning.mockResolvedValue([]),
        }),
      });

      const res = await app!.inject({
        method: 'DELETE',
        url: `/objectives/${randomUUID()}`,
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('deletes objective when found', async () => {
      mockDbDelete.mockReturnValue({
        where: mockDbWhere.mockReturnValue({
          returning: mockDbReturning.mockResolvedValue([{ id: randomUUID() }]),
        }),
      });

      const res = await app!.inject({
        method: 'DELETE',
        url: `/objectives/${randomUUID()}`,
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveProperty('success', true);
    });
  });

  describe('PATCH /objectives/:id', () => {
    it('returns 401 without auth', async () => {
      mockVerifyAuthToken.mockResolvedValue(false);

      const res = await app!.inject({
        method: 'PATCH',
        url: `/objectives/${randomUUID()}`,
        payload: { name: 'Updated Name' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 404 when objective not found', async () => {
      mockDbUpdate.mockReturnValue({
        set: mockDbSet.mockReturnThis(),
        where: mockDbWhere.mockReturnValue({
          returning: mockDbReturning.mockResolvedValue([]),
        }),
      });

      const res = await app!.inject({
        method: 'PATCH',
        url: `/objectives/${randomUUID()}`,
        payload: { name: 'Updated Name' },
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('updates objective when found', async () => {
      const updated = mockObjective({ name: 'Updated Name' });
      mockDbUpdate.mockReturnValue({
        set: mockDbSet.mockReturnThis(),
        where: mockDbWhere.mockReturnValue({
          returning: mockDbReturning.mockResolvedValue([updated]),
        }),
      });

      const res = await app!.inject({
        method: 'PATCH',
        url: `/objectives/${randomUUID()}`,
        payload: { name: 'Updated Name' },
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveProperty('name', 'Updated Name');
    });
  });

  describe('GET /objectives/:id/stats', () => {
    it('returns 404 when objective not found', async () => {
      mockDbSelect.mockResolvedValue([]);

      const res = await app!.inject({
        method: 'GET',
        url: `/objectives/${randomUUID()}/stats`,
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns stats when objective found', async () => {
      mockDbSelect
        .mockResolvedValueOnce([{ id: randomUUID() }])
        .mockResolvedValueOnce([{
          runCount: 5,
          totalSpendCents: 1000,
          totalTasksCompleted: 50,
          totalBotHours: 25.5,
        }]);

      const res = await app!.inject({
        method: 'GET',
        url: `/objectives/${randomUUID()}/stats`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('runCount');
      expect(body).toHaveProperty('totalSpendCents');
    });
  });

  describe('GET /objectives/:id/timeline', () => {
    it('returns 404 when objective not found', async () => {
      mockDbSelect.mockResolvedValue([]);

      const res = await app!.inject({
        method: 'GET',
        url: `/objectives/${randomUUID()}/timeline`,
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns timeline events', async () => {
      mockDbSelect
        .mockResolvedValueOnce([{ id: randomUUID() }])
        .mockResolvedValueOnce([]);

      const res = await app!.inject({
        method: 'GET',
        url: `/objectives/${randomUUID()}/timeline`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('events');
      expect(body).toHaveProperty('total');
      expect(body).toHaveProperty('hasMore');
    });

    it('supports limit and offset query params', async () => {
      mockDbSelect
        .mockResolvedValueOnce([{ id: randomUUID() }])
        .mockResolvedValueOnce([]);

      const res = await app!.inject({
        method: 'GET',
        url: `/objectives/${randomUUID()}/timeline?limit=10&offset=5`,
      });

      expect(res.statusCode).toBe(200);
    });
  });
});
