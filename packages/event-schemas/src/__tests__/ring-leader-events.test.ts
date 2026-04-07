import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  ringLeaderStatusChangeEventSchema,
  intelligenceRoutingEventSchema,
  reallocationEventSchema,
  reanchoringEventSchema,
  budgetDegradationEventSchema,
  ringLeaderEventSchema,
} from '../ring-leader-events';

const VALID_STATUS_CHANGE = {
  type: 'ring_leader_status_change',
  runId: '550e8400-e29b-41d4-a716-446655440000',
  executionId: '550e8400-e29b-41d4-a716-446655440001',
  fromStatus: 'assembling',
  toStatus: 'spawning',
  description: 'All bots spawned successfully',
  timestamp: '2024-01-15T10:30:00.000Z',
};

const VALID_INTELLIGENCE_ROUTING = {
  type: 'intelligence_routing',
  runId: '550e8400-e29b-41d4-a716-446655440000',
  executionId: '550e8400-e29b-41d4-a716-446655440001',
  fromAgentSessionId: '550e8400-e29b-41d4-a716-446655440002',
  toAgentSessionId: '550e8400-e29b-41d4-a716-446655440003',
  fromTaskId: 'task-1',
  toTaskId: 'task-2',
  signalSummary: 'Partial result ready',
  routingRationale: 'Next bot has capacity',
  timestamp: '2024-01-15T10:30:00.000Z',
};

const VALID_REALLOCATION = {
  type: 'reallocation',
  runId: '550e8400-e29b-41d4-a716-446655440000',
  executionId: '550e8400-e29b-41d4-a716-446655440001',
  trigger: 'agent_failure',
  affectedAgentSessionId: '550e8400-e29b-41d4-a716-446655440002',
  affectedTaskId: 'task-1',
  action: 'replacement_spawned',
  rationale: 'Agent failed during execution',
  timestamp: '2024-01-15T10:30:00.000Z',
};

const VALID_REANCHORING = {
  type: 'reanchoring',
  runId: '550e8400-e29b-41d4-a716-446655440000',
  executionId: '550e8400-e29b-41d4-a716-446655440001',
  driftScore: 0.3,
  objectiveRestatement: 'Complete the original objective',
  driftSummary: 'Minor deviation detected',
  reorientationDirective: 'Return to core task',
  timestamp: '2024-01-15T10:30:00.000Z',
};

const VALID_BUDGET_DEGRADATION = {
  type: 'budget_degradation',
  runId: '550e8400-e29b-41d4-a716-446655440000',
  executionId: '550e8400-e29b-41d4-a716-446655440001',
  previousTier: 'normal',
  newTier: 'deprioritize',
  budgetConsumedPercent: 0.75,
  projectedOverrunPercent: 0.15,
  description: 'Budget 75% consumed, entering deprioritize tier',
  timestamp: '2024-01-15T10:30:00.000Z',
};

