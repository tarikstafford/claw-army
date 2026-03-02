import { generateText, Output } from 'ai';
import { z } from 'zod';
import { db, ringLeaderRuns } from '@claw/db';
import { eq } from 'drizzle-orm';
import { resolveModel } from '../lib/resolve-model';
import type {
  RingLeaderMissionBrief,
  RingLeaderRunState,
  RingLeaderSynthesis,
  PopulationManifest,
  TaskSummary,
} from '@claw/shared-types';
import type { CoordinationLogEntry } from './coordination-events';

// ─── Constants ──────────────────────────────────────────────────────────────────

const SYNTHESIS_MODEL = process.env.SYNTHESIS_MODEL ?? 'claude-sonnet-4-6';

/** Maximum number of coordination log events to include in the LLM prompt */
const MAX_COORDINATION_LOG_EVENTS = 20;

/** Maximum characters for the manifest summary block in the LLM prompt */
const MAX_MANIFEST_SUMMARY_CHARS = 4000;

// ─── Params Interface ──────────────────────────────────────────────────────────

export interface RunSynthesisParams {
  runId: string;
  executionId: string;
  missionBrief: RingLeaderMissionBrief;
  runState: RingLeaderRunState;
  manifests: PopulationManifest[];
  coordinationLog: CoordinationLogEntry[];
}

// ─── LLM Output Schema ─────────────────────────────────────────────────────────

const SynthesisLLMOutputSchema = z.object({
  objectiveAchieved: z.boolean(),
  achievementRationale: z.string(),
  soulSelectionRetrospective: z.string(),
  ringLeaderSelfAssessment: z.string(),
});

type SynthesisLLMOutput = z.infer<typeof SynthesisLLMOutputSchema>;

// ─── Event Count Helpers ───────────────────────────────────────────────────────

function countEventsByType(
  log: CoordinationLogEntry[],
  type: string,
): number {
  return log.filter((entry) => entry.type === type).length;
}

// ─── Per-Task Summary Builder ──────────────────────────────────────────────────

function buildTaskSummaries(
  missionBrief: RingLeaderMissionBrief,
  runState: RingLeaderRunState,
  manifests: PopulationManifest[],
  coordinationLog: CoordinationLogEntry[],
): TaskSummary[] {
  return missionBrief.taskGraph.tasks.map((task) => {
    const taskState = runState.taskStates[task.taskId];
    const completed = taskState?.status === 'complete';

    // Find the manifest for this task to look up soul assignments
    const manifest = manifests.find((m) => m.taskId === task.taskId);

    // Top-performing soul: first completed agent's soulId from manifest
    let topPerformingSoulId: string | null = null;
    if (completed && manifest && manifest.assignedSouls.length > 0) {
      topPerformingSoulId = manifest.assignedSouls[0]?.soulId ?? null;
    }

    // Anomalies: coordination log entries referencing this taskId for reallocation/reanchoring
    const anomalies: string[] = coordinationLog
      .filter((entry) => {
        if (
          entry.type !== 'reallocation' &&
          entry.type !== 'reanchoring'
        ) {
          return false;
        }
        const payload = entry.payload as Record<string, unknown>;
        return (
          payload['taskId'] === task.taskId ||
          payload['fromTaskId'] === task.taskId ||
          payload['toTaskId'] === task.taskId
        );
      })
      .map((entry) => `${entry.type} at ${entry.timestamp}`);

    return {
      taskId: task.taskId,
      completed,
      topPerformingSoulId,
      outputQualitySignal: taskState?.outputQualitySignal ?? null,
      anomalies,
    };
  });
}

// ─── Pioneer Events Derivation ─────────────────────────────────────────────────

function derivePioneerEvents(manifests: PopulationManifest[]): string[] {
  return manifests
    .filter((m) => m.pioneerFlag === true)
    .map((m) => m.taskId);
}

// ─── Recommended Library Writes Derivation ─────────────────────────────────────

function deriveRecommendedLibraryWrites(
  manifests: PopulationManifest[],
  runState: RingLeaderRunState,
): string[] {
  const soulIds: string[] = [];

  for (const manifest of manifests) {
    const taskState = runState.taskStates[manifest.taskId];
    if (taskState?.status !== 'complete') continue;

    for (const soul of manifest.assignedSouls) {
      if (soul.agentClass === 'Artisan' || soul.agentClass === 'Understudy') {
        soulIds.push(soul.soulId);
      }
    }
  }

  // Deduplicate (a soul may appear in multiple tasks)
  return [...new Set(soulIds)];
}

// ─── Prompt Builders ───────────────────────────────────────────────────────────

