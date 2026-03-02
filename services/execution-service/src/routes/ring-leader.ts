import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { db, ringLeaderRuns } from '@claw/db';
import { eq } from 'drizzle-orm';
import type { PopulationManifest } from '@claw/shared-types';

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
};
