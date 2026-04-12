import { describe, it, expect } from 'vitest';
import {
  estimatePopulationCost,
  applyTieredReduction,
  validateBudget,
  AGENT_COST_CENTS,
} from '../../services/budget-validator.js';
import type { PopulationManifest } from '@claw/shared-types';

function makeManifest(overrides: Partial<PopulationManifest> = {}): PopulationManifest {
  return {
    taskId: 'task-1',
    taskDescription: 'Test task',
    assignedSouls: [
      {
        soulId: 'soul-1',
        agentClass: 'Novice',
        source: 'archetype',
        differentiationScore: 0.5,
        selectionRationale: 'test rationale',
      },
    ],
    pioneerFlag: false,
    ...overrides,
  };
}

describe('budget-validator', () => {
  describe('estimatePopulationCost', () => {
    it('returns 0 for empty manifests', () => {
      expect(estimatePopulationCost([])).toBe(0);
    });

    it('sums costs across all souls in all manifests', () => {
      const manifests = [
        makeManifest({
          assignedSouls: [
            { soulId: 's1', agentClass: 'Artisan', source: 'library', differentiationScore: 0.5, selectionRationale: '' },
            { soulId: 's2', agentClass: 'Understudy', source: 'library', differentiationScore: 0.5, selectionRationale: '' },
          ],
        }),
        makeManifest({
          taskId: 'task-2',
          assignedSouls: [
            { soulId: 's3', agentClass: 'Novice', source: 'archetype', differentiationScore: 0.5, selectionRationale: '' },
          ],
        }),
      ];

      const expected = AGENT_COST_CENTS.Artisan + AGENT_COST_CENTS.Understudy + AGENT_COST_CENTS.Novice;
      expect(estimatePopulationCost(manifests)).toBe(expected);
    });
  });

  describe('applyTieredReduction', () => {
    it('replaces Artisans with Understudies in Tier 1', () => {
      const manifests = [
        makeManifest({
          assignedSouls: [
            { soulId: 's1', agentClass: 'Artisan', source: 'library', differentiationScore: 0.5, selectionRationale: '' },
            { soulId: 's2', agentClass: 'Artisan', source: 'library', differentiationScore: 0.5, selectionRationale: '' },
          ],
        }),
      ];

      const { manifests: reduced, warnings } = applyTieredReduction(manifests, 200);

      for (const soul of reduced[0]!.assignedSouls) {
        expect(soul.agentClass).toBe('Understudy');
      }
      expect(warnings.some((w) => w.includes('Tier 1'))).toBe(true);
    });

    it('applies Tier 2 reduction when Tier 1 is insufficient', () => {
      const souls = Array.from({ length: 10 }, (_, i) => ({
        soulId: `s${i}`,
        agentClass: 'Understudy' as const,
        source: 'library' as const,
        differentiationScore: 0.5,
        selectionRationale: '',
      }));

      const manifests = [makeManifest({ assignedSouls: souls })];
      // MIN_AGENTS_PER_TASK is 3, cost = 3 * 50 = 150
      const { manifests: reduced, warnings } = applyTieredReduction(manifests, 10);

      expect(reduced[0]!.assignedSouls.length).toBe(3);
      expect(warnings.some((w) => w.includes('Tier 2'))).toBe(true);
    });

    it('does not mutate the original manifests', () => {
      const manifests = [
        makeManifest({
          assignedSouls: [
            { soulId: 's1', agentClass: 'Artisan', source: 'library', differentiationScore: 0.5, selectionRationale: '' },
          ],
        }),
      ];

      applyTieredReduction(manifests, 10);

      expect(manifests[0]!.assignedSouls[0]!.agentClass).toBe('Artisan');
    });
  });

  describe('validateBudget', () => {
    it('returns funded=true with no warnings when budgetCapCents is 0 (no-cap mode)', () => {
      const manifests = [makeManifest()];
      const result = validateBudget(manifests, 0);

      expect(result.funded).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.manifests).toBe(manifests); // same reference, no clone
    });

    it('returns funded=true when cost is within budget', () => {
      const manifests = [makeManifest()]; // 1 Novice = 30 cents
      const result = validateBudget(manifests, 1000);

      expect(result.funded).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.estimatedCostCents).toBe(30);
    });

    it('applies tiered reduction when over budget and returns reduced manifests', () => {
      const manifests = [
        makeManifest({
          assignedSouls: [
            { soulId: 's1', agentClass: 'Artisan', source: 'library', differentiationScore: 0.5, selectionRationale: '' },
            { soulId: 's2', agentClass: 'Artisan', source: 'library', differentiationScore: 0.5, selectionRationale: '' },
          ],
        }),
      ];
      // 2 Artisans = 200 cents, budget = 150
      // Tier 1: replace with Understudies = 100 cents, fits
      const result = validateBudget(manifests, 150);

      expect(result.funded).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.estimatedCostCents).toBeLessThanOrEqual(150);
    });

    it('returns funded=false with shortfall when reduction is insufficient', () => {
      const souls = Array.from({ length: 5 }, (_, i) => ({
        soulId: `s${i}`,
        agentClass: 'Artisan' as const,
        source: 'library' as const,
        differentiationScore: 0.5,
        selectionRationale: '',
      }));

      const manifests = [makeManifest({ assignedSouls: souls })];
      // After Tier 1: 5 Understudies = 250. After Tier 2: 3 Understudies = 150. Budget = 10.
      const result = validateBudget(manifests, 10);

      expect(result.funded).toBe(false);
      expect(result.shortfallCents).toBeGreaterThan(0);
      expect(result.minimumRequiredCents).toBeDefined();
    });
  });
});
