import { db, ringLeaderRuns, executions } from '@claw/db';
import { eq } from 'drizzle-orm';
import type { CampaignType, RingLeaderMissionBrief, TaskGraph } from '@claw/shared-types';
import { assemblePopulation } from './assemble-population';

export interface SpawnRingLeaderParams {
  executionId: string;
  objective: string;
  taskGraph: TaskGraph;
  toolGrants: string[];
  budgetCapCents: number;
  runtimeLimitSeconds: number;
  campaignType: CampaignType;
}

export interface SpawnRingLeaderResult {
  ringLeaderRunId: string;
  missionBrief: RingLeaderMissionBrief;
}

/**
 * Construct a mission brief, create a ring_leader_runs DB row, and link it to
 * the execution row.
 *
 * This function is the handoff point between the Orchestrator and the Ring
 * Leader. It does NOT start soul selection, bot spawning, or coordination —
 * those responsibilities belong to the Ring Leader (phases 26-29).
 *
 * ORCH-03: Orchestrator emits structured mission brief.
 * ORCH-04: Orchestrator steps back after this call.
 */
export async function spawnRingLeader(
  params: SpawnRingLeaderParams,
): Promise<SpawnRingLeaderResult> {
  const {
    executionId,
    objective,
    taskGraph,
    toolGrants,
    budgetCapCents,
    runtimeLimitSeconds,
    campaignType,
  } = params;

  // Insert the ring_leader_runs row and get the generated ID.
  // runId will be the DB-generated UUID — used as the missionBrief.runId as well.
  const [runRow] = await db
    .insert(ringLeaderRuns)
    .values({
      executionId,
      status: 'assembling',
      // Temporarily set missionBrief to an empty object; we'll update it below
      // once we have the runId for the brief.
      missionBrief: {},
      startedAt: new Date(),
    })
    .returning({ id: ringLeaderRuns.id });

  if (!runRow) {
    throw new Error('[ring-leader-spawner] Failed to insert ring_leader_runs row');
  }

  const ringLeaderRunId = runRow.id;

  // Construct the RingLeaderMissionBrief now that we have the runId.
  const missionBrief: RingLeaderMissionBrief = {
    objective,
    taskGraph,
    toolGrants,
    budgetCapCents,
    runtimeLimitSeconds,
    campaignType,
    runId: ringLeaderRunId,
  };

  // Persist the fully-constructed mission brief back to the row.
  await db
    .update(ringLeaderRuns)
    .set({ missionBrief, updatedAt: new Date() })
    .where(eq(ringLeaderRuns.id, ringLeaderRunId));

  // Link the execution row to this Ring Leader run (logical FK pattern).
  await db
    .update(executions)
    .set({ ringLeaderRunId, updatedAt: new Date() })
    .where(eq(executions.id, executionId));

  console.info('[ring-leader-spawner] Ring Leader run created:', { ringLeaderRunId, executionId });

  // Phase 26: Trigger soul selection and population assembly
  // This runs asynchronously after the spawn completes — status transitions
  // from 'assembling' to 'spawning' happen inside assemblePopulation.
  assemblePopulation(ringLeaderRunId, missionBrief).catch((err) => {
    console.error('[ring-leader-spawner] Population assembly failed:', err);
    // Update status to 'failed' on error
    db.update(ringLeaderRuns)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(ringLeaderRuns.id, ringLeaderRunId))
      .catch((dbErr) => console.error('[ring-leader-spawner] Failed to update status:', dbErr));
  });

  return { ringLeaderRunId, missionBrief };
}
