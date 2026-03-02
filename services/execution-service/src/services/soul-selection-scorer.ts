import { generateText, Output } from 'ai';
import { z } from 'zod';
import { resolveModel } from '../lib/resolve-model';
import type {
  RingLeaderMissionBrief,
  RingLeaderSynthesis,
  PopulationManifest,
  SoulSelectionScore,
} from '@claw/shared-types';

// ─── Constants ──────────────────────────────────────────────────────────────────

const SOUL_SELECTION_SCORER_MODEL =
  process.env.SOUL_SELECTION_SCORER_MODEL ?? 'claude-sonnet-4-6';

// ─── Params Interface ──────────────────────────────────────────────────────────

export interface SoulSelectionScoringParams {
  synthesis: RingLeaderSynthesis;
  manifests: PopulationManifest[];
  missionBrief: RingLeaderMissionBrief;
}

// ─── LLM Output Schema ─────────────────────────────────────────────────────────

const SoulSelectionScoreSchema = z.object({
  librarySearchQuality: z.number().min(0).max(1),
  differentiationEffectiveness: z.number().min(0).max(1),
  mutationDecisionQuality: z.number().min(0).max(1),
  pioneerHandling: z.number().min(0).max(1),
  selectionRetrospectiveQuality: z.number().min(0).max(1),
});

// ─── System Prompt ──────────────────────────────────────────────────────────────

const SOUL_SELECTION_SCORER_SYSTEM =
  'You are the Soul Analyst evaluating a Ring Leader\'s soul selection quality. ' +
  'Score five dimensions on a 0 to 1 scale. ' +
  'Assess whether the Ring Leader made effective selection decisions that contributed to run success.';

// ─── Data Aggregation Helpers ──────────────────────────────────────────────────

interface SoulStats {
  totalSouls: number;
  librarySouls: number;
  generatedSouls: number;
  mutatedSouls: number;
  artisanCount: number;
  understudyCount: number;
  noviceCount: number;
  averageDifferentiationScore: number;
  mutationCount: number;
  pioneerTaskCount: number;
}

function aggregateSoulStats(manifests: PopulationManifest[]): SoulStats {
  let totalSouls = 0;
  let librarySouls = 0;
  let generatedSouls = 0;
  let mutatedSouls = 0;
  let artisanCount = 0;
  let understudyCount = 0;
  let noviceCount = 0;
  let differentiationSum = 0;
  let mutationCount = 0;
  const pioneerTaskCount = manifests.filter((m) => m.pioneerFlag).length;

  for (const manifest of manifests) {
    for (const soul of manifest.assignedSouls) {
      totalSouls++;
      differentiationSum += soul.differentiationScore;

      if (soul.source === 'library') librarySouls++;
      else if (soul.source === 'generated') generatedSouls++;
      else if (soul.source === 'mutated') mutatedSouls++;

      if (soul.agentClass === 'Artisan') artisanCount++;
      else if (soul.agentClass === 'Understudy') understudyCount++;
      else if (soul.agentClass === 'Novice') noviceCount++;

      if (soul.mutationApplied !== null) mutationCount++;
    }
  }

  return {
    totalSouls,
    librarySouls,
    generatedSouls,
    mutatedSouls,
    artisanCount,
    understudyCount,
    noviceCount,
    averageDifferentiationScore: totalSouls > 0 ? differentiationSum / totalSouls : 0,
    mutationCount,
    pioneerTaskCount,
  };
}

// ─── Prompt Builder ─────────────────────────────────────────────────────────────

