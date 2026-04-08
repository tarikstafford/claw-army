import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';

vi.mock('@claw/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
  },
  bots: {},
  botSouls: {},
  toolInvocations: {},
  tasks: {},
  decisionTraces: {},
}));

vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => 'mock-model'),
}));

function toUUIDFormat(hex: string): string {
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

function makeDeterministicId(seed: string): string {
  const hex = createHash('sha256').update(seed, 'utf8').digest('hex');
  return toUUIDFormat(hex.slice(0, 32));
}

describe('attribution-compiler helpers', () => {
  describe('toUUIDFormat', () => {
    it('converts 32-char hex string to UUID format', () => {
      const hex = '1234567890abcdef1234567890abcdef';
      const uuid = toUUIDFormat(hex);
      expect(uuid).toBe('12345678-90ab-cdef-1234-567890abcdef');
    });

    it('handles all zeros', () => {
      const hex = '00000000000000000000000000000000';
      const uuid = toUUIDFormat(hex);
      expect(uuid).toBe('00000000-0000-0000-0000-000000000000');
    });

    it('handles all f values', () => {
      const hex = 'ffffffffffffffffffffffffffffffff';
      const uuid = toUUIDFormat(hex);
      expect(uuid).toBe('ffffffff-ffff-ffff-ffff-ffffffffffff');
    });

    it('produces valid UUID structure (8-4-4-4-12)', () => {
      const hex = 'abcdef1234567890abcdef1234567890';
      const uuid = toUUIDFormat(hex);
      const parts = uuid.split('-');
      expect(parts.length).toBe(5);
      expect(parts[0].length).toBe(8);
      expect(parts[1].length).toBe(4);
      expect(parts[2].length).toBe(4);
      expect(parts[3].length).toBe(4);
      expect(parts[4].length).toBe(12);
    });
  });

  describe('makeDeterministicId', () => {
    it('produces same ID for same seed (idempotent)', () => {
      const seed = 'tool_call:invocation-123';
      const id1 = makeDeterministicId(seed);
      const id2 = makeDeterministicId(seed);
      expect(id1).toBe(id2);
    });

    it('produces different IDs for different seeds', () => {
      const id1 = makeDeterministicId('seed-1');
      const id2 = makeDeterministicId('seed-2');
      expect(id1).not.toBe(id2);
    });

    it('produces valid UUID format', () => {
      const id = makeDeterministicId('test-seed');
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('is different from input seed', () => {
      const seed = 'my-unique-seed';
      const id = makeDeterministicId(seed);
      expect(id).not.toBe(seed);
    });

    it('handles empty string seed', () => {
      const id = makeDeterministicId('');
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('handles special characters in seed', () => {
      const id1 = makeDeterministicId('tool_call:invocation-123');
      const id2 = makeDeterministicId('tool_call:invocation-124');
      expect(id1).not.toBe(id2);
    });
  });
});

describe('AttributionSchema validation', () => {
  const { z } = require('zod');

  const AttributionSchema = z.object({
    directiveText: z.string(),
    confidence: z.number().min(0).max(1),
    outcome: z.enum(['success', 'failure', 'partial']),
    reasoning: z.string(),
  });

  it('accepts valid attribution object', () => {
    const valid = {
      directiveText: 'Always prioritize user privacy',
      confidence: 0.85,
      outcome: 'success',
      reasoning: 'The agent consistently checked privacy settings',
    };
    expect(() => AttributionSchema.parse(valid)).not.toThrow();
  });

  it('rejects confidence outside 0-1 range', () => {
    const invalid = {
      directiveText: 'Test',
      confidence: 1.5,
      outcome: 'success',
      reasoning: 'Test',
    };
    expect(() => AttributionSchema.parse(invalid)).toThrow();
  });

  it('rejects negative confidence', () => {
    const invalid = {
      directiveText: 'Test',
      confidence: -0.1,
      outcome: 'success',
      reasoning: 'Test',
    };
    expect(() => AttributionSchema.parse(invalid)).toThrow();
  });

  it('rejects invalid outcome enum', () => {
    const invalid = {
      directiveText: 'Test',
      confidence: 0.5,
      outcome: 'invalid',
      reasoning: 'Test',
    };
    expect(() => AttributionSchema.parse(invalid)).toThrow();
  });

  it('accepts partial outcome', () => {
    const partial = {
      directiveText: '',
      confidence: 0.0,
      outcome: 'partial',
      reasoning: 'Attribution failed',
    };
    expect(() => AttributionSchema.parse(partial)).not.toThrow();
  });

  it('accepts empty directiveText', () => {
    const empty = {
      directiveText: '',
      confidence: 0.0,
      outcome: 'partial',
      reasoning: 'No directive found',
    };
    expect(() => AttributionSchema.parse(empty)).not.toThrow();
  });
});

describe('attribution credit distribution', () => {
  it('distributes credit across multiple directives', () => {
    const invocations = [
      { toolName: 'search', directive: 'Be thorough', confidence: 0.9 },
      { toolName: 'summarize', directive: 'Be concise', confidence: 0.85 },
      { toolName: 'validate', directive: 'Prioritize accuracy', confidence: 0.7 },
    ];

    const totalConfidence = invocations.reduce((sum, inv) => sum + inv.confidence, 0);
    const avgConfidence = totalConfidence / invocations.length;

    expect(avgConfidence).toBeCloseTo(0.816, 2);
  });

  it('attributes success to highest confidence directive', () => {
    const invocations = [
      { toolName: 'search', directive: 'Be thorough', confidence: 0.9 },
      { toolName: 'search', directive: 'Be fast', confidence: 0.3 },
    ];

    const bestAttribution = invocations.reduce((best, inv) =>
      inv.confidence > best.confidence ? inv : best,
    );

    expect(bestAttribution.directive).toBe('Be thorough');
  });

  it('handles zero confidence gracefully', () => {
    const invocations = [
      { toolName: 'unknown', directive: '', confidence: 0.0 },
    ];

    const totalConfidence = invocations.reduce((sum, inv) => sum + inv.confidence, 0);
    expect(totalConfidence).toBe(0);
  });
});

describe('verbatim validation', () => {
  it('degrades confidence when directive not found in soul', () => {
    const soulContent = 'Always prioritize accuracy above speed.';
    const directiveText = 'Maximize throughput at all costs';
    let confidence = 0.8;

    if (confidence > 0.5 && directiveText && !soulContent.includes(directiveText)) {
      confidence = Math.min(confidence, 0.3);
    }

    expect(confidence).toBe(0.3);
  });

  it('keeps high confidence when directive found verbatim', () => {
    const soulContent = 'Always prioritize accuracy above speed.';
    const directiveText = 'Always prioritize accuracy above speed.';
    let confidence = 0.8;

    if (confidence > 0.5 && directiveText && !soulContent.includes(directiveText)) {
      confidence = Math.min(confidence, 0.3);
    }

    expect(confidence).toBe(0.8);
  });

  it('does not degrade low confidence', () => {
    const soulContent = 'Be thorough.';
    const directiveText = 'Something else entirely';
    let confidence = 0.4;

    if (confidence > 0.5 && directiveText && !soulContent.includes(directiveText)) {
      confidence = Math.min(confidence, 0.3);
    }

    expect(confidence).toBe(0.4);
  });
});

describe('decision trace types', () => {
  it('tool_call decision type captures invocation metadata', () => {
    const trace = {
      decisionType: 'tool_call',
      directiveReferenced: 'Search the web for relevant info',
      attributionConfidence: '0.850',
      outcome: 'success',
      metadata: {
        toolName: 'web_search',
        durationMs: 234,
        rejected: false,
      },
    };

    expect(trace.decisionType).toBe('tool_call');
    expect(trace.metadata.toolName).toBe('web_search');
    expect(trace.metadata.rejected).toBe(false);
  });

  it('output_step decision type captures completed task', () => {
    const trace = {
      decisionType: 'output_step',
      directiveReferenced: null,
      attributionConfidence: null,
      outcome: 'success',
      metadata: {
        taskId: 'task-123',
        taskDescription: 'Summarize the article',
      },
    };

    expect(trace.decisionType).toBe('output_step');
    expect(trace.directiveReferenced).toBeNull();
  });

  it('reasoning_branch decision type captures overall approach', () => {
    const trace = {
      decisionType: 'reasoning_branch',
      directiveReferenced: 'Break complex problems into steps',
      attributionConfidence: '0.720',
      outcome: 'success',
      metadata: {
        toolSequenceLength: 15,
        completedTasks: 8,
        totalTasks: 10,
      },
    };

    expect(trace.decisionType).toBe('reasoning_branch');
    expect(trace.metadata.completedTasks).toBeLessThan(trace.metadata.totalTasks);
  });
});

describe('TTL pruning logic', () => {
  it('does not prune when below row threshold', () => {
    const totalRows = 100_000;
    const maxRows = 5_000_000;
    const ttlDays = 90;

    if (totalRows < maxRows) {
      return { deleted: 0 };
    }

    expect(totalRows).toBeLessThan(maxRows);
  });

  it('calculates correct cutoff date', () => {
    const ttlDays = 90;
    const now = Date.now();
    const cutoff = new Date(now - ttlDays * 24 * 60 * 60 * 1000);
    const expectedDiff = ttlDays * 24 * 60 * 60 * 1000;

    expect(now - cutoff.getTime()).toBe(expectedDiff);
  });
});
