import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  contentIdSchema,
  contentStatusSchema,
  slugSchema,
  timestampSchema,
} from './common';

extendZodWithOpenApi(z);

const titleSchema = z.string().trim().min(1);
const bodySchema = z.string().refine(value => value.trim().length > 0);

export const contentSchema = z.object({
  id: contentIdSchema,
  status: contentStatusSchema,
  slug: slugSchema.nullable(),
  title: titleSchema,
  body: bodySchema,
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
  })
  .openapi({
    anyOf: [
      {
        required: ['title'],
      },
      {
        required: ['body'],
      },
    ],
  });

export const contentResponseSchema = contentSchema;

export type Content = z.infer<typeof contentSchema>;
export type CreateContentRequest = z.infer<typeof createContentRequestSchema>;
export type UpdateContentRequest = z.infer<typeof updateContentRequestSchema>;
export type ContentResponse = z.infer<typeof contentResponseSchema>;
