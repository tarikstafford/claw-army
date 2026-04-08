import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

const { ioredisMock, pubsubMock, openclawClientMock } = vi.hoisted(() => {
  const mockRedisInstance = {
    setex: vi.fn().mockResolvedValue('OK'),
    mget: vi.fn().mockResolvedValue(['500', '10000']),
  };
  const MockRedis = function() {
    return mockRedisInstance;
  };

  const mockTopicInstance = {
    createSubscription: vi.fn().mockResolvedValue({}),
  };
  const mockSubscriptionInstance = {
    on: vi.fn(),
    removeAllListeners: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const MockPubSub = function() {
    return {
      topic: vi.fn().mockReturnValue(mockTopicInstance),
      subscription: vi.fn().mockReturnValue(mockSubscriptionInstance),
    };
  };

  const mockOpenClawClientInstance = {
    connect: vi.fn().mockResolvedValue(undefined),
    isConnected: true,
  };
  const MockOpenClawClient = function() {
    return mockOpenClawClientInstance;
  };

  return {
    ioredisMock: MockRedis,
    pubsubMock: MockPubSub,
    openclawClientMock: MockOpenClawClient,
  };
});

vi.mock('ioredis', () => ({
  default: ioredisMock,
}));

vi.mock('@google-cloud/pubsub', () => ({
  PubSub: pubsubMock,
}));

const mockVerifyAuthToken = vi.fn().mockResolvedValue(true);

const mockDbSelect = vi.fn();
const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();
const mockDbOrderBy = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbReturning = vi.fn();
const mockDbSet = vi.fn();
const mockDbInnerJoin = vi.fn();
const mockDbLeftJoin = vi.fn();
const mockDbLimit = vi.fn();
const mockDbGroupBy = vi.fn();
const mockDbAs = vi.fn();
const mockDbAnd = vi.fn();
const mockDbInArray = vi.fn();

const mockDb = {
  select: mockDbSelect,
  insert: mockDbInsert,
  update: mockDbUpdate,
  delete: vi.fn(),
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
  inArray: mockDbInArray,
};

vi.mock('@claw/db', () => ({
  db: mockDb,
  executions: { id: Symbol('executions.id') },
  tasks: { id: Symbol('tasks.id'), executionId: Symbol('tasks.executionId'), status: Symbol('tasks.status'), claimedByBotId: Symbol('tasks.claimedByBotId'), description: Symbol('tasks.description') },
  bots: { id: Symbol('bots.id'), executionId: Symbol('bots.executionId'), status: Symbol('bots.status'), compositeScore: Symbol('bots.compositeScore'), soulId: Symbol('bots.soulId'), startedAt: Symbol('bots.startedAt'), stoppedAt: Symbol('bots.stoppedAt'), tier: Symbol('bots.tier'), tasksClaimed: Symbol('bots.tasksClaimed'), tasksCompleted: Symbol('bots.tasksCompleted'), tasksFailed: Symbol('bots.tasksFailed'), errorMessage: Symbol('bots.errorMessage') },
  telemetry: { id: Symbol('telemetry.id'), executionId: Symbol('telemetry.executionId'), metricName: Symbol('telemetry.metricName'), metricValue: Symbol('telemetry.metricValue'), botId: Symbol('telemetry.botId') },
  agentClasses: { id: Symbol('agentClasses.id'), botId: Symbol('agentClasses.botId'), currentClass: Symbol('agentClasses.currentClass'), isPioneer: Symbol('agentClasses.isPioneer'), taskCategory: Symbol('agentClasses.task_category') },
  councilVerdicts: { id: Symbol('councilVerdicts.id'), botId: Symbol('councilVerdicts.botId'), executionId: Symbol('councilVerdicts.executionId'), verdictType: Symbol('councilVerdicts.verdictType'), status: Symbol('councilVerdicts.status'), createdAt: Symbol('councilVerdicts.createdAt'), weightedConfidenceScore: Symbol('councilVerdicts.weightedConfidenceScore'), verdictSummary: Symbol('councilVerdicts.verdictSummary'), soulAnalystOutput: Symbol('councilVerdicts.soulAnalystOutput'), performanceJudgeOutput: Symbol('councilVerdicts.performanceJudgeOutput') },
  toolInvocations: { id: Symbol('toolInvocations.id'), botId: Symbol('toolInvocations.botId'), toolName: Symbol('toolInvocations.toolName'), invocationId: Symbol('toolInvocations.invocationId'), rejected: Symbol('toolInvocations.rejected'), rejectionReason: Symbol('toolInvocations.rejectionReason'), durationMs: Symbol('toolInvocations.durationMs'), promptTokens: Symbol('toolInvocations.promptTokens'), completionTokens: Symbol('toolInvocations.completionTokens'), totalTokens: Symbol('toolInvocations.totalTokens'), requestSummary: Symbol('toolInvocations.requestSummary'), responseSummary: Symbol('toolInvocations.responseSummary'), invokedAt: Symbol('toolInvocations.invokedAt') },
  botSouls: { id: Symbol('botSouls.id'), soulContent: Symbol('botSouls.soulContent'), generation: Symbol('botSouls.generation'), parentSoulId: Symbol('botSouls.parentSoulId'), isArchetype: Symbol('botSouls.isArchetype'), taskCategory: Symbol('botSouls.taskCategory'), constitutionDirectives: Symbol('botSouls.constitutionDirectives'), dimensions: Symbol('botSouls.dimensions') },
  executionStatusEnum: { enumValues: ['pre_flight', 'queued', 'running', 'paused', 'stopped', 'completed', 'failed'] },
  authUsers: { id: Symbol('authUsers.id'), email: Symbol('authUsers.email') },
  authSessions: { id: Symbol('authSessions.id') },
  authAccounts: { id: Symbol('authAccounts.id') },
  authVerifications: { id: Symbol('authVerifications.id') },
}));

vi.mock('../lib/verify-auth-token.js', () => ({
  verifyAuthToken: () => mockVerifyAuthToken(),
}));

vi.mock('../../orchestrator/bot-registry.js', () => ({
  getBot: vi.fn(),
  unregisterBot: vi.fn(),
}));

vi.mock('../../orchestrator/openclaw-client.js', () => ({
  OpenClawClient: openclawClientMock,
}));

vi.mock('../../orchestrator/gce-bot-launcher.js', () => ({
  terminateBotVM: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../performance/metrics-computer.js', () => ({
  computeBotMetrics: vi.fn().mockResolvedValue({
    tasksCompleted: 5,
    tasksFailed: 1,
    totalTasks: 6,
    successRate: 0.83,
    totalCostCents: 250,
    costPerTaskCents: 42,
    totalTokens: 10000,
    tokensPerTask: 1667,
    toolCallsPerTask: 5,
    totalToolCalls: 30,
    botHours: 2.5,
    tasksPerMinute: 2,
    totalRetries: 1,
    errorRate: 0.17,
    idleRatio: 0.1,
  }),
}));

vi.mock('../../events/publisher.js', () => ({
  publishBotStarted: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/execution.service.js', () => ({
  getExecution: vi.fn(),
  createExecution: vi.fn(),
  transitionExecution: vi.fn(),
}));

const mockBot = (overrides = {}) => ({
  id: randomUUID(),
  executionId: randomUUID(),
  status: 'idle' as const,
  tasksClaimed: 0,
  tasksCompleted: 0,
  tasksFailed: 0,
  startedAt: new Date(),
  stoppedAt: null,
  errorMessage: null,
  soulId: null,
  compositeScore: null,
  tier: null,
  ...overrides,
});

let app: FastifyInstance | null = null;

beforeAll(async () => {
  try {
    const { buildApp } = await import('../../app.js');
    app = await buildApp();
    await app.ready();
  } catch (err) {
    console.warn('[bots.test] buildApp failed:', err);
    app = null;
  }
}, 30_000);

afterAll(async () => {
  if (app) await app.close();
});

describe('Bots Routes', () => {
  if (!app) {
    it('skip all tests if app failed to build', () => { expect(app).toBeTruthy(); });
    return;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /bots/by-execution/:executionId', () => {
    it('returns bots for execution', async () => {
      const executionId = randomUUID();
      const bots = [mockBot({ executionId }), mockBot({ executionId })];

      mockDbSelect.mockReturnValue({
        from: mockDbFrom.mockReturnValue({
          where: mockDbWhere.mockReturnValue({
            orderBy: mockDbOrderBy.mockResolvedValue(bots),
          }),
        }),
      });

      const res = await app!.inject({
        method: 'GET',
        url: `/bots/by-execution/${executionId}`,
      });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });

    it('returns 400 for invalid UUID format', async () => {
      const res = await app!.inject({
        method: 'GET',
        url: '/bots/by-execution/not-a-uuid',
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /bots/:botId/soul', () => {
    it('returns 404 when bot not found', async () => {
      mockDbSelect.mockResolvedValue([]);

      const res = await app!.inject({
        method: 'GET',
        url: `/bots/${randomUUID()}/soul`,
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toHaveProperty('error', 'Bot not found');
    });

    it('returns 400 for invalid UUID format', async () => {
      const res = await app!.inject({
        method: 'GET',
        url: '/bots/not-a-uuid/soul',
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /bots/:botId/detail', () => {
    it('returns 404 when bot not found', async () => {
      mockDbSelect.mockResolvedValue([]);

      const res = await app!.inject({
        method: 'GET',
        url: `/bots/${randomUUID()}/detail`,
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 400 for invalid UUID format', async () => {
      const res = await app!.inject({
        method: 'GET',
        url: '/bots/not-a-uuid/detail',
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /bots/:botId/ready', () => {
    it('returns 404 when bot not found', async () => {
      mockDbSelect.mockResolvedValue([]);

      const res = await app!.inject({
        method: 'POST',
        url: `/bots/${randomUUID()}/ready`,
        payload: {
          success: true,
          internalIp: '192.168.1.1',
          port: 8080,
          gatewayToken: 'test-token',
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 400 for invalid UUID format', async () => {
      const res = await app!.inject({
        method: 'POST',
        url: '/bots/not-a-uuid/ready',
        payload: {
          success: true,
          internalIp: '192.168.1.1',
          port: 8080,
          gatewayToken: 'test-token',
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
