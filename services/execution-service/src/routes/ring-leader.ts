import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { db, ringLeaderRuns, ringLeaderFitness } from '@claw/db';
import { eq } from 'drizzle-orm';
import type { PopulationManifest, RingLeaderRunState, RingLeaderSynthesis } from '@claw/shared-types';
import { getCoordinationLog } from '../services/coordination-events';

// TypeBox schema for a single soul selection entry
const SoulSelectionEntrySchema = Type.Object({
  soulId: Type.String({ format: 'uuid' }),
  agentClass: Type.Union([
    Type.Literal('Artisan'),
    Type.Literal('Understudy'),
    Type.Literal('Novice'),
  ]),
  source: Type.Union([
    Type.Literal('library'),
    Type.Literal('generated'),
    Type.Literal('mutated'),
  ]),
  parentSoulId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  mutationApplied: Type.Union([Type.String(), Type.Null()]),
  selectionRationale: Type.String(),
  differentiationScore: Type.Number(),
});

// TypeBox schema for a population manifest (per task)
const ManifestSchema = Type.Object({
  taskId: Type.String(),
  taskDescription: Type.String(),
  assignedSouls: Type.Array(SoulSelectionEntrySchema),
  pioneerFlag: Type.Boolean(),
  varianceIntent: Type.Union([Type.String(), Type.Null()]),
});

// Shared response schema for ring leader run manifest
const ManifestResponseSchema = Type.Object({
  runId: Type.String({ format: 'uuid' }),
  executionId: Type.String({ format: 'uuid' }),
  status: Type.String(),
  manifests: Type.Array(ManifestSchema),
  missionBrief: Type.Unknown(),
});

// TypeBox schema for per-task state in run state
const TaskStateSchema = Type.Object({
  status: Type.String(),
  activeAgents: Type.Array(Type.String()),
  completedAgents: Type.Array(Type.String()),
  failedAgents: Type.Array(Type.String()),
  outputQualitySignal: Type.Union([Type.Number(), Type.Null()]),
});

// TypeBox schema for live run state
const RunStateSchema = Type.Object({
  runId: Type.String(),
  elapsedTimeSeconds: Type.Number(),
  budgetConsumedCents: Type.Number(),
  taskStates: Type.Record(Type.String(), TaskStateSchema),
  objectiveDriftScore: Type.Number(),
  anomalies: Type.Array(Type.String()),
});

// Response schema for /state endpoint
const RunStateResponseSchema = Type.Object({
  runId: Type.String({ format: 'uuid' }),
  executionId: Type.String({ format: 'uuid' }),
  status: Type.String(),
  runState: Type.Union([RunStateSchema, Type.Null()]),
});

// TypeBox schema for a coordination event entry
const CoordinationEventSchema = Type.Object({
  type: Type.String(),
  timestamp: Type.String(),
  payload: Type.Unknown(),
});

// Response schema for /events endpoint
const EventsResponseSchema = Type.Object({
  runId: Type.String({ format: 'uuid' }),
  events: Type.Array(CoordinationEventSchema),
});

// TypeBox schema for coordination score dimensions
const CoordinationScoreSchema = Type.Object({
  collectiveOutcome: Type.Number(),
  driftPrevention: Type.Number(),
  reallocationEffectiveness: Type.Number(),
  budgetManagement: Type.Number(),
});

// TypeBox schema for soul selection score dimensions
const SoulSelectionScoreSchema = Type.Object({
  librarySearchQuality: Type.Number(),
  differentiationEffectiveness: Type.Number(),
  mutationDecisionQuality: Type.Number(),
  pioneerHandling: Type.Number(),
  selectionRetrospectiveQuality: Type.Number(),
});

// Response schema for /synthesis endpoint
const SynthesisResponseSchema = Type.Object({
  runId: Type.String({ format: 'uuid' }),
  executionId: Type.String({ format: 'uuid' }),
  status: Type.String(),
  synthesis: Type.Union([Type.Unknown(), Type.Null()]),
  fitness: Type.Union([
    Type.Object({
      coordinationScore: CoordinationScoreSchema,
      soulSelectionScore: SoulSelectionScoreSchema,
      compositeScore: Type.Number(),
    }),
    Type.Null(),
  ]),
});

