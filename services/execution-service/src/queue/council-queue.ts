import { Queue } from 'bullmq';
import { queueConnection } from './task-queue';
import type { RingLeaderSynthesis } from '@claw/shared-types';

// Queue name used by both producer and council worker — must match on both sides.
export const COUNCIL_QUEUE_NAME = 'council-queue';

/**
 * Data carried by each council evaluation job.
 * Identifies the execution and bot to be evaluated, plus the optional soul ID
 * and the Ring Leader synthesis document (SYNTH-05).
 */
export interface CouncilJobData {
  executionId: string;
  botId: string;
  soulId: string | null;
  ringLeaderSynthesis?: RingLeaderSynthesis | null;  // SYNTH-05: synthesis as primary input
}

/**
 * Shared context object passed to all three council judges.
 * Contains the raw inputs assembled by the council worker before invoking judges.
 * NO judge-specific data lives here — each judge receives this same object
 * and produces its own independent verdict.
 */
export interface CouncilContext {
  executionId: string;
  botId: string;
  soulId: string | null;
  soulContent: string | null;           // from bot_souls.soulContent
  constitutionDirectives: string[];     // from bot_souls.constitutionDirectives (parsed JSONB)
  taskCategory: string | null;          // from bot_souls.taskCategory
  botMetrics: {
    tasksClaimed: number;
    tasksCompleted: number;
    tasksFailed: number;
    compositeScore: string | null;      // numeric from DB
    tier: string | null;
  };
  decisionTraces: Array<{
    decisionId: string;
    decisionType: string;
    directiveReferenced: string | null;
    attributionConfidence: string | null; // numeric from DB
    outcome: string | null;
    metadata: unknown;
  }>;
  telemetryMetrics: Array<{
    metricName: string;
    metricValue: string;               // numeric from DB
  }>;
  ringLeaderSynthesis?: RingLeaderSynthesis | null;  // SYNTH-05: Ring Leader synthesis as primary context
}

/**
 * Producer-side council queue.
 * Reuses the same Redis connection as the task queue — no separate connection needed.
 * The council worker (Plan 02) will create its own Worker instance using workerConnection.
 */
export const councilQueue = new Queue<CouncilJobData>(COUNCIL_QUEUE_NAME, {
  connection: queueConnection,
});
