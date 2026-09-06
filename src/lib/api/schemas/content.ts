import { z } from 'zod';
import {
  contentIdSchema,
  contentStatusSchema,
  slugSchema,
  timestampSchema,
} from './common';

const titleSchema = z.string().trim().min(1);
const bodySchema = z.string().refine(value => value.trim().length > 0);

export const contentSchema = z.object({
  id: contentIdSchema,
  title: titleSchema,
  body: bodySchema,
  status: contentStatusSchema,
  slug: slugSchema.nullable(),
  createdAt: timestampSchema,
  publishedAt: timestampSchema.nullable(),
  updatedAt: timestampSchema,
  deletedAt: timestampSchema.nullable(),
});

export const createContentRequestSchema = z.strictObject({
  title: titleSchema,
  body: bodySchema,
});

export const updateContentRequestSchema = z
  .strictObject({
    title: titleSchema.optional(),
    body: bodySchema.optional(),
  })
  .refine(data => data.title !== undefined || data.body !== undefined, {
    message: 'At least one field is required.',
  });

export const contentResponseSchema = contentSchema;

export type Content = z.infer<typeof contentSchema>;
export type CreateContentRequest = z.infer<typeof createContentRequestSchema>;
export type UpdateContentRequest = z.infer<typeof updateContentRequestSchema>;
export type ContentResponse = z.infer<typeof contentResponseSchema>;
