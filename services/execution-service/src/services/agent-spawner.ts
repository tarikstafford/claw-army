import { db, botSouls, tasks, ringLeaderRuns } from '@claw/db';
import { eq, and, inArray } from 'drizzle-orm';
import { mintSessionJwt } from './session-jwt';
import { buildAgentSessionPrompt } from './agent-session-builder';
import { spawnBot } from '../orchestrator/bot-orchestrator';
import { AGENT_COST_CENTS } from './budget-validator';
import type { RingLeaderMissionBrief, PopulationManifest } from '@claw/shared-types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActiveSession {
  sessionId: string;      // botId returned from spawnBot (used as session identifier until OpenClaw session protocol is confirmed)
  botId: string;
  soulId: string;
  taskId: string;
  agentClass: string;
  sessionJwt: string;
  spawnedAt: Date;
  status: 'spawning' | 'active' | 'completed' | 'failed';
}

export interface ActiveSessionRegistry {
  runId: string;
  sessions: Map<string, ActiveSession>;  // keyed by sessionId
}

export interface SpawnResult {
  totalAgentsSpawned: number;
  totalWaves: number;
  registry: ActiveSessionRegistry;
}

export interface SpawnParams {
  ringLeaderRunId: string;
  executionId: string;
  missionBrief: RingLeaderMissionBrief;
  manifests: PopulationManifest[];
}

// ─── Module-level registry map ────────────────────────────────────────────────

const registries = new Map<string, ActiveSessionRegistry>();

/**
 * Get the active session registry for a specific Ring Leader run.
 *
 * @param runId - ringLeaderRunId
 * @returns ActiveSessionRegistry if found, undefined otherwise
 */
export function getActiveSessionRegistry(runId: string): ActiveSessionRegistry | undefined {
  return registries.get(runId);
}

/**
 * Get all active session registries across all runs.
 *
 * @returns Map keyed by ringLeaderRunId
 */
export function getAllActiveRegistries(): Map<string, ActiveSessionRegistry> {
  return registries;
}

// ─── DAG wave computation ─────────────────────────────────────────────────────

/**
 * Compute topological spawn waves from the DAG.
 *
 * Wave 0 = tasks with no upstream dependencies.
 * Wave N = tasks whose all upstream dependencies are resolved in waves < N.
 *
 * @param tasks  - Array of task IDs in the task graph
 * @param dag    - Adjacency map: taskId -> downstream taskId[]
 * @returns Array of waves, where each wave is an array of taskIds
 */
function computeSpawnWaves(taskIds: string[], dag: Record<string, string[]>): string[][] {
  // Build reverse-dependency map: taskId -> set of upstream taskIds that must complete first
  const upstreamDeps: Map<string, Set<string>> = new Map();

  for (const taskId of taskIds) {
    upstreamDeps.set(taskId, new Set());
  }

  // dag[taskId] = downstream taskIds — so taskId is upstream for each entry in dag[taskId]
  for (const [upstreamId, downstreamIds] of Object.entries(dag)) {
    for (const downstreamId of downstreamIds) {
      const deps = upstreamDeps.get(downstreamId);
      if (deps !== undefined) {
        deps.add(upstreamId);
      }
    }
  }

  const waves: string[][] = [];
  const assigned = new Set<string>();
  const remaining = new Set<string>(taskIds);

  while (remaining.size > 0) {
    // Find tasks whose upstream deps are all assigned to earlier waves
    const wave: string[] = [];

    for (const taskId of remaining) {
      const deps = upstreamDeps.get(taskId) ?? new Set();
      const allDepsAssigned = [...deps].every((dep) => assigned.has(dep));

      if (allDepsAssigned) {
        wave.push(taskId);
      }
    }

    if (wave.length === 0) {
      // Cycle detected — add all remaining tasks to a single wave to avoid infinite loop
      console.warn(
        `[agent-spawner] Cycle or unresolvable deps detected in DAG. ` +
        `Remaining tasks added to single wave: ${[...remaining].join(', ')}`,
      );
      waves.push([...remaining]);
      break;
    }

    for (const taskId of wave) {
      assigned.add(taskId);
      remaining.delete(taskId);
    }

    waves.push(wave);
  }

  return waves;
}

// ─── Upstream output collection ───────────────────────────────────────────────

