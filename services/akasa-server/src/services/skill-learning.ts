import { generateText, Output } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { db, skills, decisionTraces, executions, bots } from '@claw/db';
import { eq, and } from 'drizzle-orm';
import { publishGlobalLiveEvent } from '@paperclipai/shared';
import type { SkillLearnedEvent } from '@claw/event-schemas';

const CandidateSkillSchema = z.object({
  name: z.string(),
  category: z.string(),
  description: z.string(),
  triggerPatterns: z.array(z.string()),
  proceduralBody: z.string(),
  requiredTools: z.array(z.string()),
  confidenceScore: z.number().min(0).max(1),
  reasoning: z.string(),
});

export type CandidateSkill = z.infer<typeof CandidateSkillSchema>;

const SKILL_LEARNING_SYSTEM = `You are a Pattern Detection Expert analyzing AI agent decision traces to identify novel procedural skills.

Your task is to:
1. Analyze decision sequences that led to successful outcomes
2. Identify patterns that don't match existing skill triggers
3. Extract reusable procedural knowledge into SKILL.md format
4. Assess confidence based on attribution clarity and outcome consistency

Generate skills that are:
- Actionable: clear steps the agent can follow
- Generalizable: work across different contexts within the task category  
- Novel: not already covered by existing skills
- High-quality: specific enough to be useful, general enough to apply broadly

Output a candidate skill with confidence score based on:
- Attribution confidence of source traces (higher = more confident)
- Outcome consistency (all success = higher confidence)
- Pattern clarity (clear decision sequence = higher confidence)`;

function buildPatternDetectionPrompt(
  traces: Array<{
    decisionId: string;
    decisionType: string;
    directiveReferenced: string | null;
    attributionConfidence: string | null;
    outcome: string | null;
    metadata: unknown;
  }>,
  taskCategory: string | null,
  executionId: string,
): string {
  const successTraces = traces.filter((t) => t.outcome === 'success');
  const tracesByType: Record<string, number> = {};
  const tracesByDirective: Record<string, number> = {};

  for (const trace of successTraces) {
    tracesByType[trace.decisionType] = (tracesByType[trace.decisionType] ?? 0) + 1;
    if (trace.directiveReferenced) {
      tracesByDirective[trace.directiveReferenced] =
        (tracesByDirective[trace.directiveReferenced] ?? 0) + 1;
    }
  }

  const avgConfidence =
    successTraces.length > 0
      ? successTraces.reduce((sum, t) => sum + parseFloat(t.attributionConfidence ?? '0'), 0) /
        successTraces.length
      : 0;

  const typesSummary = Object.entries(tracesByType)
    .map(([type, count]) => `  ${type}: ${count}`)
    .join('\n');
  const directivesSummary = Object.entries(tracesByDirective)
    .map(([dir, count]) => `  ${dir}: ${count}`)
    .join('\n');

  const traceDetails = successTraces
    .slice(0, 20)
    .map((t) => {
      const meta = t.metadata as Record<string, unknown> | null;
      return `  - [${t.decisionType}] confidence=${t.attributionConfidence ?? 'N/A'} outcome=${t.outcome}${meta ? ` meta=${JSON.stringify(meta).slice(0, 200)}` : ''}`;
    })
    .join('\n');

  return `## Decision Trace Analysis for Skill Extraction

**Execution ID:** ${executionId}
**Task Category:** ${taskCategory ?? 'Unknown'}
**Total Success Traces:** ${successTraces.length}
**Average Attribution Confidence:** ${avgConfidence.toFixed(3)}

### Success Traces by Type:
${typesSummary || '  No type data'}

### Success Traces by Directive:
${directivesSummary || '  No directive data'}

### Detailed Success Trace Sample (up to 20):
${traceDetails || '  No traces available'}

---
Based on the above decision traces, identify any NOVEL procedural patterns that led to successful outcomes.
Extract reusable skills that could help other agents handle similar situations.
If no novel patterns are detected, return null for the skill.`;
}

async function detectNovelPattern(
  traces: Array<{
    decisionId: string;
    decisionType: string;
    directiveReferenced: string | null;
    attributionConfidence: string | null;
    outcome: string | null;
    metadata: unknown;
  }>,
  taskCategory: string | null,
  executionId: string,
): Promise<CandidateSkill | null> {
  if (traces.length === 0) {
    return null;
  }

  const successTraces = traces.filter((t) => t.outcome === 'success');
  if (successTraces.length < 3) {
    console.log('[skill-learning] Insufficient success traces for pattern detection:', {
      executionId,
      successCount: successTraces.length,
    });
    return null;
  }

  try {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      output: Output.object({ schema: CandidateSkillSchema }),
      system: SKILL_LEARNING_SYSTEM,
      prompt: buildPatternDetectionPrompt(traces, taskCategory, executionId),
      temperature: 0.3,
    });

    if (result.output === null || result.output === undefined) {
      console.log('[skill-learning] LLM returned null pattern detection result:', { executionId });
      return null;
    }

    if (result.output.confidenceScore < 0.3) {
      console.log('[skill-learning] Pattern confidence below threshold:', {
        executionId,
        confidence: result.output.confidenceScore,
      });
      return null;
    }

    return result.output;
  } catch (err) {
    console.error('[skill-learning] Pattern detection LLM call failed:', {
      executionId,
      error: (err as Error).message,
    });
    return null;
  }
}

