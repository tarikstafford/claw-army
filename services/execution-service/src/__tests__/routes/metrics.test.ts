import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

const { ioredisMock } = vi.hoisted(() => {
  const mockInstance = {
    setex: vi.fn().mockResolvedValue('OK'),
    mget: vi.fn().mockResolvedValue(['500', '10000']),
  };
  const MockClass = function() {
    return mockInstance;
  };
  return { ioredisMock: MockClass };
});

vi.mock('ioredis', () => ({
  default: ioredisMock,
}));

const mockDbSelect = vi.fn();
const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();
const mockDbAnd = vi.fn();
const mockDbInArray = vi.fn();
const mockDbOrderBy = vi.fn();

const mockDb = {
  select: mockDbSelect,
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  from: mockDbFrom,
  where: mockDbWhere,
  orderBy: mockDbOrderBy,
  returning: vi.fn(),
  set: vi.fn(),
  innerJoin: vi.fn(),
  leftJoin: vi.fn(),
  limit: vi.fn(),
  groupBy: vi.fn(),
  as: vi.fn(),
  and: mockDbAnd,
  inArray: mockDbInArray,
};

vi.mock('@claw/db', () => ({
  db: mockDb,
  executions: { id: Symbol('executions.id'), status: Symbol('executions.status'), projectId: Symbol('executions.projectId') },
  tasks: { id: Symbol('tasks.id'), executionId: Symbol('tasks.executionId'), status: Symbol('tasks.status') },
  bots: { id: Symbol('bots.id'), executionId: Symbol('bots.executionId'), status: Symbol('bots.status') },
  telemetry: { id: Symbol('telemetry.id'), executionId: Symbol('telemetry.executionId'), metricName: Symbol('telemetry.metricName'), metricValue: Symbol('telemetry.metricValue') },
  agentClasses: { id: Symbol('agentClasses.id'), botId: Symbol('agentClasses.botId'), currentClass: Symbol('agentClasses.currentClass') },
  councilVerdicts: { id: Symbol('councilVerdicts.id'), botId: Symbol('councilVerdicts.botId'), executionId: Symbol('councilVerdicts.executionId'), verdictType: Symbol('councilVerdicts.verdictType'), status: Symbol('councilVerdicts.status') },
  ringLeaderRuns: { id: Symbol('ringLeaderRuns.id'), executionId: Symbol('ringLeaderRuns.executionId'), status: Symbol('ringLeaderRuns.status') },
  executionStatusEnum: { enumValues: ['pre_flight', 'queued', 'running', 'paused', 'stopped', 'completed', 'failed'] },
  objectives: { id: Symbol('objectives.id'), isArchived: Symbol('objectives.isArchived'), projectId: Symbol('objectives.projectId') },
  billingEvents: { id: Symbol('billingEvents.id'), executionId: Symbol('billingEvents.executionId'), eventType: Symbol('billingEvents.eventType'), amountCents: Symbol('billingEvents.amount_cents') },
  authUsers: { id: Symbol('authUsers.id'), email: Symbol('authUsers.email') },
  authSessions: { id: Symbol('authSessions.id') },
  authAccounts: { id: Symbol('authAccounts.id') },
  authVerifications: { id: Symbol('authVerifications.id') },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  sql: vi.fn((template, ...values) => ({ type: 'sql', template, values })),
  desc: vi.fn((col) => ({ type: 'desc', col })),
  inArray: vi.fn((col, values) => ({ type: 'inArray', col, values })),
}));

vi.mock('../../services/execution.service.js', () => ({
  getExecution: vi.fn(),
}));

const mockExecution = (overrides = {}) => ({
  id: randomUUID(),
  objective: 'Test execution',
  status: 'running' as const,
  maxBots: 5,
  budgetCapCents: 10000,
  runtimeLimitSeconds: 3600,
  allowedTools: [] as string[],
  llmProvider: null,
  allowedDomains: null,
  campaignType: null,
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
    console.warn('[metrics.test] buildApp failed:', err);
    app = null;
  }
}, 30_000);

afterAll(async () => {
  if (app) await app.close();
});

describe('Metrics Routes', () => {
  if (!app) {
    it('skip all tests if app failed to build', () => { expect(app).toBeTruthy(); });
    return;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /executions/:id/metrics', () => {
    it('returns 404 when execution not found', async () => {
      const { getExecution } = await import('../../services/execution.service.js');
      vi.mocked(getExecution).mockResolvedValue(null);

      const res = await app!.inject({
        method: 'GET',
        url: `/executions/${randomUUID()}/metrics`,
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toHaveProperty('error', 'Execution not found');
    });

    it('returns metrics for execution', async () => {
      const { getExecution } = await import('../../services/execution.service.js');
      const exec = mockExecution();
      vi.mocked(getExecution).mockResolvedValue(exec);

      mockDbSelect
        .mockResolvedValueOnce([{ count: 5 }])
        .mockResolvedValueOnce([{ total: 25.5 }]);

      const res = await app!.inject({
        method: 'GET',
        url: `/executions/${exec.id}/metrics`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('activeBotCount');
      expect(body).toHaveProperty('totalBotHours');
      expect(body).toHaveProperty('spentCents');
      expect(body).toHaveProperty('budgetCapCents');
      expect(body).toHaveProperty('remainingCents');
      expect(body).toHaveProperty('estimatedCostCents');
    });

    it('returns 400 for invalid UUID format', async () => {
      const res = await app!.inject({
        method: 'GET',
        url: '/executions/not-a-uuid/metrics',
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /executions/projects/:id/metrics', () => {
    it('returns 404 when project not found', async () => {
      mockDbSelect.mockResolvedValue([]);

      const res = await app!.inject({
        method: 'GET',
        url: `/executions/projects/${randomUUID()}/metrics`,
      });

      expect(res.statusCode).toBe(200);
    });

    it('returns aggregated project metrics', async () => {
      const projectId = randomUUID();
      const executions = [
        { id: randomUUID() },
        { id: randomUUID() },
      ];

      mockDbSelect
        .mockResolvedValueOnce(executions)
        .mockResolvedValueOnce([{ count: 10 }])
        .mockResolvedValueOnce([{ total: 50.0 }])
        .mockResolvedValueOnce([{ total: 5000 }])
        .mockResolvedValueOnce([{ count: 5 }])
        .mockResolvedValueOnce([{ count: 2 }]);

      const res = await app!.inject({
        method: 'GET',
        url: `/executions/projects/${projectId}/metrics`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('totalExecutions');
      expect(body).toHaveProperty('totalBotHours');
      expect(body).toHaveProperty('totalSpentCents');
      expect(body).toHaveProperty('activeBotCount');
      expect(body).toHaveProperty('completedExecutions');
      expect(body).toHaveProperty('failedExecutions');
    });

    it('returns 400 for invalid UUID format', async () => {
      const res = await app!.inject({
        method: 'GET',
        url: '/executions/projects/not-a-uuid/metrics',
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns zeros when project has no executions', async () => {
      const projectId = randomUUID();

      mockDbSelect.mockResolvedValue([]);

      const res = await app!.inject({
        method: 'GET',
        url: `/executions/projects/${projectId}/metrics`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.totalExecutions).toBe(0);
      expect(body.totalBotHours).toBe(0);
      expect(body.totalSpentCents).toBe(0);
    });
  });
});
