import { CONTENT_STATUS } from '$lib/api/schemas';

import { env } from 'cloudflare:workers';
import { getTableColumns } from 'drizzle-orm';

import { insertTestContent } from '$lib/test/helpers';
import { getDb } from '.';

describe('[Server/DB] Content Schema', async () => {
  const schema = await import('./schema');
  const columns = getTableColumns(schema.content);

  describe('content Zod schema', () => {
    it('exports the content table', () => {
      expect(schema.content).toBeDefined();
    });

    it('defines all content schema', () => {
      expect(columns).toHaveProperty('id');
      expect(columns).toHaveProperty('status');
      expect(columns).toHaveProperty('slug');
      expect(columns).toHaveProperty('title');
      expect(columns).toHaveProperty('body');
      expect(columns).toHaveProperty('createdAt');
      expect(columns).toHaveProperty('publishedAt');
      expect(columns).toHaveProperty('updatedAt');
      expect(columns).toHaveProperty('deletedAt');
    });

    it('maps content fields to snake_case database columns', () => {
      expect(columns.id.name).toBe('id');
      expect(columns.status.name).toBe('status');
      expect(columns.slug.name).toBe('slug');
      expect(columns.title.name).toBe('title');
      expect(columns.body.name).toBe('body');
      expect(columns.createdAt.name).toBe('created_at');
      expect(columns.publishedAt.name).toBe('published_at');
      expect(columns.updatedAt.name).toBe('updated_at');
      expect(columns.deletedAt.name).toBe('deleted_at');
    });

    it('defines required/nullable columns', () => {
      expect(columns.id.notNull).toBe(true);
      expect(columns.status.notNull).toBe(true);
      expect(columns.slug.notNull).toBe(false);
      expect(columns.title.notNull).toBe(true);
      expect(columns.body.notNull).toBe(true);
      expect(columns.createdAt.notNull).toBe(true);
      expect(columns.publishedAt.notNull).toBe(false);
      expect(columns.updatedAt.notNull).toBe(true);
      expect(columns.deletedAt.notNull).toBe(false);
    });

    it('defines id as primary key', () => {
      expect(columns.id.primary).toBe(true);
    });

    it('restricts status to content lifecycle values', () => {
      expect(columns.status.enumValues).toEqual(CONTENT_STATUS);
    });
  });

  describe('content database integration', () => {
    const db = getDb(env.DB);

    it('generates created_at and updated_at automatically', async () => {
      const created = await insertTestContent(db);

      expect(created.createdAt).toBeTruthy();
      expect(created.updatedAt).toBeTruthy();
      expect(created.createdAt).toEqual(expect.any(String));
      expect(created.updatedAt).toEqual(expect.any(String));
    });

    it('accepts a valid UUIDv7', async () => {
      const validId = '0198f7b1-1234-7abc-8def-123456789abc';

      const created = await insertTestContent(db, {
        id: validId,
      });

      expect(created.id).toBe(validId);
    });

    it('rejects an ID that is not a valid UUIDv7', async () => {
      const invalidId = '0198f7b1-1234-4abc-8def-123456789abc';

      await expect(
        insertTestContent(db, {
          id: invalidId,
        }),
      ).rejects.toThrow();
    });
  });
});