function buildSoulSelectionScorerPrompt(params: SoulSelectionScoringParams): string {
  const { synthesis, manifests, missionBrief } = params;
  const stats = aggregateSoulStats(manifests);

  // Task graph summary
  const taskGraphSection = missionBrief.taskGraph.tasks
    .map((task) => {
      const manifest = manifests.find((m) => m.taskId === task.taskId);
      const assignedCount = manifest?.assignedSouls.length ?? 0;
      return (
        `  ${task.taskId} (complexity=${task.complexity}, recommendedPop=${task.recommendedPopulation}, ` +
        `tools=${task.requiredTools.join(',') || 'none'}) — assigned=${assignedCount} souls`
      );
    })
    .join('\n');

  // Per-task manifest detail
  const manifestSection = manifests
    .map((manifest) => {
      const taskOutcome = synthesis.taskSummary.find((t) => t.taskId === manifest.taskId);
      const soulLines = manifest.assignedSouls
        .map((soul) => {
          const mutation = soul.mutationApplied ? ` mutation="${soul.mutationApplied}"` : '';
          const parent = soul.parentSoulId ? ` parent=${soul.parentSoulId}` : '';
          return (
            `    Soul ${soul.soulId}: class=${soul.agentClass} source=${soul.source}` +
            `${parent}${mutation} diff=${soul.differentiationScore.toFixed(3)} ` +
            `rationale="${soul.selectionRationale.slice(0, 80)}"`
          );
        })
        .join('\n');

      const outcome = taskOutcome
        ? `outcome=${taskOutcome.completed ? 'COMPLETE' : 'INCOMPLETE'} ` +
          `quality=${taskOutcome.outputQualitySignal?.toFixed(3) ?? 'null'} ` +
          `topSoul=${taskOutcome.topPerformingSoulId ?? 'none'}`
        : 'outcome=unknown';

      return (
        `Task: ${manifest.taskId} — pioneer=${manifest.pioneerFlag ? 'yes' : 'no'} ${outcome}\n` +
        soulLines
      );
    })
    .join('\n\n');

  // Population sizing summary
  const sizingLines = missionBrief.taskGraph.tasks
    .map((task) => {
      const manifest = manifests.find((m) => m.taskId === task.taskId);
      const assigned = manifest?.assignedSouls.length ?? 0;
      const diff = assigned - task.recommendedPopulation;
      const diffStr = diff >= 0 ? `+${diff}` : `${diff}`;
      return `  ${task.taskId}: recommended=${task.recommendedPopulation} assigned=${assigned} (${diffStr})`;
    })
    .join('\n');

  // Mutation summary
  const mutationRatio =
    stats.totalSouls > 0 ? (stats.mutationCount / stats.totalSouls).toFixed(3) : '0.000';

  // Task outcomes for retrospective comparison
  const completedTasks = synthesis.taskSummary.filter((t) => t.completed).length;
  const totalTasks = synthesis.taskSummary.length;

  return `## Soul Analyst Evaluation — Soul Selection Quality

### Task Graph Summary
${taskGraphSection}

### Population Sizing (vs Recommended)
${sizingLines}

### Soul Source Distribution
- Library: ${stats.librarySouls}/${stats.totalSouls} souls (${stats.totalSouls > 0 ? ((stats.librarySouls / stats.totalSouls) * 100).toFixed(1) : '0.0'}%)
- Generated (pioneer): ${stats.generatedSouls}/${stats.totalSouls} souls
- Mutated: ${stats.mutatedSouls}/${stats.totalSouls} souls

### Soul Class Distribution
- Artisan: ${stats.artisanCount} | Understudy: ${stats.understudyCount} | Novice: ${stats.noviceCount}

### Differentiation Summary
- Average differentiation score across all manifests: ${stats.averageDifferentiationScore.toFixed(3)}
- (0 = identical souls, 1 = maximally different; target > 0.3 per soul)

### Mutation Summary
- Mutations applied: ${stats.mutationCount}/${stats.totalSouls} souls (${mutationRatio} ratio)
- Pioneer tasks (tasks flagged for novel/untested objectives): ${stats.pioneerTaskCount}
- Pioneer task IDs from synthesis: ${synthesis.pioneerEvents.join(', ') || 'none'}

### Per-Task Manifest Detail
${manifestSection}

### Task Outcomes
${completedTasks}/${totalTasks} tasks completed

### Ring Leader's Soul Selection Retrospective (self-assessment)
${synthesis.soulSelectionRetrospective || 'No retrospective recorded.'}

---

## Scoring Rubric

Score each dimension from 0.0 to 1.0:

**librarySearchQuality**: Did the Ring Leader find relevant souls from the library?
- 1.0 = diverse, class-appropriate library selections for all tasks
- Reduce if most souls are generated (pioneer) when library had options
- High differentiation scores across library-sourced souls indicate effective search

**differentiationEffectiveness**: Are assigned souls within each task sufficiently different?
- 1.0 = all souls have differentiationScore > 0.3
- 0.5 = average differentiation around 0.15-0.3
- Below 0.5 = many near-duplicate selections (differentiationScore < 0.15)

**mutationDecisionQuality**: Were mutations applied judiciously?
- 1.0 = targeted mutations on high-complexity tasks where they matter most
- Penalize: >50% of souls mutated (excessive) OR complex tasks with no mutations
- Neutral: no complex tasks to mutate

**pioneerHandling**: For pioneer tasks, were archetypal souls well-distributed?
- 1.0 = pioneer decisions appropriate, diverse behavioral spread across pioneer task souls
- 0.5 = no pioneer tasks existed (neutral — cannot evaluate)
- 0.0 = pioneer flag used on non-novel tasks, or pioneer tasks had homogeneous souls

**selectionRetrospectiveQuality**: Did the Ring Leader's self-assessment accurately identify which selections worked?
- 1.0 = accurate self-assessment referencing specific outcomes (soul IDs, task IDs, actual metrics)
- 0.5 = vague retrospective without specific references
- 0.0 = retrospective contradicts actual task outcomes, or is empty

Score each dimension now.`;
}

