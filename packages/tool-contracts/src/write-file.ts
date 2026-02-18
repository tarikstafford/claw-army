import { z } from 'zod';
import { toolInvocationRequestBaseSchema, toolInvocationResponseBaseSchema } from './common';

/** Request schema for the write_file tool */
export const writeFileRequestSchema = toolInvocationRequestBaseSchema.extend({
  toolName: z.literal('write_file'),
  args: z.object({
    path: z.string(),
    content: z.string(),
    encoding: z.enum(['utf-8', 'base64']).default('utf-8'),
  }),
});

/** Response schema for the write_file tool */
export const writeFileResponseSchema = toolInvocationResponseBaseSchema.extend({
  result: z.object({
    artifactId: z.uuid(),
    path: z.string(),
    sizeBytes: z.number().int().nonnegative(),
  }).optional(),
});

export type WriteFileRequest = z.infer<typeof writeFileRequestSchema>;
export type WriteFileResponse = z.infer<typeof writeFileResponseSchema>;
