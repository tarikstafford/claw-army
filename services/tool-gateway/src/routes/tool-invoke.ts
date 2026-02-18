import fp from 'fastify-plugin';
import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  llmCallRequestSchema,
  fetchUrlRequestSchema,
  writeFileRequestSchema,
} from '@claw/tool-contracts';
import { checkAllowlist } from '../services/allowlist';
import { writeAuditLog } from '../services/audit-log';
import { checkCallRateLimit, checkTokenRateLimit } from '../middleware/rate-limit';

// Loose body schema — strict enforcement is done via Zod per-tool schemas
// All fields optional at TypeBox level so preHandler (JWT auth) fires before
// body validation causes a 400 (preHandler runs after TypeBox schema validation,
// but we still want auth to catch missing JWT for any body shape).
const BodySchema = Type.Partial(
  Type.Object({
    toolName: Type.String(),
    botId: Type.String(),
    executionId: Type.String(),
    invocationId: Type.String(),
    timestamp: Type.String(),
    args: Type.Unknown(),
  }),
);

const toolInvokeRoutes: FastifyPluginAsyncTypebox = async function (fastify) {
  fastify.post(
    '/tool.invoke',
    {
      schema: {
        body: BodySchema,
      },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const startTime = Date.now();
      const {
        toolName,
        botId,
        executionId,
        invocationId,
        args,
      } = request.body;

      // Validate required fields are present (Zod does deep validation later)
      if (!toolName || !botId || !executionId || !invocationId) {
        return reply.status(422).send({
          success: false,
          error: 'Missing required fields: toolName, botId, executionId, invocationId',
        });
      }

      // 1. Allowlist check
      const allowlistResult = await checkAllowlist(executionId, toolName);
      if (!allowlistResult.allowed) {
        await writeAuditLog({
          executionId,
          botId,
          toolName,
          invocationId,
          rejected: true,
          rejectionReason: 'not_in_allowlist',
          requestSummary: { toolName, args },
        });
        return reply.status(403).send({
          success: false,
          error: 'Tool not in execution allowed_tools',
          allowedTools: allowlistResult.allowedTools,
        });
      }

      // 2. Call rate limit
      const callLimitResult = await checkCallRateLimit(botId);
      if (!callLimitResult.allowed) {
        await writeAuditLog({
          executionId,
          botId,
          toolName,
          invocationId,
          rejected: true,
          rejectionReason: 'rate_limit_exceeded',
          requestSummary: { toolName },
        });
        return reply.status(429).send({
          success: false,
          error: 'Call rate limit exceeded',
          retryAfter: callLimitResult.retryAfter,
        });
      }

      // 3. Token rate limit pre-check
      const tokenLimitResult = await checkTokenRateLimit(botId);
      if (!tokenLimitResult.allowed) {
        await writeAuditLog({
          executionId,
          botId,
          toolName,
          invocationId,
          rejected: true,
          rejectionReason: 'token_rate_limit_exceeded',
          requestSummary: { toolName },
        });
        return reply.status(429).send({
          success: false,
          error: 'Token rate limit exceeded',
          retryAfter: tokenLimitResult.retryAfter,
        });
      }

      // 4. Zod schema validation
      const fullBody = {
        toolName,
        botId,
        executionId,
        invocationId,
        timestamp: request.body.timestamp,
        args,
      };

      let parsedArgs: unknown;

      if (toolName === 'llm_call') {
        const result = llmCallRequestSchema.safeParse(fullBody);
        if (!result.success) {
          await writeAuditLog({
            executionId,
            botId,
            toolName,
            invocationId,
            rejected: true,
            rejectionReason: 'schema_validation_failed',
            requestSummary: { toolName, args },
          });
          return reply.status(422).send({
            success: false,
            error: 'Schema validation failed',
            issues: result.error.issues,
          });
        }
        parsedArgs = result.data;
      } else if (toolName === 'fetch_url') {
        const result = fetchUrlRequestSchema.safeParse(fullBody);
        if (!result.success) {
          await writeAuditLog({
            executionId,
            botId,
            toolName,
            invocationId,
            rejected: true,
            rejectionReason: 'schema_validation_failed',
            requestSummary: { toolName, args },
          });
          return reply.status(422).send({
            success: false,
            error: 'Schema validation failed',
            issues: result.error.issues,
          });
        }
        parsedArgs = result.data;
      } else if (toolName === 'write_file') {
        const result = writeFileRequestSchema.safeParse(fullBody);
        if (!result.success) {
          await writeAuditLog({
            executionId,
            botId,
            toolName,
            invocationId,
            rejected: true,
            rejectionReason: 'schema_validation_failed',
            requestSummary: { toolName, args },
          });
          return reply.status(422).send({
            success: false,
            error: 'Schema validation failed',
            issues: result.error.issues,
          });
        }
        parsedArgs = result.data;
      } else {
        return reply.status(400).send({
          success: false,
          error: `Unknown tool: ${toolName}`,
        });
      }

      // 5. Tool dispatch (stub — Plan 03-02 plugs in real implementations)
      void parsedArgs; // explicitly ignored for now

      const durationMs = Date.now() - startTime;

      await writeAuditLog({
        executionId,
        botId,
        toolName,
        invocationId,
        rejected: false,
        durationMs,
        requestSummary: { toolName, args },
      });

      return reply.status(501).send({
        success: false,
        error: 'Tool not implemented',
      });
    },
  );
};

export { toolInvokeRoutes };
