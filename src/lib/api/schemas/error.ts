import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'CONTENT_NOT_FOUND',
  'INVALID_CONTENT_STATE',
  'SLUG_CONFLICT',
  'INTERNAL_ERROR',
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);

export const validationIssueSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string().min(1),
});

export const errorResponseSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string().min(1),
    details: z.array(validationIssueSchema),
  }),
});

export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
