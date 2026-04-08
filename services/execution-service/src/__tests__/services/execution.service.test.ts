import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createExecution,
  getExecution,
  transitionExecution,
  type CreateExecutionInput,
} from '../../services/execution.service.js';

const { MockIORedis } = vi.hoisted(() => {
  class MockIORedis {
    setex = vi.fn().mockResolvedValue('OK');
  }
  return { MockIORedis };
});

vi.mock('@claw/db', () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  };
  return { db: mockDb, executions: {}, objectives: {}, executionStatusEnum: { enumValues: ['pre_flight', 'pending', 'running', 'completed', 'failed'] } };
});

vi.mock('ioredis', () => ({
  default: MockIORedis,
}));

const mockDb = vi.mocked(await import('@claw/db')).db;

describe('execution.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createExecution', () => {
    it('creates an execution and returns executionId with pre_flight status', async () => {
      const input: CreateExecutionInput = {
        objective: 'Test objective',
        maxBots: 5,
        budgetCapCents: 1000,
        runtimeLimitSeconds: 3600,
        allowedTools: ['tool-a', 'tool-b'],
      };

      const mockReturning = [{ id: 'exec-123' }];
      vi.mocked(mockDb.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(mockReturning),
        }),
      } as any);

      const result = await createExecution(input);

      expect(result.executionId).toBe('exec-123');
      expect(result.status).toBe('pre_flight');
    });

    it('validates objectiveId if provided and objective is not archived', async () => {
      const input: CreateExecutionInput = {
        objective: 'Test',
        maxBots: 5,
        budgetCapCents: 1000,
        runtimeLimitSeconds: 3600,
        allowedTools: [],
        objectiveId: 'obj-456',
      };

      const mockSelectResult = [{ id: 'obj-456' }];
      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockSelectResult),
        }),
      } as any);

      const mockReturning = [{ id: 'exec-789' }];
      vi.mocked(mockDb.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(mockReturning),
        }),
      } as any);

      await createExecution(input);

      expect(mockDb.select).toHaveBeenCalled();
    });

    it('throws error if objectiveId is provided but objective not found or archived', async () => {
      const input: CreateExecutionInput = {
        objective: 'Test',
        maxBots: 5,
        budgetCapCents: 1000,
        runtimeLimitSeconds: 3600,
        allowedTools: [],
        objectiveId: 'obj-nonexistent',
      };

      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      await expect(createExecution(input)).rejects.toThrow('Objective not found or archived');
    });

    it('throws error when insert returns no rows', async () => {
      const input: CreateExecutionInput = {
        objective: 'Test',
        maxBots: 5,
        budgetCapCents: 1000,
        runtimeLimitSeconds: 3600,
        allowedTools: [],
      };

      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);
      vi.mocked(mockDb.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      await expect(createExecution(input)).rejects.toThrow('Failed to create execution: no row returned');
    });
  });

  describe('getExecution', () => {
    it('returns execution when found', async () => {
      const mockExecution = {
        id: 'exec-123',
        objective: 'Test',
        status: 'pre_flight',
        maxBots: 5,
        budgetCapCents: 1000,
      };

      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockExecution]),
        }),
      } as any);

      const result = await getExecution('exec-123');

      expect(result).toEqual(mockExecution);
    });

    it('returns null when execution not found', async () => {
      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await getExecution('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('transitionExecution', () => {
    it('returns true when transition succeeds', async () => {
      vi.mocked(mockDb.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'exec-123' }]),
          }),
        }),
      } as any);

      const result = await transitionExecution('exec-123', 'pre_flight', 'running');

      expect(result).toBe(true);
    });

    it('returns false when transition fails (wrong fromStatus)', async () => {
      vi.mocked(mockDb.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await transitionExecution('exec-123', 'completed', 'running');

      expect(result).toBe(false);
    });

    it('returns false when execution does not exist', async () => {
      vi.mocked(mockDb.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await transitionExecution('nonexistent', 'pre_flight', 'running');

      expect(result).toBe(false);
    });
  });
});
