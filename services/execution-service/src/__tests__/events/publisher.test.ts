import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PubSub } from '@google-cloud/pubsub';

vi.mock('@google-cloud/pubsub', () => ({
  PubSub: vi.fn(function MockPubSub() {
    return {
      topic: vi.fn(() => ({
        publishMessage: mockPublishMessage,
      })),
    };
  }),
}));

function mockTopicPublishMessage(_message: { data: Buffer }): Promise<string> {
  return Promise.resolve('msg-id-' + Math.random().toString(36).slice(2));
}

const mockPublishMessage = vi.fn().mockImplementation(mockTopicPublishMessage);

describe('publisher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('publishBotStarted', () => {
    it('serializes and publishes a bot_started event to bot-lifecycle topic', async () => {
      vi.resetModules();
      const { publishBotStarted } = await import('../../events/publisher.js');

      const event = {
        type: 'bot_started' as const,
        botId: '550e8400-e29b-41d4-a716-446655440000',
        executionId: '550e8400-e29b-41d4-a716-446655440001',
        timestamp: '2026-04-07T10:00:00.000Z',
        metadata: { imageTag: 'latest' },
      };

      await publishBotStarted(event);

      expect(mockPublishMessage).toHaveBeenCalledTimes(1);
      const callArg = mockPublishMessage.mock.calls[0]![0] as { data: Buffer };
      const parsed = JSON.parse(callArg.data.toString());
      expect(parsed.type).toBe('bot_started');
      expect(parsed.botId).toBe(event.botId);
      expect(parsed.executionId).toBe(event.executionId);
    });

    it('does not throw on publish failure (fail-open)', async () => {
      vi.resetModules();
      mockPublishMessage.mockRejectedValueOnce(new Error('PubSub unavailable'));

      const { publishBotStarted } = await import('../../events/publisher.js');

      const event = {
        type: 'bot_started' as const,
        botId: '550e8400-e29b-41d4-a716-446655440000',
        executionId: '550e8400-e29b-41d4-a716-446655440001',
        timestamp: '2026-04-07T10:00:00.000Z',
      };

      await expect(publishBotStarted(event)).resolves.not.toThrow();
    });
  });

  describe('publishBotStopped', () => {
    it('serializes and publishes a bot_stopped event to bot-lifecycle topic', async () => {
      vi.resetModules();
      const { publishBotStopped } = await import('../../events/publisher.js');

      const event = {
        type: 'bot_stopped' as const,
        botId: '550e8400-e29b-41d4-a716-446655440000',
        executionId: '550e8400-e29b-41d4-a716-446655440001',
        timestamp: '2026-04-07T10:00:00.000Z',
        reason: 'completed' as const,
      };

      await publishBotStopped(event);

      expect(mockPublishMessage).toHaveBeenCalledTimes(1);
      const callArg = mockPublishMessage.mock.calls[0]![0] as { data: Buffer };
      const parsed = JSON.parse(callArg.data.toString());
      expect(parsed.type).toBe('bot_stopped');
      expect(parsed.reason).toBe('completed');
    });
  });

  describe('publishExecutionStatusChanged', () => {
    it('publishes to execution-lifecycle topic', async () => {
      vi.resetModules();
      const { publishExecutionStatusChanged } = await import('../../events/publisher.js');

      const event = {
        type: 'execution_status_changed' as const,
        executionId: '550e8400-e29b-41d4-a716-446655440001',
        fromStatus: 'queued' as const,
        toStatus: 'running' as const,
        timestamp: '2026-04-07T10:00:00.000Z',
      };

      await publishExecutionStatusChanged(event);

      expect(mockPublishMessage).toHaveBeenCalledTimes(1);
      const callArg = mockPublishMessage.mock.calls[0]![0] as { data: Buffer };
      const parsed = JSON.parse(callArg.data.toString());
      expect(parsed.type).toBe('execution_status_changed');
      expect(parsed.fromStatus).toBe('queued');
      expect(parsed.toStatus).toBe('running');
    });
  });

  describe('publishTaskClaimed', () => {
    it('publishes to task-lifecycle topic', async () => {
      vi.resetModules();
      const { publishTaskClaimed } = await import('../../events/publisher.js');

      const event = {
        type: 'task_claimed' as const,
        taskId: '550e8400-e29b-41d4-a716-446655440002',
        botId: '550e8400-e29b-41d4-a716-446655440000',
        executionId: '550e8400-e29b-41d4-a716-446655440001',
        timestamp: '2026-04-07T10:00:00.000Z',
      };

      await publishTaskClaimed(event);

      expect(mockPublishMessage).toHaveBeenCalledTimes(1);
      const callArg = mockPublishMessage.mock.calls[0]![0] as { data: Buffer };
      const parsed = JSON.parse(callArg.data.toString());
      expect(parsed.type).toBe('task_claimed');
      expect(parsed.taskId).toBe(event.taskId);
    });
  });

  describe('publishTaskCompleted', () => {
    it('publishes to task-lifecycle topic with durationMs', async () => {
      vi.resetModules();
      const { publishTaskCompleted } = await import('../../events/publisher.js');

      const event = {
        type: 'task_completed' as const,
        taskId: '550e8400-e29b-41d4-a716-446655440002',
        botId: '550e8400-e29b-41d4-a716-446655440000',
        executionId: '550e8400-e29b-41d4-a716-446655440001',
        durationMs: 1234,
        timestamp: '2026-04-07T10:00:00.000Z',
      };

      await publishTaskCompleted(event);

      expect(mockPublishMessage).toHaveBeenCalledTimes(1);
      const callArg = mockPublishMessage.mock.calls[0]![0] as { data: Buffer };
      const parsed = JSON.parse(callArg.data.toString());
      expect(parsed.type).toBe('task_completed');
      expect(parsed.durationMs).toBe(1234);
    });
  });

  describe('publishBillingEvent', () => {
    it('publishes a billing_event to billing-events topic', async () => {
      vi.resetModules();
      const { publishBillingEvent } = await import('../../events/publisher.js');

      const event = {
        type: 'billing_event' as const,
        executionId: '550e8400-e29b-41d4-a716-446655440001',
        botId: '550e8400-e29b-41d4-a716-446655440000',
        eventType: 'tool_invoked' as const,
        amountCents: 5,
        tokenCount: 1000,
        timestamp: '2026-04-07T10:00:00.000Z',
      };

      await publishBillingEvent(event);

      expect(mockPublishMessage).toHaveBeenCalledTimes(1);
      const callArg = mockPublishMessage.mock.calls[0]![0] as { data: Buffer };
      const parsed = JSON.parse(callArg.data.toString());
      expect(parsed.type).toBe('billing_event');
      expect(parsed.amountCents).toBe(5);
      expect(parsed.tokenCount).toBe(1000);
    });

    it('does not throw when Zod validation fails (fail-open)', async () => {
      vi.resetModules();
      const { publishBillingEvent } = await import('../../events/publisher.js');

      const invalidEvent = {
        type: 'billing_event' as const,
        executionId: 'not-a-uuid',
        eventType: 'tool_invoked' as const,
        timestamp: '2026-04-07T10:00:00.000Z',
      } as Parameters<typeof publishBillingEvent>[0];

      await expect(publishBillingEvent(invalidEvent)).resolves.not.toThrow();
    });
  });

  describe('publishBudgetExceeded', () => {
    it('publishes a budget_exceeded event to billing-events topic', async () => {
      vi.resetModules();
      const { publishBudgetExceeded } = await import('../../events/publisher.js');

      const event = {
        type: 'budget_exceeded' as const,
        executionId: '550e8400-e29b-41d4-a716-446655440001',
        budgetCapCents: 1000,
        totalSpentCents: 1050,
        timestamp: '2026-04-07T10:00:00.000Z',
      };

      await publishBudgetExceeded(event);

      expect(mockPublishMessage).toHaveBeenCalledTimes(1);
      const callArg = mockPublishMessage.mock.calls[0]![0] as { data: Buffer };
      const parsed = JSON.parse(callArg.data.toString());
      expect(parsed.type).toBe('budget_exceeded');
      expect(parsed.budgetCapCents).toBe(1000);
      expect(parsed.totalSpentCents).toBe(1050);
    });
  });

  describe('publishGuardrailTriggered', () => {
    it('publishes a guardrail_triggered event to guardrail-events topic', async () => {
      vi.resetModules();
      const { publishGuardrailTriggered } = await import('../../events/publisher.js');

      const event = {
        type: 'guardrail_triggered' as const,
        botId: '550e8400-e29b-41d4-a716-446655440000',
        executionId: '550e8400-e29b-41d4-a716-446655440001',
        reason: 'rate_limit' as const,
        action: 'revoked' as const,
        timestamp: '2026-04-07T10:00:00.000Z',
      };

      await publishGuardrailTriggered(event);

      expect(mockPublishMessage).toHaveBeenCalledTimes(1);
      const callArg = mockPublishMessage.mock.calls[0]![0] as { data: Buffer };
      const parsed = JSON.parse(callArg.data.toString());
      expect(parsed.type).toBe('guardrail_triggered');
      expect(parsed.reason).toBe('rate_limit');
      expect(parsed.action).toBe('revoked');
    });
  });

  describe('publishSoulLifecycleEvent', () => {
    it('publishes a soul_promoted event to soul-lifecycle topic', async () => {
      vi.resetModules();
      const { publishSoulLifecycleEvent } = await import('../../events/publisher.js');

      const event = {
        type: 'soul_promoted' as const,
        botId: '550e8400-e29b-41d4-a716-446655440000',
        executionId: '550e8400-e29b-41d4-a716-446655440001',
        taskCategory: 'test-task',
        fromClass: 'Novice' as const,
        toClass: 'Understudy' as const,
        description: 'Promoted due to good performance',
        timestamp: '2026-04-07T10:00:00.000Z',
      };

      await publishSoulLifecycleEvent(event);

      expect(mockPublishMessage).toHaveBeenCalledTimes(1);
      const callArg = mockPublishMessage.mock.calls[0]![0] as { data: Buffer };
      const parsed = JSON.parse(callArg.data.toString());
      expect(parsed.type).toBe('soul_promoted');
      expect(parsed.fromClass).toBe('Novice');
      expect(parsed.toClass).toBe('Understudy');
    });
  });

  describe('publishRingLeaderEvent', () => {
    it('publishes a ring_leader_status_change event to ring-leader-events topic', async () => {
      vi.resetModules();
      const { publishRingLeaderEvent } = await import('../../events/publisher.js');

      const event = {
        type: 'ring_leader_status_change' as const,
        runId: '550e8400-e29b-41d4-a716-446655440003',
        executionId: '550e8400-e29b-41d4-a716-446655440001',
        fromStatus: 'coordinating' as const,
        toStatus: 'synthesizing' as const,
        description: 'All agents have completed their tasks',
        timestamp: '2026-04-07T10:00:00.000Z',
      };

      await publishRingLeaderEvent(event);

      expect(mockPublishMessage).toHaveBeenCalledTimes(1);
      const callArg = mockPublishMessage.mock.calls[0]![0] as { data: Buffer };
      const parsed = JSON.parse(callArg.data.toString());
      expect(parsed.type).toBe('ring_leader_status_change');
      expect(parsed.fromStatus).toBe('coordinating');
      expect(parsed.toStatus).toBe('synthesizing');
    });
  });
});
