import { generateText, Output } from 'ai';
import { z } from 'zod';
import { resolveModel } from '../lib/resolve-model';
import type {
  RingLeaderMissionBrief,
  RingLeaderRunState,
  RingLeaderSynthesis,
  CoordinationScore,
} from '@claw/shared-types';
import { COORDINATION_WEIGHTS } from '@claw/shared-types';
import type { CoordinationLogEntry } from './coordination-events';

// ─── Constants ──────────────────────────────────────────────────────────────────

const COORDINATION_SCORER_MODEL =
  process.env.COORDINATION_SCORER_MODEL ?? 'claude-sonnet-4-6';

/** Maximum number of coordination log events to include in the LLM prompt */
const MAX_COORDINATION_LOG_EVENTS = 15;

// ─── Params Interface ──────────────────────────────────────────────────────────

export interface CoordinationScoringParams {
  synthesis: RingLeaderSynthesis;
  coordinationLog: CoordinationLogEntry[];
  missionBrief: RingLeaderMissionBrief;
  runState: RingLeaderRunState;
}

// ─── LLM Output Schema ─────────────────────────────────────────────────────────

const CoordinationScoreLLMSchema = z.object({
  collectiveOutcome: z.number().min(0).max(1),
  driftPrevention: z.number().min(0).max(1),
  reallocationEffectiveness: z.number().min(0).max(1),
  budgetManagement: z.number().min(0).max(1),
});

type CoordinationScoreLLMOutput = z.infer<typeof CoordinationScoreLLMSchema>;

// ─── Prompt Builder ────────────────────────────────────────────────────────────

function buildCoordinationEventHighlights(log: CoordinationLogEntry[]): string {
  const recent = log.slice(-MAX_COORDINATION_LOG_EVENTS);
  if (recent.length === 0) return 'No coordination events recorded.';
  return recent.map((entry) => `[${entry.timestamp}] ${entry.type}`).join('\n');
}

function buildScoringPrompt(params: CoordinationScoringParams): string {
  const { synthesis, coordinationLog, missionBrief, runState } = params;

  const completedTasks = synthesis.taskSummary.filter((t) => t.completed).length;
  const totalTasks = synthesis.taskSummary.length;
  const taskCompletionRate =
    totalTasks > 0 ? (completedTasks / totalTasks).toFixed(3) : '0.000';

  const budgetVarianceSign = synthesis.budgetVarianceCents >= 0 ? '+' : '';
  const budgetConsumedPct =
    missionBrief.budgetCapCents > 0
      ? ((runState.budgetConsumedCents / missionBrief.budgetCapCents) * 100).toFixed(1)
      : 'N/A (no cap)';

  const runtimeConsumedPct =
    missionBrief.runtimeLimitSeconds > 0
      ? ((runState.elapsedTimeSeconds / missionBrief.runtimeLimitSeconds) * 100).toFixed(1)
      : 'N/A (no limit)';

  const eventHighlights = buildCoordinationEventHighlights(coordinationLog);

  const anomaliesList =
    runState.anomalies.length > 0
      ? runState.anomalies.map((a) => `  - ${a}`).join('\n')
      : '  None';

  return `## Ring Leader Coordination Quality Assessment

### Objective
${synthesis.objective}
Achieved: ${synthesis.objectiveAchieved ? 'YES' : 'NO'}
Achievement Rationale: ${synthesis.achievementRationale}

### Task Completion
- Rate: ${completedTasks}/${totalTasks} (${taskCompletionRate})

### Coordination Events
- Intelligence Routing Events: ${synthesis.intelligenceRoutingEvents}
- Reallocation Events: ${synthesis.reallocationEvents}
- Reanchoring Events: ${synthesis.reanchoringEvents}

### Objective Drift
- Final drift score: ${runState.objectiveDriftScore.toFixed(3)} (0 = fully aligned, 1 = fully drifted; lower is better)

### Budget
- Cap: ${missionBrief.budgetCapCents}¢
- Consumed: ${runState.budgetConsumedCents}¢ (${budgetConsumedPct}% of cap)
- Variance: ${budgetVarianceSign}${synthesis.budgetVarianceCents}¢ (negative = under budget)

### Runtime
- Limit: ${missionBrief.runtimeLimitSeconds}s
- Elapsed: ${runState.elapsedTimeSeconds}s (${runtimeConsumedPct}% of limit)

### Anomalies
${anomaliesList}

### Coordination Event Highlights (last ${MAX_COORDINATION_LOG_EVENTS})
${eventHighlights}

### Ring Leader Self-Assessment
${synthesis.ringLeaderSelfAssessment}

---

## Scoring Rubric

Score each dimension 0.0 to 1.0. Be evidence-driven and reference the specific metrics above.

**collectiveOutcome (weight: ${COORDINATION_WEIGHTS.collectiveOutcome * 100}%)**
Based on task completion rate, objective achievement, and output quality signals.
- 1.0 = all tasks complete + objective achieved
- 0.5–0.9 = partial completion with objective achieved or close
- Below 0.5 = majority of tasks failed or objective not achieved

**driftPrevention (weight: ${COORDINATION_WEIGHTS.driftPrevention * 100}%)**
Based on final objectiveDriftScore and reanchoring event count.
- 1.0 = drift stayed below 0.1 throughout
- 0.5 = moderate drift (0.1–0.3) with some reanchoring
- 0.0 = drift exceeded 0.5 with no reanchoring attempts

**reallocationEffectiveness (weight: ${COORDINATION_WEIGHTS.reallocationEffectiveness * 100}%)**
Based on reallocation events relative to failures.
- 1.0 = all failures recovered via reallocation
- 0.5 = some reallocation response to failures
- 0.0 = failures occurred with no reallocation response

**budgetManagement (weight: ${COORDINATION_WEIGHTS.budgetManagement * 100}%)**
Based on budget variance and degradation events.
- 1.0 = finished under budget with no hard stops
- 0.5 = close to budget (within 10%) without hard stops
- 0.0 = exceeded budget cap`;
}

