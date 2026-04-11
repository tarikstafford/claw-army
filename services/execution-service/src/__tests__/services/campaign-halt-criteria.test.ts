import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Halt-criteria evaluator tests. Mocks @claw/db at module boundary so we
 * can drive the campaign/iteration state explicitly from each test.
 *
 * Every test sets up three mocked query paths:
 *   1. SELECT campaign row (always called first)
 *   2. Optional campaign spend aggregation
 *   3. Optional best_efs history query (regression guard)
 *   4. Optional recent deltas query (plateau detection)
 */

// vi.hoisted: makes mockDb accessible from the hoisted vi.mock() factory below.
const { mockDb } = vi.hoisted(() => ({
  mockDb: { select: vi.fn() },
}));

vi.mock("@claw/db", () => ({
  db: mockDb,
  evolutionCampaigns: { id: "id" },
  evolutionCampaignIterations: {
    id: "id",
    campaignId: "campaignId",
    iterationNum: "iterationNum",
    efsScore: "efsScore",
    deltaFromPrevious: "deltaFromPrevious",
  },
  billingEvents: {
    executionId: "executionId",
    eventType: "eventType",
    amountCents: "amountCents",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: (...args: unknown[]) => ({ _type: "eq", args }),
  and: (...args: unknown[]) => ({ _type: "and", args }),
  sql: Object.assign(
    (strings: TemplateStringsArray, ..._values: unknown[]) => ({
      _type: "sql",
      text: strings.join("?"),
    }),
    {
      raw: (s: string) => ({ _type: "sql_raw", text: s }),
    },
  ),
  desc: (col: unknown) => ({ _type: "desc", col }),
  inArray: (col: unknown, values: unknown[]) => ({
    _type: "inArray",
    col,
    values,
  }),
}));

import { evaluateHaltCriteria } from "../../services/campaign-halt-criteria";

const baseCampaign = {
  id: "camp-1",
  objective: "test",
  projectId: null,
  maxIterations: 10,
  campaignBudgetCapCents: null as number | null,
  seedMaxBots: 5,
  seedBudgetCapCents: 1000,
  seedRuntimeLimitSeconds: 600,
  seedAllowedTools: [],
  seedLlmProvider: null,
  seedAllowedDomains: null,
  status: "running" as const,
  completedIterationCount: 0,
  bestEfsScore: null as string | null,
  createdAt: new Date(),
  updatedAt: new Date(),
  stoppedAt: null as Date | null,
};

/**
 * Helper: queue up a sequence of SELECT responses in the order the
 * campaign-halt-criteria module makes them. Each call to db.select()
 * pops one response off the queue and returns a chain that resolves to it.
 */
function mockSelectSequence(responses: unknown[][]): void {
  const queue = [...responses];
  mockDb.select.mockImplementation(() => {
    const rows = queue.shift() ?? [];
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(rows),
          }),
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve(rows).then(resolve),
        }),
      }),
    } as any;
  });
}

describe("campaign-halt-criteria", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("evaluateHaltCriteria — success ceiling", () => {
    it("halts with completed_success when currentEfs >= 0.95", async () => {
      mockSelectSequence([[baseCampaign]]);
      const decision = await evaluateHaltCriteria({
        campaignId: "camp-1",
        currentEfs: 0.96,
        currentIterationNum: 2,
      });
      expect(decision.halt).toBe(true);
      expect(decision.reason).toBe("completed_success");
    });

    it("does NOT halt when currentEfs = 0.949", async () => {
      // campaign → spend=0 → best history empty → (no plateau check, iter<3)
      mockSelectSequence([
        [baseCampaign],
        [], // best history: no prior iterations
      ]);
      const decision = await evaluateHaltCriteria({
        campaignId: "camp-1",
        currentEfs: 0.949,
        currentIterationNum: 2,
      });
      expect(decision.halt).toBe(false);
    });
  });

  describe("evaluateHaltCriteria — max iterations", () => {
    it("halts with completed_max when iterationNum >= maxIterations", async () => {
      mockSelectSequence([[{ ...baseCampaign, maxIterations: 10 }]]);
      const decision = await evaluateHaltCriteria({
        campaignId: "camp-1",
        currentEfs: 0.5,
        currentIterationNum: 10,
      });
      expect(decision.halt).toBe(true);
      expect(decision.reason).toBe("completed_max");
    });
  });

  describe("evaluateHaltCriteria — regression guard", () => {
    it("halts with halted_regression when currentEfs < best * 0.9", async () => {
      mockSelectSequence([
        [baseCampaign],
        [{ best: "0.8000" }], // best prior EFS = 0.8; threshold = 0.72
      ]);
      const decision = await evaluateHaltCriteria({
        campaignId: "camp-1",
        currentEfs: 0.65, // below 0.72
        currentIterationNum: 3,
      });
      expect(decision.halt).toBe(true);
      expect(decision.reason).toBe("halted_regression");
    });

    it("does NOT halt when currentEfs within 90% of best", async () => {
      mockSelectSequence([
        [baseCampaign],
        [{ best: "0.8000" }],
        [{ delta: "0.05" }, { delta: "0.06" }],
      ]);
      const decision = await evaluateHaltCriteria({
        campaignId: "camp-1",
        currentEfs: 0.75, // >= 0.72
        currentIterationNum: 3,
      });
      expect(decision.halt).toBe(false);
    });
  });

  describe("evaluateHaltCriteria — plateau", () => {
    it("halts with halted_plateau when 2 recent deltas all < 0.03 and iteration >= 3", async () => {
      mockSelectSequence([
        [baseCampaign],
        [{ best: "0.6000" }], // regression: 0.55 >= 0.54 (0.6*0.9), safe
        [{ delta: "0.01" }, { delta: "-0.02" }],
      ]);
      const decision = await evaluateHaltCriteria({
        campaignId: "camp-1",
        currentEfs: 0.55,
        currentIterationNum: 4,
      });
      expect(decision.halt).toBe(true);
      expect(decision.reason).toBe("halted_plateau");
    });

    it("does NOT halt on plateau when iteration < 3", async () => {
      mockSelectSequence([[baseCampaign], [{ best: "0.5000" }]]);
      const decision = await evaluateHaltCriteria({
        campaignId: "camp-1",
        currentEfs: 0.5,
        currentIterationNum: 2,
      });
      expect(decision.halt).toBe(false);
    });
  });

  describe("evaluateHaltCriteria — budget cap", () => {
    it("halts with halted_budget when cumulative spend meets cap", async () => {
      mockSelectSequence([
        [{ ...baseCampaign, campaignBudgetCapCents: 10_000 }],
        [{ executionId: "exec-1" }, { executionId: "exec-2" }], // iteration rows
        [{ total: 10_500 }], // cumulative billing spend
      ]);
      const decision = await evaluateHaltCriteria({
        campaignId: "camp-1",
        currentEfs: 0.5,
        currentIterationNum: 3,
      });
      expect(decision.halt).toBe(true);
      expect(decision.reason).toBe("halted_budget");
    });
  });

  describe("evaluateHaltCriteria — continue path", () => {
    it("returns halt=false when no criterion fires", async () => {
      mockSelectSequence([[baseCampaign], [{ best: "0.4000" }]]);
      const decision = await evaluateHaltCriteria({
        campaignId: "camp-1",
        currentEfs: 0.5,
        currentIterationNum: 2,
      });
      expect(decision.halt).toBe(false);
      expect(decision.reason).toBeNull();
    });
  });
});
