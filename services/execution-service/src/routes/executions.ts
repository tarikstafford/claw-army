import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { verifyAuthToken } from '../lib/verify-auth-token.js';
import {
  createExecution,
  getExecution,
  transitionExecution,
} from '../services/execution.service';
import { planObjective } from '../services/planner.service';
import { generateSoulPopulation } from '../services/soul-generator';
import { addTaskToQueue } from '../queue/task-queue';
import { db, executions, tasks, bots, telemetry, agentClasses, councilVerdicts } from '@claw/db';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import {
  spawnBotsForExecution,
  startIdleChecker,
  startQueueEventListener,
  stopBot,
} from '../orchestrator/bot-orchestrator';
import { publishExecutionStatusChanged } from '../events/publisher';
import { getBotsForExecution } from '../orchestrator/bot-registry';
import { startCompletionPoller } from '../orchestrator/completion-checker';
import { buildExecutionReport } from '../performance/report-builder';

export const executionsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // POST /executions — create a new execution
  fastify.post('/', {
    schema: {
      body: Type.Object({
        objective: Type.String({ minLength: 1 }),
        maxBots: Type.Integer({ minimum: 3, maximum: 20 }),
        budgetCapCents: Type.Optional(Type.Integer({ minimum: 0 })),
        runtimeLimitSeconds: Type.Optional(Type.Integer({ minimum: 60 })),
        allowedTools: Type.Optional(Type.Array(Type.String())),
        llmProvider: Type.Optional(Type.String()),
        allowedDomains: Type.Optional(Type.Array(Type.String())),
        objectiveId: Type.Optional(Type.String({ format: 'uuid' })),
      }),
      response: {
        201: Type.Object({
          executionId: Type.String({ format: 'uuid' }),
          status: Type.Literal('queued'),
        }),
        400: Type.Object({
          error: Type.String(),
        }),
        401: Type.Object({
          error: Type.String(),
        }),
      },
    },
    preHandler: [
      async (request, reply) => {
        const valid = await verifyAuthToken(request.headers.authorization);
        if (!valid) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
      },
    ],
  }, async (request, reply) => {
    const {
      objective,
      maxBots,
      budgetCapCents,
      runtimeLimitSeconds,
      allowedTools = [],
      objectiveId,
    } = request.body;

    const MIN_POPULATION = 3;

    // SOUL-02: Custom guard for human-readable minimum population message.
    // TypeBox schema also enforces minimum:3 as defense-in-depth, but its
    // error message is a generic JSON Schema validation string.
    if (maxBots < MIN_POPULATION) {
      return reply.code(400).send({
        error: `A minimum of ${MIN_POPULATION} bots is required to maintain a meaningfully differentiated soul population. Increase maxBots to at least ${MIN_POPULATION}.`,
      });
    }

    let result: { executionId: string; status: 'queued' };
    try {
      result = await createExecution({
        objective,
        maxBots,
        budgetCapCents: budgetCapCents ?? 0,
        runtimeLimitSeconds: runtimeLimitSeconds ?? 3600,
        allowedTools,
        objectiveId,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message === 'Objective not found or archived') {
        return reply.code(400).send({ error: message });
      }
      throw err;
    }

    const { executionId } = result;

    // Trigger async planning after returning 201 (non-blocking).
    // setImmediate ensures the reply is sent before planning begins,
    // guaranteeing the POST response is well within the 1-second SLA.
    setImmediate(async () => {
      try {
        // 1. Plan tasks (LLM decomposition)
        const plannedTasks = await planObjective(objective, maxBots);

        // 1b. Generate differentiated soul population for this execution
        const souls = await generateSoulPopulation(executionId, objective, maxBots);
        fastify.log.info(
          { executionId, soulCount: souls.length },
          'Soul population generated',
        );

        // 2. Dual-write: Postgres first, then BullMQ
        // Per RESEARCH.md: write to DB first so task rows always exist.
        // If BullMQ add fails, the task stays 'pending' — a reconciler can re-enqueue.
        // This prevents orphan queue jobs with no corresponding DB record.
        for (const planned of plannedTasks) {
          const taskResult = await db
            .insert(tasks)
            .values({
              executionId,
              description: planned.description,
              status: 'pending',
            })
            .returning({ id: tasks.id });

          if (taskResult.length > 0) {
            const taskRow = taskResult[0]!;
            await addTaskToQueue({
              taskId: taskRow.id,
              executionId,
              description: planned.description,
            });
          }
        }

        // 3. Transition execution from 'queued' to 'running'
        const transitioned = await transitionExecution(executionId, 'queued', 'running');
        if (!transitioned) {
          fastify.log.error({ executionId }, 'Failed to transition to running');
          return;
        }

        await publishExecutionStatusChanged({
          type: 'execution_status_changed',
          executionId,
          fromStatus: 'queued',
          toStatus: 'running',
          timestamp: new Date().toISOString(),
        }).catch((err: Error) => {
          fastify.log.error({ err, executionId }, 'Failed to publish execution_status_changed (non-fatal)');
        });

        // 4. Spawn bots for this execution (each bot receives its assigned soul)
        await spawnBotsForExecution(executionId, souls);
        fastify.log.info(
          { executionId, botCount: souls.length, taskCount: plannedTasks.length },
          'Bots spawned, execution running',
        );

        // 5. Start QueueEvents listener to keep lastTaskClaimedAt fresh
        // This prevents the idle checker from killing bots that are actively processing tasks.
        startQueueEventListener();

        // 6. Start idle checker and completion polling
        startIdleChecker();
        startCompletionPoller(executionId);
      } catch (err) {
        fastify.log.error({ err, executionId }, 'Failed during execution pipeline');
        // Attempt to transition to failed so the execution doesn't stay stuck
        await transitionExecution(executionId, 'queued', 'failed').catch(() => {});
        await transitionExecution(executionId, 'running', 'failed').catch(() => {});
      }
    });

    return reply.code(201).send(result);
  });

  // GET /executions/:id — get a single execution by ID
  fastify.get('/:id', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          id: Type.String({ format: 'uuid' }),
          status: Type.Union([
            Type.Literal('queued'),
            Type.Literal('running'),
            Type.Literal('paused'),
            Type.Literal('stopped'),
            Type.Literal('completed'),
            Type.Literal('failed'),
          ]),
          objective: Type.String(),
          maxBots: Type.Integer(),
          budgetCapCents: Type.Integer(),
          runtimeLimitSeconds: Type.Integer(),
          allowedTools: Type.Array(Type.String()),
          createdAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
          updatedAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
        }),
        404: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const execution = await getExecution(id);

    if (!execution) {
      return reply.code(404).send({ error: 'Execution not found' });
    }

    return reply.code(200).send(execution);
  });

  // GET /executions/:id/tasks — get all tasks for an execution (debug/visibility)
  fastify.get('/:id/tasks', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Array(
          Type.Object({
            id: Type.String({ format: 'uuid' }),
            executionId: Type.String({ format: 'uuid' }),
            status: Type.Union([
              Type.Literal('pending'),
              Type.Literal('claimed'),
              Type.Literal('completed'),
              Type.Literal('failed'),
            ]),
            description: Type.String(),
            result: Type.Union([Type.String(), Type.Null()]),
            claimedByBotId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
            attemptCount: Type.Integer(),
            createdAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
            updatedAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
          }),
        ),
        404: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    // Verify execution exists
    const execution = await getExecution(id);
    if (!execution) {
      return reply.code(404).send({ error: 'Execution not found' });
    }

    const taskList = await db
      .select()
      .from(tasks)
      .where(eq(tasks.executionId, id));

    return reply.code(200).send(taskList);
  });

  // GET /executions/:id/bots — get all bots for an execution (debug/visibility)
  fastify.get('/:id/bots', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Array(
          Type.Object({
            id: Type.String({ format: 'uuid' }),
            executionId: Type.String({ format: 'uuid' }),
            status: Type.Union([
              Type.Literal('spawning'),
              Type.Literal('idle'),
              Type.Literal('working'),
              Type.Literal('stopping'),
              Type.Literal('stopped'),
              Type.Literal('failed'),
            ]),
            containerId: Type.Union([Type.String(), Type.Null()]),
            imageTag: Type.String(),
            tasksClaimed: Type.Integer(),
            tasksCompleted: Type.Integer(),
            tasksFailed: Type.Integer(),
            createdAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
            updatedAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
          }),
        ),
        404: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    // Verify execution exists
    const execution = await getExecution(id);
    if (!execution) {
      return reply.code(404).send({ error: 'Execution not found' });
    }

    const botList = await db
      .select()
      .from(bots)
      .where(eq(bots.executionId, id));

    return reply.code(200).send(botList);
  });

  // GET /executions/:id/report — execution summary report (PERF-06)
  fastify.get('/:id/report', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          executionId: Type.String({ format: 'uuid' }),
          totalBots: Type.Integer(),
          totalBotHours: Type.Number(),
          totalCostCents: Type.Integer(),
          averageBotScore: Type.Number(),
          topPerformingBotId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
          errorDistribution: Type.Record(Type.String(), Type.Integer()),
          costPerTaskCents: Type.Integer(),
          totalTasks: Type.Integer(),
          completedTasks: Type.Integer(),
          failedTasks: Type.Integer(),
          soulTierDistribution: Type.Object({
            novice: Type.Integer(),
            understudy: Type.Integer(),
            artisan: Type.Integer(),
            retired: Type.Integer(),
          }),
        }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const execution = await getExecution(id);
    if (!execution) {
      return reply.code(404).send({ error: 'Execution not found' });
    }
    const report = await buildExecutionReport(id);
    return reply.code(200).send(report);
  });

  // GET /executions/:id/leaderboard — bot leaderboard sorted by score (PERF-07)
  fastify.get('/:id/leaderboard', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Array(
          Type.Object({
            botId: Type.String({ format: 'uuid' }),
            compositeScore: Type.Union([Type.Number(), Type.Null()]),
            tier: Type.Union([Type.String(), Type.Null()]),
            tasksCompleted: Type.Integer(),
            tasksFailed: Type.Integer(),
            botHours: Type.Union([Type.Number(), Type.Null()]),
            agentClass: Type.Union([
              Type.Literal('Novice'),
              Type.Literal('Understudy'),
              Type.Literal('Artisan'),
              Type.Literal('Retired'),
              Type.Null(),
            ]),
            isPioneer: Type.Boolean(),
            verdictSummary: Type.Union([Type.String(), Type.Null()]),
            verdictType: Type.Union([Type.String(), Type.Null()]),
          }),
        ),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const execution = await getExecution(id);
    if (!execution) {
      return reply.code(404).send({ error: 'Execution not found' });
    }

    // Get bots sorted by composite_score descending
    const botRows = await db
      .select({
        botId: bots.id,
        compositeScore: bots.compositeScore,
        tier: bots.tier,
      })
      .from(bots)
      .where(eq(bots.executionId, id))
      .orderBy(sql`${bots.compositeScore} DESC NULLS LAST`);

    // Build botIds array for batch queries
    const botIds = botRows.map((b) => b.botId);

    // Rank map for agent class precedence: Artisan > Understudy > Novice > Retired
    const CLASS_RANK: Record<string, number> = {
      Artisan: 3,
      Understudy: 2,
      Novice: 1,
      Retired: 0,
    };

    // Lookup maps keyed by botId
    type AgentClassInfo = { agentClass: 'Novice' | 'Understudy' | 'Artisan' | 'Retired'; isPioneer: boolean };
    type VerdictInfo = { verdictType: string; verdictSummary: string };

    const agentClassMap = new Map<string, AgentClassInfo>();
    const verdictMap = new Map<string, VerdictInfo>();

    if (botIds.length > 0) {
      // Batch query agent_classes for all bots in this execution
      const agentClassRows = await db
        .select({
          botId: agentClasses.botId,
          currentClass: agentClasses.currentClass,
          isPioneer: agentClasses.isPioneer,
        })
        .from(agentClasses)
        .where(inArray(agentClasses.botId, botIds));

      // Build agent class map: pick highest-ranked class per bot; OR isPioneer across rows
      for (const row of agentClassRows) {
        const existing = agentClassMap.get(row.botId);
        const rowRank = CLASS_RANK[row.currentClass] ?? -1;
        if (!existing || rowRank > (CLASS_RANK[existing.agentClass] ?? -1)) {
          agentClassMap.set(row.botId, {
            agentClass: row.currentClass,
            isPioneer: existing?.isPioneer || row.isPioneer,
          });
        } else if (row.isPioneer) {
          // Same or lower rank but isPioneer=true — propagate pioneer flag
          agentClassMap.set(row.botId, { ...existing, isPioneer: true });
        }
      }

      // Batch query council_verdicts for all bots in this execution, most recent first
      const verdictRows = await db
        .select({
          botId: councilVerdicts.botId,
          verdictType: councilVerdicts.verdictType,
          verdictSummary: councilVerdicts.verdictSummary,
          createdAt: councilVerdicts.createdAt,
        })
        .from(councilVerdicts)
        .where(
          and(
            inArray(councilVerdicts.botId, botIds),
            eq(councilVerdicts.executionId, id),
          ),
        )
        .orderBy(desc(councilVerdicts.createdAt));

      // Build verdict map: take first (most recent) verdict per bot
      for (const row of verdictRows) {
        if (!verdictMap.has(row.botId)) {
          verdictMap.set(row.botId, {
            verdictType: row.verdictType,
            verdictSummary: row.verdictSummary,
          });
        }
      }
    }

    // For each bot, get task counts and bot-hours
    // N+1 is acceptable for MVP where executions have at most 20 bots (maxBots cap)
    const leaderboard = await Promise.all(
      botRows.map(async (bot) => {
        const [completedRow] = await db
          .select({ count: sql<number>`cast(count(*) as int)` })
          .from(tasks)
          .where(and(eq(tasks.executionId, id), eq(tasks.claimedByBotId, bot.botId), eq(tasks.status, 'completed')));

        const [failedRow] = await db
          .select({ count: sql<number>`cast(count(*) as int)` })
          .from(tasks)
          .where(and(eq(tasks.executionId, id), eq(tasks.claimedByBotId, bot.botId), eq(tasks.status, 'failed')));

        const [hoursRow] = await db
          .select({ value: telemetry.metricValue })
          .from(telemetry)
          .where(and(eq(telemetry.botId, bot.botId), eq(telemetry.metricName, 'bot_hours')));

        const classInfo = agentClassMap.get(bot.botId);
        const verdictInfo = verdictMap.get(bot.botId);

        return {
          botId: bot.botId,
          compositeScore: bot.compositeScore ? Number(bot.compositeScore) : null,
          tier: bot.tier,
          tasksCompleted: completedRow?.count ?? 0,
          tasksFailed: failedRow?.count ?? 0,
          botHours: hoursRow?.value ? Number(hoursRow.value) : null,
          agentClass: classInfo?.agentClass ?? null,
          isPioneer: classInfo?.isPioneer ?? false,
          verdictSummary: verdictInfo?.verdictSummary ?? null,
          verdictType: verdictInfo?.verdictType ?? null,
        };
      }),
    );

    return reply.code(200).send(leaderboard);
  });

  // GET /executions/:id/pending-verdicts — pending Promote/Retire verdicts for a specific execution (RUN-04)
  fastify.get('/:id/pending-verdicts', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Array(
          Type.Object({
            id: Type.String({ format: 'uuid' }),
            botId: Type.String({ format: 'uuid' }),
            executionId: Type.String({ format: 'uuid' }),
            verdictType: Type.String(),
            status: Type.String(),
            weightedConfidenceScore: Type.Number(),
            verdictSummary: Type.String(),
            hasUnresolvedDevilsAdvocate: Type.Boolean(),
            devilsAdvocateOutput: Type.Unknown(),
            performanceJudgeOutput: Type.Unknown(),
            soulAnalystOutput: Type.Unknown(),
            requiresHumanConfirmation: Type.Boolean(),
            createdAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
          }),
        ),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const execution = await getExecution(id);
    if (!execution) {
      return reply.code(404).send({ error: 'Execution not found' });
    }

    const rows = await db
      .select({
        id: councilVerdicts.id,
        botId: councilVerdicts.botId,
        executionId: councilVerdicts.executionId,
        verdictType: councilVerdicts.verdictType,
        status: councilVerdicts.status,
        weightedConfidenceScore: councilVerdicts.weightedConfidenceScore,
        verdictSummary: councilVerdicts.verdictSummary,
        hasUnresolvedDevilsAdvocate: councilVerdicts.hasUnresolvedDevilsAdvocate,
        devilsAdvocateOutput: councilVerdicts.devilsAdvocateOutput,
        performanceJudgeOutput: councilVerdicts.performanceJudgeOutput,
        soulAnalystOutput: councilVerdicts.soulAnalystOutput,
        requiresHumanConfirmation: councilVerdicts.requiresHumanConfirmation,
        createdAt: councilVerdicts.createdAt,
      })
      .from(councilVerdicts)
      .where(
        and(
          eq(councilVerdicts.executionId, id),
          inArray(councilVerdicts.verdictType, ['Promote', 'Retire']),
          eq(councilVerdicts.status, 'pending'),
        ),
      )
      .orderBy(councilVerdicts.createdAt);

    return rows.map((r) => ({
      ...r,
      weightedConfidenceScore: Number(r.weightedConfidenceScore),
    }));
  });

  // GET / — list all executions (admin)
  fastify.get('/all', {
    schema: {
      response: {
        200: Type.Array(
          Type.Object({
            id: Type.String({ format: 'uuid' }),
            status: Type.Union([
              Type.Literal('queued'),
              Type.Literal('running'),
              Type.Literal('paused'),
              Type.Literal('stopped'),
              Type.Literal('completed'),
              Type.Literal('failed'),
            ]),
            objective: Type.String(),
            maxBots: Type.Integer(),
            budgetCapCents: Type.Integer(),
            allowedTools: Type.Array(Type.String()),
            createdAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
            updatedAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
            activeBotCount: Type.Integer(),
          }),
        ),
      },
    },
  }, async (_request, reply) => {
    const allExecutions = await db
      .select()
      .from(executions)
      .orderBy(desc(executions.createdAt));

    const result = await Promise.all(
      allExecutions.map(async (exec) => {
        const [row] = await db
          .select({ count: sql<number>`cast(count(*) as int)` })
          .from(bots)
          .where(
            and(
              eq(bots.executionId, exec.id),
              sql`${bots.status} NOT IN ('stopped', 'failed')`,
            ),
          );
        return { ...exec, activeBotCount: row?.count ?? 0 };
      }),
    );

    return reply.code(200).send(result);
  });

  // POST /:id/stop — stop a running execution (admin)
  fastify.post('/:id/stop', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({ success: Type.Boolean() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const execution = await getExecution(id);
    if (!execution) return reply.code(404).send({ error: 'Execution not found' });

    // Transition to stopped (handles both queued and running states)
    await transitionExecution(id, 'running', 'stopped').catch(() => {});
    await transitionExecution(id, 'queued', 'stopped').catch(() => {});

    // Stop bots tracked in the in-memory registry
    const activeBots = getBotsForExecution(id);
    await Promise.allSettled(activeBots.map((b) => stopBot(b.botId, 'terminated')));

    // Failsafe: mark any remaining DB bot rows as stopped
    await db
      .update(bots)
      .set({ status: 'stopped', stoppedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(bots.executionId, id),
          sql`${bots.status} NOT IN ('stopped', 'failed')`,
        ),
      );

    return reply.code(200).send({ success: true });
  });
};
