import {
  createPostSchema,
  patchPostSchema,
  validationDetails,
  type AdminPost,
  type CreatePostInput,
  type PatchPostInput,
} from '$lib/admin/contracts';
import { and, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type { z } from 'zod';
import { AdminApiError } from '../admin/errors';
import type { BlogDb } from '../db';
import { posts } from '../db/schema';
import { getPost } from './read';

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

async function currentPost(db: BlogDb, id: string): Promise<AdminPost> {
  const post = await getPost(db, id);
  if (!post) throw new AdminApiError(404, 'POST_NOT_FOUND', 'Post not found.');
  return post;
}

function invalidState(): never {
  throw new AdminApiError(
    409,
    'INVALID_POST_STATE',
    'Operation is not allowed in the current post state.',
  );
}

function requireRevision(post: AdminPost, expected: number): void {
  if (post.revision !== expected)
    throw new AdminApiError(
      409,
      'POST_VERSION_CONFLICT',
      'Post has changed since it was loaded.',
    );
}

export async function savePost(
  db: BlogDb,
  id: string,
  input: PatchPostInput,
): Promise<AdminPost> {
  const { title, body, expected_revision } = validated(patchPostSchema, input);
  const [changed] = await db
    .update(posts)
    .set({
      title,
      body,
      revision: sql`${posts.revision} + 1`,
      updated_at: new Date().toISOString(),
    })
    .where(
      and(
        eq(posts.id, id),
        eq(posts.revision, expected_revision),
        isNull(posts.deleted_at),
        or(
          eq(posts.status, 'draft'),
          eq(posts.status, 'published'),
          eq(posts.status, 'archived'),
        ),
        or(
          title === undefined ? undefined : ne(posts.title, title),
          body === undefined ? undefined : ne(posts.body, body),
        ),
      ),
    )
    .returning();
  if (changed) return changed;
  const post = await currentPost(db, id);
  if (post.deleted_at !== null) invalidState();
  requireRevision(post, expected_revision);
  return post;
}
