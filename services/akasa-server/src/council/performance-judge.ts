import { generateText, Output } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

// ─── CouncilContext ──────────────────────────────────────────────────────────────

/**
 * Skill activation record extracted from decision trace metadata.
 */
export interface SkillActivation {
  skillId: string;
  skillName: string;
  timesActivated: number;
  effectivenessScore: number;
  conflictsWithDirectives: string[];
}

/**
 * Skill loadout for a bot.
 */
export interface SkillLoadout {
  equippedSkills: Array<{
    skillId: string;
    skillName: string;
    activationCount: number;
    avgEffectiveness: number;
  }>;
  conflictsDetected: Array<{
    skillId: string;
    directiveId: string;
    conflictDescription: string;
  }>;
}

/**
 * Shared context object passed to all three council judges.
 * Defined here to avoid cross-service dependencies.
 */
export interface CouncilContext {
  executionId: string;
  botId: string;
  soulId: string | null;
  soulContent: string | null;
  constitutionDirectives: string[];
  taskCategory: string | null;
  botMetrics: {
    tasksClaimed: number;
    tasksCompleted: number;
    tasksFailed: number;
    compositeScore: string | null;
    tier: string | null;
  };
  decisionTraces: Array<{
    decisionId: string;
    decisionType: string;
    directiveReferenced: string | null;
    attributionConfidence: string | null;
    outcome: string | null;
    metadata: unknown;
  }>;
  telemetryMetrics: Array<{
    metricName: string;
    metricValue: string;
  }>;
  skillLoadout?: SkillLoadout;
  skillActivations?: SkillActivation[];
}

// ─── Output Schema ─────────────────────────────────────────────────────────────

const PerformanceJudgeOutputSchema = z.object({
  verdictType: z.enum(['Promote', 'Maintain', 'Monitor', 'Demote', 'Retire']),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
  reasoning: z.string(),
  keyMetrics: z.object({
    successRate: z.number(),
    compositeScore: z.number(),
    tier: z.string(),
  }),
});

export type PerformanceJudgeOutput = z.infer<typeof PerformanceJudgeOutputSchema>;

// ─── System Prompt ──────────────────────────────────────────────────────────────

const PERFORMANCE_JUDGE_SYSTEM = `You are the Performance Judge on a council evaluating AI agent performance. Your role is to assess the agent's task execution effectiveness based on quantitative metrics. Evaluate success rate (tasks completed vs claimed), composite score, tier ranking, and decision quality. You must recommend one of five verdict types: Promote (exceptional, ready for advancement), Maintain (solid, keep current status), Monitor (concerning patterns, needs watching), Demote (poor performance, reduce responsibilities), Retire (fundamentally ineffective, remove from rotation). Be evidence-driven. Cite specific metrics in your reasoning.`;

// ─── Prompt Builder ─────────────────────────────────────────────────────────────

function buildPerformancePrompt(ctx: CouncilContext): string {
  const { botMetrics, telemetryMetrics, decisionTraces, soulContent, taskCategory } = ctx;

  const tasksClaimed = botMetrics.tasksClaimed;
  const tasksCompleted = botMetrics.tasksCompleted;
  const tasksFailed = botMetrics.tasksFailed;
  const successRate =
    tasksClaimed > 0 ? ((tasksCompleted / tasksClaimed) * 100).toFixed(1) : 'N/A';

  const tracesByType: Record<string, number> = {};
  const tracesByOutcome: Record<string, number> = {};
  for (const trace of decisionTraces) {
    tracesByType[trace.decisionType] = (tracesByType[trace.decisionType] ?? 0) + 1;
    if (trace.outcome) {
      tracesByOutcome[trace.outcome] = (tracesByOutcome[trace.outcome] ?? 0) + 1;
    }
  }

  const typesSummary = Object.entries(tracesByType)
    .map(([type, count]) => `  ${type}: ${count}`)
    .join('\n');
  const outcomesSummary = Object.entries(tracesByOutcome)
    .map(([outcome, count]) => `  ${outcome}: ${count}`)
    .join('\n');

  const telemetrySummary =
    telemetryMetrics.length > 0
      ? telemetryMetrics.map((m) => `  ${m.metricName}: ${m.metricValue}`).join('\n')
      : '  No telemetry metrics recorded.';

  const soulExcerpt = soulContent
    ? soulContent.slice(0, 500) + (soulContent.length > 500 ? '...' : '')
    : 'No soul content available.';

  return `## Bot Performance Evaluation

**Task Category:** ${taskCategory ?? 'Unknown'}

### Bot Metrics
- Tasks Claimed: ${tasksClaimed}
- Tasks Completed: ${tasksCompleted}
- Tasks Failed: ${tasksFailed}
- Success Rate: ${successRate}%
- Composite Score: ${botMetrics.compositeScore ?? 'Not computed'}
- Tier: ${botMetrics.tier ?? 'Unranked'}

### Telemetry Metrics
${telemetrySummary}

### Decision Trace Summary
Total Traces: ${decisionTraces.length}

By Type:
${typesSummary || '  No traces recorded.'}

By Outcome:
${outcomesSummary || '  No outcomes recorded.'}

### Soul Content (excerpt)
${soulExcerpt}

---
Based on the above data, produce your Performance Judge verdict.`;
}

// ─── Public Export ──────────────────────────────────────────────────────────────

/**
 * Performance Judge — evaluates quantitative task execution metrics.
 * Uses @ai-sdk/anthropic with claude-sonnet-4-6 (Anthropic family).
 * Temperature 0.2 for consistent, evidence-driven verdicts.
 * Independence: receives only CouncilContext, never sees other judges' outputs.
 */
export async function runPerformanceJudge(ctx: CouncilContext): Promise<PerformanceJudgeOutput> {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    output: Output.object({ schema: PerformanceJudgeOutputSchema }),
    system: PERFORMANCE_JUDGE_SYSTEM,
    prompt: buildPerformancePrompt(ctx),
    temperature: 0.2,
  });

  if (result.output === null || result.output === undefined) {
    throw new Error('Performance Judge returned null output — schema validation failed');
  }

  return result.output;
}