function generateSkillMarkdown(candidate: CandidateSkill): string {
  const triggerLines = candidate.triggerPatterns.map((p) => `  - ${p}`).join('\n');
  const toolsLines = candidate.requiredTools.map((t) => `  - ${t}`).join('\n');

  const frontmatter = `---
name: ${candidate.name}
category: ${candidate.category}
description: ${candidate.description}
version: "1.0"
trigger_patterns:
${triggerLines}
requires_tools:
${toolsLines}
---

`;

  return `${frontmatter.trim()}\n\n${candidate.proceduralBody}`;
}

export interface SkillLearningResult {
  skillId: string | null;
  candidate: CandidateSkill | null;
  approved: boolean;
  reason: string;
}

export async function processSkillLearning(
  executionId: string,
  botId: string,
): Promise<SkillLearningResult> {
  console.log('[skill-learning] Starting skill learning process:', { executionId, botId });

  const traceRows = await db
    .select({
      id: decisionTraces.id,
      decisionId: decisionTraces.decisionId,
      decisionType: decisionTraces.decisionType,
      directiveReferenced: decisionTraces.directiveReferenced,
      attributionConfidence: decisionTraces.attributionConfidence,
      outcome: decisionTraces.outcome,
      metadata: decisionTraces.metadata,
    })
    .from(decisionTraces)
    .where(eq(decisionTraces.executionId, executionId));

  if (traceRows.length === 0) {
    console.log('[skill-learning] No decision traces found for execution:', { executionId });
    return { skillId: null, candidate: null, approved: false, reason: 'no_traces' };
  }

  const botRows = await db
    .select({
      soulId: bots.soulId,
      userId: bots.userId,
    })
    .from(bots)
    .where(eq(bots.id, botId))
    .limit(1);

  const bot = botRows[0];
  if (!bot) {
    console.log('[skill-learning] Bot not found:', { botId });
    return { skillId: null, candidate: null, approved: false, reason: 'bot_not_found' };
  }

  const executionRows = await db
    .select({
      taskCategory: executions.taskCategory,
    })
    .from(executions)
    .where(eq(executions.id, executionId))
    .limit(1);

  const taskCategory = executionRows[0]?.taskCategory ?? null;

  const candidate = await detectNovelPattern(traceRows, taskCategory, executionId);

  if (!candidate) {
    return { skillId: null, candidate: null, approved: false, reason: 'no_pattern_detected' };
  }

  const confidenceScore = candidate.confidenceScore;
  const approved = confidenceScore >= 0.8;

  const skillMarkdown = generateSkillMarkdown(candidate);
  const triggerPatterns = candidate.triggerPatterns;
  const requiredTools = candidate.requiredTools;

  const [insertedSkill] = await db
    .insert(skills)
    .values({
      userId: bot.userId,
      name: candidate.name,
      category: candidate.category,
      content: skillMarkdown,
      metadata: {
        description: candidate.description,
        version: '1.0',
        learnedFromTraces: traceRows.map((t) => t.id),
      },
      source: 'learned',
      effectivenessScore: confidenceScore.toFixed(3),
      approvalStatus: approved ? 'approved' : 'pending',
      sourceExecutionId: executionId,
      sourceBotId: botId,
      confidenceScore: confidenceScore.toFixed(3),
      triggerPatterns,
      requiredTools,
    })
    .returning();

  const event: SkillLearnedEvent = {
    type: 'skill_learned',
    skillId: insertedSkill.id,
    executionId,
    botId,
    skillName: candidate.name,
    category: candidate.category,
    confidenceScore,
    approvalStatus: approved ? 'approved' : 'pending',
    source: 'learned',
    timestamp: new Date().toISOString(),
  };

  try {
    publishGlobalLiveEvent({ type: 'skill_learned', payload: event as unknown as Record<string, unknown> });
    console.log('[skill-learning] Emitted skill_learned event:', { skillId: insertedSkill.id });
  } catch (err) {
    console.error('[skill-learning] Failed to emit skill_learned event:', {
      skillId: insertedSkill.id,
      error: (err as Error).message,
    });
  }

  console.log('[skill-learning] Skill candidate processed:', {
    skillId: insertedSkill.id,
    name: candidate.name,
    confidence: confidenceScore,
    approved,
  });

  return {
    skillId: insertedSkill.id,
    candidate,
    approved,
    reason: approved ? 'high_confidence_auto_approved' : 'low_confidence_pending_review',
  };
}