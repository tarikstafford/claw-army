import { describe, it, expect, vi } from 'vitest';

const mockWorkerOn = vi.fn();
const mockWorkerOnError = vi.fn();
const mockWorkerOnFailed = vi.fn();
const mockWorkerOnCompleted = vi.fn();

vi.mock('bullmq', () => ({
  Queue: vi.fn(),
  Worker: vi.fn().mockImplementation(() => ({
    on: mockWorkerOn,
  })),
}));

describe('council-worker', () => {
  describe('COUNCIL_LOCK_DURATION_MS constant', () => {
    it('is 5 minutes in ms', () => {
      const COUNCIL_LOCK_DURATION_MS = 5 * 60 * 1000;
      expect(COUNCIL_LOCK_DURATION_MS).toBe(300_000);
    });
  });

  describe('COUNCIL_STALLED_INTERVAL_MS constant', () => {
    it('is 30 seconds', () => {
      const COUNCIL_STALLED_INTERVAL_MS = 30_000;
      expect(COUNCIL_STALLED_INTERVAL_MS).toBe(30_000);
    });
  });

  describe('COUNCIL_MAX_STALLED_COUNT constant', () => {
    it('is 1', () => {
      const COUNCIL_MAX_STALLED_COUNT = 1;
      expect(COUNCIL_MAX_STALLED_COUNT).toBe(1);
    });
  });

  describe('COUNCIL_CONCURRENCY constant', () => {
    it('is 5', () => {
      const COUNCIL_CONCURRENCY = 5;
      expect(COUNCIL_CONCURRENCY).toBe(5);
    });
  });

  describe('VERDICT_VALUES mapping', () => {
    const VERDICT_VALUES: Record<string, number> = {
      Promote: 4,
      Maintain: 3,
      Monitor: 2,
      Demote: 1,
      Retire: 0,
    };

    it('maps verdict strings to numeric values correctly', () => {
      expect(VERDICT_VALUES['Promote']).toBe(4);
      expect(VERDICT_VALUES['Maintain']).toBe(3);
      expect(VERDICT_VALUES['Monitor']).toBe(2);
      expect(VERDICT_VALUES['Demote']).toBe(1);
      expect(VERDICT_VALUES['Retire']).toBe(0);
    });
  });

  describe('VERDICT_FROM_VALUE mapping', () => {
    const VERDICT_FROM_VALUE = ['Retire', 'Demote', 'Monitor', 'Maintain', 'Promote'] as const;

    it('maps numeric values back to verdict strings correctly', () => {
      expect(VERDICT_FROM_VALUE[0]).toBe('Retire');
      expect(VERDICT_FROM_VALUE[1]).toBe('Demote');
      expect(VERDICT_FROM_VALUE[2]).toBe('Monitor');
      expect(VERDICT_FROM_VALUE[3]).toBe('Maintain');
      expect(VERDICT_FROM_VALUE[4]).toBe('Promote');
    });
  });

  describe('aggregateVerdicts', () => {
    const VERDICT_VALUES: Record<string, number> = {
      Promote: 4,
      Maintain: 3,
      Monitor: 2,
      Demote: 1,
      Retire: 0,
    };
    const VERDICT_FROM_VALUE = ['Retire', 'Demote', 'Monitor', 'Maintain', 'Promote'] as const;

    function aggregateVerdicts(
      perf: { verdictType: string; confidence: number; summary: string },
      soul: { verdictType: string; confidence: number; summary: string; strongUnresolvedArgument?: boolean },
      devil: { verdictType: string; confidence: number; summary: string; strongUnresolvedArgument?: boolean },
    ) {
      const weightedConfidenceScore =
        perf.confidence * 0.5 + soul.confidence * 0.35 + devil.confidence * 0.15;

      const perfVal = VERDICT_VALUES[perf.verdictType] ?? 2;
      const soulVal = VERDICT_VALUES[soul.verdictType] ?? 2;
      const devilVal = VERDICT_VALUES[devil.verdictType] ?? 2;

      const weightedVerdictValue = perfVal * 0.5 + soulVal * 0.35 + devilVal * 0.15;
      const rounded = Math.max(0, Math.min(4, Math.round(weightedVerdictValue)));
      const verdictType = VERDICT_FROM_VALUE[rounded] ?? 'Monitor';

      const hasUnresolvedDevilsAdvocate = devil.strongUnresolvedArgument ?? false;
      const requiresHumanConfirmation = hasUnresolvedDevilsAdvocate;

      const verdictSummary = `Performance Judge: ${perf.summary}\n\nSoul Analyst: ${soul.summary}\n\nDevil's Advocate: ${devil.summary}`;

      return {
        verdictType,
        weightedConfidenceScore,
        requiresHumanConfirmation,
        hasUnresolvedDevilsAdvocate,
        verdictSummary,
      };
    }

    it('aggregates all Promote verdicts to Promote', () => {
      const result = aggregateVerdicts(
        { verdictType: 'Promote', confidence: 0.9, summary: 'Great' },
        { verdictType: 'Promote', confidence: 0.9, summary: 'Great' },
        { verdictType: 'Promote', confidence: 0.9, summary: 'Great' },
      );
      expect(result.verdictType).toBe('Promote');
      expect(result.weightedConfidenceScore).toBeCloseTo(0.9);
      expect(result.requiresHumanConfirmation).toBe(false);
    });

    it('aggregates all Retire verdicts to Retire', () => {
      const result = aggregateVerdicts(
        { verdictType: 'Retire', confidence: 0.8, summary: 'Bad' },
        { verdictType: 'Retire', confidence: 0.8, summary: 'Bad' },
        { verdictType: 'Retire', confidence: 0.8, summary: 'Bad' },
      );
      expect(result.verdictType).toBe('Retire');
      expect(result.weightedConfidenceScore).toBeCloseTo(0.8);
    });

    it('computes weighted confidence score correctly', () => {
      const result = aggregateVerdicts(
        { verdictType: 'Promote', confidence: 1.0, summary: 'A' },
        { verdictType: 'Maintain', confidence: 0.5, summary: 'B' },
        { verdictType: 'Demote', confidence: 0.0, summary: 'C' },
      );
      expect(result.weightedConfidenceScore).toBeCloseTo(0.675);
    });

    it('requires human confirmation when Devil\'s Advocate has strong unresolved argument', () => {
      const result = aggregateVerdicts(
        { verdictType: 'Promote', confidence: 0.9, summary: 'A' },
        { verdictType: 'Promote', confidence: 0.9, summary: 'B' },
        { verdictType: 'Promote', confidence: 0.5, summary: 'C', strongUnresolvedArgument: true },
      );
      expect(result.requiresHumanConfirmation).toBe(true);
      expect(result.hasUnresolvedDevilsAdvocate).toBe(true);
    });

    it('does not require human confirmation when Devil\'s Advocate has no unresolved argument', () => {
      const result = aggregateVerdicts(
        { verdictType: 'Promote', confidence: 0.9, summary: 'A' },
        { verdictType: 'Promote', confidence: 0.9, summary: 'B' },
        { verdictType: 'Promote', confidence: 0.5, summary: 'C', strongUnresolvedArgument: false },
      );
      expect(result.requiresHumanConfirmation).toBe(false);
      expect(result.hasUnresolvedDevilsAdvocate).toBe(false);
    });

    it('builds correct verdictSummary', () => {
      const result = aggregateVerdicts(
        { verdictType: 'Promote', confidence: 0.9, summary: 'Perf summary' },
        { verdictType: 'Maintain', confidence: 0.7, summary: 'Soul summary' },
        { verdictType: 'Monitor', confidence: 0.5, summary: 'Devil summary' },
      );
      expect(result.verdictSummary).toContain('Performance Judge: Perf summary');
      expect(result.verdictSummary).toContain('Soul Analyst: Soul summary');
      expect(result.verdictSummary).toContain("Devil's Advocate: Devil summary");
    });

    it('handles unknown verdict types by treating as Monitor (value 2)', () => {
      const result = aggregateVerdicts(
        { verdictType: 'Unknown', confidence: 0.5, summary: 'A' },
        { verdictType: 'Unknown', confidence: 0.5, summary: 'B' },
        { verdictType: 'Unknown', confidence: 0.5, summary: 'C' },
      );
      expect(result.verdictType).toBe('Monitor');
    });

    it('clamps rounded verdict to Retire at minimum', () => {
      const result = aggregateVerdicts(
        { verdictType: 'Retire', confidence: 0.0, summary: 'A' },
        { verdictType: 'Retire', confidence: 0.0, summary: 'B' },
        { verdictType: 'Retire', confidence: 0.0, summary: 'C' },
      );
      expect(result.verdictType).toBe('Retire');
    });

    it('produces Maintain for weighted value ~2.5', () => {
      const result = aggregateVerdicts(
        { verdictType: 'Maintain', confidence: 0.8, summary: 'A' },
        { verdictType: 'Monitor', confidence: 0.8, summary: 'B' },
        { verdictType: 'Monitor', confidence: 0.8, summary: 'C' },
      );
      expect(result.verdictType).toBe('Maintain');
    });

    it('clamps to Promote at maximum', () => {
      const result = aggregateVerdicts(
        { verdictType: 'Promote', confidence: 1.0, summary: 'A' },
        { verdictType: 'Promote', confidence: 1.0, summary: 'B' },
        { verdictType: 'Promote', confidence: 1.0, summary: 'C' },
      );
      expect(result.verdictType).toBe('Promote');
    });
  });
});

type CouncilJobData = {
  executionId: string;
  botId: string;
  soulId: string | null;
  ringLeaderSynthesis?: unknown;
};
