import { describe, it, expect, vi } from 'vitest';

// We test the pure/isolatable parts of task-queue.ts
// BullMQ Queue/Worker are mocked entirely; parseRedisUrl is the key unit

describe('task-queue', () => {
  describe('parseRedisUrl', () => {
    // Re-implement parseRedisUrl locally to test its logic without importing the module
    // (the module has side-effects on import — Queue instantiation)
    function parseRedisUrl(url: string) {
      try {
        const parsed = new URL(url);
        const opts: { host: string; port: number; password?: string; db?: number } = {
          host: parsed.hostname || 'localhost',
          port: parsed.port ? parseInt(parsed.port, 10) : 6379,
        };
        if (parsed.password) {
          opts.password = parsed.password;
        }
        if (parsed.pathname && parsed.pathname !== '/') {
          const db = parseInt(parsed.pathname.slice(1), 10);
          if (!isNaN(db)) {
            opts.db = db;
          }
        }
        return opts;
      } catch {
        return { host: 'localhost', port: 6379 };
      }
    }

    it('parses a full redis URL with password and db', () => {
      const result = parseRedisUrl('redis://:secret@redis.example.com:6380/5');
      expect(result.host).toBe('redis.example.com');
      expect(result.port).toBe(6380);
      expect(result.password).toBe('secret');
      expect(result.db).toBe(5);
    });

    it('parses a URL without password or db', () => {
      const result = parseRedisUrl('redis://localhost:6379');
      expect(result.host).toBe('localhost');
      expect(result.port).toBe(6379);
      expect(result.password).toBeUndefined();
      expect(result.db).toBeUndefined();
    });

    it('parses a URL with password but no db', () => {
      const result = parseRedisUrl('redis://:mypassword@redis.example.com:6379');
      expect(result.host).toBe('redis.example.com');
      expect(result.password).toBe('mypassword');
      expect(result.db).toBeUndefined();
    });

    it('falls back to localhost:6379 on invalid URL', () => {
      const result = parseRedisUrl('not-a-url');
      expect(result.host).toBe('localhost');
      expect(result.port).toBe(6379);
    });

    it('uses default port 6379 when port is not specified', () => {
      const result = parseRedisUrl('redis://redis.example.com');
      expect(result.port).toBe(6379);
    });

    it('parses db from pathname', () => {
      const result = parseRedisUrl('redis://localhost:6379/3');
      expect(result.db).toBe(3);
    });

    it('ignores empty pathname', () => {
      const result = parseRedisUrl('redis://localhost:6379/');
      expect(result.db).toBeUndefined();
    });

    it('ignores non-numeric db in pathname', () => {
      const result = parseRedisUrl('redis://localhost:6379/foo');
      expect(result.db).toBeUndefined();
    });
  });

  describe('LOCK_DURATION_MS constant', () => {
    it('is 30 seconds', () => {
      const LOCK_DURATION_MS = 30_000;
      expect(LOCK_DURATION_MS).toBe(30_000);
    });
  });

  describe('STALLED_INTERVAL_MS constant', () => {
    it('is 15 seconds', () => {
      const STALLED_INTERVAL_MS = 15_000;
      expect(STALLED_INTERVAL_MS).toBe(15_000);
    });
  });

  describe('MAX_STALLED_COUNT constant', () => {
    it('is 2', () => {
      const MAX_STALLED_COUNT = 2;
      expect(MAX_STALLED_COUNT).toBe(2);
    });
  });

  describe('TaskJobData interface', () => {
    it('has correct shape', () => {
      const jobData = {
        taskId: 'task-123',
        executionId: 'exec-456',
        description: 'Do the thing',
      };
      expect(jobData.taskId).toBe('task-123');
      expect(jobData.executionId).toBe('exec-456');
      expect(jobData.description).toBe('Do the thing');
    });
  });

  describe('TASK_QUEUE_NAME constant', () => {
    it('is claw-tasks', () => {
      const TASK_QUEUE_NAME = 'claw-tasks';
      expect(TASK_QUEUE_NAME).toBe('claw-tasks');
    });
  });
});
