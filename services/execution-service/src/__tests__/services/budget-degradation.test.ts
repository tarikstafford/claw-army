import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBudgetDegradation } from '../../services/budget-degradation.js';
import type { CoordinationContext, RingLeaderMissionBrief, RingLeaderRunState } from '@claw/shared-types';

vi.mock('../../services/coordination-events.js', () => ({
  logCoordinationEvent: vi.fn().mockResolvedValue(undefined),
}));

function makeMissionBrief(overrides: Partial<RingLeaderMissionBrief> = {}): RingLeaderMissionBrief {
  return {
    objective: 'Test objective',
    taskGraph: { tasks: [], dag: {} },
    toolGrants: [],
    budgetCapCents: 1000,
    runtimeLimitSeconds: 3600,
    campaignType: 'ad_hoc',
    runId: 'run-001',
    projectId: null,
    ...overrides,
  };
}

function makeRunState(overrides: Partial<RingLeaderRunState> = {}): RingLeaderRunState {
  return {
    runId: 'run-001',
    elapsedTimeSeconds: 100,
    budgetConsumedCents: 100,
    taskStates: {},
    objectiveDriftScore: 0,
    anomalies: [],
    ...overrides,
  };
}

function makeCtx(
  missionBrief: RingLeaderMissionBrief = makeMissionBrief(),
  runState: RingLeaderRunState = makeRunState(),
): CoordinationContext {
  return {
    runId: missionBrief.runId,
    executionId: 'exec-001',
    missionBrief,
    registry: { sessions: new Map() } as any,
    runState,
    pollIntervalMs: 30000,
    startedAt: new Date(),
  };
}