export const ringLeaderRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // GET /ring-leader/runs/:runId/manifest — pre-flight dashboard data (SPAWN-07)
  // Returns the full population manifest for a Ring Leader run, including all soul
  // assignments, agent classes, sources, selection rationale, and pioneer flags per task.
  fastify.get('/runs/:runId/manifest', {
    schema: {
      params: Type.Object({
        runId: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: ManifestResponseSchema,
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { runId } = request.params;

    const [run] = await db
      .select()
      .from(ringLeaderRuns)
      .where(eq(ringLeaderRuns.id, runId));

    if (!run) {
      return reply.code(404).send({ error: 'Ring Leader run not found' });
    }

    // populationManifest is null while still assembling — return empty array with current status
    const manifests = run.populationManifest != null
      ? (run.populationManifest as PopulationManifest[])
      : [];

    return reply.code(200).send({
      runId: run.id,
      executionId: run.executionId,
      status: run.status,
      manifests,
      missionBrief: run.missionBrief,
    });
  });

  // GET /ring-leader/runs/by-execution/:executionId — convenience lookup by execution ID
  // UI knows executionId from the POST /executions response; this maps to the Ring Leader run.
  fastify.get('/runs/by-execution/:executionId', {
    schema: {
      params: Type.Object({
        executionId: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: ManifestResponseSchema,
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { executionId } = request.params;

    const [run] = await db
      .select()
      .from(ringLeaderRuns)
      .where(eq(ringLeaderRuns.executionId, executionId));

    if (!run) {
      return reply.code(404).send({ error: 'Ring Leader run not found for this execution' });
    }

    const manifests = run.populationManifest != null
      ? (run.populationManifest as PopulationManifest[])
      : [];

    return reply.code(200).send({
      runId: run.id,
      executionId: run.executionId,
      status: run.status,
      manifests,
      missionBrief: run.missionBrief,
    });
  });

  // GET /ring-leader/runs/by-execution/:executionId/state — live run state
  // Returns the current run state including budget, task states, drift score, and anomalies.
  // runState is null when run has not yet entered the coordinating phase.
  fastify.get('/runs/by-execution/:executionId/state', {
    schema: {
      params: Type.Object({
        executionId: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: RunStateResponseSchema,
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { executionId } = request.params;

    const [run] = await db
      .select()
      .from(ringLeaderRuns)
      .where(eq(ringLeaderRuns.executionId, executionId));

    if (!run) {
      return reply.code(404).send({ error: 'Ring Leader run not found for this execution' });
    }

    return reply.code(200).send({
      runId: run.id,
      executionId: run.executionId,
      status: run.status,
      runState: run.runState != null ? (run.runState as RingLeaderRunState) : null,
    });
  });

  // GET /ring-leader/runs/by-execution/:executionId/events — coordination event log
  // Returns all coordination events for the run (in-memory log via getCoordinationLog).
  fastify.get('/runs/by-execution/:executionId/events', {
    schema: {
      params: Type.Object({
        executionId: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: EventsResponseSchema,
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { executionId } = request.params;

    const [run] = await db
      .select()
      .from(ringLeaderRuns)
      .where(eq(ringLeaderRuns.executionId, executionId));

    if (!run) {
      return reply.code(404).send({ error: 'Ring Leader run not found for this execution' });
    }

    const events = getCoordinationLog(run.id);

    return reply.code(200).send({
      runId: run.id,
      events,
    });
  });

  // GET /ring-leader/runs/by-execution/:executionId/synthesis — run synthesis + fitness scores
  // Returns the Ring Leader synthesis and fitness breakdown for completed runs.
  // synthesis and fitness are null for failed or in-progress runs.
  fastify.get('/runs/by-execution/:executionId/synthesis', {
    schema: {
      params: Type.Object({
        executionId: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: SynthesisResponseSchema,
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { executionId } = request.params;

    const [run] = await db
      .select()
      .from(ringLeaderRuns)
      .where(eq(ringLeaderRuns.executionId, executionId));

    if (!run) {
      return reply.code(404).send({ error: 'Ring Leader run not found for this execution' });
    }

    // Fetch fitness row — may not exist for failed or in-progress runs
    const [fitnessRow] = await db
      .select()
      .from(ringLeaderFitness)
      .where(eq(ringLeaderFitness.ringLeaderRunId, run.id));

    const fitness = fitnessRow != null
      ? {
          coordinationScore: fitnessRow.coordinationScore as { collectiveOutcome: number; driftPrevention: number; reallocationEffectiveness: number; budgetManagement: number },
          soulSelectionScore: fitnessRow.soulSelectionScore as { librarySearchQuality: number; differentiationEffectiveness: number; mutationDecisionQuality: number; pioneerHandling: number; selectionRetrospectiveQuality: number },
          compositeScore: Number(fitnessRow.compositeScore),
        }
      : null;

    return reply.code(200).send({
      runId: run.id,
      executionId: run.executionId,
      status: run.status,
      synthesis: run.synthesis != null ? (run.synthesis as RingLeaderSynthesis) : null,
      fitness,
    });
  });
};
