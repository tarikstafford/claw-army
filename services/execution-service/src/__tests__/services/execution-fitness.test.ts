import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Execution Fitness Score (EFS) tests.
 *
 * We mock:
 *   - @claw/db for the execution row + council verdicts query
 *   - the report-builder module for the execution report
 *
 * Each test drives specific sub-scores (successRate, costEfficiency, speed,
 * councilHealth) and asserts the weighted composite comes out as expected.
 */

const { mockDb, mockBuildExecutionReport } = vi.hoisted(() => ({
  mockDb: { select: vi.fn() },
  mockBuildExecutionReport: vi.fn(),
}));

vi.mock("@claw/db", () => ({
  db: mockDb,
  executions: {
    id: "id",
    budgetCapCents: "budgetCapCents",
    runtimeLimitSeconds: "runtimeLimitSeconds",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  councilVerdicts: {
    id: "id",
    executionId: "executionId",
    verdictType: "verdictType",
    godLayerProcessedAt: "godLayerProcessedAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: (...args: unknown[]) => ({ _type: "eq", args }),
  and: (...args: unknown[]) => ({ _type: "and", args }),
  inArray: (col: unknown, values: unknown[]) => ({
    _type: "inArray",
    col,
    values,
  }),
}));

vi.mock("../../performance/report-builder", () => ({
  buildExecutionReport: (...args: unknown[]) =>
    mockBuildExecutionReport(...args),
}));

import {
  computeExecutionFitness,
  allVerdictsProcessed,
} from "../../services/execution-fitness";

/** Helper to queue up select() responses in FIFO order. */
function mockSelectSequence(responses: unknown[][]): void {
  const queue = [...responses];
  mockDb.select.mockImplementation(() => {
    const rows = queue.shift() ?? [];
    const chain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          // support both `.where(...).then(...)` and `.where(...).limit(1)`
          limit: vi.fn().mockResolvedValue(rows),
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve(rows).then(resolve),
        }),
      }),
    } as any;
    return chain;
  });
}

describe("execution-fitness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("computeExecutionFitness", () => {
    const now = Date.now();
    const execRow = {
      budgetCapCents: 10_000,
      runtimeLimitSeconds: 3600,
      createdAt: new Date(now - 1_800_000), // started 30min ago
      updatedAt: new Date(now), // ran for 1800s, half the limit
    };

    it("computes EFS from weighted sub-scores", async () => {
      mockSelectSequence([
        [execRow],
        // council verdicts — 4 total, 3 healthy (Promote+Maintain)
        [
          { verdictType: "Promote" },
          { verdictType: "Maintain" },
          { verdictType: "Promote" },
          { verdictType: "Demote" },
        ],
      ]);

      mockBuildExecutionReport.mockResolvedValue({
        totalTasks: 10,
        completedTasks: 8, // success = 0.8
        failedTasks: 2,
        totalCostCents: 5_000, // cost_eff = 10000/5000 = 2.0 → clamped to 1.0
      });

      const fitness = await computeExecutionFitness("exec-1");

      // success_rate = 0.8
      // cost_efficiency = 1.0 (clamped)
      // speed = 3600/1800 = 2.0 → clamped to 1.0
      // council_health = 3/4 = 0.75
      // efs = 0.5*0.8 + 0.25*1.0 + 0.15*1.0 + 0.1*0.75 = 0.4 + 0.25 + 0.15 + 0.075 = 0.875
      expect(fitness.successRate).toBeCloseTo(0.8, 5);
      expect(fitness.costEfficiency).toBeCloseTo(1.0, 5);
      expect(fitness.speed).toBeCloseTo(1.0, 5);
      expect(fitness.councilHealth).toBeCloseTo(0.75, 5);
      expect(fitness.efs).toBeCloseTo(0.875, 5);
    });

    it("handles zero tasks (successRate = 0)", async () => {
      mockSelectSequence([
        [execRow],
        [], // no verdicts
      ]);
      mockBuildExecutionReport.mockResolvedValue({
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        totalCostCents: 0,
      });
      const fitness = await computeExecutionFitness("exec-1");
      expect(fitness.successRate).toBe(0);
      // cost_eff = 1 (no spend), speed = 1 (runtime_limit / duration > 1),
      // council_health = 0.5 (no verdicts neutral)
      // efs = 0 + 0.25 + 0.15 + 0.05 = 0.45
      expect(fitness.efs).toBeCloseTo(0.45, 5);
    });

    it("clamps sub-scores above 1.0", async () => {
      mockSelectSequence([
        [{ ...execRow, runtimeLimitSeconds: 100_000 }], // speed would be huge
        [{ verdictType: "Promote" }],
      ]);
      mockBuildExecutionReport.mockResolvedValue({
        totalTasks: 5,
        completedTasks: 5,
        failedTasks: 0,
        totalCostCents: 100, // very low spend → cost_eff very high
      });
      const fitness = await computeExecutionFitness("exec-1");
      expect(fitness.costEfficiency).toBeLessThanOrEqual(1);
      expect(fitness.speed).toBeLessThanOrEqual(1);
      expect(fitness.successRate).toBe(1);
      expect(fitness.councilHealth).toBe(1);
      expect(fitness.efs).toBeLessThanOrEqual(1);
    });

    it("throws when execution is not found", async () => {
      mockSelectSequence([[]]);
      await expect(computeExecutionFitness("nope")).rejects.toThrow(
        /execution not found/,
      );
    });
  });

  describe("allVerdictsProcessed", () => {
    it("returns false when there are no verdicts", async () => {
      mockSelectSequence([[]]);
      const result = await allVerdictsProcessed("exec-1");
      expect(result).toBe(false);
    });

    it("returns false when at least one verdict is unprocessed", async () => {
      mockSelectSequence([
        [
          { id: "v1", godLayerProcessedAt: new Date() },
          { id: "v2", godLayerProcessedAt: null },
        ],
      ]);
      const result = await allVerdictsProcessed("exec-1");
      expect(result).toBe(false);
    });

    it("returns true when all verdicts are processed", async () => {
      mockSelectSequence([
        [
          { id: "v1", godLayerProcessedAt: new Date() },
          { id: "v2", godLayerProcessedAt: new Date() },
        ],
      ]);
      const result = await allVerdictsProcessed("exec-1");
      expect(result).toBe(true);
    });
  });
});
