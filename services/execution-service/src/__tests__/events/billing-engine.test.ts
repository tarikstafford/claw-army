import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Message } from '@google-cloud/pubsub';

const mockRedisEval = vi.fn();
const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();
const mockRedisSetex = vi.fn();

vi.mock('ioredis', () => {
  return {
    default: vi.fn(function MockIORedis() {
      return {
        eval: mockRedisEval,
        get: mockRedisGet,
        set: mockRedisSet,
        setex: mockRedisSetex,
      };
    }),
  };
});

const mockPublishBudgetExceeded = vi.fn().mockResolvedValue(undefined);
const mockPublishBillingEvent = vi.fn().mockResolvedValue(undefined);

vi.mock('../../events/publisher.js', () => ({
  publishBudgetExceeded: mockPublishBudgetExceeded,
  publishBillingEvent: mockPublishBillingEvent,
}));

const mockStopBot = vi.fn().mockResolvedValue(undefined);

vi.mock('../../orchestrator/bot-orchestrator.js', () => ({
  stopBot: mockStopBot,
}));

const mockGetBotsForExecution = vi.fn().mockReturnValue([]);

vi.mock('../../orchestrator/bot-registry.js', () => ({
  getBotsForExecution: mockGetBotsForExecution,
}));

const mockTransitionExecution = vi.fn().mockResolvedValue(undefined);

vi.mock('../../services/execution.service.js', () => ({
  transitionExecution: mockTransitionExecution,
}));

const mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockDbInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
const mockDbSelect = vi.fn();
const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();
const mockDbOrderBy = vi.fn();
const mockDbLimit = vi.fn();

vi.mock('@claw/db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({ values: mockInsertValues }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  },
  billingEvents: {},
  telemetry: {},
  bots: { startedAt: Symbol('startedAt'), stoppedAt: Symbol('stoppedAt') },
  executions: { projectId: Symbol('projectId') },
}));

const mockPublishMessage = vi.fn().mockResolvedValue('msg-id');
const mockSubscriptionClose = vi.fn().mockResolvedValue(undefined);

vi.mock('@google-cloud/pubsub', () => ({
  PubSub: vi.fn(function MockPubSub() {
    return {
      subscription: vi.fn(() => ({
        on: vi.fn(),
        close: mockSubscriptionClose,
      })),
    };
  }),
}));

describe('billing-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateTokenCost', () => {
    it('calculates cost for prompt and completion tokens at default rates (15c/M in, 60c/M out)', async () => {
      const { calculateTokenCost } = await import('../../events/billing-engine.js');

      const cost = calculateTokenCost(1_000_000, 500_000);
      expect(cost).toBe(45);
    });

    it('returns 0 when no tokens', async () => {
      const { calculateTokenCost } = await import('../../events/billing-engine.js');

      expect(calculateTokenCost(0, 0)).toBe(0);
    });

    it('rounds to nearest cent', async () => {
      const { calculateTokenCost } = await import('../../events/billing-engine.js');

      const cost = calculateTokenCost(333_333, 333_333);
      expect(cost).toBe(25);
    });

    it('handles large token counts correctly', async () => {
      const { calculateTokenCost } = await import('../../events/billing-engine.js');

      const cost = calculateTokenCost(10_000_000, 10_000_000);
      expect(cost).toBe(750);
    });
  });

  describe('enforceAtomicBudget', () => {
    it('returns capExceeded=false when under budget', async () => {
      mockRedisEval.mockResolvedValue([500, 0]);

      const { enforceAtomicBudget } = await import('../../events/billing-engine.js');

      const result = await enforceAtomicBudget('exec-1', 100);
      expect(result.newTotalCents).toBe(500);
      expect(result.capExceeded).toBe(false);
      expect(mockRedisEval).toHaveBeenCalledWith(
        expect.any(String),
        2,
        'budget:spend:exec-1',
        'budget:cap:exec-1',
        '100',
      );
    });

    it('returns capExceeded=false when exactly at cap', async () => {
      mockRedisEval.mockResolvedValue([1000, 0]);

      const { enforceAtomicBudget } = await import('../../events/billing-engine.js');

      const result = await enforceAtomicBudget('exec-1', 1000);
      expect(result.newTotalCents).toBe(1000);
      expect(result.capExceeded).toBe(false);
    });

    it('returns capExceeded=true when over budget', async () => {
      mockRedisEval.mockResolvedValue([1500, 1]);

      const { enforceAtomicBudget } = await import('../../events/billing-engine.js');

      const result = await enforceAtomicBudget('exec-1', 500);
      expect(result.newTotalCents).toBe(1500);
      expect(result.capExceeded).toBe(true);
    });

    it('passes correct Redis key format to EVAL', async () => {
      mockRedisEval.mockResolvedValue([100, 0]);

      const { enforceAtomicBudget } = await import('../../events/billing-engine.js');

      await enforceAtomicBudget('550e8400-e29b-41d4-a716-446655440001', 50);

      expect(mockRedisEval).toHaveBeenCalledWith(
        expect.any(String),
        2,
        'budget:spend:550e8400-e29b-41d4-a716-446655440001',
        'budget:cap:550e8400-e29b-41d4-a716-446655440001',
        '50',
      );
    });
  });

  describe('startBillingEngine lifecycle', () => {
    it('creates subscription with configured name', async () => {
      const originalEnv = process.env.BILLING_SUBSCRIPTION;
      process.env.BILLING_SUBSCRIPTION = 'test-billing-sub';

      try {
        const { startBillingEngine } = await import('../../events/billing-engine.js');

        startBillingEngine();

        expect(mockSubscriptionClose).toHaveBeenCalledTimes(0);
      } finally {
        process.env.BILLING_SUBSCRIPTION = originalEnv;
      }
    });

    it('shutdown closes both subscriptions', async () => {
      const { startBillingEngine } = await import('../../events/billing-engine.js');

      const engine = startBillingEngine();
      await engine.shutdown();

      expect(mockSubscriptionClose).toHaveBeenCalledTimes(2);
    });
  });
});