// ─── Fallback Scoring ──────────────────────────────────────────────────────────

function buildFallbackScore(params: CoordinationScoringParams): CoordinationScore {
  const { synthesis, missionBrief, runState } = params;

  const completedTasks = synthesis.taskSummary.filter((t) => t.completed).length;
  const totalTasks = synthesis.taskSummary.length;

  const collectiveOutcome =
    totalTasks > 0 ? completedTasks / totalTasks : 0;

  const driftPrevention = Math.min(
    1,
    Math.max(0, 1 - runState.objectiveDriftScore),
  );

  const reallocationEffectiveness = 0.5; // neutral default when LLM unavailable

  const budgetManagement =
    synthesis.budgetVarianceCents <= 0
      ? 1.0
      : Math.max(
          0,
          1 - synthesis.budgetVarianceCents / (missionBrief.budgetCapCents || 1),
        );

  return {
    collectiveOutcome,
    driftPrevention,
    reallocationEffectiveness,
    budgetManagement,
  };
}

// ─── Public Export ─────────────────────────────────────────────────────────────

/**
 * Score coordination quality across four weighted dimensions (FIT-01).
 *
 * Uses a single LLM call (temperature 0.2) to evaluate:
 * - collectiveOutcome (40%): task completion + objective achievement
 * - driftPrevention (25%): drift score + reanchoring events
 * - reallocationEffectiveness (20%): reallocation response to failures
 * - budgetManagement (15%): budget variance + hard-stop events
 *
 * On LLM failure: returns a deterministic fallback score computed from raw metrics.
 *
 * @param params - CoordinationScoringParams
 * @returns Promise<CoordinationScore> — four 0-1 dimension scores
 */
export async function scoreCoordinationQuality(
  params: CoordinationScoringParams,
): Promise<CoordinationScore> {
  const { synthesis } = params;
  const runId = synthesis.runId;

  try {
    const prompt = buildScoringPrompt(params);

    const result = await generateText({
      model: resolveModel(COORDINATION_SCORER_MODEL),
      output: Output.object({ schema: CoordinationScoreLLMSchema }),
      system:
        'You are a Ring Leader fitness evaluator. Score coordination quality across four ' +
        'dimensions on a 0 to 1 scale. Be evidence-driven — cite specific metrics.',
      prompt,
      temperature: 0.2,
    });

    if (result.output === null || result.output === undefined) {
      throw new Error('LLM returned null output — schema validation failed');
    }

    const llmOutput: CoordinationScoreLLMOutput = result.output;

    const score: CoordinationScore = {
      collectiveOutcome: llmOutput.collectiveOutcome,
      driftPrevention: llmOutput.driftPrevention,
      reallocationEffectiveness: llmOutput.reallocationEffectiveness,
      budgetManagement: llmOutput.budgetManagement,
    };

    console.info(
      `[coordination-scorer] Scored runId=${runId} ` +
      `collectiveOutcome=${score.collectiveOutcome.toFixed(3)} ` +
      `driftPrevention=${score.driftPrevention.toFixed(3)} ` +
      `reallocation=${score.reallocationEffectiveness.toFixed(3)} ` +
      `budget=${score.budgetManagement.toFixed(3)}`,
    );

    return score;
  } catch (err) {
    const message = (err as Error).message;
    console.warn(
      `[coordination-scorer] LLM call failed for runId=${runId}, falling back to deterministic scoring:`,
      message,
    );

    const fallback = buildFallbackScore(params);

    console.info(
      `[coordination-scorer] Scored runId=${runId} ` +
      `collectiveOutcome=${fallback.collectiveOutcome.toFixed(3)} ` +
      `driftPrevention=${fallback.driftPrevention.toFixed(3)} ` +
      `reallocation=${fallback.reallocationEffectiveness.toFixed(3)} ` +
      `budget=${fallback.budgetManagement.toFixed(3)}`,
    );

    return fallback;
  }
}
