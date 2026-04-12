import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb } = vi.hoisted(() => ({
  mockDb: { select: vi.fn() },
}));

vi.mock('@claw/db', () => ({
  db: mockDb,
  billingEvents: {
    occurredAt: 'occurredAt',
    amountCents: 'amountCents',
    tokenCount: 'tokenCount',
    eventType: 'eventType',
    metadata: 'metadata',
  },
  telemetry: {
    computedAt: 'computedAt',
    metricValue: 'metricValue',
    metricName: 'metricName',
  },
}));

vi.mock('drizzle-orm', () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ..._values: unknown[]) => ({
      _type: 'sql',
      text: strings.join('?'),
    }),
    { raw: (s: string) => ({ _type: 'sql_raw', text: s }) },
  ),
  gte: (...args: unknown[]) => ({ _type: 'gte', args }),
  and: (...args: unknown[]) => ({ _type: 'and', args }),
}));

import { calculateCostProjection } from '../../services/cost-projection.js';

function makeChain(data: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        groupBy: vi.fn().mockResolvedValue(data),
      }),
    }),
  };
}

function makeSimpleChain(data: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(data),
    }),
  };
}

describe('cost-projection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env['BOT_HOURLY_RATE_CENTS'];
  });

  it('returns zero burn rate when no billing events or telemetry exist', async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // dailySpend query — has groupBy
        return makeChain([]);
      }
      if (callCount === 2) {
        // botHoursResult query — no groupBy
        return makeSimpleChain([{ totalHours: 0 }]);
      }
      // dimensionBreakdown query — no groupBy
      return makeSimpleChain([{ totalInputCents: 0, totalOutputCents: 0, totalToolCents: 0 }]);
    });

    const result = await calculateCostProjection(null, null, 0);

    expect(result.dailyBurnRateCents).toBe(0);
    expect(result.dataPoints).toBe(0);
    expect(result.trend).toBe('stable');
    expect(result.daysUntilBudgetExhaustion).toBeNull();
  });

  it('calculates daily burn rate from billing events', async () => {
    const today = new Date().toISOString().slice(0, 10);
    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeChain([
          { day: today, totalCents: 300, tokenCount: 1000, eventCount: 5 },
        ]);
      }
      if (callCount === 2) {
        return makeSimpleChain([{ totalHours: 0 }]);
      }
      return makeSimpleChain([{ totalInputCents: 100, totalOutputCents: 100, totalToolCents: 100 }]);
    });

    const result = await calculateCostProjection(null, null, 0);

    expect(result.dailyBurnRateCents).toBe(300); // 300 / 1 active day
    expect(result.dataPoints).toBe(1);
  });

  it('includes bot hours cost in burn rate', async () => {
    process.env['BOT_HOURLY_RATE_CENTS'] = '200';
    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeChain([]);
      }
      if (callCount === 2) {
        return makeSimpleChain([{ totalHours: 5 }]);
      }
      return makeSimpleChain([{ totalInputCents: 0, totalOutputCents: 0, totalToolCents: 0 }]);
    });

    const result = await calculateCostProjection(null, null, 0);

    // 5 hours * 200 cents/hour = 1000 cents
    expect(result.dailyBurnRateCents).toBe(1000);
    expect(result.breakdown.botHoursCents).toBe(1000);
  });

  it('calculates daysUntilBudgetExhaustion with monthly budget', async () => {
    let callCount = 0;
    const today = new Date().toISOString().slice(0, 10);
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeChain([
          { day: today, totalCents: 100, tokenCount: 100, eventCount: 1 },
        ]);
      }
      if (callCount === 2) {
        return makeSimpleChain([{ totalHours: 0 }]);
      }
      return makeSimpleChain([{ totalInputCents: 50, totalOutputCents: 50, totalToolCents: 0 }]);
    });

    const result = await calculateCostProjection(null, 1000, 200);

    // Remaining budget: 1000 - 200 = 800. Daily burn: 100. Days: floor(800/100) = 8
    expect(result.daysUntilBudgetExhaustion).toBe(8);
  });

  it('returns daysUntilBudgetExhaustion=0 when budget is already exhausted', async () => {
    let callCount = 0;
    const today = new Date().toISOString().slice(0, 10);
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeChain([
          { day: today, totalCents: 100, tokenCount: 100, eventCount: 1 },
        ]);
      }
      if (callCount === 2) {
        return makeSimpleChain([{ totalHours: 0 }]);
      }
      return makeSimpleChain([{ totalInputCents: 50, totalOutputCents: 50, totalToolCents: 0 }]);
    });

    const result = await calculateCostProjection(null, 500, 600);

    expect(result.daysUntilBudgetExhaustion).toBe(0);
  });

  it('detects increasing trend when second half spend exceeds first half by >10%', async () => {
    const now = new Date();
    const earlyDay = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const lateDay = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeChain([
          { day: earlyDay, totalCents: 100, tokenCount: 100, eventCount: 1 },
          { day: lateDay, totalCents: 200, tokenCount: 200, eventCount: 2 },
        ]);
      }
      if (callCount === 2) {
        return makeSimpleChain([{ totalHours: 0 }]);
      }
      return makeSimpleChain([{ totalInputCents: 150, totalOutputCents: 150, totalToolCents: 0 }]);
    });

    const result = await calculateCostProjection(null, null, 0);

    expect(result.trend).toBe('increasing');
  });

  it('returns windowDays=7', async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain([]);
      if (callCount === 2) return makeSimpleChain([{ totalHours: 0 }]);
      return makeSimpleChain([{ totalInputCents: 0, totalOutputCents: 0, totalToolCents: 0 }]);
    });

    const result = await calculateCostProjection(null, null, 0);
    expect(result.windowDays).toBe(7);
  });
});