describe('ringLeaderStatusChangeEventSchema', () => {
  it('parses valid status change event', () => {
    const result = ringLeaderStatusChangeEventSchema.parse(VALID_STATUS_CHANGE);
    expect(result.type).toBe('ring_leader_status_change');
    expect(result.fromStatus).toBe('assembling');
    expect(result.toStatus).toBe('spawning');
  });

  it('parses all valid status values', () => {
    const statuses = ['assembling', 'spawning', 'coordinating', 'synthesizing', 'completed', 'failed'] as const;
    for (const fromStatus of statuses) {
      for (const toStatus of statuses) {
        const result = ringLeaderStatusChangeEventSchema.parse({
          ...VALID_STATUS_CHANGE,
          fromStatus,
          toStatus,
        });
        expect(result.fromStatus).toBe(fromStatus);
        expect(result.toStatus).toBe(toStatus);
      }
    }
  });

  it('throws on missing required type field', () => {
    const { type: _type, ...withoutType } = VALID_STATUS_CHANGE;
    expect(() => ringLeaderStatusChangeEventSchema.parse(withoutType)).toThrow(z.ZodError);
  });

  it('throws on invalid fromStatus', () => {
    const result = { ...VALID_STATUS_CHANGE, fromStatus: 'invalid' };
    expect(() => ringLeaderStatusChangeEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = ringLeaderStatusChangeEventSchema.parse({
      ...VALID_STATUS_CHANGE,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });
});

describe('intelligenceRoutingEventSchema', () => {
  it('parses valid intelligence routing event', () => {
    const result = intelligenceRoutingEventSchema.parse(VALID_INTELLIGENCE_ROUTING);
    expect(result.type).toBe('intelligence_routing');
    expect(result.fromAgentSessionId).toBe(VALID_INTELLIGENCE_ROUTING.fromAgentSessionId);
    expect(result.toAgentSessionId).toBe(VALID_INTELLIGENCE_ROUTING.toAgentSessionId);
  });

  it('throws on missing required type field', () => {
    const { type: _type, ...withoutType } = VALID_INTELLIGENCE_ROUTING;
    expect(() => intelligenceRoutingEventSchema.parse(withoutType)).toThrow(z.ZodError);
  });

  it('throws on missing required signalSummary field', () => {
    const { signalSummary: _signalSummary, ...withoutSignalSummary } = VALID_INTELLIGENCE_ROUTING;
    expect(() => intelligenceRoutingEventSchema.parse(withoutSignalSummary)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = intelligenceRoutingEventSchema.parse({
      ...VALID_INTELLIGENCE_ROUTING,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });
});

describe('reallocationEventSchema', () => {
  it('parses valid reallocation event', () => {
    const result = reallocationEventSchema.parse(VALID_REALLOCATION);
    expect(result.type).toBe('reallocation');
    expect(result.trigger).toBe('agent_failure');
    expect(result.action).toBe('replacement_spawned');
  });

  it('parses all valid trigger values', () => {
    const triggers: Array<'agent_failure' | 'early_completion' | 'guardrail_trigger'> = [
      'agent_failure', 'early_completion', 'guardrail_trigger'
    ];
    for (const trigger of triggers) {
      const result = reallocationEventSchema.parse({ ...VALID_REALLOCATION, trigger });
      expect(result.trigger).toBe(trigger);
    }
  });

  it('parses all valid action values', () => {
    const actions: Array<'redistributed' | 'replacement_spawned' | 'capacity_redirected' | 'paused_for_review'> = [
      'redistributed', 'replacement_spawned', 'capacity_redirected', 'paused_for_review'
    ];
    for (const action of actions) {
      const result = reallocationEventSchema.parse({ ...VALID_REALLOCATION, action });
      expect(result.action).toBe(action);
    }
  });

  it('throws on missing required type field', () => {
    const { type: _type, ...withoutType } = VALID_REALLOCATION;
    expect(() => reallocationEventSchema.parse(withoutType)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = reallocationEventSchema.parse({
      ...VALID_REALLOCATION,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });
});

describe('reanchoringEventSchema', () => {
  it('parses valid reanchoring event', () => {
    const result = reanchoringEventSchema.parse(VALID_REANCHORING);
    expect(result.type).toBe('reanchoring');
    expect(result.driftScore).toBe(0.3);
  });

  it('parses driftScore at boundaries', () => {
    const minDrift = { ...VALID_REANCHORING, driftScore: 0 };
    const resultMin = reanchoringEventSchema.parse(minDrift);
    expect(resultMin.driftScore).toBe(0);

    const maxDrift = { ...VALID_REANCHORING, driftScore: 1 };
    const resultMax = reanchoringEventSchema.parse(maxDrift);
    expect(resultMax.driftScore).toBe(1);
  });

  it('throws on driftScore below 0', () => {
    const result = { ...VALID_REANCHORING, driftScore: -0.1 };
    expect(() => reanchoringEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on driftScore above 1', () => {
    const result = { ...VALID_REANCHORING, driftScore: 1.1 };
    expect(() => reanchoringEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on missing required type field', () => {
    const { type: _type, ...withoutType } = VALID_REANCHORING;
    expect(() => reanchoringEventSchema.parse(withoutType)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = reanchoringEventSchema.parse({
      ...VALID_REANCHORING,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });
});

describe('budgetDegradationEventSchema', () => {
  it('parses valid budget degradation event', () => {
    const result = budgetDegradationEventSchema.parse(VALID_BUDGET_DEGRADATION);
    expect(result.type).toBe('budget_degradation');
    expect(result.previousTier).toBe('normal');
    expect(result.newTier).toBe('deprioritize');
    expect(result.budgetConsumedPercent).toBe(0.75);
  });

  it('parses all valid tier values', () => {
    const tiers = ['normal', 'deprioritize', 'consolidate', 'wrap_up', 'hard_stop'] as const;
    for (const previousTier of tiers) {
      for (const newTier of tiers) {
        const result = budgetDegradationEventSchema.parse({
          ...VALID_BUDGET_DEGRADATION,
          previousTier,
          newTier,
        });
        expect(result.previousTier).toBe(previousTier);
        expect(result.newTier).toBe(newTier);
      }
    }
  });

  it('parses null projectedOverrunPercent', () => {
    const result = budgetDegradationEventSchema.parse({
      ...VALID_BUDGET_DEGRADATION,
      projectedOverrunPercent: null,
    });
    expect(result.projectedOverrunPercent).toBeNull();
  });

  it('throws on missing required type field', () => {
    const { type: _type, ...withoutType } = VALID_BUDGET_DEGRADATION;
    expect(() => budgetDegradationEventSchema.parse(withoutType)).toThrow(z.ZodError);
  });

  it('throws on budgetConsumedPercent below 0', () => {
    const result = { ...VALID_BUDGET_DEGRADATION, budgetConsumedPercent: -0.1 };
    expect(() => budgetDegradationEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on budgetConsumedPercent above 1', () => {
    const result = { ...VALID_BUDGET_DEGRADATION, budgetConsumedPercent: 1.1 };
    expect(() => budgetDegradationEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = budgetDegradationEventSchema.parse({
      ...VALID_BUDGET_DEGRADATION,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });
});

describe('ringLeaderEventSchema (discriminated union)', () => {
  it('resolves to ring_leader_status_change type', () => {
    const result = ringLeaderEventSchema.parse(VALID_STATUS_CHANGE);
    expect(result.type).toBe('ring_leader_status_change');
    expect(result.fromStatus).toBe('assembling');
  });

  it('resolves to intelligence_routing type', () => {
    const result = ringLeaderEventSchema.parse(VALID_INTELLIGENCE_ROUTING);
    expect(result.type).toBe('intelligence_routing');
    expect(result.signalSummary).toBe('Partial result ready');
  });

  it('resolves to reallocation type', () => {
    const result = ringLeaderEventSchema.parse(VALID_REALLOCATION);
    expect(result.type).toBe('reallocation');
    expect(result.action).toBe('replacement_spawned');
  });

  it('resolves to reanchoring type', () => {
    const result = ringLeaderEventSchema.parse(VALID_REANCHORING);
    expect(result.type).toBe('reanchoring');
    expect(result.driftScore).toBe(0.3);
  });

  it('resolves to budget_degradation type', () => {
    const result = ringLeaderEventSchema.parse(VALID_BUDGET_DEGRADATION);
    expect(result.type).toBe('budget_degradation');
    expect(result.newTier).toBe('deprioritize');
  });

  it('throws on invalid type discriminant', () => {
    const result = { ...VALID_STATUS_CHANGE, type: 'invalid_type' };
    expect(() => ringLeaderEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws when missing type discriminant', () => {
    const { type: _type, ...withoutType } = VALID_STATUS_CHANGE;
    expect(() => ringLeaderEventSchema.parse(withoutType)).toThrow(z.ZodError);
  });

  it('each event type has required timestamp field', () => {
    const events = [
      { ...VALID_STATUS_CHANGE },
      { ...VALID_INTELLIGENCE_ROUTING },
      { ...VALID_REALLOCATION },
      { ...VALID_REANCHORING },
      { ...VALID_BUDGET_DEGRADATION },
    ];
    for (const event of events) {
      const { timestamp: _timestamp, ...withoutTimestamp } = event;
      expect(() => ringLeaderEventSchema.parse(withoutTimestamp)).toThrow(z.ZodError);
    }
  });

  it('each event type has type discriminant', () => {
    const events = [
      VALID_STATUS_CHANGE,
      VALID_INTELLIGENCE_ROUTING,
      VALID_REALLOCATION,
      VALID_REANCHORING,
      VALID_BUDGET_DEGRADATION,
    ];
    for (const event of events) {
      const parsed = ringLeaderEventSchema.parse(event);
      expect(parsed).toHaveProperty('type');
    }
  });
});