function buildManifestSummary(manifests: PopulationManifest[]): string {
  const lines: string[] = [];

  for (const manifest of manifests) {
    lines.push(`Task: ${manifest.taskId} — ${manifest.taskDescription}`);
    lines.push(`  Pioneer: ${manifest.pioneerFlag ? 'yes' : 'no'}`);
    for (const soul of manifest.assignedSouls) {
      lines.push(
        `  Soul ${soul.soulId}: class=${soul.agentClass} source=${soul.source} ` +
        `diff=${soul.differentiationScore.toFixed(3)} rationale="${soul.selectionRationale.slice(0, 80)}"`,
      );
    }
  }

  const text = lines.join('\n');
  return text.length > MAX_MANIFEST_SUMMARY_CHARS
    ? text.slice(0, MAX_MANIFEST_SUMMARY_CHARS) + '\n... (truncated)'
    : text;
}

function buildCoordinationEventHighlights(log: CoordinationLogEntry[]): string {
  const recent = log.slice(-MAX_COORDINATION_LOG_EVENTS);
  if (recent.length === 0) return 'No coordination events recorded.';

  return recent
    .map((entry) => `[${entry.timestamp}] ${entry.type}`)
    .join('\n');
}

function buildSynthesisPrompt(
  params: RunSynthesisParams,
  taskSummaries: TaskSummary[],
  intelligenceRoutingEvents: number,
  reallocationEvents: number,
  reanchoringEvents: number,
  budgetVarianceCents: number,
): string {
  const { missionBrief, runState, manifests, coordinationLog } = params;
  const completedTasks = taskSummaries.filter((t) => t.completed).length;
  const totalTasks = taskSummaries.length;

  const taskStatusLines = taskSummaries
    .map((t) => {
      const qual =
        t.outputQualitySignal !== null
          ? t.outputQualitySignal.toFixed(3)
          : 'null';
      const anomalyCount = t.anomalies.length;
      return (
        `  ${t.taskId}: ${t.completed ? 'COMPLETE' : 'INCOMPLETE'} ` +
        `quality=${qual} anomalies=${anomalyCount}`
      );
    })
    .join('\n');

  const taskGraphSummary = missionBrief.taskGraph.tasks
    .map(
      (t) =>
        `  ${t.taskId} (${t.complexity}) — ${t.description.slice(0, 100)}`,
    )
    .join('\n');

  const manifestSummary = buildManifestSummary(manifests);
  const eventHighlights = buildCoordinationEventHighlights(coordinationLog);

  const budgetVarianceSign = budgetVarianceCents >= 0 ? '+' : '';

  return `## Ring Leader Run Synthesis

### Objective
${missionBrief.objective}

### Task Graph
${taskGraphSummary}

### Task Completion Status
${completedTasks}/${totalTasks} tasks completed
${taskStatusLines}

### Coordination Event Counts
- Intelligence Routing Events: ${intelligenceRoutingEvents}
- Reallocation Events: ${reallocationEvents}
- Reanchoring Events: ${reanchoringEvents}

### Budget
- Cap: ${missionBrief.budgetCapCents}¢
- Consumed: ${runState.budgetConsumedCents}¢
- Variance: ${budgetVarianceSign}${budgetVarianceCents}¢ (negative = under budget)

### Objective Drift Score
${runState.objectiveDriftScore.toFixed(3)} (0 = fully aligned, 1 = fully drifted)

### Population Manifest Summary
${manifestSummary}

### Coordination Event Highlights (last ${MAX_COORDINATION_LOG_EVENTS})
${eventHighlights}

---

Based on all of the above, produce:
1. objectiveAchieved: boolean — was the mission objective met overall?
2. achievementRationale: 2-3 sentences assessing whether the objective was met, referencing task completion rate and anomaly severity.
3. soulSelectionRetrospective: Assess which soul selections worked (completed tasks with no anomalies) and which did not (failed tasks, reallocation events). Reference agent classes and differentiation scores from the manifest.
4. ringLeaderSelfAssessment: Evaluate coordination quality — intelligence routing effectiveness, drift management, budget discipline, and failure recovery. Reference specific event counts and drift scores.`;
}

// ─── Fallback Synthesis ────────────────────────────────────────────────────────

function buildFallbackLLMOutput(errorMessage: string): SynthesisLLMOutput {
  return {
    objectiveAchieved: false,
    achievementRationale: `Synthesis generation failed: ${errorMessage}. Unable to assess objective achievement.`,
    soulSelectionRetrospective: '',
    ringLeaderSelfAssessment: '',
  };
}

// ─── Public Export ─────────────────────────────────────────────────────────────

