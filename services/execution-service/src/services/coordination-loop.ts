import { db, ringLeaderRuns, toolInvocations } from '@claw/db';
import { eq, and, sum } from 'drizzle-orm';
import type { RingLeaderMissionBrief, RingLeaderRunState, TaskState, TaskRunStatus } from '@claw/shared-types';
import {
  getActiveSessionRegistry,
  type ActiveSessionRegistry,
} from './agent-spawner';
import { clearCoordinationLog } from './coordination-events';

// ─── Constants ─────────────────────────────────────────────────────────────────

/**
 * Cost estimate per 1,000 tokens in cents.
 * Placeholder until real model pricing is wired in a future phase.
 */
const COST_PER_1K_TOKENS_CENTS = 0.3;

// ─── Interfaces ────────────────────────────────────────────────────────────────

/**
 * Context object passed to every coordination module on each poll cycle.
 * Provides a read-only snapshot of run state and the live session registry.
 */
export interface CoordinationContext {
  runId: string;
  executionId: string;
  missionBrief: RingLeaderMissionBrief;
  registry: ActiveSessionRegistry;
  runState: RingLeaderRunState;
  pollIntervalMs: number;
  startedAt: Date;
}

/**
 * Extension point for coordination modules (plans 29-02 through 29-05).
 * Each module receives the full CoordinationContext on every poll tick.
 */
export interface CoordinationModule {
  name: string;
  execute(ctx: CoordinationContext): Promise<void>;
}

/**
 * Handle returned by startCoordinationLoop.
 * Use stop() to terminate the loop and addModule() to register new coordination modules.
 */
export interface CoordinationHandle {
  runId: string;
  stop(): void;
  addModule(module: CoordinationModule): void;
}

interface StartCoordinationLoopParams {
  runId: string;
  executionId: string;
  missionBrief: RingLeaderMissionBrief;
  pollIntervalMs?: number;
  modules?: CoordinationModule[];
}

// ─── Module-level handle map ───────────────────────────────────────────────────

const handles = new Map<string, CoordinationHandle>();

/**
 * Retrieve the active coordination handle for a run.
 *
 * @param runId - ringLeaderRunId
 * @returns CoordinationHandle if the loop is running, undefined otherwise
 */
export function getCoordinationHandle(runId: string): CoordinationHandle | undefined {
  return handles.get(runId);
}

// ─── Run state construction ────────────────────────────────────────────────────

/**
 * Build a RingLeaderRunState snapshot for the current poll cycle.
 *
 * - elapsedTimeSeconds: wall-clock time since loop start
 * - budgetConsumedCents: sum of tokens from llm_call invocations * COST_PER_1K_TOKENS_CENTS
 * - taskStates: derived from session registry status by taskId
 * - objectiveDriftScore: defaults to 0 (Plan 29-04 will compute real drift)
 * - anomalies: populated by coordination modules during this cycle
 */
