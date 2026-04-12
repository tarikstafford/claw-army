import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPublishRingLeaderEvent = vi.fn().mockResolvedValue(undefined);

vi.mock('../../events/publisher.js', () => ({
  publishRingLeaderEvent: (...args: unknown[]) => mockPublishRingLeaderEvent(...args),
}));

import {
  logCoordinationEvent,
  getCoordinationLog,
  clearCoordinationLog,
} from '../../services/coordination-events.js';

describe('coordination-events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear all logs between tests
    clearCoordinationLog('run-1');
    clearCoordinationLog('run-2');
  });

  describe('logCoordinationEvent', () => {
    it('appends an event to the in-memory log', async () => {
      const event = { type: 'intelligence_routing' as const, runId: 'run-1' } as any;
      await logCoordinationEvent('run-1', 'exec-1', event);

      const log = getCoordinationLog('run-1');
      expect(log).toHaveLength(1);
      expect(log[0]!.type).toBe('intelligence_routing');
      expect(log[0]!.payload).toBe(event);
      expect(log[0]!.timestamp).toBeDefined();
    });

    it('publishes the event via the publisher', async () => {
      const event = { type: 'reallocation' as const } as any;
      await logCoordinationEvent('run-1', 'exec-1', event);
      expect(mockPublishRingLeaderEvent).toHaveBeenCalledWith(event);
    });

    it('appends multiple events in order', async () => {
      const event1 = { type: 'intelligence_routing' as const } as any;
      const event2 = { type: 'reallocation' as const } as any;

      await logCoordinationEvent('run-1', 'exec-1', event1);
      await logCoordinationEvent('run-1', 'exec-1', event2);

      const log = getCoordinationLog('run-1');
      expect(log).toHaveLength(2);
      expect(log[0]!.type).toBe('intelligence_routing');
      expect(log[1]!.type).toBe('reallocation');
    });

    it('maintains separate logs for different runIds', async () => {
      const event1 = { type: 'intelligence_routing' as const } as any;
      const event2 = { type: 'reallocation' as const } as any;

      await logCoordinationEvent('run-1', 'exec-1', event1);
      await logCoordinationEvent('run-2', 'exec-2', event2);

      expect(getCoordinationLog('run-1')).toHaveLength(1);
      expect(getCoordinationLog('run-2')).toHaveLength(1);
    });
  });

  describe('getCoordinationLog', () => {
    it('returns empty array for unknown runId', () => {
      expect(getCoordinationLog('nonexistent')).toEqual([]);
    });
  });

  describe('clearCoordinationLog', () => {
    it('removes all events for a given runId', async () => {
      const event = { type: 'intelligence_routing' as const } as any;
      await logCoordinationEvent('run-1', 'exec-1', event);

      expect(getCoordinationLog('run-1')).toHaveLength(1);

      clearCoordinationLog('run-1');

      expect(getCoordinationLog('run-1')).toEqual([]);
    });

    it('does not throw when clearing a nonexistent runId', () => {
      expect(() => clearCoordinationLog('nonexistent')).not.toThrow();
    });
  });
});
