import { db, bots, botSouls, tasks } from '@claw/db';
import { eq } from 'drizzle-orm';
import type { CoordinationContext, CoordinationModule } from './coordination-loop';
import { logCoordinationEvent } from './coordination-events';
import type { ReallocationEvent } from '@claw/event-schemas';
import { spawnBot } from '../orchestrator/bot-orchestrator';
import { type ActiveSession } from './agent-spawner';
import { AGENT_COST_CENTS } from './budget-validator';

// ─── Guardrail detection helpers ──────────────────────────────────────────────

/** Keywords that indicate a guardrail was triggered in an agent's error message */
const GUARDRAIL_KEYWORDS = ['guardrail', 'safety', 'blocked', 'restricted', 'constitution'];

/** Keywords that indicate soul-driven (INVIOLABLE) guardrail triggers */
const SOUL_DRIVEN_KEYWORDS = ['constitution', 'INVIOLABLE'];

function isGuardrailError(errorMessage: string | null): boolean {
  if (!errorMessage) return false;
  const lower = errorMessage.toLowerCase();
  return GUARDRAIL_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

function classifyGuardrail(errorMessage: string): 'soul-driven' | 'context-driven' {
  // Soul-driven if error contains constitution or INVIOLABLE references
  if (SOUL_DRIVEN_KEYWORDS.some((kw) => errorMessage.includes(kw))) {
    return 'soul-driven';
  }
  return 'context-driven';
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a failure reallocation coordination module.
 *
 * Implements COORD-03 (failure redistribution/replacement spawn),
 * COORD-04 (early completion capacity evaluation), and
 * COORD-05 (guardrail trigger logging and classification).
 *
 * Module-level state (processedFailures and processedCompletions) is scoped
 * to this module instance so deduplication works correctly across poll cycles.
 *
 * @returns CoordinationModule with name 'failure-reallocator'
 */
export function createFailureReallocator(): CoordinationModule {
  /** sessionIds of failed agents already handled in COORD-03 */
  const processedFailures = new Set<string>();

  /** sessionIds of early-completed agents already evaluated in COORD-04 */
  const processedCompletions = new Set<string>();

  return {
    name: 'failure-reallocator',

    async execute(ctx: CoordinationContext): Promise<void> {
      const { runId, executionId, missionBrief, registry, runState } = ctx;

      const allSessions = [...registry.sessions.values()];

      // ── A. Failure reallocation (COORD-03) ─────────────────────────────────
      const failedSessions = allSessions.filter(
        (s) => s.status === 'failed' && !processedFailures.has(s.sessionId),
      );

      for (const session of failedSessions) {
        try {
          await handleFailedSession(
            session,
            allSessions,
            ctx,
            runId,
            executionId,
            processedFailures,
          );
        } catch (err) {
          console.warn(
            `[failure-reallocator] Non-fatal error handling failed session ${session.sessionId}:`,
            (err as Error).message,
          );
        }

        // Always mark processed even if the handler threw to avoid infinite retries
        processedFailures.add(session.sessionId);
      }

      // ── B. Early completion evaluation (COORD-04) ──────────────────────────
      const completedSessions = allSessions.filter(
        (s) => s.status === 'completed' && !processedCompletions.has(s.sessionId),
      );

      for (const session of completedSessions) {
        try {
          await handleCompletedSession(
            session,
            allSessions,
            ctx,
            runId,
            executionId,
            runState.budgetConsumedCents,
            missionBrief.budgetCapCents,
            missionBrief,
            processedCompletions,
          );
        } catch (err) {
          console.warn(
            `[failure-reallocator] Non-fatal error evaluating completed session ${session.sessionId}:`,
            (err as Error).message,
          );
        }

        processedCompletions.add(session.sessionId);
      }
    },
  };
}

// ─── COORD-03: Failure handler ────────────────────────────────────────────────

async function handleFailedSession(
  session: ActiveSession,
  allSessions: ActiveSession[],
  ctx: CoordinationContext,
  runId: string,
  executionId: string,
  processedFailures: Set<string>,
): Promise<void> {
  const { taskId, sessionId, soulId, agentClass, botId } = session;
  const { missionBrief, runState, registry } = ctx;
  const budgetConsumedCents = runState.budgetConsumedCents;
  const budgetCapCents = missionBrief.budgetCapCents;

  // Count remaining active agents on the same task
  const activeOnTask = allSessions.filter(
    (s) => s.taskId === taskId && (s.status === 'active' || s.status === 'spawning'),
  );
  const activeCount = activeOnTask.length;

  // ── COORD-05: Guardrail detection ─────────────────────────────────────────
  let guardrailDetected = false;
  let guardrailClass: 'soul-driven' | 'context-driven' | null = null;
  let botErrorMessage: string | null = null;

  try {
    const [botRow] = await db
      .select({ errorMessage: bots.errorMessage })
      .from(bots)
      .where(eq(bots.id, botId));

    botErrorMessage = botRow?.errorMessage ?? null;

    if (isGuardrailError(botErrorMessage)) {
      guardrailDetected = true;
      guardrailClass = classifyGuardrail(botErrorMessage ?? '');

      const guardrailDescription =
        `Agent ${sessionId} on task ${taskId} triggered a ${guardrailClass} guardrail: ` +
        (botErrorMessage ?? '(no error message)');

      // Append to run state anomalies so the coordination loop captures it
      runState.anomalies.push(guardrailDescription);

      const guardrailAction =
        guardrailClass === 'soul-driven' ? 'paused_for_review' : 'redistributed';

      const guardrailEvent: ReallocationEvent = {
        type: 'reallocation',
        runId,
        executionId,
        trigger: 'guardrail_trigger',
        affectedAgentSessionId: sessionId,
        affectedTaskId: taskId,
        action: guardrailAction,
        rationale:
          `Guardrail triggered (${guardrailClass}) for agent ${sessionId} on task ${taskId}. ` +
          `Error: ${botErrorMessage ?? '(none)'}`,
        timestamp: new Date().toISOString(),
      };

      await logCoordinationEvent(runId, executionId, guardrailEvent);

      console.warn(
        `[failure-reallocator] COORD-05 guardrail (${guardrailClass}) on session ${sessionId}, task ${taskId}`,
      );

      // Soul-driven guardrails pause further processing for this agent
      if (guardrailClass === 'soul-driven') {
        processedFailures.add(sessionId);
        return;
      }
    }
  } catch (err) {
    console.warn(
      `[failure-reallocator] Could not query bot error message for botId=${botId}:`,
      (err as Error).message,
    );
  }

  // ── COORD-03: Redistribution or replacement spawn ─────────────────────────

  if (activeCount >= 1) {
    // Other active agents remain — redistribution is sufficient
    const event: ReallocationEvent = {
      type: 'reallocation',
      runId,
      executionId,
      trigger: guardrailDetected ? 'guardrail_trigger' : 'agent_failure',
      affectedAgentSessionId: sessionId,
      affectedTaskId: taskId,
      action: 'redistributed',
      rationale:
        `Task ${taskId} still has ${activeCount} active agent(s); no replacement needed.`,
      timestamp: new Date().toISOString(),
    };

    await logCoordinationEvent(runId, executionId, event);

    console.info(
      `[failure-reallocator] COORD-03 redistributed task ${taskId} — ${activeCount} active agent(s) remain`,
    );
    return;
  }

  // No active agents remain — evaluate replacement spawn
  const budgetPercent = budgetCapCents > 0 ? budgetConsumedCents / budgetCapCents : 0;
  const budgetAllowsReplacement = budgetCapCents === 0 || budgetPercent < 0.8;

  if (!budgetAllowsReplacement) {
    // Budget too high for replacement
    const event: ReallocationEvent = {
      type: 'reallocation',
      runId,
      executionId,
      trigger: guardrailDetected ? 'guardrail_trigger' : 'agent_failure',
      affectedAgentSessionId: sessionId,
      affectedTaskId: taskId,
      action: 'redistributed',
      rationale:
        `Budget at ${Math.round(budgetPercent * 100)}% — cannot afford replacement spawn for task ${taskId}.`,
      timestamp: new Date().toISOString(),
    };

    await logCoordinationEvent(runId, executionId, event);

    console.warn(
      `[failure-reallocator] COORD-03 cannot spawn replacement for task ${taskId} — budget at ${Math.round(budgetPercent * 100)}%`,
    );
    return;
  }

  // Attempt replacement spawn
  try {
    // Look up the failed session's soul content for the replacement
    const [soulRow] = await db
      .select({ soulContent: botSouls.soulContent })
      .from(botSouls)
      .where(eq(botSouls.id, soulId));

    if (!soulRow) {
      console.error(
        `[failure-reallocator] Soul not found for soulId=${soulId} — cannot spawn replacement for task ${taskId}`,
      );
      return;
    }

    const { botId: newBotId } = await spawnBot(
      ctx.executionId,
      soulId,
      soulRow.soulContent,
    );

    // Create a task row for the replacement agent
    const taskNode = missionBrief.taskGraph.tasks.find((t) => t.taskId === taskId);
    if (taskNode) {
      await db.insert(tasks).values({
        executionId: ctx.executionId,
        description: taskNode.description,
        status: 'claimed',
        claimedByBotId: newBotId,
        ringLeaderTaskId: taskId,
        attemptCount: 1,
      });
    }

    // Register the new session in the active session registry
    const newSession: ActiveSession = {
      sessionId: newBotId,
      botId: newBotId,
      soulId,
      taskId,
      agentClass,
      sessionJwt: session.sessionJwt, // reuse the original JWT for v1
      spawnedAt: new Date(),
      status: 'spawning',
    };
    registry.sessions.set(newBotId, newSession);

    const event: ReallocationEvent = {
      type: 'reallocation',
      runId,
      executionId,
      trigger: guardrailDetected ? 'guardrail_trigger' : 'agent_failure',
      affectedAgentSessionId: sessionId,
      affectedTaskId: taskId,
      action: 'replacement_spawned',
      rationale:
        `All agents for task ${taskId} failed; replacement agent spawned (newSessionId=${newBotId}).`,
      timestamp: new Date().toISOString(),
    };

    await logCoordinationEvent(runId, executionId, event);

    console.info(
      `[failure-reallocator] COORD-03 replacement agent spawned for task ${taskId}: newBotId=${newBotId}`,
    );
  } catch (err) {
    console.error(
      `[failure-reallocator] COORD-03 replacement spawn failed for task ${taskId}:`,
      (err as Error).message,
    );
  }
}

// ─── COORD-04: Early completion capacity evaluation ───────────────────────────

async function handleCompletedSession(
  session: ActiveSession,
  allSessions: ActiveSession[],
  ctx: CoordinationContext,
  runId: string,
  executionId: string,
  budgetConsumedCents: number,
  budgetCapCents: number,
  missionBrief: typeof ctx.missionBrief,
  processedCompletions: Set<string>,
): Promise<void> {
  const { taskId, sessionId } = session;

  // Count remaining active agents on the SAME task
  const activeOnSameTask = allSessions.filter(
    (s) => s.taskId === taskId && (s.status === 'active' || s.status === 'spawning'),
  );

  if (activeOnSameTask.length > 0) {
    // Other agents still working on this task — not yet a capacity redirection opportunity
    return;
  }

  // All agents for this task are done — evaluate other tasks with active agents
  const budgetPercent = budgetCapCents > 0 ? budgetConsumedCents / budgetCapCents : 0;
  const budgetAllowsRedirection = budgetCapCents === 0 || budgetPercent < 0.8;

  // Find tasks with active agents that have fewer agents than their recommendedPopulation
  const tasksNeedingCapacity = missionBrief.taskGraph.tasks.filter((t) => {
    if (t.taskId === taskId) return false; // skip the completed task

    const activeAgentsForTask = allSessions.filter(
      (s) => s.taskId === t.taskId && (s.status === 'active' || s.status === 'spawning'),
    );

    return (
      activeAgentsForTask.length > 0 &&
      activeAgentsForTask.length < t.recommendedPopulation
    );
  });

  if (tasksNeedingCapacity.length === 0) {
    const event: ReallocationEvent = {
      type: 'reallocation',
      runId,
      executionId,
      trigger: 'early_completion',
      affectedAgentSessionId: sessionId,
      affectedTaskId: taskId,
      action: 'redistributed',
      rationale: `No active tasks need additional capacity after early completion of task ${taskId}.`,
      timestamp: new Date().toISOString(),
    };

    await logCoordinationEvent(runId, executionId, event);

    console.info(
      `[failure-reallocator] COORD-04 no capacity redirection needed after task ${taskId} completion`,
    );
    return;
  }

  if (!budgetAllowsRedirection) {
    const event: ReallocationEvent = {
      type: 'reallocation',
      runId,
      executionId,
      trigger: 'early_completion',
      affectedAgentSessionId: sessionId,
      affectedTaskId: taskId,
      action: 'redistributed',
      rationale:
        `Budget at ${Math.round(budgetPercent * 100)}% — capacity redirection not viable for task ${taskId} early completion.`,
      timestamp: new Date().toISOString(),
    };

    await logCoordinationEvent(runId, executionId, event);
    return;
  }

  // Log recommendation (v1: advisory only — no auto-spawn on capacity redirection)
  const benefitingTask = tasksNeedingCapacity[0];
  if (!benefitingTask) return;

  const activeOnBenefiting = allSessions.filter(
    (s) => s.taskId === benefitingTask.taskId && (s.status === 'active' || s.status === 'spawning'),
  ).length;

  const event: ReallocationEvent = {
    type: 'reallocation',
    runId,
    executionId,
    trigger: 'early_completion',
    affectedAgentSessionId: sessionId,
    affectedTaskId: taskId,
    action: 'capacity_redirected',
    rationale:
      `Capacity redirect recommended for task ${benefitingTask.taskId} — currently ${activeOnBenefiting}/${benefitingTask.recommendedPopulation} agents active. ` +
      `Manual intervention or future auto-spawn required.`,
    timestamp: new Date().toISOString(),
  };

  await logCoordinationEvent(runId, executionId, event);

  console.info(
    `[failure-reallocator] COORD-04 capacity redirection recommended: ` +
    `freed from task ${taskId} → recommended for task ${benefitingTask.taskId}`,
  );
}
