import {
  createPostSchema,
  patchPostSchema,
  revisionSchema,
  validationDetails,
  type AdminPost,
  type CreatePostInput,
  type PatchPostInput,
  type PostCommand,
  type RevisionInput,
} from '#lib/admin/contracts.ts';
import { and, eq, isNotNull, isNull, ne, or, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type { z } from 'zod';
import { AdminApiError } from '../admin/errors';
import type { BlogDb } from '../db';
import { posts } from '../db/schema';
import { getPost } from './read';
import { normalizeSlug, slugCandidate } from './slug';

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

function alreadySatisfied(post: AdminPost, command: PostCommand): boolean {
  if (command === 'delete') return post.deleted_at !== null;
  if (command === 'restore') return post.deleted_at === null;
  if (post.deleted_at !== null) invalidState();
  if (command === 'archive' && post.status === 'draft') invalidState();
  return post.status === (command === 'publish' ? 'published' : 'archived');
}

/** Drizzle wraps binding errors in cause; retry only the posts.slug constraint. */
function isSlugCollision(error: unknown): boolean {
  const seen = new Set<unknown>();
  while (error instanceof Error && !seen.has(error)) {
    seen.add(error);
    if (/UNIQUE constraint failed: posts\.slug(?:$|:)/.test(error.message))
      return true;
    error = error.cause;
  }
  return false;
}

export async function commandPost(
  db: BlogDb,
  id: string,
  command: PostCommand,
  input: RevisionInput,
): Promise<AdminPost> {
  const { expected_revision } = validated(revisionSchema, input);
  const post = await currentPost(db, id);
  if (alreadySatisfied(post, command)) return post;
  requireRevision(post, expected_revision);
  const firstPublication = command === 'publish' && post.status === 'draft';
  const base = firstPublication ? normalizeSlug(post.title) : '';
  if (firstPublication && !base)
    throw new AdminApiError(
      400,
      'VALIDATION_ERROR',
      'Title cannot produce a publication slug.',
      [
        {
          path: ['title'],
          message:
            'Title must contain a letter, number or plus sign for publication.',
        },
      ],
    );

  for (let attempt = 1; ; attempt++) {
    const timestamp = new Date().toISOString();
    let changed: AdminPost | undefined;
    try {
      [changed] = await db
        .update(posts)
        .set({
          status:
            command === 'publish'
              ? 'published'
              : command === 'archive'
                ? 'archived'
                : post.status,
          slug: firstPublication ? slugCandidate(base, attempt) : undefined,
          published_at: firstPublication ? timestamp : undefined,
          deleted_at:
            command === 'delete'
              ? timestamp
              : command === 'restore'
                ? null
                : undefined,
          revision: sql`${posts.revision} + 1`,
          updated_at: timestamp,
        })
        .where(
          and(
            eq(posts.id, id),
            eq(posts.revision, expected_revision),
            eq(posts.status, post.status),
            command === 'restore'
              ? isNotNull(posts.deleted_at)
              : isNull(posts.deleted_at),
          ),
        )
        .returning();
    } catch (error) {
      if (firstPublication && isSlugCollision(error)) continue;
      throw error;
    }
    if (changed) return changed;
    const current = await currentPost(db, id);
    if (alreadySatisfied(current, command)) return current;
    requireRevision(current, expected_revision);
    // A permitted unchanged-revision row cannot miss the guarded UPDATE.
    throw new AdminApiError(
      409,
      'POST_VERSION_CONFLICT',
      'Post changed during the operation.',
    );
  }
}
