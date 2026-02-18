import { z } from 'zod';

/** All supported tool names in the Tool Gateway */
export type ToolName = 'llm_call' | 'fetch_url' | 'write_file';

/** Runtime-iterable array of all tool names */
export const TOOL_NAMES: readonly ToolName[] = [
  'llm_call',
  'fetch_url',
  'write_file',
] as const;

/**
 * Base schema for all tool invocation requests.
 * Extended by each specific tool request schema.
 */
export const toolInvocationRequestBaseSchema = z.object({
  botId: z.uuid(),
  executionId: z.uuid(),
  toolName: z.string(),
  invocationId: z.uuid(),
  timestamp: z.iso.datetime(),
});

/**
 * Base schema for all tool invocation responses.
 * Extended by each specific tool response schema.
 */
export const toolInvocationResponseBaseSchema = z.object({
  invocationId: z.uuid(),
  success: z.boolean(),
  durationMs: z.number().int().nonnegative(),
  error: z.string().optional(),
});

export type ToolInvocationRequestBase = z.infer<typeof toolInvocationRequestBaseSchema>;
export type ToolInvocationResponseBase = z.infer<typeof toolInvocationResponseBaseSchema>;
