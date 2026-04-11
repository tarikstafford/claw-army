import { generateText, Output } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { db, decisionTraces, skills, bots, botSouls } from '@claw/db';
import { eq, and } from 'drizzle-orm';
import type { Skill } from '@claw/db';
import type { SkillLearnedEvent } from '@claw/event-schemas';

const CONFIDENCE_APPROVAL_THRESHOLD = 0.80;

const SkillCandidateSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.string().min(1).max(100),
  triggerPatterns: z.array(z.string()).min(1),
  proceduralBody: z.string().min(1),
  requiredTools: z.array(z.string()),
  confidenceScore: z.number().min(0).max(1),
  reasoning: z.string(),
});

export type SkillCandidate = z.infer<typeof SkillCandidateSchema>;

const SKILL_LEARNING_SYSTEM = `You are a skill extraction agent. Your task is to analyze decision traces from AI agent executions and identify NOVEL procedural patterns that led to successful outcomes.

A novel pattern is:
1. A decision sequence that contributed to a successful outcome
2. NOT already present in the agent's current skill library (if any)
3. Generalizable enough to be reused in similar situations

For each successful decision trace pattern you identify, generate a SKILL.md document with:
- **name**: A concise, descriptive name for the skill (kebab-case, max 255 chars)
- **category**: One of: reasoning, tool_usage, planning, communication, recovery, coordination
- **triggerPatterns**: Array of conditions that should activate this skill (max 5)
- **proceduralBody**: Step-by-step procedure (3-10 steps, markdown numbered list)
- **requiredTools**: Any tools needed to execute this skill (can be empty array)
- **confidenceScore**: Your confidence this is a real, reusable skill (0.0-1.0)
- **reasoning**: Why this pattern is novel and how it contributed to success

Be conservative — only extract skills with confidence >= 0.6. Lower confidence patterns are not worth documenting.`;

function buildSkillExtractionPrompt(
  traces: Array<{
    decisionId: string;
    decisionType: string;
    directiveReferenced: string | null;
    attributionConfidence: string | null;
    outcome: string | null;
    metadata: unknown;
  }>,
  taskCategory: string | null,
  existingSkills: string[],
): string {
  const successfulTraces = traces.filter(
    (t) => t.outcome === 'success' && parseFloat(t.attributionConfidence ?? '0') > 0.5,
  );

  const traceSummary = successfulTraces
    .slice(0, 30)
    .map(
      (t, i) =>
        `### Trace ${i + 1}: ${t.decisionId}\n` +
        `- Type: ${t.decisionType}\n` +
        `- Directive: ${t.directiveReferenced ?? 'None'}\n` +
        `- Confidence: ${t.attributionConfidence ?? 'N/A'}\n` +
        `- Outcome: ${t.outcome}\n` +
        `- Metadata: ${JSON.stringify(t.metadata ?? {})}`,
    )
    .join('\n\n');

  const skillsSection =
    existingSkills.length > 0
      ? existingSkills.map((s, i) => `${i + 1}. ${s}`).join('\n')
      : 'No existing skills recorded.';

  return `## Skill Extraction Task

**Task Category:** ${taskCategory ?? 'Unknown'}

### Existing Skills (for novelty check)
${skillsSection}

---

### High-Confidence Successful Decision Traces
Analyze these traces for novel procedural patterns:

${traceSummary}

---

Based on the above traces, identify any NOVEL procedural patterns that:
1. Led to successful outcomes
2. Are not covered by existing skills
3. Are generalizable enough to be reused

If no novel patterns found, return empty arrays. Otherwise, generate SKILL.md candidates for each novel pattern.`;
}

