import type { TaskComplexity } from '@claw/shared-types';

// ─── Public Types ─────────────────────────────────────────────────────────────

/**
 * Full assembled prompt for a single Ring Leader agent session.
 *
 * This is the `input` value passed to the OpenClaw POST /v1/responses payload.
 * Combines SOUL.md + task brief + upstream intelligence into one structured string.
 */
export interface AgentSessionPrompt {
  /** Combined prompt string for OpenClaw session input */
  fullPrompt: string;
  /** Raw SOUL.md content, unmodified */
  soulContent: string;
  /**
   * True if all INVIOLABLE constitution directives were verified present verbatim.
   * False signals a tampered or incomplete soul — caller decides whether to abort.
   */
  constitutionVerified: boolean;
  /** List of INVIOLABLE lines extracted from soulContent (SPAWN-04) */
  constitutionDirectives: string[];
  /** Task assignment block: taskId + complexity + requiredTools + description */
  taskBrief: string;
  /** Intelligence from completed upstream tasks (SPAWN-03), null if none */
  upstreamIntelligence: string | null;
}

/**
 * Parameters for building a Ring Leader agent session prompt.
 */
export interface BuildParams {
  /** Full SOUL.md document content */
  soulContent: string;
  /** Inviolable constitution directives from bot_souls.constitutionDirectives (SPAWN-04) */
  constitutionDirectives: string[];
  /** Human-readable task description */
  taskDescription: string;
  /** Task ID within the Ring Leader run DAG */
  taskId: string;
  /** Tools the agent is allowed to call */
  requiredTools: string[];
  /** Complexity tier for this task */
  complexity: TaskComplexity;
  /**
   * Intelligence from completed upstream tasks (SPAWN-03).
   * Null or empty means no upstream context is available yet.
   */
  upstreamOutputs: Array<{ taskId: string; summary: string }> | null;
}

// ─── Public Export: Constitution verification ─────────────────────────────────

/**
 * Verify that all expected INVIOLABLE constitution directives are present verbatim
 * in the soul content (SPAWN-04).
 *
 * Each directive is matched by exact string after trimming both sides.
 * If expectedDirectives is empty, verification passes (pioneer souls may not have
 * a constitution yet — they are subject to the footer reminder only).
 *
 * @param soulContent         - Raw SOUL.md document
 * @param expectedDirectives  - INVIOLABLE lines from bot_souls.constitutionDirectives
 * @returns { verified: true, missing: [] } if all present; { verified: false, missing: [...] } if any absent
 */
export function verifyConstitution(
  soulContent: string,
  expectedDirectives: string[],
): { verified: boolean; missing: string[] } {
  if (expectedDirectives.length === 0) {
    return { verified: true, missing: [] };
  }

  const missing: string[] = [];

  for (const directive of expectedDirectives) {
    const trimmed = directive.trim();
    if (!soulContent.includes(trimmed)) {
      missing.push(trimmed);
    }
  }

  return {
    verified: missing.length === 0,
    missing,
  };
}

// ─── Public Export: Build agent session prompt ────────────────────────────────

/**
 * Assemble the full session prompt for a Ring Leader agent.
 *
 * Prompt structure (SPAWN-02, SPAWN-03, SPAWN-04):
 *  1. SOUL.md content — full, unmodified behavioral constitution
 *  ---
 *  2. Task brief — taskId, complexity, requiredTools, taskDescription
 *  ---
 *  3. Upstream intelligence (only if available) — summaries from completed upstream tasks
 *  ---
 *  4. Footer reminder — constitution binding statement
 *
 * Constitution verification (SPAWN-04):
 *  - Checks all INVIOLABLE directives are present verbatim in SOUL.md
 *  - If any are missing, logs a WARN but does NOT throw — execution proceeds
 *  - The constitutionVerified flag in the return value allows the spawner to decide
 *
 * @param params - Soul content, task context, and upstream intelligence
 * @returns AgentSessionPrompt with fullPrompt and all metadata
 */
export function buildAgentSessionPrompt(params: BuildParams): AgentSessionPrompt {
  const {
    soulContent,
    constitutionDirectives,
    taskDescription,
    taskId,
    requiredTools,
    complexity,
    upstreamOutputs,
  } = params;

  // ── Step 1: Verify constitution (SPAWN-04) ──────────────────────────────────
  const { verified: constitutionVerified, missing } = verifyConstitution(
    soulContent,
    constitutionDirectives,
  );

  if (!constitutionVerified) {
    console.warn(
      `[agent-session-builder] Constitution verification FAILED for task ${taskId}: ` +
        `${missing.length} INVIOLABLE directive(s) missing from soul content. ` +
        `Missing: ${missing.map((d) => JSON.stringify(d)).join(', ')}. ` +
        `Execution will proceed — spawner must decide whether to abort.`,
    );
  }

  // ── Step 2: Build task brief ────────────────────────────────────────────────
  const toolsDisplay =
    requiredTools.length > 0 ? requiredTools.join(', ') : '(none specified)';

  const taskBrief = [
    '## Task Assignment',
    '',
    `Task ID: ${taskId}`,
    `Complexity: ${complexity}`,
    `Required Tools: ${toolsDisplay}`,
    '',
    taskDescription,
  ].join('\n');

  // ── Step 3: Build upstream intelligence block (SPAWN-03) ────────────────────
  let upstreamIntelligence: string | null = null;

  if (upstreamOutputs !== null && upstreamOutputs.length > 0) {
    const entries = upstreamOutputs
      .map(
        (output) =>
          `### Task ${output.taskId}\n${output.summary}\n`,
      )
      .join('\n');

    upstreamIntelligence =
      '## Upstream Intelligence\n\n' +
      'The following tasks have completed and produced intelligence relevant to your task:\n\n' +
      entries;
  }

  // ── Step 4: Assemble full prompt ────────────────────────────────────────────
  const sections: string[] = [
    soulContent,
    '---',
    taskBrief,
    '---',
  ];

  if (upstreamIntelligence !== null) {
    sections.push(upstreamIntelligence);
    sections.push('---');
  }

  sections.push(
    'You are bound by the SOUL.md constitution above. Begin executing your assigned task.',
  );

  const fullPrompt = sections.join('\n');

  return {
    fullPrompt,
    soulContent,
    constitutionVerified,
    constitutionDirectives,
    taskBrief,
    upstreamIntelligence,
  };
}