async function buildRunState(ctx: Omit<CoordinationContext, 'runState'>): Promise<RingLeaderRunState> {
  const { runId, executionId, missionBrief, registry, startedAt } = ctx;

  // ── Elapsed time ──────────────────────────────────────────────────────────
  const elapsedTimeSeconds = (Date.now() - startedAt.getTime()) / 1000;

  // ── Budget consumed ───────────────────────────────────────────────────────
  // Sum totalTokens from tool_invocations WHERE executionId matches AND toolName = 'llm_call'
  let budgetConsumedCents = 0;
  try {
    const result = await db
      .select({ totalTokensSum: sum(toolInvocations.totalTokens) })
      .from(toolInvocations)
      .where(
        and(
          eq(toolInvocations.executionId, executionId),
          eq(toolInvocations.toolName, 'llm_call'),
        ),
      );
    const rawSum = result[0]?.totalTokensSum;
    const totalTokens = rawSum !== null && rawSum !== undefined ? Number(rawSum) : 0;
    budgetConsumedCents = Math.round((totalTokens / 1000) * COST_PER_1K_TOKENS_CENTS);
  } catch (err) {
    console.warn(
      `[coordination-loop] Failed to query budget for executionId=${executionId}:`,
      (err as Error).message,
    );
  }

  // ── Task states ───────────────────────────────────────────────────────────
  // Group sessions by taskId, then derive TaskRunStatus from agent states
  const taskStates: Record<string, TaskState> = {};

  for (const task of missionBrief.taskGraph.tasks) {
    const taskId = task.taskId;

    // Find all sessions assigned to this task
    const taskSessions = [...registry.sessions.values()].filter(
      (s) => s.taskId === taskId,
    );

    const activeAgents: string[] = [];
    const completedAgents: string[] = [];
    const failedAgents: string[] = [];

    for (const session of taskSessions) {
      if (session.status === 'active' || session.status === 'spawning') {
        activeAgents.push(session.sessionId);
      } else if (session.status === 'completed') {
        completedAgents.push(session.sessionId);
      } else if (session.status === 'failed') {
        failedAgents.push(session.sessionId);
      }
    }

    // Derive TaskRunStatus from agent states
    let status: TaskRunStatus;

    if (taskSessions.length === 0) {
      status = 'queued';
    } else if (activeAgents.length > 0) {
      status = 'active';
    } else if (failedAgents.length === taskSessions.length && taskSessions.length > 0) {
      status = 'failed';
    } else if (completedAgents.length > 0 && activeAgents.length === 0) {
      status = 'complete';
    } else {
      status = 'active';
    }

    taskStates[taskId] = {
      status,
      activeAgents,
      completedAgents,
      failedAgents,
      outputQualitySignal: null, // Plan 29-05 (synthesis) will populate
    };
  }

  return {
    runId,
    elapsedTimeSeconds,
    budgetConsumedCents,
    taskStates,
    objectiveDriftScore: 0, // Plan 29-04 will compute drift
    anomalies: [],          // Populated by coordination modules during this cycle
  };
}

// ─── Termination check ─────────────────────────────────────────────────────────

/**
 * Returns true if all tasks in the mission brief have reached a terminal state
 * (complete or failed) and no agents remain active.
 */
function isRunComplete(runState: RingLeaderRunState, missionBrief: RingLeaderMissionBrief): boolean {
  const tasks = missionBrief.taskGraph.tasks;
  if (tasks.length === 0) return true;

  return tasks.every((task) => {
    const state = runState.taskStates[task.taskId];
    if (!state) return false;
    return state.status === 'complete' || state.status === 'failed';
  });
}

// ─── Main exports ──────────────────────────────────────────────────────────────

/**
 * Start the coordination polling loop for a Ring Leader run (COORD-01).
 *
 * On each poll cycle:
 *   1. Retrieves current registry state
 *   2. Builds a live RingLeaderRunState
 *   3. Runs each registered coordination module
 *   4. Persists run state to ring_leader_runs.runState
 *   5. Checks termination: all tasks terminal → stop loop + transition to synthesizing
 *
 * @param params - runId, executionId, missionBrief, pollIntervalMs (default 30s), modules
 * @returns CoordinationHandle with stop() and addModule() methods
 */
