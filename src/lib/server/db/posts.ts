import { and, asc, desc, eq, isNotNull, isNull, ne } from 'drizzle-orm';
import { imageReferences, MediaError } from '../media.js';
import { getDb } from './index.js';
import { categories, posts, postTags, tags } from './schema.js';

export type PostInput = {
  title: string;
  body: string;
  slug: string;
  categoryId: string;
  tags: string[];
};
export type PostAction =
  'create' | 'save' | 'publish' | 'archive' | 'republish' | 'trash' | 'restore';
export type PostFilter = 'all' | 'draft' | 'published' | 'archived' | 'trash';
export type PostConflictCode =
  'stale_revision' | 'slug_reserved' | 'category_missing' | 'write_conflict';

type PostResult =
  | { ok: true; id: string; revision: string }
  | {
      ok: false;
      status: 400 | 404 | 409;
      message: string;
      code?: PostConflictCode;
    };
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const validSlug = (slug: string) =>
  slug.length <= 120 && slugPattern.test(slug);
const bad = (message: string): PostResult => ({
  ok: false,
  status: 400,
  message,
});
const conflict = (code: PostConflictCode): PostResult => ({
  ok: false,
  status: 409,
  code,
  message: {
    stale_revision:
      'The post changed. Your input has been kept. Export it before reloading the latest saved post.',
    slug_reserved:
      'The slug is already reserved. Choose another slug and retry.',
    category_missing:
      'The category no longer exists. Choose another category and retry.',
    write_conflict:
      'The post could not be updated because a referenced item changed. Your input has been kept.',
  }[code],
});

// RFC 9562: 48-bit millisecond timestamp, version 7, random remainder and RFC variant.
function uuidv7() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let timestamp = Date.now();
  for (let index = 5; index >= 0; index--) {
    bytes[index] = timestamp % 256;
    timestamp = Math.floor(timestamp / 256);
  }
  bytes[6] = (bytes[6] & 15) | 112;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, value =>
    value.toString(16).padStart(2, '0'),
  ).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function getPost(d1: D1Database, id: string) {
  const db = getDb(d1);
  const [rows, names] = await db.batch([
    db.select().from(posts).where(eq(posts.id, id)),
    db
      .select({ name: tags.name })
      .from(tags)
      .innerJoin(postTags, eq(tags.id, postTags.tagId))
      .where(eq(postTags.postId, id))
      .orderBy(asc(tags.name)),
  ]);
  return rows[0] ? { ...rows[0], tags: names.map(tag => tag.name) } : null;
}

export async function listPosts(
  d1: D1Database,
  filter: PostFilter = 'all',
  page = 1,
) {
  const rows = await getDb(d1)
    .select({
      id: posts.id,
      title: posts.title,
      status: posts.status,
      updatedAt: posts.updatedAt,
      deletedAt: posts.deletedAt,
      category: categories.name,
    })
    .from(posts)
    .leftJoin(categories, eq(posts.categoryId, categories.id))
    .where(
      filter === 'trash'
        ? isNotNull(posts.deletedAt)
        : and(
            isNull(posts.deletedAt),
            filter === 'all' ? undefined : eq(posts.status, filter),
          ),
    )
    .orderBy(desc(posts.updatedAt), desc(posts.id))
    .limit(21)
    .offset((page - 1) * 20);
  return { posts: rows.slice(0, 20), hasNext: rows.length > 20 };
}

export async function editorOptions(d1: D1Database) {
  const db = getDb(d1);
  const [categoryRows, tagRows] = await db.batch([
    db.select().from(categories).orderBy(asc(categories.name)),
    db.select({ name: tags.name }).from(tags).orderBy(asc(tags.name)),
  ]);
  return { categories: categoryRows, tags: tagRows.map(tag => tag.name) };
}

