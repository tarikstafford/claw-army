import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  createExecution,
  getExecution,
  transitionExecution,
} from '../services/execution.service';
import { planObjective } from '../services/planner.service';
import { addTaskToQueue } from '../queue/task-queue';
import { db, tasks } from '@claw/db';

export const executionsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // POST /executions — create a new execution
  fastify.post('/', {
    schema: {
      body: Type.Object({
        objective: Type.String({ minLength: 1 }),
        maxBots: Type.Integer({ minimum: 1, maximum: 20 }),
        budgetCapCents: Type.Optional(Type.Integer({ minimum: 0 })),
        runtimeLimitSeconds: Type.Optional(Type.Integer({ minimum: 60 })),
        allowedTools: Type.Array(Type.String()),
      }),
      response: {
        201: Type.Object({
          executionId: Type.String({ format: 'uuid' }),
          status: Type.Literal('queued'),
        }),
      },
    },
  }, async (request, reply) => {
    const {
      objective,
      maxBots,
      budgetCapCents,
      runtimeLimitSeconds,
      allowedTools,
    } = request.body;

    const result = await createExecution({
      objective,
      maxBots,
      budgetCapCents: budgetCapCents ?? 0,
      runtimeLimitSeconds: runtimeLimitSeconds ?? 3600,
      allowedTools,
    });

    const { executionId } = result;

    // Trigger async planning after returning 201 (non-blocking).
    // setImmediate ensures the reply is sent before planning begins,
    // guaranteeing the POST response is well within the 1-second SLA.
    setImmediate(async () => {
      try {
        // 1. Plan tasks (stub — no LLM)
        const plannedTasks = planObjective(objective, maxBots);

        // 2. Dual-write: Postgres first, then BullMQ
        // Per RESEARCH.md: write to DB first so task rows always exist.
        // If BullMQ add fails, the task stays 'pending' — a reconciler can re-enqueue.
        // This prevents orphan queue jobs with no corresponding DB record.
        for (const planned of plannedTasks) {
          // Write to Postgres (create task row with status 'pending')
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
            // Write to BullMQ queue
            await addTaskToQueue({
              taskId: taskRow.id,
              executionId,
              description: planned.description,
            });
          }
        }

        // 3. Transition execution from 'queued' to 'running'
        await transitionExecution(executionId, 'queued', 'running');

        fastify.log.info(
          { executionId, taskCount: plannedTasks.length },
          'Planning complete, execution running',
        );
      } catch (err) {
        fastify.log.error({ err, executionId }, 'Failed to plan and queue tasks');
        // Transition to failed on planning error so the execution doesn't stay stuck in 'queued'
        await transitionExecution(executionId, 'queued', 'failed').catch(() => {});
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
};