/**
 * Collect completed task outputs for a set of upstream taskIds.
 *
 * NOTE: The current tasks table does not have a `ringLeaderTaskId` column linking
 * rows back to mission brief taskIds. Until that column is added (a future schema
 * migration), upstream outputs cannot be reliably queried by taskId. This function
 * returns an empty array, which causes buildAgentSessionPrompt to omit the upstream
 * intelligence section. The DAG ordering is still respected — tasks still wait for
 * upstream waves to spawn before they themselves spawn.
 *
 * TODO(28-03+): Add `ring_leader_task_id` varchar column to tasks table and populate
 * it during task creation so upstream outputs can be queried here.
 *
 * @param _upstreamTaskIds - upstream taskIds from the mission brief DAG
 * @returns Empty array (no upstream outputs until schema supports it)
 */
async function collectUpstreamOutputs(
  _upstreamTaskIds: string[],
): Promise<Array<{ taskId: string; summary: string }>> {
  return [];
}

// ─── Main export: spawnAgentsForRun ──────────────────────────────────────────

/**
 * Spawn agents for all tasks in a Ring Leader run, respecting DAG order (SPAWN-06).
 *
 * Wave 0 tasks (no upstream dependencies) spawn immediately in parallel.
 * Dependent tasks are held until their upstream wave completes.
 *
 * Every spawned agent's session is registered in the ActiveSessionRegistry (SPAWN-05).
 * Each agent receives a session JWT (SPAWN-01) and an assembled session prompt (SPAWN-02/03/04).
 *
 * @param params - ringLeaderRunId, executionId, missionBrief, manifests
 * @returns SpawnResult with agent count, wave count, and registry reference
 */
