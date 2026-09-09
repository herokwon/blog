import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const paginationSchema = z.strictObject({
  cursor: z.string().min(1).optional(),
  limit: z.int().min(1).optional(),
});

export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().min(1).nullable(),
  });

export type Pagination = z.infer<typeof paginationSchema>;
export type PaginatedResponse<T extends z.ZodType> = z.infer<
  typeof paginatedResponseSchema<T>
>;
