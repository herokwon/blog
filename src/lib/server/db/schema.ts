import { CONTENT_STATUS } from '$lib/api/schemas';

import { sql } from 'drizzle-orm';
import {
  check,
  index,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const content = sqliteTable(
  'content',
  {
    id: text('id').primaryKey(),
    status: text('status', {
      enum: CONTENT_STATUS,
    }).notNull(),
    slug: text('slug'),
    title: text('title').notNull(),
    body: text('body').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    publishedAt: text('published_at'),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    deletedAt: text('deleted_at'),
  },
  table => [
    check(
      'content_id_uuidv7_check',
      sql`
        length(${table.id}) = 36
        AND ${table.id} NOT GLOB '*[^0-9A-Fa-f-]*'
        AND substr(${table.id}, 9, 1) = '-'
        AND substr(${table.id}, 14, 1) = '-'
        AND substr(${table.id}, 19, 1) = '-'
        AND substr(${table.id}, 24, 1) = '-'
        AND substr(${table.id}, 15, 1) = '7'
        AND substr(${table.id}, 20, 1) GLOB '[89ABab]'
      `,
    ),
    check(
      'content_status_check',
      sql`${table.status} IN (${sql.join(
        CONTENT_STATUS.map(status => sql.raw(`'${status}'`)),
        sql`, `,
      )})`,
    ),
    uniqueIndex('content_slug_unique').on(table.slug),
    index('content_admin_order_idx').on(
      table.deletedAt,
      table.updatedAt,
      table.id,
    ),
  ],
);