export async function spawnAgentsForRun(params: SpawnParams): Promise<SpawnResult> {
  const { ringLeaderRunId, executionId, missionBrief, manifests } = params;

  // Initialise registry for this run
  const registry: ActiveSessionRegistry = {
    runId: ringLeaderRunId,
    sessions: new Map(),
  };
  registries.set(ringLeaderRunId, registry);

  // ── Step 1: Compute spawn waves from DAG ───────────────────────────────────
  const taskIds = missionBrief.taskGraph.tasks.map((t) => t.taskId);
  const waves = computeSpawnWaves(taskIds, missionBrief.taskGraph.dag);

  console.info(
    `[agent-spawner] Spawn wave plan for run=${ringLeaderRunId}: ` +
    waves.map((w, i) => `wave${i}=[${w.join(',')}]`).join(', '),
  );

  // Build lookup maps for manifests and task nodes
  const manifestByTaskId = new Map<string, PopulationManifest>(
    manifests.map((m) => [m.taskId, m]),
  );
  const taskNodeByTaskId = new Map(
    missionBrief.taskGraph.tasks.map((t) => [t.taskId, t]),
  );

  // Build reverse-dep map for upstream output queries
  const upstreamByTaskId = new Map<string, string[]>();
  for (const taskId of taskIds) {
    upstreamByTaskId.set(taskId, []);
  }
  for (const [upstreamId, downstreamIds] of Object.entries(missionBrief.taskGraph.dag)) {
    for (const downstreamId of downstreamIds) {
      const existing = upstreamByTaskId.get(downstreamId) ?? [];
      existing.push(upstreamId);
      upstreamByTaskId.set(downstreamId, existing);
    }
  }

  let totalAgentsSpawned = 0;

  // ── Step 2: Process waves sequentially ────────────────────────────────────
  for (let waveIndex = 0; waveIndex < waves.length; waveIndex++) {
    const waveTaskIds = waves[waveIndex];

    if (!waveTaskIds || waveTaskIds.length === 0) continue;

    console.info(
      `[agent-spawner] Starting wave ${waveIndex}: tasks=[${waveTaskIds.join(', ')}]`,
    );

    // Collect all agent spawn tasks for this wave
    const waveSpawnPromises: Array<() => Promise<void>> = [];

    for (const taskId of waveTaskIds) {
      const manifest = manifestByTaskId.get(taskId);
      const taskNode = taskNodeByTaskId.get(taskId);

      if (!manifest || !taskNode) {
        console.warn(
          `[agent-spawner] No manifest or task node found for taskId=${taskId} in wave ${waveIndex} — skipping`,
        );
        continue;
      }

      // Collect upstream outputs for tasks in waves > 0
      const upstreamTaskIds = waveIndex > 0 ? (upstreamByTaskId.get(taskId) ?? []) : [];
      const upstreamOutputs =
        upstreamTaskIds.length > 0
          ? await collectUpstreamOutputs(upstreamTaskIds)
          : null;

      for (const soul of manifest.assignedSouls) {
        const soulId = soul.soulId;
        const agentClass = soul.agentClass;

        waveSpawnPromises.push(async () => {
          // Look up soul content and constitution directives
          const [soulRow] = await db
            .select({
              soulContent: botSouls.soulContent,
              constitutionDirectives: botSouls.constitutionDirectives,
            })
            .from(botSouls)
            .where(eq(botSouls.id, soulId));

          if (!soulRow) {
            console.error(
              `[agent-spawner] Soul not found in DB: soulId=${soulId}, taskId=${taskId} — skipping agent`,
            );
            return;
          }

          const soulContent = soulRow.soulContent;
          const constitutionDirectives = Array.isArray(soulRow.constitutionDirectives)
            ? (soulRow.constitutionDirectives as string[])
            : [];

          // Mint session JWT (SPAWN-01)
          const sessionJwt = await mintSessionJwt({
            soulId,
            taskId,
            toolAllowlist: missionBrief.toolGrants,
            thirdPartyGrants: [],  // placeholder until external integrations are wired
            budgetAllocationCents: AGENT_COST_CENTS[agentClass],
            runtimeLimitSeconds: missionBrief.runtimeLimitSeconds,
            ringLeaderRunId,
          });

          // Build session prompt (SPAWN-02, SPAWN-03, SPAWN-04)
          const sessionPrompt = buildAgentSessionPrompt({
            soulContent,
            constitutionDirectives,
            taskDescription: taskNode.description,
            taskId,
            requiredTools: taskNode.requiredTools,
            complexity: taskNode.complexity,
            upstreamOutputs,
          });

          if (!sessionPrompt.constitutionVerified) {
            const missing = constitutionDirectives.filter(
              (d) => !soulContent.includes(d.trim()),
            );
            console.warn(
              `[agent-spawner] Constitution verification failed for soul ${soulId} on task ${taskId}: ` +
              `missing ${missing.join(', ')}`,
            );
          }

          // Spawn bot VM with full assembled session prompt as soulContent (SPAWN-05, SPAWN-06)
          const { botId } = await spawnBot(executionId, soulId, sessionPrompt.fullPrompt);

          // Register in active session registry
          const activeSession: ActiveSession = {
            sessionId: botId,  // botId serves as session identifier
            botId,
            soulId,
            taskId,
            agentClass,
            sessionJwt,
            spawnedAt: new Date(),
            status: 'spawning',
          };
          registry.sessions.set(botId, activeSession);
        });
      }
    }

    // Spawn all agents in this wave in parallel
    const results = await Promise.allSettled(waveSpawnPromises.map((fn) => fn()));

    let waveSpawned = 0;
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result?.status === 'fulfilled') {
        waveSpawned++;
      } else if (result?.status === 'rejected') {
        console.error(
          `[agent-spawner] Agent spawn failed in wave ${waveIndex}:`,
          (result.reason as Error).message,
        );
      }
    }

    // Mark registry entries as 'active' for successful spawns — entries are keyed by botId
    // We update the most recently added sessions (those with status 'spawning' from this wave)
    for (const session of registry.sessions.values()) {
      if (session.status === 'spawning') {
        session.status = 'active';
      }
    }

    totalAgentsSpawned += waveSpawned;

    console.info(
      `[agent-spawner] Wave ${waveIndex} complete: ${waveSpawned}/${waveSpawnPromises.length} agents spawned`,
    );
  }

  // ── Step 3: Update ring_leader_runs with registry snapshot ─────────────────
  const sessionCount = registry.sessions.size;
  const failedCount = [...registry.sessions.values()].filter(
    (s) => s.status === 'failed',
  ).length;

  await db
    .update(ringLeaderRuns)
    .set({
      status: 'coordinating',
      runState: {
        agentSpawningComplete: true,
        sessionCount,
        totalWaves: waves.length,
        failedSpawns: failedCount,
      },
      updatedAt: new Date(),
    })
    .where(eq(ringLeaderRuns.id, ringLeaderRunId));

  console.info(
    `[agent-spawner] All waves complete for run=${ringLeaderRunId}: ` +
    `totalAgentsSpawned=${totalAgentsSpawned}, waves=${waves.length}, ` +
    `status=coordinating`,
  );

  return {
    totalAgentsSpawned,
    totalWaves: waves.length,
    registry,
  };
}
