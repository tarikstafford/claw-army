import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  soulPromotedEventSchema,
  soulDemotedEventSchema,
  soulRetiredEventSchema,
  pioneerDetectedEventSchema,
  soulLifecycleEventSchema,
} from '../soul-lifecycle-events';

const VALID_SOUL_PROMOTED = {
  type: 'soul_promoted',
  botId: '550e8400-e29b-41d4-a716-446655440000',
  executionId: '550e8400-e29b-41d4-a716-446655440001',
  taskCategory: 'code_review',
  fromClass: 'Novice',
  toClass: 'Understudy',
  description: 'Promoted for consistent high-quality reviews',
  timestamp: '2024-01-15T10:30:00.000Z',
};

const VALID_SOUL_DEMOTED = {
  type: 'soul_demoted',
  botId: '550e8400-e29b-41d4-a716-446655440000',
  executionId: '550e8400-e29b-41d4-a716-446655440001',
  taskCategory: 'code_review',
  fromClass: 'Understudy',
  toClass: 'Novice',
  description: 'Demoted due to quality issues',
  timestamp: '2024-01-15T10:30:00.000Z',
};

const VALID_SOUL_RETIRED = {
  type: 'soul_retired',
  botId: '550e8400-e29b-41d4-a716-446655440000',
  executionId: '550e8400-e29b-41d4-a716-446655440001',
  taskCategory: 'code_review',
  fromClass: 'Artisan',
  description: 'Retired after exceptional service',
  timestamp: '2024-01-15T10:30:00.000Z',
};

const VALID_PIONEER_DETECTED = {
  type: 'pioneer_detected',
  botId: '550e8400-e29b-41d4-a716-446655440000',
  executionId: '550e8400-e29b-41d4-a716-446655440001',
  taskCategory: 'code_review',
  description: 'Pioneer behavior detected in new task category',
  timestamp: '2024-01-15T10:30:00.000Z',
};