export async function slugAvailability(
  d1: D1Database,
  slug: string,
  postId?: string,
) {
  if (!validSlug(slug)) return { valid: false, available: false };
  const rows = await getDb(d1)
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.slug, slug), postId ? ne(posts.id, postId) : undefined))
    .limit(1);
  return { valid: true, available: rows.length === 0 };
}

export async function mutatePost(
  d1: D1Database,
  command: {
    action: PostAction;
    id?: string;
    revision?: string;
    input?: PostInput;
  },
): Promise<PostResult> {
  const { action, input } = command;
  const existing = command.id ? await getPost(d1, command.id) : null;
  const creating = !command.id && (action === 'create' || action === 'publish');
  if (!creating && !existing)
    return { ok: false, status: 404, message: 'Post not found.' };
  if (existing && existing.revision !== command.revision)
    return conflict('stale_revision');
  if (existing?.deletedAt && action !== 'restore')
    return bad('Trashed posts are read-only. Restore this post first.');
  if (action === 'create' && !creating) return bad('This post already exists.');
  if (action === 'publish' && existing && existing.status !== 'draft')
    return bad('Only drafts can be published.');
  if (action === 'archive' && existing?.status !== 'published')
    return bad('Only published posts can be archived.');
  if (action === 'republish' && existing?.status !== 'archived')
    return bad('Only archived posts can be republished.');
  if (action === 'restore' && !existing?.deletedAt)
    return bad('Only trashed posts can be restored.');

  const writingContent =
    action === 'create' ||
    action === 'save' ||
    action === 'publish' ||
    action === 'republish';
  let normalizedTags: string[] = [];
  if (writingContent) {
    if (!input) return bad('Post input is required.');
    normalizedTags = [
      ...new Set(input.tags.map(tag => tag.trim()).filter(Boolean)),
    ];
    if ([...input.title].length > 200 || input.title.includes('\0'))
      return bad('Title must be at most 200 characters.');
    if (
      new TextEncoder().encode(input.body).length > 1_048_576 ||
      input.body.includes('\0')
    )
      return bad(
        'Markdown must be at most 1 MiB and contain no NUL characters.',
      );
    if (input.slug && !validSlug(input.slug))
      return bad(
        'Slug must use lowercase letters, digits and single separating hyphens, at most 120 characters.',
      );
    if (existing?.publishedAt && input.slug !== existing.slug)
      return bad('The slug cannot change after first publication.');
    if (
      normalizedTags.length > 20 ||
      normalizedTags.some(tag => [...tag].length > 40 || tag.includes('\0'))
    )
      return bad('Use at most 20 tags, each with 1–40 characters.');
  }
  let imageIds: string[] = [];
  if (writingContent && input) {
    try {
      imageIds = imageReferences(input.body);
    } catch (cause) {
      if (cause instanceof MediaError) return bad(cause.message);
      throw cause;
    }
    if (imageIds.length) {
      const count = await d1
        .prepare(
          'SELECT count(*) AS count FROM attachments WHERE id IN (SELECT value FROM json_each(?))',
        )
        .bind(JSON.stringify(imageIds))
        .first<number>('count');
      if (count !== imageIds.length)
        return bad('One or more referenced images do not exist.');
    }
  }
  const imageIdsJson = JSON.stringify(imageIds);
  const status =
    action === 'publish' || action === 'republish'
      ? 'published'
      : action === 'archive' ||
          (action === 'trash' && existing?.status === 'published')
        ? 'archived'
        : (existing?.status ?? 'draft');
  if (
    writingContent &&
    input &&
    status !== 'draft' &&
    (!input.title.trim() ||
      !input.body.trim() ||
      !input.slug ||
      !input.categoryId)
  )
    return bad('Publication requires a title, Markdown, slug and category.');

  const id = existing?.id ?? uuidv7();
  const revision = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const title = writingContent ? input!.title : existing!.title;
  const body = writingContent ? input!.body : existing!.body;
  const slug = writingContent ? input!.slug || null : existing!.slug;
  const categoryId = writingContent
    ? input!.categoryId || null
    : existing!.categoryId;
  const publishedAt =
    existing?.publishedAt ?? (status === 'published' ? timestamp : null);
  const deletedAt =
    action === 'trash'
      ? timestamp
      : action === 'restore'
        ? null
        : (existing?.deletedAt ?? null);
  const constraints =
    '(? IS NULL OR EXISTS (SELECT 1 FROM categories WHERE id = ?)) AND (? IS NULL OR NOT EXISTS (SELECT 1 FROM posts WHERE slug = ? AND id <> ?)) AND NOT EXISTS (SELECT 1 FROM json_each(?) requested WHERE NOT EXISTS (SELECT 1 FROM attachments WHERE attachments.id = requested.value))';
  const values = [
    title,
    body,
    slug,
    categoryId,
    status,
    publishedAt,
    deletedAt,
    revision,
  ];
  const parent = creating
    ? d1
        .prepare(
          `INSERT INTO posts (id, title, body, slug, category_id, status, published_at, deleted_at, revision) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${constraints} RETURNING id`,
        )
        .bind(
          id,
          ...values,
          categoryId,
          categoryId,
          slug,
          slug,
          id,
          imageIdsJson,
        )
    : d1
        .prepare(
          `UPDATE posts SET title = ?, body = ?, slug = ?, category_id = ?, status = ?, published_at = ?, deleted_at = ?, revision = ?, updated_at = ? WHERE id = ? AND revision = ? AND ${constraints} RETURNING id`,
        )
        .bind(
          ...values,
          timestamp,
          id,
          command.revision!,
          categoryId,
          categoryId,
          slug,
          slug,
          id,
          imageIdsJson,
        );
  const statements = [parent];
  if (writingContent) {
    // A zero-row stale parent update is not a SQL error. Every child write must
    // explicitly require the new opaque revision from THIS successful mutation.
    const guard = 'EXISTS (SELECT 1 FROM posts WHERE id = ? AND revision = ?)';
    for (const name of normalizedTags)
      statements.push(
        d1
          .prepare(
            `INSERT INTO tags (id, name) SELECT ?, ? WHERE ${guard} ON CONFLICT(name) DO NOTHING`,
          )
          .bind(crypto.randomUUID(), name, id, revision),
      );
    statements.push(
      d1
        .prepare(`DELETE FROM post_tags WHERE post_id = ? AND ${guard}`)
        .bind(id, id, revision),
    );
    for (const name of normalizedTags)
      statements.push(
        d1
          .prepare(
            `INSERT INTO post_tags (post_id, tag_id) SELECT ?, id FROM tags WHERE name = ? AND ${guard}`,
          )
          .bind(id, name, id, revision),
      );
    statements.push(
      d1
        .prepare(`DELETE FROM post_attachments WHERE post_id = ? AND ${guard}`)
        .bind(id, id, revision),
    );
    statements.push(
      d1
        .prepare(
          `INSERT INTO post_attachments (post_id, attachment_id) SELECT ?, value FROM json_each(?) WHERE ${guard}`,
        )
        .bind(id, imageIdsJson, id, revision),
    );
  }
  const results = await d1.batch<{ id: string }>(statements);
  if (results[0].results.length) return { ok: true, id, revision };
  // Classify only after the guarded atomic write fails; never renew the client's revision.
  const [current, category, reserved] = await d1.batch<{
    revision?: string;
    id?: string;
  }>([
    d1.prepare('SELECT revision FROM posts WHERE id = ?').bind(id),
    d1.prepare('SELECT id FROM categories WHERE id = ?').bind(categoryId),
    d1
      .prepare('SELECT id FROM posts WHERE slug = ? AND id <> ?')
      .bind(slug, id),
  ]);
  if (!creating && current.results[0]?.revision !== command.revision)
    return conflict('stale_revision');
  if (categoryId && !category.results.length)
    return conflict('category_missing');
  if (slug && reserved.results.length) return conflict('slug_reserved');
  return conflict('write_conflict');
}