async function computeAverageConfidence(
  traceIds: string[],
  executionId: string,
  botId: string,
): Promise<number> {
  if (traceIds.length === 0) return 0;

  const rows = await db
    .select({ attributionConfidence: decisionTraces.attributionConfidence })
    .from(decisionTraces)
    .where(
      and(
        eq(decisionTraces.executionId, executionId),
        eq(decisionTraces.botId, botId),
      ),
    );

  const matching = rows.filter(
    (r) => r.attributionConfidence !== null && traceIds.includes(r.decisionId),
  );

  if (matching.length === 0) return 0;

  const sum = matching.reduce((acc, r) => {
    const val = parseFloat(r.attributionConfidence ?? '0');
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  return sum / matching.length;
}

async function getExistingSkillNames(soulId: string | null): Promise<string[]> {
  if (!soulId) return [];

  const rows = await db
    .select({ skillContent: skills.skillContent })
    .from(skills)
    .where(eq(skills.soulId, soulId));

  return rows.map((r) => r.skillContent);
}

async function detectNovelPatterns(
  traces: Array<{
    decisionId: string;
    decisionType: string;
    directiveReferenced: string | null;
    attributionConfidence: string | null;
    outcome: string | null;
    metadata: unknown;
  }>,
  taskCategory: string | null,
  soulId: string | null,
): Promise<SkillCandidate[]> {
  const existingSkills = await getExistingSkillNames(soulId);
  const prompt = buildSkillExtractionPrompt(traces, taskCategory, existingSkills);

  const result = await generateText({
    model: openai('gpt-4o-mini'),
    output: Output.object({ schema: SkillCandidateSchema.array() }),
    system: SKILL_LEARNING_SYSTEM,
    prompt,
    temperature: 0.3,
  });

  if (!result.output || result.output.length === 0) {
    return [];
  }

  return result.output.filter((c) => c.confidenceScore >= 0.6);
}

function generateSkillMarkdown(candidate: SkillCandidate): string {
  const toolsSection =
    candidate.requiredTools.length > 0
      ? `## Required Tools\n${candidate.requiredTools.map((t) => `- ${t}`).join('\n')}\n`
      : '';

  return `# ${candidate.name}

## Category
${candidate.category}

## Trigger Patterns
${candidate.triggerPatterns.map((p) => `- ${p}`).join('\n')}

${toolsSection}## Procedure
${candidate.proceduralBody}

## Confidence
${candidate.confidenceScore.toFixed(3)}

## Reasoning
${candidate.reasoning}
`;
}

export interface ProcessSkillLearningResult {
  skillsCreated: number;
  skillIds: string[];
}

export async function processSkillLearningForExecution(
  executionId: string,
  botId: string,
  soulId: string | null,
): Promise<ProcessSkillLearningResult> {
  const traceRows = await db
    .select({
      decisionId: decisionTraces.decisionId,
      decisionType: decisionTraces.decisionType,
      directiveReferenced: decisionTraces.directiveReferenced,
      attributionConfidence: decisionTraces.attributionConfidence,
      outcome: decisionTraces.outcome,
      metadata: decisionTraces.metadata,
    })
    .from(decisionTraces)
    .where(and(eq(decisionTraces.executionId, executionId), eq(decisionTraces.botId, botId)));

  if (traceRows.length === 0) {
    return { skillsCreated: 0, skillIds: [] };
  }

  const successfulTraces = traceRows.filter(
    (t) => t.outcome === 'success' && parseFloat(t.attributionConfidence ?? '0') > 0.5,
  );

  if (successfulTraces.length === 0) {
    return { skillsCreated: 0, skillIds: [] };
  }

  let taskCategory: string | null = null;
  if (soulId !== null) {
    const soulRows = await db
      .select({ taskCategory: botSouls.taskCategory })
      .from(botSouls)
      .where(eq(botSouls.id, soulId))
      .limit(1);
    if (soulRows.length > 0 && soulRows[0]) {
      taskCategory = soulRows[0].taskCategory ?? null;
    }
  }

  const candidates = await detectNovelPatterns(traceRows, taskCategory, soulId);

  if (candidates.length === 0) {
    return { skillsCreated: 0, skillIds: [] };
  }

  const insertedSkills: Skill[] = [];

  for (const candidate of candidates) {
    const traceIds = successfulTraces.map((t) => t.decisionId);
    const avgConfidence = await computeAverageConfidence(traceIds, executionId, botId);
    const finalConfidence = (candidate.confidenceScore + avgConfidence) / 2;
    const approvalStatus = finalConfidence >= CONFIDENCE_APPROVAL_THRESHOLD ? 'auto_approved' : 'pending_review';

    const skillMarkdown = generateSkillMarkdown({
      ...candidate,
      confidenceScore: finalConfidence,
    });

    const [inserted] = await db
      .insert(skills)
      .values({
        botId,
        soulId: soulId ?? undefined,
        executionId,
        name: candidate.name,
        category: candidate.category,
        triggerPatterns: candidate.triggerPatterns,
        proceduralBody: candidate.proceduralBody,
        requiredTools: candidate.requiredTools,
        confidenceScore: finalConfidence.toFixed(3),
        approvalStatus,
        sourceTraceIds: traceIds,
        skillContent: skillMarkdown,
        approvedAt: approvalStatus === 'auto_approved' ? new Date() : undefined,
      })
      .returning();

    if (inserted) {
      insertedSkills.push(inserted);
    }
  }

  const event: SkillLearnedEvent = {
    type: 'skill_learned',
    skillId: insertedSkills[0]!.id,
    botId,
    executionId,
    soulId,
    taskCategory: taskCategory ?? 'unknown',
    skillName: insertedSkills[0]!.name,
    confidenceScore: parseFloat(insertedSkills[0]!.confidenceScore),
    approvalStatus: insertedSkills[0]!.approvalStatus as 'auto_approved' | 'pending_review' | 'rejected',
    sourceTraceIds: insertedSkills[0]!.sourceTraceIds as string[],
    timestamp: new Date().toISOString(),
  };

  console.log('[skill-learning] skill_learned event:', event);

  return {
    skillsCreated: insertedSkills.length,
    skillIds: insertedSkills.map((s) => s.id),
  };
}
