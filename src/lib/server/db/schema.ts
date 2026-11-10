import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
// ECMAScript String.trim whitespace, so database and later form validation agree.
const whitespace = sql`char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279)`;

export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
  },
  table => [
    check(
      'categories_name',
      sql`length(${table.name}) BETWEEN 1 AND 20 AND ${table.name} = trim(${table.name}, ${whitespace}) AND instr(${table.name}, char(0)) = 0`,
    ),
  ],
);

export const legacyTags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
  },
  table => [
    check(
      'tags_name',
      sql`length(${table.name}) BETWEEN 1 AND 40 AND ${table.name} = trim(${table.name}, ${whitespace}) AND instr(${table.name}, char(0)) = 0`,
    ),
  ],
);

export const posts = sqliteTable(
  'posts',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull().default(''),
    body: text('body').notNull().default(''),
    status: text('status', { enum: ['draft', 'published', 'archived'] })
      .notNull()
      .default('draft'),
    slug: text('slug'),
    categoryId: text('category_id').references(() => categories.id, {
      onDelete: 'restrict',
    }),
    createdAt: text('created_at').notNull().default(now),
    publishedAt: text('published_at'),
    updatedAt: text('updated_at').notNull().default(now),
    deletedAt: text('deleted_at'),
    revision: text('revision').notNull(),
  },
  table => [
    uniqueIndex('posts_slug_unique').on(table.slug),
    index('posts_category').on(table.categoryId),
    index('posts_admin_list').on(
      table.deletedAt,
      table.status,
      table.updatedAt,
      table.id,
    ),
    index('posts_public_list')
      .on(table.publishedAt, table.id)
      .where(sql`${table.status} = 'published' AND ${table.deletedAt} IS NULL`),
    check(
      'posts_status',
      sql`${table.status} IN ('draft', 'published', 'archived')`,
    ),
    check(
      'posts_title_length',
      sql`length(${table.title}) <= 200 AND instr(${table.title}, char(0)) = 0`,
    ),
    check(
      'posts_body_size',
      sql`length(cast(${table.body} AS blob)) <= 1048576 AND instr(${table.body}, char(0)) = 0`,
    ),
    check(
      'posts_slug_format',
      sql`${table.slug} IS NULL OR (length(${table.slug}) BETWEEN 1 AND 120 AND ${table.slug} NOT GLOB '*[^a-z0-9-]*' AND ${table.slug} NOT LIKE '-%' AND ${table.slug} NOT LIKE '%-' AND instr(${table.slug}, '--') = 0 AND instr(${table.slug}, char(0)) = 0)`,
    ),
    check(
      'posts_publication',
      sql`(${table.status} = 'draft' AND ${table.publishedAt} IS NULL) OR (${table.status} IN ('published', 'archived') AND ${table.publishedAt} IS NOT NULL AND ${table.slug} IS NOT NULL AND ${table.categoryId} IS NOT NULL AND length(trim(${table.title}, ${whitespace})) > 0 AND length(trim(${table.body}, ${whitespace})) > 0)`,
    ),
    check(
      'posts_trash',
      sql`${table.deletedAt} IS NULL OR ${table.status} <> 'published'`,
    ),
  ],
);

export const legacyPostTags = sqliteTable(
  'post_tags',
  {
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'restrict' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => legacyTags.id, { onDelete: 'restrict' }),
  },
  table => [
    primaryKey({ columns: [table.postId, table.tagId] }),
    index('post_tags_tag').on(table.tagId),
  ],
);

export const attachments = sqliteTable(
  'attachments',
  {
    id: text('id').primaryKey(),
    objectKey: text('object_key').notNull().unique(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    createdAt: text('created_at').notNull().default(now),
  },
  table => [
    check(
      'attachments_type',
      sql`${table.contentType} IN ('image/jpeg', 'image/png', 'image/gif', 'image/webp')`,
    ),
    check('attachments_size', sql`${table.size} BETWEEN 1 AND 10485760`),
  ],
);

export const postAttachments = sqliteTable(
  'post_attachments',
  {
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'restrict' }),
    attachmentId: text('attachment_id')
      .notNull()
      .references(() => attachments.id, { onDelete: 'restrict' }),
  },
  table => [
    primaryKey({ columns: [table.postId, table.attachmentId] }),
    index('post_attachments_attachment').on(table.attachmentId),
  ],
);

// Legacy tables remain during the migration-to-activation overlap (ADR 0005).
export const postTags = sqliteTable(
  'post_owned_tags',
  {
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    position: integer('position').notNull(),
  },
  table => [
    primaryKey({ columns: [table.postId, table.name] }),
    check(
      'post_owned_tags_name',
      sql`length(${table.name}) BETWEEN 1 AND 40 AND ${table.name} = trim(${table.name}, ${whitespace}) AND instr(${table.name}, char(0)) = 0`,
    ),
    check('post_owned_tags_position', sql`${table.position} >= 0`),
  ],
);
