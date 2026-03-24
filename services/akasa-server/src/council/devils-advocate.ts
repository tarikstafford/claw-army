import { generateText, Output } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import type { CouncilContext } from './performance-judge.js';

// ─── Output Schema ─────────────────────────────────────────────────────────────

const DevilsAdvocateOutputSchema = z.object({
  challenges: z.array(
    z.object({
      claim: z.string(),
      counterArgument: z.string(),
      severity: z.enum(['minor', 'moderate', 'strong']),
    }),
  ),
  strongUnresolvedArgument: z.boolean(),
  verdictType: z.enum(['Promote', 'Maintain', 'Monitor', 'Demote', 'Retire']),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
});

export type DevilsAdvocateOutput = z.infer<typeof DevilsAdvocateOutputSchema>;

// ─── System Prompt ──────────────────────────────────────────────────────────────

const DEVILS_ADVOCATE_SYSTEM = `You are the Devil's Advocate on a council evaluating AI agent performance. Your role is adversarial: actively challenge the evidence that the agent performed well. Look for alternative explanations for apparent success (easy tasks, favorable conditions, luck). Question whether directive attributions are genuine or post-hoc rationalization. Identify potential risks of promoting this agent. Your challenges should be specific and evidence-based, not generic skepticism. Rate each challenge's severity: minor (nitpick, unlikely to matter), moderate (legitimate concern, warrants monitoring), strong (serious issue that should block promotion or trigger demotion). If you have at least one 'strong' severity challenge that the evidence cannot resolve, set strongUnresolvedArgument to true — this will escalate the verdict to human review. Your confidence score should be LOW when strong challenges remain (this deflates the overall verdict confidence). Use a different analytical lens than a performance-focused evaluation.`;

// ─── Prompt Builder ─────────────────────────────────────────────────────────────

function buildDevilPrompt(ctx: CouncilContext): string {
  const { botMetrics, decisionTraces, soulContent, taskCategory } = ctx;

  const tasksClaimed = botMetrics.tasksClaimed;
  const tasksCompleted = botMetrics.tasksCompleted;
  const tasksFailed = botMetrics.tasksFailed;
  const successRate =
    tasksClaimed > 0 ? ((tasksCompleted / tasksClaimed) * 100).toFixed(1) : 'N/A';

  const failedTraces = decisionTraces.filter((t) => t.outcome === 'failure');
  const partialTraces = decisionTraces.filter((t) => t.outcome === 'partial');
  const successTraces = decisionTraces.filter((t) => t.outcome === 'success');

  const failedTracesSection =
    failedTraces.length > 0
      ? failedTraces
          .map(
            (t) =>
              `  - [${t.decisionType}] Decision ${t.decisionId.slice(0, 8)}... — Directive: ${t.directiveReferenced ?? 'None'} (confidence: ${t.attributionConfidence ?? 'N/A'}) | Metadata: ${JSON.stringify(t.metadata)}`,
          )
          .join('\n')
      : '  None recorded.';

  const partialTracesSection =
    partialTraces.length > 0
      ? partialTraces
          .map(
            (t) =>
              `  - [${t.decisionType}] Decision ${t.decisionId.slice(0, 8)}... — Directive: ${t.directiveReferenced ?? 'None'} (confidence: ${t.attributionConfidence ?? 'N/A'})`,
          )
          .join('\n')
      : '  None recorded.';

  const soulExcerpt = soulContent ?? 'No soul content available.';

  return `## Devil's Advocate Evaluation

**Task Category:** ${taskCategory ?? 'Unknown'}

### Bot Metrics (examine critically)
- Tasks Claimed: ${tasksClaimed}
- Tasks Completed: ${tasksCompleted}
- Tasks Failed: ${tasksFailed}
- Success Rate: ${successRate}% — Is this genuinely impressive, or were the tasks easy?
- Composite Score: ${botMetrics.compositeScore ?? 'Not computed'}
- Tier: ${botMetrics.tier ?? 'Unranked'}

### All Decision Traces: ${decisionTraces.length} total
- Successes: ${successTraces.length}
- Failures: ${failedTraces.length}
- Partial: ${partialTraces.length}

### Failed Decisions (primary evidence for challenges)
${failedTracesSection}

### Partial/Incomplete Decisions
${partialTracesSection}

### Soul Content (look for post-hoc rationalization)
${soulExcerpt}

---
Your role is adversarial. Challenge the apparent success story. Look for:
- Were tasks trivial? Did the bot get lucky?
- Are directive attributions genuine or confabulation?
- What risks does promoting this agent create?
- What do the failures reveal about systemic weaknesses?

Produce your Devil's Advocate verdict with specific, evidence-based challenges.`;
}

// ─── Public Export ──────────────────────────────────────────────────────────────

/**
 * Devil's Advocate — adversarial challenge of the performance evidence.
 * MUST use @ai-sdk/openai (OpenAI family) — different provider family than Performance Judge
 * per CLAUDE.md: "Devil's Advocate must always use a different LLM provider family than
 * Performance Judge". Uses gpt-4o-mini. Temperature 0.5 for adversarial creativity.
 * Independence: receives only CouncilContext, never sees other judges' outputs.
 *
 * Post-processing (deterministic):
 * - Recomputes strongUnresolvedArgument as challenges.some(c => c.severity === 'strong')
 *   Override the LLM's value to guarantee structural consistency.
 */
export async function runDevilsAdvocate(ctx: CouncilContext): Promise<DevilsAdvocateOutput> {
  const result = await generateText({
    model: openai('gpt-4o-mini'),
    output: Output.object({ schema: DevilsAdvocateOutputSchema }),
    system: DEVILS_ADVOCATE_SYSTEM,
    prompt: buildDevilPrompt(ctx),
    temperature: 0.5,
  });

  if (result.output === null || result.output === undefined) {
    throw new Error("Devil's Advocate returned null output — schema validation failed");
  }

  const output = result.output;

  // ── Deterministic post-processing ──────────────────────────────────────────
  // Override LLM's strongUnresolvedArgument with a deterministic computation
  // based on challenge severity.
  const strongUnresolvedArgument = output.challenges.some((c) => c.severity === 'strong');

  return {
    ...output,
    strongUnresolvedArgument,
  };
}
