import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';

const mockStripeCustomersCreate = vi.fn();
const mockStripeSubscriptionsList = vi.fn();
const mockStripeSubscriptionsCreate = vi.fn();
const mockStripeSubscriptionsRetrieve = vi.fn();
const mockStripeSubscriptionItemsCreateUsageRecord = vi.fn();
const mockStripeWebhooksConstructEvent = vi.fn();

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    customers: { create: mockStripeCustomersCreate },
    subscriptions: {
      list: mockStripeSubscriptionsList,
      create: mockStripeSubscriptionsCreate,
      retrieve: mockStripeSubscriptionsRetrieve,
    },
    subscriptionItems: {
      createUsageRecord: mockStripeSubscriptionItemsCreateUsageRecord,
    },
    webhooks: { constructEvent: mockStripeWebhooksConstructEvent },
  })),
}));

const mockDbSelect = vi.fn();
const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();
const mockDbInsert = vi.fn();
const mockDbLimit = vi.fn();

const mockDb = {
  select: mockDbSelect,
  insert: mockDbInsert,
  update: vi.fn(),
  delete: vi.fn(),
  from: mockDbFrom,
  where: mockDbWhere,
  returning: vi.fn(),
  set: vi.fn(),
  innerJoin: vi.fn(),
  leftJoin: vi.fn(),
  limit: mockDbLimit,
  groupBy: vi.fn(),
  as: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
};

vi.mock('@claw/db', () => ({
  db: mockDb,
  authAccounts: { id: Symbol('authAccounts.id'), userId: Symbol('authAccounts.userId'), providerId: Symbol('authAccounts.providerId'), accountId: Symbol('authAccounts.accountId'), accessToken: Symbol('authAccounts.accessToken') },
  authUsers: { id: Symbol('authUsers.id'), email: Symbol('authUsers.email') },
  authSessions: { id: Symbol('authSessions.id') },
  authVerifications: { id: Symbol('authVerifications.id') },
  executions: { id: Symbol('executions.id') },
  billingEvents: { id: Symbol('billingEvents.id') },
  bots: { id: Symbol('bots.id') },
  tasks: { id: Symbol('tasks.id') },
  telemetry: { id: Symbol('telemetry.id') },
  agentClasses: { id: Symbol('agentClasses.id') },
  councilVerdicts: { id: Symbol('councilVerdicts.id') },
  ringLeaderRuns: { id: Symbol('ringLeaderRuns.id') },
  objectives: { id: Symbol('objectives.id') },
  billingEventsEnum: { enumValues: ['bot_started', 'bot_stopped', 'tool_invoked', 'execution_completed', 'budget_exceeded'] },
  executionStatusEnum: { enumValues: ['pre_flight', 'queued', 'running', 'paused', 'stopped', 'completed', 'failed'] },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  sql: vi.fn((template, ...values) => ({ type: 'sql', template, values })),
  desc: vi.fn((col) => ({ type: 'desc', col })),
  inArray: vi.fn((col, values) => ({ type: 'inArray', col, values })),
}));

