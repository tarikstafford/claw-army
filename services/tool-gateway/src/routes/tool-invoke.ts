import fp from 'fastify-plugin';
import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import IORedis from 'ioredis';
import {
  llmCallRequestSchema,
  fetchUrlRequestSchema,
  writeFileRequestSchema,
} from '@claw/tool-contracts';
import type { LlmCallRequest, FetchUrlRequest, WriteFileRequest } from '@claw/tool-contracts';
import { checkAllowlist } from '../services/allowlist';
import { writeAuditLog } from '../services/audit-log';
import { checkCallRateLimit, checkTokenRateLimit, consumeTokens } from '../middleware/rate-limit';
import { executeLlmCall } from '../tools/llm-call';
import { executeFetchUrl } from '../tools/fetch-url';
import { executeWriteFile } from '../tools/write-file';

/**
 * Dedicated Redis client for deny-list checks.
 * Separate from the rate-limiter's connection — simple GET operations only.
 * Uses default enableOfflineQueue: true (fail-open on Redis errors below, so
 * queuing vs. failing fast doesn't matter here; default keeps it simple).
 */
const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379');

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
      const startMs = Date.now();
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

      // 0. Bot deny-list check (GARD-02, GARD-03, GARD-04)
      // If the Guardrail Watchdog has revoked this bot, reject immediately.
      // Runs BEFORE the allowlist check — deny-list is the highest priority security gate.
      try {
        const isDenied = await redis.get(`guardrail:denied:${botId}`);
        if (isDenied) {
          await writeAuditLog({
            executionId,
            botId,
            toolName,
            invocationId,
            rejected: true,
            rejectionReason: 'bot_revoked',
            requestSummary: { toolName, args },
          });
          return reply.status(403).send({
            success: false,
            error: 'Bot has been revoked by guardrail watchdog',
          });
        }
      } catch (err) {
        // Fail-open: if Redis is unavailable, allow the request
        // (same pattern as rate-limit.ts fail-open behavior)
        console.error('[tool-invoke] Redis error in deny-list check (fail-open):', err);
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

      let parsed: LlmCallRequest | FetchUrlRequest | WriteFileRequest;

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
        parsed = result.data;
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
        parsed = result.data;
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
        parsed = result.data;
      } else {
        return reply.status(400).send({
          success: false,
          error: `Unknown tool: ${toolName}`,
        });
      }

      // 5. Tool dispatch — real implementations (replaces 501 stubs from 03-01)
      let result: unknown;
      let tokenCount: number | undefined;

      try {
        if (toolName === 'llm_call') {
          const llmResult = await executeLlmCall(parsed as LlmCallRequest);
          result = llmResult;
          tokenCount = llmResult.totalTokens;
        } else if (toolName === 'fetch_url') {
          result = await executeFetchUrl(parsed as FetchUrlRequest);
        } else if (toolName === 'write_file') {
          result = await executeWriteFile(parsed as WriteFileRequest);
        }
      } catch (err) {
        // Tool execution failed — log and return 500
        const durationMs = Date.now() - startMs;
        await writeAuditLog({
          executionId,
          botId,
          toolName,
          invocationId,
          rejected: false,
          durationMs,
          requestSummary: { toolName, args },
          responseSummary: { error: (err as Error).message },
        });
        return reply.code(500).send({ success: false, error: (err as Error).message });
      }

      const durationMs = Date.now() - startMs;

      // 6. Consume token credits after a successful llm_call (consume-after-return pattern)
      // Per locked user decision #2: if consuming pushes over the limit, the CURRENT call
      // still succeeds. The NEXT call will be blocked by the pre-check above.
      if (toolName === 'llm_call' && tokenCount !== undefined) {
        try {
          await consumeTokens(botId, tokenCount);
        } catch (err) {
          // TOKEN_RATE_LIMIT from consumeTokens is intentionally swallowed here —
          // the current call already completed. Log so we know the bot hit the limit.
          console.error('[tool-invoke] Token rate limit hit after llm_call (next call will be blocked):', err);
        }
      }

      // 7. Write success audit log with token counts (llm_call only)
      const llmResult = toolName === 'llm_call' ? (result as { promptTokens: number; completionTokens: number; totalTokens: number }) : undefined;

      await writeAuditLog({
        executionId,
        botId,
        toolName,
        invocationId,
        rejected: false,
        durationMs,
        promptTokens: llmResult?.promptTokens,
        completionTokens: llmResult?.completionTokens,
        totalTokens: llmResult?.totalTokens,
        requestSummary: { toolName, args },
        responseSummary: result,
      });

      return reply.code(200).send({ success: true, result, durationMs });
    },
  );
};

export { toolInvokeRoutes };
