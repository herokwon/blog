import { desc, sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

export const task = sqliteTable('task', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  priority: integer('priority').notNull().default(1),
});

const insertionTimestamp = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const posts = sqliteTable(
  'posts',
  {
    id: text('id').notNull().primaryKey(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    status: text('status', { enum: ['draft', 'published', 'archived'] })
      .notNull()
      .default('draft'),
    slug: text('slug').unique(),
    created_at: text('created_at').notNull().default(insertionTimestamp),
    published_at: text('published_at'),
    updated_at: text('updated_at').notNull().default(insertionTimestamp),
    deleted_at: text('deleted_at'),
    revision: integer('revision').notNull().default(1),
  },
  table => [
    check('posts_title_nonempty', sql`${table.title} <> ''`),
    check('posts_body_nonempty', sql`${table.body} <> ''`),
    check(
      'posts_status_valid',
      sql`${table.status} IN ('draft', 'published', 'archived')`,
    ),
    check(
      'posts_revision_valid',
      sql`typeof(${table.revision}) = 'integer' AND ${table.revision} > 0`,
    ),
    check(
      'posts_publication_history_valid',
      sql`(${table.status} = 'draft' AND ${table.slug} IS NULL AND ${table.published_at} IS NULL)
        OR (${table.status} IN ('published', 'archived') AND ${table.slug} IS NOT NULL AND ${table.published_at} IS NOT NULL)`,
    ),
    index('posts_admin_updated_idx')
      .on(desc(table.updated_at), desc(table.id))
      .where(sql`${table.deleted_at} IS NULL`),
    index('posts_admin_status_updated_idx')
      .on(table.status, desc(table.updated_at), desc(table.id))
      .where(sql`${table.deleted_at} IS NULL`),
    index('posts_trash_updated_idx')
      .on(desc(table.updated_at), desc(table.id))
      .where(sql`${table.deleted_at} IS NOT NULL`),
  ],
);
