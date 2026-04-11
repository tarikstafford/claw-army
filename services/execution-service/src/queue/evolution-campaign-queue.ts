import { Queue } from "bullmq";
import { queueConnection } from "./task-queue";

/**
 * Queue name shared by producer (god-layer-worker) and the evolution
 * campaign worker that creates the next iteration's execution.
 * Must match on both sides.
 */
export const EVOLUTION_CAMPAIGN_QUEUE_NAME = "evolution-campaign-next";

/**
 * Job payload — everything the worker needs to spawn the next iteration
 * for a campaign. The worker is responsible for double-checking campaign
 * state (in case of stale enqueues) and loading the seed params from the
 * campaigns row.
 */
export interface EvolutionCampaignJobData {
  campaignId: string;
  /** The iteration that just completed — used for delta computation. */
  previousIterationNum: number;
  /** The execution_id whose verdicts just finished god-layer processing. */
  previousExecutionId: string;
}

/**
 * Producer-side queue. Reuses the shared Redis connection used by the
 * other BullMQ producers in this service.
 */
export const evolutionCampaignQueue = new Queue<EvolutionCampaignJobData>(
  EVOLUTION_CAMPAIGN_QUEUE_NAME,
  {
    connection: queueConnection,
  },
);
