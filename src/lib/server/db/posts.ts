import { asc, desc, eq, isNull } from 'drizzle-orm';

import type { PostContent, PostStatus } from '../posts/domain';
import { getDb } from './index';
import { categories, posts, tags } from './schema';

type PostWrite = PostContent & { id: string; status: PostStatus };
type PostWriteResult = 'saved' | 'conflict' | 'category';

export function listCategories(d1: D1Database) {
  return getDb(d1).select().from(categories).orderBy(asc(categories.name));
}

export async function createCategory(d1: D1Database, name: string) {
  const [category] = await getDb(d1)
    .insert(categories)
    .values({ name })
    .onConflictDoNothing({ target: categories.name })
    .returning({ id: categories.id });
  return category?.id;
}

export async function renameCategory(d1: D1Database, id: number, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return 'invalid';
  try {
    const result = await d1
      .prepare('UPDATE categories SET name = ? WHERE id = ?')
      .bind(trimmed, id)
      .run();
    return result.meta.changes === 1 ? 'renamed' : 'missing';
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('UNIQUE constraint failed: categories.name')
    )
      return 'duplicate';
    throw error;
  }
}

export async function removeCategory(d1: D1Database, id: number) {
  try {
    const result = await d1
      .prepare('DELETE FROM categories WHERE id = ?')
      .bind(id)
      .run();
    return result.meta.changes === 1 ? 'deleted' : 'missing';
  } catch (error) {
    if (isForeignKeyConstraint(error)) return 'inUse';
    throw error;
  }
}

export function listPosts(d1: D1Database) {
  return getDb(d1)
    .select({
      id: posts.id,
      title: posts.title,
      status: posts.status,
      categoryName: categories.name,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .innerJoin(categories, eq(posts.categoryId, categories.id))
    .where(isNull(posts.deletedAt))
    .orderBy(desc(posts.updatedAt), desc(posts.id));
}

export async function getPost(d1: D1Database, id: string) {
  const db = getDb(d1);
  const [[post], tagRows] = await db.batch([
    db.select().from(posts).where(eq(posts.id, id)),
    db
      .select({ name: tags.name })
      .from(tags)
      .where(eq(tags.postId, id))
      .orderBy(asc(tags.name)),
  ]);
  if (!post || post.deletedAt !== null) return undefined;
  return { ...post, tags: tagRows.map(({ name }) => name) };
}

function isForeignKeyConstraint(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes('FOREIGN KEY constraint failed')
  );
}

export async function createPost(
  d1: D1Database,
  post: PostWrite & { status: 'draft' | 'published' },
  now = new Date(),
): Promise<PostWriteResult> {
  const { id, title, body, status, categoryId, tags: names } = post;
  const timestamp = now.getTime();
  try {
    await d1.batch([
      d1
        .prepare(
          `INSERT INTO posts
        (id, title, body, status, category_id, created_at, updated_at, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          title,
          body,
          status,
          categoryId,
          timestamp,
          timestamp,
          status === 'published' ? timestamp : null,
        ),
      d1
        .prepare(
          'INSERT INTO tags (post_id, name) SELECT ?, value FROM json_each(?)',
        )
        .bind(id, JSON.stringify(names)),
    ]);
    return 'saved';
  } catch (error) {
    if (isForeignKeyConstraint(error)) return 'category';
    if (
      !(error instanceof Error) ||
      !error.message.includes('UNIQUE constraint failed: posts.id')
    )
      throw error;
    const existing = await getPost(d1, id);
    return existing?.version === 1 &&
      existing.title === title &&
      existing.body === body &&
      existing.status === status &&
      existing.categoryId === categoryId &&
      JSON.stringify(existing.tags) === JSON.stringify([...names].sort())
      ? 'saved'
      : 'conflict';
  }
}

export async function updatePost(
  d1: D1Database,
  post: PostWrite & { version: number },
  now = new Date(),
): Promise<PostWriteResult> {
  const { id, version, title, body, status, categoryId, tags: names } = post;
  const timestamp = now.getTime();
  const currentVersion = 'id = ? AND version = ? AND deleted_at IS NULL';
  const currentPost = `EXISTS (SELECT 1 FROM posts WHERE ${currentVersion})`;
  try {
    // Advance the version last so all three statements use the same guard.
    const [, , updated] = await d1.batch([
      d1
        .prepare(`DELETE FROM tags WHERE post_id = ? AND ${currentPost}`)
        .bind(id, id, version),
      d1
        .prepare(
          `INSERT INTO tags (post_id, name)
        SELECT ?, value FROM json_each(?) WHERE ${currentPost}`,
        )
        .bind(id, JSON.stringify(names), id, version),
      d1
        .prepare(
          `UPDATE posts SET title = ?, body = ?, status = ?, category_id = ?,
        published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END,
        updated_at = ?, version = version + 1 WHERE ${currentVersion}`,
        )
        .bind(
          title,
          body,
          status,
          categoryId,
          status,
          timestamp,
          timestamp,
          id,
          version,
        ),
    ]);
    return updated.meta.changes === 1 ? 'saved' : 'conflict';
  } catch (error) {
    if (isForeignKeyConstraint(error)) return 'category';
    throw error;
  }
}