describe('budget-degradation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('tierFromConsumedPercent (via execute)', () => {
    it('returns "normal" when consumed percent is below deprioritize threshold (0.55)', async () => {
      const module = createBudgetDegradation();
      const ctx = makeCtx(
        makeMissionBrief({ budgetCapCents: 1000, runtimeLimitSeconds: 600, runId: 'run-normal' }),
        makeRunState({ elapsedTimeSeconds: 100, budgetConsumedCents: 100, runId: 'run-normal' }),
      );

      await module.execute(ctx);

      expect(ctx.runState.anomalies.filter(a => a.includes('Budget tier'))).toHaveLength(0);
    });

    it('returns "deprioritize" when consumed >= 0.55 but < 0.70', async () => {
      const module = createBudgetDegradation();
      const ctx = makeCtx(
        makeMissionBrief({ budgetCapCents: 1000, runtimeLimitSeconds: 600, runId: 'run-deprioritize' }),
        makeRunState({ elapsedTimeSeconds: 100, budgetConsumedCents: 600, runId: 'run-deprioritize' }),
      );

      await module.execute(ctx);

      expect(ctx.runState.anomalies.some(a => a.includes('Budget tier: deprioritize'))).toBe(true);
    });

    it('returns "consolidate" when consumed >= 0.70 but < 0.85', async () => {
      const module = createBudgetDegradation();
      const ctx = makeCtx(
        makeMissionBrief({ budgetCapCents: 1000, runtimeLimitSeconds: 600, runId: 'run-consolidate' }),
        makeRunState({ elapsedTimeSeconds: 100, budgetConsumedCents: 750, runId: 'run-consolidate' }),
      );

      await module.execute(ctx);

      expect(ctx.runState.anomalies.some(a => a.includes('Budget tier: consolidate'))).toBe(true);
    });

    it('returns "wrap_up" when consumed >= 0.85 but < 0.95', async () => {
      const module = createBudgetDegradation();
      const ctx = makeCtx(
        makeMissionBrief({ budgetCapCents: 1000, runtimeLimitSeconds: 600, runId: 'run-wrapup' }),
        makeRunState({ elapsedTimeSeconds: 100, budgetConsumedCents: 900, runId: 'run-wrapup' }),
      );

      await module.execute(ctx);

      expect(ctx.runState.anomalies.some(a => a.includes('Budget tier: wrap_up'))).toBe(true);
    });

    it('returns "hard_stop" when consumed >= 0.95', async () => {
      const module = createBudgetDegradation();
      const ctx = makeCtx(
        makeMissionBrief({ budgetCapCents: 1000, runtimeLimitSeconds: 600, runId: 'run-hardstop' }),
        makeRunState({ elapsedTimeSeconds: 100, budgetConsumedCents: 960, runId: 'run-hardstop' }),
      );

      await module.execute(ctx);

      expect(ctx.runState.anomalies.some(a => a.includes('Budget tier: hard_stop'))).toBe(true);
      expect(ctx.runState.anomalies.some(a => a.includes('HARD STOP'))).toBe(true);
    });
  });

  describe('early warning for projected overrun', () => {
    it('promotes tier to deprioritize when projection shows > 20% overrun while still normal', async () => {
      const module = createBudgetDegradation();
      const ctx = makeCtx(
        makeMissionBrief({ budgetCapCents: 1000, runtimeLimitSeconds: 3600, runId: 'run-earlywarn' }),
        makeRunState({ elapsedTimeSeconds: 100, budgetConsumedCents: 400, runId: 'run-earlywarn' }),
      );

      await module.execute(ctx);

      expect(ctx.runState.anomalies.some(a => a.includes('Budget tier: deprioritize'))).toBe(true);
    });
  });

  describe('budget cap of zero (no cap)', () => {
    it('skips degradation when budgetCapCents is 0', async () => {
      const module = createBudgetDegradation();
      const ctx = makeCtx(
        makeMissionBrief({ budgetCapCents: 0, runId: 'run-nocap' }),
        makeRunState({ elapsedTimeSeconds: 100, budgetConsumedCents: 500, runId: 'run-nocap' }),
      );

      await module.execute(ctx);

      expect(ctx.runState.anomalies.filter(a => a.includes('Budget tier'))).toHaveLength(0);
    });
  });

  describe('insufficient elapsed time', () => {
    it('skips projection when elapsedSeconds < 10', async () => {
      const module = createBudgetDegradation();
      const ctx = makeCtx(
        makeMissionBrief({ budgetCapCents: 1000, runId: 'run-shorttime' }),
        makeRunState({ elapsedTimeSeconds: 5, budgetConsumedCents: 500, runId: 'run-shorttime' }),
      );

      await module.execute(ctx);

      expect(ctx.runState.anomalies.filter(a => a.includes('Budget tier'))).toHaveLength(0);
    });

    it('skips projection when budgetConsumed is 0', async () => {
      const module = createBudgetDegradation();
      const ctx = makeCtx(
        makeMissionBrief({ budgetCapCents: 1000, runId: 'run-nospent' }),
        makeRunState({ elapsedTimeSeconds: 100, budgetConsumedCents: 0, runId: 'run-nospent' }),
      );

      await module.execute(ctx);

      expect(ctx.runState.anomalies.filter(a => a.includes('Budget tier'))).toHaveLength(0);
    });
  });

  describe('tier change debounce', () => {
    it('does not emit new anomaly if last change was less than 60 seconds ago', async () => {
      const module = createBudgetDegradation();

      const ctx1 = makeCtx(
        makeMissionBrief({ budgetCapCents: 1000, runtimeLimitSeconds: 600, runId: 'run-debounce' }),
        makeRunState({ elapsedTimeSeconds: 100, budgetConsumedCents: 600, runId: 'run-debounce' }),
      );

      await module.execute(ctx1);

      vi.advanceTimersByTime(30_000);

      const ctx2 = makeCtx(
        makeMissionBrief({ budgetCapCents: 1000, runtimeLimitSeconds: 600, runId: 'run-debounce' }),
        makeRunState({ elapsedTimeSeconds: 130, budgetConsumedCents: 850, runId: 'run-debounce' }),
      );

      await module.execute(ctx2);

      expect(ctx2.runState.anomalies.filter(a => a.includes('Budget tier: wrap_up'))).toHaveLength(0);
    });
  });
});
