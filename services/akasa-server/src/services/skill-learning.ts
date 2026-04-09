import { generateText, Output } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { db, decisionTraces, skills } from '@claw/db';
import { eq, and, inArray } from 'drizzle-orm';
import type { DecisionTrace } from '@claw/db';
import type { SkillCandidate, SkillLearnedEvent } from '@claw/event-schemas';

const CONFIDENCE_THRESHOLD = 0.8;

const PatternDetectionOutputSchema = z.object({
  novelPatterns: z.array(
    z.object({
      patternName: z.string(),
      category: z.enum([
        'tool_usage',
        'reasoning',
        'error_recovery',
        'delegation',
        'communication',
        'planning',
        'verification',
        'other',
      ]),
      triggerPatterns: z.array(z.string()),
      proceduralBody: z.string(),
      requiredTools: z.array(z.string()),
      confidenceScore: z.number().min(0).max(1),
      reasoning: z.string(),
      sourceTraceIds: z.array(z.string()),
    }),
  ),
  summary: z.string(),
});

type PatternDetectionOutput = z.infer<typeof PatternDetectionOutputSchema>;

async function queryDecisionTraces(executionId: string): Promise<DecisionTrace[]> {
  const traces = await db
    .select()
    .from(decisionTraces)
    .where(eq(decisionTraces.executionId, executionId))
    .limit(100);

  return traces;
}

function buildPatternDetectionPrompt(
  traces: DecisionTrace[],
  taskContext: string,
): string {
  const successfulTraces = traces.filter((t) => t.outcome === 'success');
  const relevantTraces = traces.filter(
    (t) => t.attributionConfidence !== null && parseFloat(t.attributionConfidence) > 0.3,
  );

  const traceDetails = relevantTraces.slice(0, 30).map((trace) => {
    const confidence = trace.attributionConfidence
      ? parseFloat(trace.attributionConfidence)
      : 0;
    return {
      decisionId: trace.decisionId,
      decisionType: trace.decisionType,
      directive: trace.directiveReferenced ?? 'None',
      confidence,
      outcome: trace.outcome ?? 'Unknown',
      metadata: trace.metadata,
    };
  });

  return `## Task Context
${taskContext}

## Decision Traces Analysis
Total traces: ${traces.length}
Successful outcomes: ${successfulTraces.length}
Relevant traces (confidence > 0.3): ${relevantTraces.length}

### Relevant Decision Traces
${JSON.stringify(traceDetails, null, 2)}

---
You are a skill extraction agent. Your task is to analyze the decision traces above and identify NOVEL procedural patterns that led to successful outcomes.

A novel pattern:
1. Is a sequence of decisions that produced successful outcomes
2. Does not match obvious or trivial reasoning
3. Could be captured as a reusable skill/procedure
4. Has at least 2-3 decision steps

For each novel pattern found, extract:
- **patternName**: A short, descriptive name for this skill (e.g., "Recursive Tool Error Recovery")
- **category**: One of: tool_usage, reasoning, error_recovery, delegation, communication, planning, verification, other
- **triggerPatterns**: What conditions/patterns in the input or state trigger this skill (2-4 patterns)
- **proceduralBody**: Step-by-step procedure for executing this skill (be specific and actionable)
- **requiredTools**: Any tools needed to execute this skill (empty array if none)
- **confidenceScore**: How confident you are this is a real, reusable pattern (0.0-1.0), based on attribution confidence of source traces and consistency of the pattern
- **reasoning**: Brief explanation of why this is a novel, useful pattern
- **sourceTraceIds**: The decision IDs that support this pattern

Return NOVEL patterns only. If the traces don't contain any interesting procedural patterns beyond obvious steps, return an empty novelPatterns array with a summary explaining why.`;
}

async function detectNovelPatterns(
  traces: DecisionTrace[],
  taskContext: string,
): Promise<PatternDetectionOutput> {
  const prompt = buildPatternDetectionPrompt(traces, taskContext);

  const result = await generateText({
    model: openai('gpt-4o'),
    output: Output.object({ schema: PatternDetectionOutputSchema }),
    system: `You are a skill extraction agent specializing in identifying novel procedural patterns from AI agent decision traces. You analyze traces of decisions (tool calls, reasoning steps, output steps) that led to successful outcomes and extract them as reusable skills. Be conservative — only extract patterns that are genuinely non-trivial and would be useful to other agents.`,
    prompt,
    temperature: 0.3,
  });

  if (!result.output) {
    return { novelPatterns: [], summary: 'Pattern detection returned no output' };
  }

  return result.output;
}

function calculateAverageConfidence(traces: DecisionTrace[]): number {
  const tracesWithConfidence = traces.filter(
    (t) => t.attributionConfidence !== null,
  );
  if (tracesWithConfidence.length === 0) return 0;

  const sum = tracesWithConfidence.reduce(
    (acc, t) => acc + parseFloat(t.attributionConfidence!),
    0,
  );
  return sum / tracesWithConfidence.length;
}

