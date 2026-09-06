import { z } from 'zod';

export const CONTENT_STATUS = ['draft', 'published', 'archived'] as const;
export const contentStatusSchema = z.enum(CONTENT_STATUS);

export const contentIdSchema = z.uuidv7();

export const contentIdParamsSchema = z.strictObject({
  id: contentIdSchema,
});

export const slugSchema = z.string().min(1);

export const timestampSchema = z.iso
  .datetime({ offset: false })
  .refine(value => value.endsWith('Z'), {
    message: 'Timestamp must be in UTC',
  });

export type ContentStatus = z.infer<typeof contentStatusSchema>;
export type ContentId = z.infer<typeof contentIdSchema>;
export type ContentIdParams = z.infer<typeof contentIdParamsSchema>;
export type Slug = z.infer<typeof slugSchema>;
export type Timestamp = z.infer<typeof timestampSchema>;
