import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

import { postStatuses } from '../posts/domain';

const currentEpochMs = sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`;

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
});

export const posts = sqliteTable(
  'posts',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    status: text('status', { enum: postStatuses }).notNull(),
    version: integer('version').notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(currentEpochMs),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(currentEpochMs),
    publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  },
  table => [
    check(
      'posts_status',
      sql`${table.status} IN ('draft', 'published', 'archived')`,
    ),
    check(
      'posts_publication_time',
      sql`(${table.status} = 'draft') = (${table.publishedAt} IS NULL)`,
    ),
    index('posts_category_id').on(table.categoryId),
    index('posts_list_order').on(table.deletedAt, table.updatedAt, table.id),
  ],
);

export const tags = sqliteTable(
  'tags',
  {
    postId: text('post_id')
      .notNull()
      .references(() => posts.id),
    name: text('name').notNull(),
  },
  table => [primaryKey({ columns: [table.postId, table.name] })],
);