/**
 * Generate a complete RingLeaderSynthesis document after all tasks complete or
 * runtime limit is reached (SYNTH-01 through SYNTH-04).
 *
 * Steps:
 * 1. Compute event counts from coordination log
 * 2. Compute budget variance from runState and missionBrief
 * 3. Build per-task summaries
 * 4. Derive pioneer events and recommended library writes from manifests
 * 5. Call LLM for objective assessment, soul retrospective, and self-assessment
 * 6. Assemble and persist the full RingLeaderSynthesis to ring_leader_runs.synthesis
 * 7. Transition run status to 'completed'
 *
 * On LLM failure: falls back to a degraded synthesis with objectiveAchieved=false,
 * still persists and transitions to 'completed'.
 *
 * @param params - RunSynthesisParams containing runId, executionId, missionBrief,
 *                 runState, manifests, and coordinationLog
 * @returns The persisted RingLeaderSynthesis document
 */
export async function generateRunSynthesis(
  params: RunSynthesisParams,
): Promise<RingLeaderSynthesis> {
  const { runId, missionBrief, runState, manifests, coordinationLog } = params;

  console.info(
    `[run-synthesis] Starting synthesis for runId=${runId} model=${SYNTHESIS_MODEL}`,
  );

  // ── Step 1: Compute event counts ──────────────────────────────────────────
  const intelligenceRoutingEvents = countEventsByType(
    coordinationLog,
    'intelligence_routing',
  );
  const reallocationEvents = countEventsByType(coordinationLog, 'reallocation');
  const reanchoringEvents = countEventsByType(coordinationLog, 'reanchoring');

  // ── Step 2: Compute budget variance ───────────────────────────────────────
  const budgetVarianceCents =
    runState.budgetConsumedCents - missionBrief.budgetCapCents;

  // ── Step 3: Build per-task summaries ──────────────────────────────────────
  const taskSummary = buildTaskSummaries(
    missionBrief,
    runState,
    manifests,
    coordinationLog,
  );

  // ── Step 4: Derive pioneer events and recommended library writes ───────────
  const pioneerEvents = derivePioneerEvents(manifests);
  const recommendedLibraryWrites = deriveRecommendedLibraryWrites(
    manifests,
    runState,
  );

  // ── Step 5: LLM call for objective assessment and qualitative fields ───────
  let llmOutput: SynthesisLLMOutput;

  try {
    const prompt = buildSynthesisPrompt(
      params,
      taskSummary,
      intelligenceRoutingEvents,
      reallocationEvents,
      reanchoringEvents,
      budgetVarianceCents,
    );

    const result = await generateText({
      model: resolveModel(SYNTHESIS_MODEL),
      output: Output.object({ schema: SynthesisLLMOutputSchema }),
      system:
        'You are the Ring Leader coordination AI. Produce a structured synthesis document ' +
        'assessing whether the mission objective was achieved, evaluating soul selection quality, ' +
        'and providing a self-assessment of your coordination performance. ' +
        'Be specific, evidence-driven, and reference actual event counts and metrics.',
      prompt,
      temperature: 0.2,
    });

    if (result.output === null || result.output === undefined) {
      throw new Error('LLM returned null output — schema validation failed');
    }

    llmOutput = result.output;

    console.info(
      `[run-synthesis] LLM synthesis complete for runId=${runId} ` +
      `objectiveAchieved=${llmOutput.objectiveAchieved}`,
    );
  } catch (err) {
    const message = (err as Error).message;
    console.warn(
      `[run-synthesis] LLM call failed for runId=${runId}, falling back to degraded synthesis:`,
      message,
    );
    llmOutput = buildFallbackLLMOutput(message);
  }

  // ── Step 6: Assemble the full RingLeaderSynthesis ─────────────────────────
  const synthesis: RingLeaderSynthesis = {
    runId,
    objective: missionBrief.objective,
    objectiveAchieved: llmOutput.objectiveAchieved,
    achievementRationale: llmOutput.achievementRationale,
    taskSummary,
    intelligenceRoutingEvents,
    reallocationEvents,
    reanchoringEvents,
    soulSelectionRetrospective: llmOutput.soulSelectionRetrospective,
    budgetVarianceCents,
    recommendedLibraryWrites,
    pioneerEvents,
    ringLeaderSelfAssessment: llmOutput.ringLeaderSelfAssessment,
  };

  // ── Step 7: Persist synthesis and transition run to 'completed' ───────────
  await db
    .update(ringLeaderRuns)
    .set({
      synthesis,
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(ringLeaderRuns.id, runId));

  console.info(
    `[run-synthesis] Synthesis persisted for runId=${runId} status=completed`,
  );

  return synthesis;
}
