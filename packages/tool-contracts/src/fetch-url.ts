import { z } from 'zod';
import { toolInvocationRequestBaseSchema, toolInvocationResponseBaseSchema } from './common';

/** Request schema for the fetch_url tool */
export const fetchUrlRequestSchema = toolInvocationRequestBaseSchema.extend({
  toolName: z.literal('fetch_url'),
  args: z.object({
    url: z.url(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.string().optional(),
  }),
});

/** Response schema for the fetch_url tool */
export const fetchUrlResponseSchema = toolInvocationResponseBaseSchema.extend({
  result: z.object({
    statusCode: z.number().int(),
    headers: z.record(z.string(), z.string()),
    body: z.string(),
    truncated: z.boolean(),
  }).optional(),
});

export type FetchUrlRequest = z.infer<typeof fetchUrlRequestSchema>;
export type FetchUrlResponse = z.infer<typeof fetchUrlResponseSchema>;