describe('Stripe Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrCreateStripeCustomer', () => {
    it('returns existing customer ID if found', async () => {
      const userId = randomUUID();
      const existingCustomerId = randomUUID();

      mockDbSelect.mockReturnValue({
        from: mockDbFrom.mockReturnValue({
          where: mockDbWhere.mockReturnValue({
            limit: mockDbLimit.mockResolvedValue([{ accessToken: existingCustomerId }]),
          }),
        }),
      });

      const { getOrCreateStripeCustomer } = await import('../services/stripe-service.js');
      const result = await getOrCreateStripeCustomer(userId);

      expect(result).toBe(existingCustomerId);
      expect(mockStripeCustomersCreate).not.toHaveBeenCalled();
    });

    it('creates new customer if none exists', async () => {
      const userId = randomUUID();
      const newCustomerId = randomUUID();

      mockDbSelect.mockReturnValue({
        from: mockDbFrom.mockReturnValue({
          where: mockDbWhere.mockReturnValue({
            limit: mockDbLimit.mockResolvedValue([]),
          }),
        }),
      });

      mockStripeCustomersCreate.mockResolvedValue({ id: newCustomerId });
      mockDbInsert.mockResolvedValue(undefined);

      const { getOrCreateStripeCustomer } = await import('../services/stripe-service.js');
      const result = await getOrCreateStripeCustomer(userId, 'test@example.com');

      expect(result).toBe(newCustomerId);
      expect(mockStripeCustomersCreate).toHaveBeenCalledWith({
        metadata: { userId },
        email: 'test@example.com',
      });
    });
  });

  describe('getOrCreateSubscription', () => {
    it('returns existing subscription if found', async () => {
      const customerId = randomUUID();
      const subscriptionId = randomUUID();

      mockStripeSubscriptionsList.mockResolvedValue({
        data: [{ id: subscriptionId }],
      });

      const { getOrCreateSubscription } = await import('../services/stripe-service.js');
      const result = await getOrCreateSubscription(customerId);

      expect(result).toBe(subscriptionId);
      expect(mockStripeSubscriptionsCreate).not.toHaveBeenCalled();
    });

    it('creates new subscription if none exists', async () => {
      const customerId = randomUUID();
      const subscriptionId = randomUUID();

      mockStripeSubscriptionsList.mockResolvedValue({ data: [] });
      mockStripeSubscriptionsCreate.mockResolvedValue({
        id: subscriptionId,
        items: { data: [] },
      });

      const { getOrCreateSubscription } = await import('../services/stripe-service.js');
      const result = await getOrCreateSubscription(customerId);

      expect(result).toBe(subscriptionId);
      expect(mockStripeSubscriptionsCreate).toHaveBeenCalled();
    });
  });

  describe('submitUsageRecord', () => {
    it('submits usage record with 20% markup', async () => {
      const userId = randomUUID();
      const customerId = randomUUID();
      const subscriptionId = randomUUID();
      const priceId = randomUUID();

      mockDbSelect.mockReturnValue({
        from: mockDbFrom.mockReturnValue({
          where: mockDbWhere.mockReturnValue({
            limit: mockDbLimit.mockResolvedValue([{ accessToken: customerId }]),
          }),
        }),
      });

      mockStripeSubscriptionsList.mockResolvedValue({ data: [{ id: subscriptionId }] });
      mockStripeSubscriptionsRetrieve.mockResolvedValue({
        id: subscriptionId,
        items: {
          data: [{ id: priceId }],
        },
      });
      mockStripeSubscriptionItemsCreateUsageRecord.mockResolvedValue({});

      const { submitUsageRecord } = await import('../services/stripe-service.js');
      await submitUsageRecord({
        userId,
        dimension: 'tool_invocations',
        quantity: 10,
        timestamp: new Date(),
        executionId: randomUUID(),
      });

      expect(mockStripeSubscriptionItemsCreateUsageRecord).toHaveBeenCalledWith(
        priceId,
        expect.objectContaining({
          quantity: 1200,
          action: 'increment',
        }),
      );
    });
  });

  describe('constructWebhookEvent', () => {
    it('constructs webhook event from payload and signature', async () => {
      const payload = JSON.stringify({ type: 'invoice.paid' });
      const signature = 'sig_123';
      const event = { type: 'invoice.paid', data: {} };

      mockStripeWebhooksConstructEvent.mockResolvedValue(event);

      const { constructWebhookEvent } = await import('../services/stripe-service.js');
      const result = await constructWebhookEvent(payload, signature);

      expect(result).toEqual(event);
      expect(mockStripeWebhooksConstructEvent).toHaveBeenCalledWith(
        payload,
        signature,
        expect.any(String),
      );
    });
  });
});
