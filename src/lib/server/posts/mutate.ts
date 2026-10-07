import {
  createPostSchema,
  validationDetails,
  type AdminPost,
  type CreatePostInput,
} from '$lib/admin/contracts';
import { v7 as uuidv7 } from 'uuid';
import type { z } from 'zod';
import { AdminApiError } from '../admin/errors';
import type { BlogDb } from '../db';
import { posts } from '../db/schema';

function validated<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AdminApiError(
      400,
      'VALIDATION_ERROR',
      'Request validation failed.',
      validationDetails(result.error),
    );
  return result.data;
}

export async function createPost(
  db: BlogDb,
  input: CreatePostInput,
): Promise<AdminPost> {
  const content = validated(createPostSchema, input);
  const [post] = await db
    .insert(posts)
    .values({
      id: uuidv7(),
      title: content.title,
      body: content.body,
      status: 'draft',
      revision: 1,
      slug: null,
      published_at: null,
      deleted_at: null,
    })
    .returning();
  return post;
}