export function startCoordinationLoop(params: StartCoordinationLoopParams): CoordinationHandle {
  const {
    runId,
    executionId,
    missionBrief,
    pollIntervalMs = Number(process.env.COORDINATION_POLL_INTERVAL_MS ?? 30_000),
    modules: initialModules = [],
  } = params;

  const startedAt = new Date();
  const modules: CoordinationModule[] = [...initialModules];

  // Validate registry is present before starting
  const registryCheck = getActiveSessionRegistry(runId);
  if (!registryCheck) {
    console.error(
      `[coordination-loop] No active session registry found for runId=${runId} — cannot start coordination loop`,
    );
    // Return a no-op handle so callers don't need to null-check
    const noopHandle: CoordinationHandle = {
      runId,
      stop: () => { /* no-op */ },
      addModule: () => { /* no-op */ },
    };
    return noopHandle;
  }

  console.info(
    `[coordination-loop] Starting coordination loop for runId=${runId} ` +
    `pollIntervalMs=${pollIntervalMs} startedAt=${startedAt.toISOString()}`,
  );

  // Create handle object (intervalId assigned after setInterval call)
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const handle: CoordinationHandle = {
    runId,
    stop() {
      stopCoordinationLoop(handle, runId);
    },
    addModule(module: CoordinationModule) {
      modules.push(module);
      console.info(
        `[coordination-loop] Module registered: ${module.name} for runId=${runId}`,
      );
    },
  };

  // Internal tick function — errors are caught so a single bad poll never crashes the loop
  async function tick(): Promise<void> {
    if (stopped) return;

    try {
      const registry = getActiveSessionRegistry(runId);
      if (!registry) {
        console.warn(
          `[coordination-loop] Registry gone for runId=${runId} — stopping loop`,
        );
        handle.stop();
        return;
      }

      // Build base context (without runState — we build it next)
      const baseCtx = {
        runId,
        executionId,
        missionBrief,
        registry,
        pollIntervalMs,
        startedAt,
      };

      // Build live run state
      const runState = await buildRunState(baseCtx);

      // Full context with run state
      const ctx: CoordinationContext = { ...baseCtx, runState };

      // Execute each registered coordination module
      for (const module of modules) {
        try {
          await module.execute(ctx);
        } catch (moduleErr) {
          console.error(
            `[coordination-loop] Module '${module.name}' threw during poll for runId=${runId}:`,
            (moduleErr as Error).message,
          );
        }
      }

      // Persist run state to DB
      await db
        .update(ringLeaderRuns)
        .set({ runState, updatedAt: new Date() })
        .where(eq(ringLeaderRuns.id, runId));

      // Check termination condition
      if (isRunComplete(runState, missionBrief)) {
        console.info(
          `[coordination-loop] All tasks terminal for runId=${runId} — transitioning to synthesizing`,
        );

        // Update run status to synthesizing
        await db
          .update(ringLeaderRuns)
          .set({ status: 'synthesizing', updatedAt: new Date() })
          .where(eq(ringLeaderRuns.id, runId));

        handle.stop();
      }
    } catch (err) {
      console.error(
        `[coordination-loop] Poll cycle error for runId=${runId}:`,
        (err as Error).message,
      );
    }
  }

  // Start polling interval
  intervalId = setInterval(() => {
    void tick();
  }, pollIntervalMs);

  // Close over intervalId in stop logic via module-level function
  // We stash the interval on the handle via a closure variable captured below
  const originalStop = handle.stop.bind(handle);
  void originalStop; // suppress unused warning — stop is called via stopCoordinationLoop

  // Store interval ID for stopCoordinationLoop to access
  activeIntervals.set(runId, intervalId);

  // Register the handle
  handles.set(runId, handle);

  return handle;
}

/**
 * Stop the coordination polling loop for a run.
 * Clears the setInterval, removes handle from the map, and clears the coordination log.
 *
 * @param handle - CoordinationHandle returned from startCoordinationLoop
 * @param runId  - ringLeaderRunId (used if handle.runId is unavailable)
 */
export function stopCoordinationLoop(handle: CoordinationHandle, runId?: string): void {
  const id = runId ?? handle.runId;

  const intervalId = activeIntervals.get(id);
  if (intervalId !== null && intervalId !== undefined) {
    clearInterval(intervalId);
    activeIntervals.delete(id);
  }

  handles.delete(id);
  clearCoordinationLog(id);

  console.info(`[coordination-loop] Stopped and cleaned up for runId=${id}`);
}

/**
 * Module-level map from runId to active setInterval ID.
 * Used by stopCoordinationLoop to clear intervals without exposing them on the handle.
 */
const activeIntervals = new Map<string, ReturnType<typeof setInterval>>();
