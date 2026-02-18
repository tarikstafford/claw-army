import { z } from 'zod';
import { toolInvocationRequestBaseSchema, toolInvocationResponseBaseSchema } from './common';

/** Schema for a single LLM message (chat format) */
const llmMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

/** Request schema for the llm_call tool */
export const llmCallRequestSchema = toolInvocationRequestBaseSchema.extend({
  toolName: z.literal('llm_call'),
  args: z.object({
    model: z.string(),
    messages: z.array(llmMessageSchema),
    maxTokens: z.number().int().positive().optional(),
    temperature: z.number().min(0).max(2).optional(),
  }),
});

/** Response schema for the llm_call tool */
export const llmCallResponseSchema = toolInvocationResponseBaseSchema.extend({
  result: z.object({
    content: z.string(),
    model: z.string(),
    promptTokens: z.number().int(),
    completionTokens: z.number().int(),
    totalTokens: z.number().int(),
  }).optional(),
});

export type LlmCallRequest = z.infer<typeof llmCallRequestSchema>;
export type LlmCallResponse = z.infer<typeof llmCallResponseSchema>;
