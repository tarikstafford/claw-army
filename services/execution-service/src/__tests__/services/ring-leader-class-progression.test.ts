import { describe, it, expect, vi } from 'vitest';
import { evaluateRingLeaderPromotion } from '../../services/ring-leader-class-progression';

vi.mock('@claw/db', () => ({
  db: {
    select: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockResolvedValue([{ currentClass: 'Novice' }]),
    update: vi.fn().mockResolvedValue(undefined),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
  },
  ringLeaderRuns: { id: 'ring_leader_runs.id', soulId: 'ring_leader_runs.soulId', status: 'ring_leader_runs.status' },
  ringLeaderFitness: {},
  agentClasses: { botId: 'agent_classes.botId', taskCategory: 'agent_classes.task_category', currentClass: 'agent_classes.current_class' },
}));

describe('evaluateRingLeaderPromotion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('early exit conditions', () => {
    it('returns no promotion when soulId is null', async () => {
      const result = await evaluateRingLeaderPromotion({
        soulId: '',
        ringLeaderRunId: 'run-456',
        compositeScore: 0.70,
      });

      expect(result.promoted).toBe(false);
      expect(result.previousClass).toBe('Novice');
      expect(result.newClass).toBe('Novice');
      expect(result.reason).toBe('No soul assigned');
    });
  });
});