// ─── Fallback Scoring ──────────────────────────────────────────────────────────

function buildFallbackScore(params: SoulSelectionScoringParams): SoulSelectionScore {
  const { manifests } = params;
  const stats = aggregateSoulStats(manifests);

  const librarySearchQuality =
    stats.totalSouls > 0
      ? Math.min(1, Math.max(0, stats.librarySouls / stats.totalSouls))
      : 0.5;

  const differentiationEffectiveness =
    stats.totalSouls > 0
      ? Math.min(1, Math.max(0, stats.averageDifferentiationScore))
      : 0.5;

  const mutationDecisionQuality = 0.5;
  const pioneerHandling = 0.5;
  const selectionRetrospectiveQuality = 0.5;

  return {
    librarySearchQuality,
    differentiationEffectiveness,
    mutationDecisionQuality,
    pioneerHandling,
    selectionRetrospectiveQuality,
  };
}

// ─── Public Export ─────────────────────────────────────────────────────────────

/**
 * Score Ring Leader soul selection quality across five FIT-02 dimensions.
 *
 * Evaluates whether the Ring Leader made good choices when assembling populations:
 * did it search the library effectively, differentiate souls, mutate wisely,
 * handle pioneers, and self-assess accurately?
 *
 * Uses a single LLM call (temperature 0.2) with deterministic fallback.
 *
 * @param params - SoulSelectionScoringParams with synthesis, manifests, and missionBrief
 * @returns SoulSelectionScore with five 0-1 dimension scores
 */
export async function scoreSoulSelectionQuality(
  params: SoulSelectionScoringParams,
): Promise<SoulSelectionScore> {
  const { synthesis } = params;
  const runId = synthesis.runId;

  try {
    const prompt = buildSoulSelectionScorerPrompt(params);

    const result = await generateText({
      model: resolveModel(SOUL_SELECTION_SCORER_MODEL),
      output: Output.object({ schema: SoulSelectionScoreSchema }),
      system: SOUL_SELECTION_SCORER_SYSTEM,
      prompt,
      temperature: 0.2,
    });

    if (result.output === null || result.output === undefined) {
      throw new Error('LLM returned null output — schema validation failed');
    }

    const score = result.output;

    console.info(
      `[soul-selection-scorer] Scored runId=${runId} ` +
      `search=${score.librarySearchQuality.toFixed(3)} ` +
      `diff=${score.differentiationEffectiveness.toFixed(3)} ` +
      `mutation=${score.mutationDecisionQuality.toFixed(3)} ` +
      `pioneer=${score.pioneerHandling.toFixed(3)} ` +
      `retrospective=${score.selectionRetrospectiveQuality.toFixed(3)}`,
    );

    return score;
  } catch (err) {
    const message = (err as Error).message;
    console.warn(
      `[soul-selection-scorer] LLM call failed for runId=${runId}, falling back to deterministic scoring:`,
      message,
    );

    const fallback = buildFallbackScore(params);

    console.info(
      `[soul-selection-scorer] Scored runId=${runId} ` +
      `search=${fallback.librarySearchQuality.toFixed(3)} ` +
      `diff=${fallback.differentiationEffectiveness.toFixed(3)} ` +
      `mutation=${fallback.mutationDecisionQuality.toFixed(3)} ` +
      `pioneer=${fallback.pioneerHandling.toFixed(3)} ` +
      `retrospective=${fallback.selectionRetrospectiveQuality.toFixed(3)}`,
    );

    return fallback;
  }
}
