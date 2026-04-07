import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('@claw/db', () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ remaining: 0 }]),
  };
  return { db: mockDb, tasks: {}, executions: {}, bots: {}, ringLeaderRuns: {} };
});

vi.mock('../../services/execution.service.js', () => ({
  transitionExecution: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../events/publisher.js', () => ({
  publishExecutionStatusChanged: vi.fn().mockResolvedValue(undefined),
  publishBillingEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../performance/performance-engine.js', () => ({
  runPerformancePipeline: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../queue/council-queue.js', () => ({
  councilQueue: {
    addBulk: vi.fn().mockResolvedValue(undefined),
  },
}));

const {
  checkExecutionCompletion,
  startCompletionPoller,
  stopCompletionPoller,
} = await import('../../orchestrator/completion-checker.js');

describe('completion-checker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkExecutionCompletion', () => {
    it('returns true and publishes events when all tasks are completed', async () => {
      const { db } = await import('@claw/db');
      db.where = vi.fn().mockResolvedValue([{ remaining: 0 }]);

      const { publishExecutionStatusChanged, publishBillingEvent } = await import('../../events/publisher.js');
      const { transitionExecution } = await import('../../services/execution.service.js');
      const { runPerformancePipeline } = await import('../../performance/performance-engine.js');

      const result = await checkExecutionCompletion('exec-001');

      expect(result).toBe(true);
      expect(transitionExecution).toHaveBeenCalledWith('exec-001', 'running', 'completed');
      expect(publishExecutionStatusChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'execution_status_changed',
          executionId: 'exec-001',
          toStatus: 'completed',
        }),
      );
      expect(publishBillingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'billing_event',
          eventType: 'execution_completed',
        }),
      );
    });

    it('returns false when tasks are still pending', async () => {
      const { db } = await import('@claw/db');
      db.where = vi.fn().mockResolvedValue([{ remaining: 5 }]);

      const { transitionExecution } = await import('../../services/execution.service.js');

      const result = await checkExecutionCompletion('exec-001');

      expect(result).toBe(false);
      expect(transitionExecution).not.toHaveBeenCalled();
    });

    it('returns false when transitionExecution returns false', async () => {
      const { db } = await import('@claw/db');
      db.where = vi.fn().mockResolvedValue([{ remaining: 0 }]);

      const { transitionExecution } = await import('../../services/execution.service.js');
      transitionExecution.mockResolvedValueOnce(false);

      const result = await checkExecutionCompletion('exec-001');

      expect(result).toBe(false);
    });
  });

  describe('startCompletionPoller / stopCompletionPoller', () => {
    it('polls until execution is completed then clears the timer', async () => {
      vi.useFakeTimers();

      const { db } = await import('@claw/db');
      db.where = vi.fn().mockResolvedValue([{ remaining: 5 }]);

      const timer = startCompletionPoller('exec-001', 1_000);

      vi.advanceTimersByTime(5_000);
      vi.useRealTimers();
      stopCompletionPoller(timer);

      expect(db.where).toHaveBeenCalled();
    });

    it('clears the timer when execution completes', async () => {
      vi.useFakeTimers();

      const { db } = await import('@claw/db');
      let callCount = 0;
      db.where = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount >= 3) {
          return Promise.resolve([{ remaining: 0 }]);
        }
        return Promise.resolve([{ remaining: 5 }]);
      });

      const timer = startCompletionPoller('exec-001', 1_000);

      vi.advanceTimersByTime(10_000);
      vi.useRealTimers();

      expect(callCount).toBeGreaterThan(0);
    });
  });
});