describe('soulPromotedEventSchema', () => {
  it('parses valid soul promoted event', () => {
    const result = soulPromotedEventSchema.parse(VALID_SOUL_PROMOTED);
    expect(result.type).toBe('soul_promoted');
    expect(result.fromClass).toBe('Novice');
    expect(result.toClass).toBe('Understudy');
  });

  it('parses soul promoted from Novice to Understudy', () => {
    const result = soulPromotedEventSchema.parse({
      ...VALID_SOUL_PROMOTED,
      fromClass: 'Novice',
      toClass: 'Understudy',
    });
    expect(result.fromClass).toBe('Novice');
    expect(result.toClass).toBe('Understudy');
  });

  it('parses soul promoted from Understudy to Artisan', () => {
    const result = soulPromotedEventSchema.parse({
      ...VALID_SOUL_PROMOTED,
      fromClass: 'Understudy',
      toClass: 'Artisan',
    });
    expect(result.fromClass).toBe('Understudy');
    expect(result.toClass).toBe('Artisan');
  });

  it('throws on invalid fromClass', () => {
    const result = { ...VALID_SOUL_PROMOTED, fromClass: 'Invalid' };
    expect(() => soulPromotedEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on invalid toClass', () => {
    const result = { ...VALID_SOUL_PROMOTED, toClass: 'Invalid' };
    expect(() => soulPromotedEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on missing required type field', () => {
    const { type: _type, ...withoutType } = VALID_SOUL_PROMOTED;
    expect(() => soulPromotedEventSchema.parse(withoutType)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = soulPromotedEventSchema.parse({
      ...VALID_SOUL_PROMOTED,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });
});

describe('soulDemotedEventSchema', () => {
  it('parses valid soul demoted event', () => {
    const result = soulDemotedEventSchema.parse(VALID_SOUL_DEMOTED);
    expect(result.type).toBe('soul_demoted');
    expect(result.fromClass).toBe('Understudy');
    expect(result.toClass).toBe('Novice');
  });

  it('parses soul demoted from Artisan to Understudy', () => {
    const result = soulDemotedEventSchema.parse({
      ...VALID_SOUL_DEMOTED,
      fromClass: 'Artisan',
      toClass: 'Understudy',
    });
    expect(result.fromClass).toBe('Artisan');
    expect(result.toClass).toBe('Understudy');
  });

  it('throws on invalid fromClass', () => {
    const result = { ...VALID_SOUL_DEMOTED, fromClass: 'Invalid' };
    expect(() => soulDemotedEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on invalid toClass', () => {
    const result = { ...VALID_SOUL_DEMOTED, toClass: 'Invalid' };
    expect(() => soulDemotedEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on missing required type field', () => {
    const { type: _type, ...withoutType } = VALID_SOUL_DEMOTED;
    expect(() => soulDemotedEventSchema.parse(withoutType)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = soulDemotedEventSchema.parse({
      ...VALID_SOUL_DEMOTED,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });
});

describe('soulRetiredEventSchema', () => {
  it('parses valid soul retired event', () => {
    const result = soulRetiredEventSchema.parse(VALID_SOUL_RETIRED);
    expect(result.type).toBe('soul_retired');
    expect(result.fromClass).toBe('Artisan');
  });

  it('parses soul retired from all classes', () => {
    const classes = ['Novice', 'Understudy', 'Artisan'] as const;
    for (const fromClass of classes) {
      const result = soulRetiredEventSchema.parse({ ...VALID_SOUL_RETIRED, fromClass });
      expect(result.fromClass).toBe(fromClass);
    }
  });

  it('throws on missing required type field', () => {
    const { type: _type, ...withoutType } = VALID_SOUL_RETIRED;
    expect(() => soulRetiredEventSchema.parse(withoutType)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = soulRetiredEventSchema.parse({
      ...VALID_SOUL_RETIRED,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });
});

describe('pioneerDetectedEventSchema', () => {
  it('parses valid pioneer detected event', () => {
    const result = pioneerDetectedEventSchema.parse(VALID_PIONEER_DETECTED);
    expect(result.type).toBe('pioneer_detected');
    expect(result.taskCategory).toBe('code_review');
    expect(result.description).toBe('Pioneer behavior detected in new task category');
  });

  it('throws on missing required type field', () => {
    const { type: _type, ...withoutType } = VALID_PIONEER_DETECTED;
    expect(() => pioneerDetectedEventSchema.parse(withoutType)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = pioneerDetectedEventSchema.parse({
      ...VALID_PIONEER_DETECTED,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });
});

describe('soulLifecycleEventSchema (discriminated union)', () => {
  it('resolves to soul_promoted type', () => {
    const result = soulLifecycleEventSchema.parse(VALID_SOUL_PROMOTED);
    expect(result.type).toBe('soul_promoted');
    expect(result.toClass).toBe('Understudy');
  });

  it('resolves to soul_demoted type', () => {
    const result = soulLifecycleEventSchema.parse(VALID_SOUL_DEMOTED);
    expect(result.type).toBe('soul_demoted');
    expect(result.toClass).toBe('Novice');
  });

  it('resolves to soul_retired type', () => {
    const result = soulLifecycleEventSchema.parse(VALID_SOUL_RETIRED);
    expect(result.type).toBe('soul_retired');
    expect(result.fromClass).toBe('Artisan');
  });

  it('resolves to pioneer_detected type', () => {
    const result = soulLifecycleEventSchema.parse(VALID_PIONEER_DETECTED);
    expect(result.type).toBe('pioneer_detected');
    expect(result.taskCategory).toBe('code_review');
  });

  it('throws on invalid type discriminant', () => {
    const result = { ...VALID_SOUL_PROMOTED, type: 'invalid_type' };
    expect(() => soulLifecycleEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws when missing type discriminant', () => {
    const { type: _type, ...withoutType } = VALID_SOUL_PROMOTED;
    expect(() => soulLifecycleEventSchema.parse(withoutType)).toThrow(z.ZodError);
  });

  it('each event type has required timestamp field', () => {
    const events = [
      { ...VALID_SOUL_PROMOTED },
      { ...VALID_SOUL_DEMOTED },
      { ...VALID_SOUL_RETIRED },
      { ...VALID_PIONEER_DETECTED },
    ];
    for (const event of events) {
      const { timestamp: _timestamp, ...withoutTimestamp } = event;
      expect(() => soulLifecycleEventSchema.parse(withoutTimestamp)).toThrow(z.ZodError);
    }
  });

  it('each event type has type discriminant', () => {
    const events = [
      VALID_SOUL_PROMOTED,
      VALID_SOUL_DEMOTED,
      VALID_SOUL_RETIRED,
      VALID_PIONEER_DETECTED,
    ];
    for (const event of events) {
      const parsed = soulLifecycleEventSchema.parse(event);
      expect(parsed).toHaveProperty('type');
    }
  });

  it('verifies ISO datetime validation on timestamp fields', () => {
    const events = [
      { ...VALID_SOUL_PROMOTED },
      { ...VALID_SOUL_DEMOTED },
      { ...VALID_SOUL_RETIRED },
      { ...VALID_PIONEER_DETECTED },
    ];
    for (const event of events) {
      const invalidTimestamp = { ...event, timestamp: 'not-a-date' };
      expect(() => soulLifecycleEventSchema.parse(invalidTimestamp)).toThrow(z.ZodError);
    }
  });
});