async function storeSkill(
  candidate: SkillCandidate,
): Promise<{ id: string; approvalStatus: string }> {
  const isAutoApproved = candidate.confidenceScore >= CONFIDENCE_THRESHOLD;

  const inserted = await db
    .insert(skills)
    .values({
      name: candidate.name,
      category: candidate.category,
      triggerPatterns: candidate.triggerPatterns,
      proceduralBody: candidate.proceduralBody,
      requiredTools: candidate.requiredTools,
      skillContent: `# ${candidate.name}

## Category
${candidate.category}

## Trigger Patterns
${candidate.triggerPatterns.map((p) => `- ${p}`).join('\n')}

## Procedure
${candidate.proceduralBody}

## Required Tools
${candidate.requiredTools.length > 0 ? candidate.requiredTools.join(', ') : 'None'}
`,
      confidenceScore: candidate.confidenceScore.toFixed(3),
      approvalStatus: isAutoApproved ? 'auto_approved' : 'pending',
      executionId: candidate.provenance.executionId,
      botId: candidate.provenance.botId,
      soulId: candidate.provenance.soulId,
      sourceTraceIds: candidate.sourceTraceIds,
      provenance: {
        decisionCount: candidate.provenance.decisionCount,
        successfulOutcomes: candidate.provenance.successfulOutcomes,
        averageAttributionConfidence: candidate.confidenceScore,
      },
    })
    .returning();

  const row = inserted[0];
  if (!row) {
    throw new Error('[skill-learning] Failed to insert skill');
  }

  return { id: row.id, approvalStatus: row.approvalStatus };
}

function emitSkillLearnedEvent(event: SkillLearnedEvent): void {
  const payload = JSON.stringify(event);
  process.emit('message', payload, ['skill_learned']);
  console.log('[skill-learning] skill_learned event emitted:', {
    skillId: event.skillId,
    name: event.skillName,
    approvalStatus: event.approvalStatus,
  });
}

export interface SkillLearningResult {
  skillId: string;
  name: string;
  category: string;
  confidenceScore: number;
  approvalStatus: string;
  sourceTraceIds: string[];
}

export async function processSkillLearning(
  executionId: string,
  botId: string,
  soulId: string | null,
  taskContext: string,
  verdictType: string,
): Promise<SkillLearningResult[]> {
  console.log('[skill-learning] Starting skill learning for execution:', {
    executionId,
    botId,
    verdictType,
  });

  const traces = await queryDecisionTraces(executionId);

  if (traces.length === 0) {
    console.log('[skill-learning] No decision traces found for execution:', executionId);
    return [];
  }

  const avgConfidence = calculateAverageConfidence(traces);
  const successfulOutcomes = traces.filter((t) => t.outcome === 'success').length;

  if (successfulOutcomes === 0) {
    console.log('[skill-learning] No successful outcomes in traces, skipping skill extraction');
    return [];
  }

  const patternResult = await detectNovelPatterns(traces, taskContext);

  if (patternResult.novelPatterns.length === 0) {
    console.log('[skill-learning] No novel patterns detected:', patternResult.summary);
    return [];
  }

  const results: SkillLearningResult[] = [];

  for (const pattern of patternResult.novelPatterns) {
    const candidate: SkillCandidate = {
      name: pattern.patternName,
      category: pattern.category,
      triggerPatterns: pattern.triggerPatterns,
      proceduralBody: pattern.proceduralBody,
      requiredTools: pattern.requiredTools,
      confidenceScore: pattern.confidenceScore,
      sourceTraceIds: pattern.sourceTraceIds,
      provenance: {
        executionId,
        botId,
        soulId,
        decisionCount: traces.length,
        successfulOutcomes,
      },
    };

    const stored = await storeSkill(candidate);

    const event: SkillLearnedEvent = {
      type: 'skill_learned',
      skillId: stored.id,
      executionId,
      botId,
      soulId,
      skillName: candidate.name,
      category: candidate.category,
      confidenceScore: candidate.confidenceScore,
      approvalStatus: stored.approvalStatus as SkillLearnedEvent['approvalStatus'],
      sourceTraceIds: candidate.sourceTraceIds as SkillLearnedEvent['sourceTraceIds'],
      timestamp: new Date().toISOString(),
      skillContent: undefined,
    };

    emitSkillLearnedEvent(event);

    results.push({
      skillId: stored.id,
      name: candidate.name,
      category: candidate.category,
      confidenceScore: candidate.confidenceScore,
      approvalStatus: stored.approvalStatus,
      sourceTraceIds: candidate.sourceTraceIds as string[],
    });
  }

  console.log('[skill-learning] Skill learning complete:', {
    executionId,
    patternsFound: results.length,
  });

  return results;
}
