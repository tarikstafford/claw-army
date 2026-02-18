import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  createExecution,
  getExecution,
} from '../services/execution.service';

export const executionsRoutes: FastifyPluginAsyncTypebox = async (app) => {
  // POST /executions — create a new execution
  app.post('/', {
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

    return reply.code(201).send(result);
  });

  // GET /executions/:id — get a single execution by ID
  app.get('/:id', {
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
