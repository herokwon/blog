import { z } from 'zod';
import { API_ERROR_CODES } from './error-codes';

export { API_ERROR_CODES, type ApiErrorCode } from './error-codes';
export const postStatusSchema = z.enum(['draft', 'published', 'archived']);
export const postIdSchema = z.uuidv7();
const titleSchema = z
  .string()
  .refine(
    value => value.trim().length > 0,
    'Title must contain a non-whitespace character.',
  );
const bodySchema = z.string().min(1);
const positiveInteger = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
const timestampSchema = z.iso.datetime({ precision: 3 });

export const createPostSchema = z.strictObject({
  title: titleSchema,
  body: bodySchema,
});
export const revisionSchema = z.strictObject({
  expected_revision: positiveInteger,
});
export const patchPostSchema = revisionSchema
  .extend({
    title: titleSchema.optional(),
    body: bodySchema.optional(),
  })
  .refine(
    value => value.title !== undefined || value.body !== undefined,
    'At least one editable field is required.',
  );

// Query strings use decimal notation only; generic coercion also accepts booleans,
// empty strings and exponent notation, none of which are query integers.
const queryInteger = z.union([
  positiveInteger,
  z.string().regex(/^\d+$/).transform(Number).pipe(positiveInteger),
]);
const paginationShape = {
  page: queryInteger.default(1),
  limit: queryInteger.pipe(z.number().max(100)).default(20),
};
const safeOffset = (query: { page: number; limit: number }) =>
  Number.isSafeInteger((query.page - 1) * query.limit);
export const adminListQuerySchema = z
  .strictObject({ ...paginationShape, status: postStatusSchema.optional() })
  .refine(safeOffset, 'Pagination offset is outside the safe integer range.');
export const trashListQuerySchema = z
  .strictObject(paginationShape)
  .refine(safeOffset, 'Pagination offset is outside the safe integer range.');

export const adminPostListItemSchema = z.strictObject({
  id: postIdSchema,
  slug: z.string().min(1).nullable(),
  title: titleSchema,
  status: postStatusSchema,
  revision: positiveInteger,
  created_at: timestampSchema,
  published_at: timestampSchema.nullable(),
  updated_at: timestampSchema,
  deleted_at: timestampSchema.nullable(),
});
export const adminPostSchema = adminPostListItemSchema.extend({
  body: bodySchema,
});
export const adminPostPageSchema = z.strictObject({
  items: z.array(adminPostListItemSchema),
  page: positiveInteger,
  limit: positiveInteger.max(100),
  totalItems: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  totalPages: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
export const validationDetailSchema = z.strictObject({
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
});
export const apiErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: z.enum(API_ERROR_CODES),
    message: z.string(),
    details: z.array(validationDetailSchema).optional(),
  }),
});

/** Only paths and human-readable messages cross the HTTP validation boundary. */
export function validationDetails(error: z.ZodError): ValidationDetail[] {
  return error.issues.flatMap(issue => {
    const path = issue.path.filter(
      (part): part is string | number =>
        typeof part === 'string' || typeof part === 'number',
    );
    return issue.code === 'unrecognized_keys'
      ? issue.keys.map(key => ({
          path: [...path, key],
          message: 'This field is not allowed.',
        }))
      : [{ path, message: issue.message }];
  });
}

export type PostStatus = z.infer<typeof postStatusSchema>;
export type AdminPostListItem = z.infer<typeof adminPostListItemSchema>;
export type AdminPost = z.infer<typeof adminPostSchema>;
export type AdminPostPage = z.infer<typeof adminPostPageSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type PatchPostInput = z.infer<typeof patchPostSchema>;
export type RevisionInput = z.infer<typeof revisionSchema>;
export type AdminListQuery = z.infer<typeof adminListQuerySchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
export type ValidationDetail = z.infer<typeof validationDetailSchema>;
export type AdminListScope = 'normal' | 'trash';
export type PostCommand = 'publish' | 'archive' | 'delete' | 'restore';
export type AuthoringInput = CreatePostInput;
