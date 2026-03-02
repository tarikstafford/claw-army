import { describe, it, expect } from 'vitest';
import {
  estimatePopulationCost,
  validateBudget,
  AGENT_COST_CENTS,
  type BudgetValidationResult,
} from '../budget-validator.js';
import type { PopulationManifest, SoulSelectionEntry } from '@claw/shared-types';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeSoul(
  agentClass: 'Artisan' | 'Understudy' | 'Novice',
  soulId = `soul-${Math.random().toString(36).slice(2)}`,
): SoulSelectionEntry {
  return {
    soulId,
    agentClass,
    source: 'library',
    parentSoulId: null,
    mutationApplied: null,
    selectionRationale: 'test',
    differentiationScore: 0.5,
  };
}

function makeManifest(
  taskId: string,
  souls: SoulSelectionEntry[],
): PopulationManifest {
  return {
    taskId,
    taskDescription: `Test task ${taskId}`,
    assignedSouls: souls,
    pioneerFlag: false,
    varianceIntent: null,
  };
}

// ─── Cost Estimation Tests (BUDG-01) ─────────────────────────────────────────

describe('budget-validator', () => {
  describe('estimatePopulationCost', () => {
    it('calculates total cost using per-class rates: Artisan=100c, Understudy=50c, Novice=30c', () => {
      const manifests = [
        makeManifest('task-1', [
          makeSoul('Artisan'),
          makeSoul('Understudy'),
          makeSoul('Novice'),
        ]),
      ];
      // 100 + 50 + 30 = 180
      expect(estimatePopulationCost(manifests)).toBe(180);
    });

    it('correctly sums across multiple tasks with mixed agent classes', () => {
      const manifests = [
        makeManifest('task-1', [
          makeSoul('Artisan'),   // 100
          makeSoul('Artisan'),   // 100
          makeSoul('Understudy'), // 50
        ]),
        makeManifest('task-2', [
          makeSoul('Novice'),    // 30
          makeSoul('Novice'),    // 30
          makeSoul('Novice'),    // 30
        ]),
      ];
      // task-1: 250, task-2: 90, total: 340
      expect(estimatePopulationCost(manifests)).toBe(340);
    });

    it('returns 0 for an empty manifests array', () => {
      expect(estimatePopulationCost([])).toBe(0);
    });
  });

  // ─── Tiered Reduction Tests (BUDG-02) ───────────────────────────────────────

  describe('validateBudget — tiered reduction (BUDG-02)', () => {
    it('Tier 1 — replaces Artisans with Understudies when cost exceeds budget (keeps same count, lowers cost)', () => {
      // 3 Artisans = 300c, budget = 200c
      const manifests = [
        makeManifest('task-1', [
          makeSoul('Artisan', 'a1'),
          makeSoul('Artisan', 'a2'),
          makeSoul('Artisan', 'a3'),
        ]),
      ];
      const result = validateBudget(manifests, 200);
      expect(result.funded).toBe(true);
      // All Artisans should become Understudies (3 * 50 = 150c)
      expect(result.manifests[0]!.assignedSouls.every((s) => s.agentClass === 'Understudy')).toBe(true);
      expect(result.manifests[0]!.assignedSouls).toHaveLength(3);
      expect(result.estimatedCostCents).toBe(150);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('Tier 2 — after Artisan replacement, reduces each task to minPopulation (3) when cost still exceeds budget', () => {
      // 3 tasks, each with 5 Artisans = 15 * 100 = 1500c, budget = 100c
      // After Tier 1: 15 Understudies = 750c (still > 100c)
      // After Tier 2: 3 tasks * 3 * 50 = 450c (still > 100c but that's the minimum)
      const manifests = [
        makeManifest('task-1', [
          makeSoul('Artisan'),
          makeSoul('Artisan'),
          makeSoul('Artisan'),
          makeSoul('Artisan'),
          makeSoul('Artisan'),
        ]),
        makeManifest('task-2', [
          makeSoul('Artisan'),
          makeSoul('Artisan'),
          makeSoul('Artisan'),
          makeSoul('Artisan'),
          makeSoul('Artisan'),
        ]),
        makeManifest('task-3', [
          makeSoul('Artisan'),
          makeSoul('Artisan'),
          makeSoul('Artisan'),
          makeSoul('Artisan'),
          makeSoul('Artisan'),
        ]),
      ];

      // Budget too low to fund even minimum, test with shortfall
      const result = validateBudget(manifests, 100);
      expect(result.funded).toBe(false);
      // All reduced to 3 souls per task
      expect(result.manifests[0]!.assignedSouls).toHaveLength(3);
      expect(result.manifests[1]!.assignedSouls).toHaveLength(3);
      expect(result.manifests[2]!.assignedSouls).toHaveLength(3);
    });

    it('Tier 2 with viable budget — reduces to min population and returns funded=true', () => {
      // 2 tasks, each with 6 Artisans = 12 * 100 = 1200c
      // After Tier 1: 12 Understudies = 600c
      // Budget = 400c, need Tier 2: 2 tasks * 3 * 50 = 300c (fits!)
      const manifests = [
        makeManifest('task-1', [
          makeSoul('Artisan'),
          makeSoul('Artisan'),
          makeSoul('Artisan'),
          makeSoul('Artisan'),
          makeSoul('Artisan'),
          makeSoul('Artisan'),
        ]),
        makeManifest('task-2', [
          makeSoul('Artisan'),
          makeSoul('Artisan'),
          makeSoul('Artisan'),
          makeSoul('Artisan'),
          makeSoul('Artisan'),
          makeSoul('Artisan'),
        ]),
      ];
      const result = validateBudget(manifests, 400);
      expect(result.funded).toBe(true);
      expect(result.manifests[0]!.assignedSouls).toHaveLength(3);
      expect(result.manifests[1]!.assignedSouls).toHaveLength(3);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('reduction preserves task count — never removes entire tasks', () => {
      const manifests = [
        makeManifest('task-1', [makeSoul('Artisan'), makeSoul('Artisan'), makeSoul('Artisan')]),
        makeManifest('task-2', [makeSoul('Artisan'), makeSoul('Artisan'), makeSoul('Artisan')]),
        makeManifest('task-3', [makeSoul('Artisan'), makeSoul('Artisan'), makeSoul('Artisan')]),
      ];
      // 9 Artisans = 900c, budget = 1c
      const result = validateBudget(manifests, 1);
      // Should still have 3 tasks even though unfunded
      expect(result.manifests).toHaveLength(3);
    });

    it('each tier produces a reductionWarning string describing what was done', () => {
      // 1 task, 5 Artisans = 500c, budget = 200c (triggers Tier 1: 5 Understudies = 250c, still > 200c)
      // Tier 2: 3 Understudies = 150c (fits)
      const manifests = [
        makeManifest('task-1', [
          makeSoul('Artisan'),
          makeSoul('Artisan'),
          makeSoul('Artisan'),
          makeSoul('Artisan'),
          makeSoul('Artisan'),
        ]),
      ];
      const result = validateBudget(manifests, 200);
      expect(result.funded).toBe(true);
      expect(result.warnings).toHaveLength(2); // Tier 1 + Tier 2 warnings
      expect(result.warnings[0]).toMatch(/tier 1/i);
      expect(result.warnings[1]).toMatch(/tier 2/i);
    });
  });

  // ─── Minimum Population Guard (BUDG-03) ──────────────────────────────────────

  describe('minimum population guard (BUDG-03)', () => {
    it('never reduces any task below 3 agents — even if budget pressure is extreme', () => {
      // 3 tasks, each with 10 Artisans = 3000c, budget = 1c (extreme)
      const manifests = [
        makeManifest('task-1', Array.from({ length: 10 }, () => makeSoul('Artisan'))),
        makeManifest('task-2', Array.from({ length: 10 }, () => makeSoul('Artisan'))),
        makeManifest('task-3', Array.from({ length: 10 }, () => makeSoul('Artisan'))),
      ];
      const result = validateBudget(manifests, 1);
      // All should still have at least 3 souls
      for (const manifest of result.manifests) {
        expect(manifest.assignedSouls.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('tasks that already have exactly 3 agents are not further reduced', () => {
      // 1 task with exactly 3 Artisans = 300c, budget = 1c
      const manifests = [
        makeManifest('task-1', [
          makeSoul('Artisan', 'a1'),
          makeSoul('Artisan', 'a2'),
          makeSoul('Artisan', 'a3'),
        ]),
      ];
      const result = validateBudget(manifests, 1);
      // After Tier 1: 3 Understudies = 150c (still > 1c)
      // Tier 2 cannot reduce further — already at min 3
      expect(result.manifests[0]!.assignedSouls).toHaveLength(3);
    });
  });

  // ─── Budget Shortfall (BUDG-04) ───────────────────────────────────────────────

  describe('budget shortfall (BUDG-04)', () => {
    it('returns funded=false with exact shortfallCents and minimumRequiredCents when minimum populations exceed budget', () => {
      // 2 tasks, each forced to 3 Novices minimum = 6 * 30 = 180c, budget = 100c
      // shortfall = 180 - 100 = 80c
      const manifests = [
        makeManifest('task-1', [makeSoul('Novice'), makeSoul('Novice'), makeSoul('Novice')]),
        makeManifest('task-2', [makeSoul('Novice'), makeSoul('Novice'), makeSoul('Novice')]),
      ];
      const result = validateBudget(manifests, 100);
      expect(result.funded).toBe(false);
      expect(result.shortfallCents).toBe(80);
      expect(result.minimumRequiredCents).toBe(180);
    });

    it('shortfallCents = estimatedMinCost - budgetCapCents (exact computation)', () => {
      // 1 task, 3 Artisans = 300c; after Tier 1: 3 Understudies = 150c; budget = 100c
      // shortfall = 150 - 100 = 50c
      const manifests = [
        makeManifest('task-1', [
          makeSoul('Artisan', 'a1'),
          makeSoul('Artisan', 'a2'),
          makeSoul('Artisan', 'a3'),
        ]),
      ];
      const result = validateBudget(manifests, 100);
      expect(result.funded).toBe(false);
      expect(result.shortfallCents).toBe(50);
      expect(result.minimumRequiredCents).toBe(150);
    });
  });

  // ─── validateBudget Orchestrator Tests ────────────────────────────────────────

  describe('validateBudget — orchestrator behavior', () => {
    it('returns funded=true with original manifests and no warnings when cost is within budget', () => {
      const manifests = [
        makeManifest('task-1', [
          makeSoul('Novice'),
          makeSoul('Novice'),
          makeSoul('Novice'),
        ]),
      ];
      // 3 * 30 = 90c, budget = 500c
      const result = validateBudget(manifests, 500);
      expect(result.funded).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.estimatedCostCents).toBe(90);
      // Manifests should be unchanged
      expect(result.manifests[0]!.assignedSouls[0]!.agentClass).toBe('Novice');
    });

    it('returns funded=true with reduced manifests and warnings when tiered reduction fits budget', () => {
      // 3 Artisans = 300c, budget = 200c; Tier 1: 3 Understudies = 150c (fits)
      const manifests = [
        makeManifest('task-1', [
          makeSoul('Artisan', 'a1'),
          makeSoul('Artisan', 'a2'),
          makeSoul('Artisan', 'a3'),
        ]),
      ];
      const result = validateBudget(manifests, 200);
      expect(result.funded).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      // All souls downgraded
      expect(result.manifests[0]!.assignedSouls.every((s) => s.agentClass === 'Understudy')).toBe(true);
    });

    it('returns funded=false with shortfallCents and minimumRequiredCents when minimum populations exceed budget', () => {
      // 1 task, 3 Novices = 90c, budget = 50c
      const manifests = [
        makeManifest('task-1', [
          makeSoul('Novice'),
          makeSoul('Novice'),
          makeSoul('Novice'),
        ]),
      ];
      const result = validateBudget(manifests, 50);
      expect(result.funded).toBe(false);
      expect(result.shortfallCents).toBeDefined();
      expect(result.minimumRequiredCents).toBeDefined();
      expect(result.shortfallCents).toBe(40);
      expect(result.minimumRequiredCents).toBe(90);
    });

    it('budgetCapCents=0 means no-cap — always returns funded=true with original manifests', () => {
      // Extremely large population — should still be funded when cap = 0
      const manifests = [
        makeManifest('task-1', Array.from({ length: 100 }, () => makeSoul('Artisan'))),
        makeManifest('task-2', Array.from({ length: 100 }, () => makeSoul('Artisan'))),
      ];
      const result = validateBudget(manifests, 0);
      expect(result.funded).toBe(true);
      expect(result.warnings).toHaveLength(0);
      // Manifests unchanged
      expect(result.manifests[0]!.assignedSouls).toHaveLength(100);
      expect(result.manifests[1]!.assignedSouls).toHaveLength(100);
    });
  });

  // ─── AGENT_COST_CENTS constant verification ───────────────────────────────────

  describe('AGENT_COST_CENTS constants', () => {
    it('exports correct cost values per agent class', () => {
      expect(AGENT_COST_CENTS.Artisan).toBe(100);
      expect(AGENT_COST_CENTS.Understudy).toBe(50);
      expect(AGENT_COST_CENTS.Novice).toBe(30);
    });
  });
});
