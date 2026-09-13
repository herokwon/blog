import type { Content } from '$lib/api/schemas';
import { env } from 'cloudflare:workers';
import { sql } from 'drizzle-orm';
import { getDb } from '../db';
import { content } from '../db/schema';
import { ContentRepository } from './content';

async function resetDb(db: ReturnType<typeof getDb>) {
  await db.run(sql`DELETE FROM content`);
}

describe('[Server/Repository] Content Repository', () => {
  const db = getDb(env.DB);
  const repository = new ContentRepository(db);

  describe('findById', async () => {
    beforeEach(async () => {
      await resetDb(db);
    });

    it('returns content when the record exists', async () => {
      const contentId = '0198f7b1-1234-7abc-8def-123456789abc';

      await db.insert(content).values({
        id: contentId,
        status: 'draft',
        slug: null,
        title: 'Test Content',
        body: '# Test Content',
        createdAt: '2026-09-11T00:00:00.000Z',
        publishedAt: null,
        updatedAt: '2026-09-11T00:00:00.000Z',
        deletedAt: null,
      });

      const result = await repository.findById(contentId);

      expect(result).toEqual({
        id: contentId,
        status: 'draft',
        slug: null,
        title: 'Test Content',
        body: '# Test Content',
        createdAt: '2026-09-11T00:00:00.000Z',
        publishedAt: null,
        updatedAt: '2026-09-11T00:00:00.000Z',
        deletedAt: null,
      });
    });

    it('returns null when the record does not exist', async () => {
      const contentId = '0198f7b1-1234-7abc-8def-123456789abc';

      const result = await repository.findById(contentId);

      expect(result).toBeNull();
    });
  });

  describe('findBySlug', async () => {
    beforeEach(async () => {
      await resetDb(db);
    });

    it('returns content when the record exists', async () => {
      const contentId = '0198f7b1-1234-7abc-8def-123456789abc';
      const slug = 'test-content';

      await db.insert(content).values({
        id: contentId,
        status: 'published',
        slug,
        title: 'Test Content',
        body: '# Test Content',
        createdAt: '2026-09-11T00:00:00.000Z',
        publishedAt: '2026-09-11T00:00:00.000Z',
        updatedAt: '2026-09-11T00:00:00.000Z',
        deletedAt: null,
      });

      const result = await repository.findBySlug(slug);

      expect(result).toEqual({
        id: contentId,
        status: 'published',
        slug,
        title: 'Test Content',
        body: '# Test Content',
        createdAt: '2026-09-11T00:00:00.000Z',
        publishedAt: '2026-09-11T00:00:00.000Z',
        updatedAt: '2026-09-11T00:00:00.000Z',
        deletedAt: null,
      });
    });

    it('returns null when the record does not exist', async () => {
      const result = await repository.findBySlug('non-existent-slug');

      expect(result).toBeNull();
    });
  });

  describe('create', async () => {
    beforeEach(async () => {
      await resetDb(db);
    });

    it('creates and returns content', async () => {
      const input = {
        id: '0198f7b1-1234-7abc-8def-123456789abc',
        status: 'draft',
        slug: null,
        title: 'Created Content',
        body: '# Created Content',
        createdAt: '2026-09-12T00:00:00.000Z',
        publishedAt: null,
        updatedAt: '2026-09-12T00:00:00.000Z',
        deletedAt: null,
      } satisfies Content;

      const result = await repository.create(input);

      expect(result).toEqual(input);
    });
  });

  describe('update', async () => {
    beforeEach(async () => {
      await resetDb(db);
    });

    it('updates and returns content', async () => {
      const contentId = '0198f7b1-1234-7abc-8def-123456789abc';

      await db.insert(content).values({
        id: contentId,
        status: 'draft',
        slug: null,
        title: 'Original Title',
        body: '# Original Content',
        createdAt: '2026-09-11T00:00:00.000Z',
        publishedAt: null,
        updatedAt: '2026-09-11T00:00:00.000Z',
        deletedAt: null,
      });

      const result = await repository.update(contentId, {
        title: 'Updated Title',
        body: '# Updated Content',
      });

      expect(result).toEqual({
        id: contentId,
        status: 'draft',
        slug: null,
        title: 'Updated Title',
        body: '# Updated Content',
        createdAt: '2026-09-11T00:00:00.000Z',
        publishedAt: null,
        updatedAt: '2026-09-11T00:00:00.000Z',
        deletedAt: null,
      });
    });

    it('returns null when the record does not exist', async () => {
      const contentId = '0198f7b1-1234-7abc-8def-123456789abc';

      const result = await repository.update(contentId, {
        title: 'Updated Title',
      });

      expect(result).toBeNull();
    });
  });

  describe('softDelete', async () => {
    beforeEach(async () => {
      await resetDb(db);
    });

    it('soft deletes and returns content', async () => {
      const contentId = '0198f7b1-1234-7abc-8def-123456789abc';
      const deletedAt = '2026-09-12T00:00:00.000Z';

      await db.insert(content).values({
        id: contentId,
        status: 'published',
        slug: 'soft-delete-test',
        title: 'Test Content',
        body: '# Test Content',
        createdAt: '2026-09-11T00:00:00.000Z',
        publishedAt: '2026-09-11T00:00:00.000Z',
        updatedAt: '2026-09-11T00:00:00.000Z',
        deletedAt: null,
      });

      const result = await repository.softDelete(contentId, deletedAt);

      expect(result).toEqual({
        id: contentId,
        status: 'published',
        slug: 'soft-delete-test',
        title: 'Test Content',
        body: '# Test Content',
        createdAt: '2026-09-11T00:00:00.000Z',
        publishedAt: '2026-09-11T00:00:00.000Z',
        updatedAt: deletedAt,
        deletedAt,
      });
    });

    it('returns null when the record does not exist', async () => {
      const contentId = '0198f7b1-1234-7abc-8def-123456789abc';
      const deletedAt = '2026-09-12T00:00:00.000Z';

      const result = await repository.softDelete(contentId, deletedAt);

      expect(result).toBeNull();
    });
  });

  describe('restore', async () => {
    beforeEach(async () => {
      await resetDb(db);
    });

    it('restores and returns content', async () => {
      const contentId = '0198f7b1-1234-7abc-8def-123456789abc';
      const restoredAt = '2026-09-12T00:00:00.000Z';

      await db.insert(content).values({
        id: contentId,
        status: 'published',
        slug: 'restore-test-content',
        title: 'Deleted Content',
        body: '# Deleted Content',
        createdAt: '2026-09-11T00:00:00.000Z',
        publishedAt: '2026-09-11T00:00:00.000Z',
        updatedAt: '2026-09-11T00:00:00.000Z',
        deletedAt: '2026-09-11T12:00:00.000Z',
      });

      const result = await repository.restore(contentId, restoredAt);

      expect(result).toEqual({
        id: contentId,
        status: 'published',
        slug: 'restore-test-content',
        title: 'Deleted Content',
        body: '# Deleted Content',
        createdAt: '2026-09-11T00:00:00.000Z',
        publishedAt: '2026-09-11T00:00:00.000Z',
        updatedAt: restoredAt,
        deletedAt: null,
      });
    });

    it('returns null when the record does not exist', async () => {
      const contentId = '0198f7b1-1234-7abc-8def-123456789abc';
      const restoredAt = '2026-09-12T00:00:00.000Z';

      const result = await repository.restore(contentId, restoredAt);

      expect(result).toBeNull();
    });
  });

  describe('findMany', () => {
    beforeAll(async () => {
      await resetDb(db);

      await db.insert(content).values([
        {
          id: '0198f7b1-1000-7abc-8def-123456789abc',
          status: 'draft',
          slug: null,
          title: 'First Content',
          body: '# First Content',
          createdAt: '2026-09-10T00:00:00.000Z',
          publishedAt: null,
          updatedAt: '2026-09-10T00:00:00.000Z',
          deletedAt: null,
        },
        {
          id: '0198f7b1-2000-7abc-8def-123456789abc',
          status: 'published',
          slug: 'published-content',
          title: 'Second Content',
          body: '# Second Content',
          createdAt: '2026-09-11T00:00:00.000Z',
          publishedAt: '2026-09-11T00:00:00.000Z',
          updatedAt: '2026-09-11T00:00:00.000Z',
          deletedAt: null,
        },
        {
          id: '0198f7b1-3000-7abc-8def-123456789abc',
          status: 'archived',
          slug: 'archived-content',
          title: 'Third Content',
          body: '# Third Content',
          createdAt: '2026-09-12T00:00:00.000Z',
          publishedAt: '2026-09-12T00:00:00.000Z',
          updatedAt: '2026-09-12T00:00:00.000Z',
          deletedAt: null,
        },
        {
          id: '0198f7b1-4000-7abc-8def-123456789abc',
          status: 'published',
          slug: 'deleted-content',
          title: 'Fourth Content',
          body: '# Fourth Content',
          createdAt: '2026-09-13T00:00:00.000Z',
          publishedAt: '2026-09-13T00:00:00.000Z',
          updatedAt: '2026-09-13T00:00:00.000Z',
          deletedAt: '2026-09-13T01:00:00.000Z',
        },
      ]);
    });

    it('returns non-deleted contents ordered by createdAt and is descending', async () => {
      const result = await repository.findMany({ limit: 10 });

      expect(result.items).toHaveLength(3);
      expect(result.items.map(item => item.id)).toEqual([
        '0198f7b1-3000-7abc-8def-123456789abc',
        '0198f7b1-2000-7abc-8def-123456789abc',
        '0198f7b1-1000-7abc-8def-123456789abc',
      ]);
      expect(result.nextCursor).toBeNull();
    });

    it('limits the number of returned contents', async () => {
      const result = await repository.findMany({ limit: 2 });

      expect(result.items).toHaveLength(2);
    });

    it('returns the next cursor when more contents are available', async () => {
      const result = await repository.findMany({ limit: 2 });

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).not.toBeNull();
    });

    it('returns contents after the cursor boundary', async () => {
      const firstPage = await repository.findMany({ limit: 2 });

      expect(firstPage.items.map(item => item.id)).toEqual([
        '0198f7b1-3000-7abc-8def-123456789abc',
        '0198f7b1-2000-7abc-8def-123456789abc',
      ]);
      expect(firstPage.nextCursor).not.toBeNull();

      const secondPage = await repository.findMany({
        limit: 2,
        cursor: firstPage.nextCursor!,
      });

      expect(secondPage.items.map(item => item.id)).toEqual([
        '0198f7b1-1000-7abc-8def-123456789abc',
      ]);
      expect(secondPage.nextCursor).toBeNull();
    });
  });

  describe('findTrash', async () => {
    beforeAll(async () => {
      await resetDb(db);

      await db.insert(content).values([
        {
          id: '0198f7b1-1000-7abc-8def-123456789abc',
          status: 'draft',
          slug: null,
          title: 'First Content',
          body: '# First Content',
          createdAt: '2026-09-10T00:00:00.000Z',
          publishedAt: null,
          updatedAt: '2026-09-10T00:00:00.000Z',
          deletedAt: null,
        },
        {
          id: '0198f7b1-2000-7abc-8def-123456789abc',
          status: 'published',
          slug: 'second-content',
          title: 'Second Content',
          body: '# Second Content',
          createdAt: '2026-09-11T00:00:00.000Z',
          publishedAt: '2026-09-11T00:00:00.000Z',
          updatedAt: '2026-09-11T00:00:00.000Z',
          deletedAt: '2026-09-11T01:00:00.000Z',
        },
        {
          id: '0198f7b1-3000-7abc-8def-123456789abc',
          status: 'published',
          slug: 'third-content',
          title: 'Third Content',
          body: '# Third Content',
          createdAt: '2026-09-12T00:00:00.000Z',
          publishedAt: '2026-09-12T00:00:00.000Z',
          updatedAt: '2026-09-12T00:00:00.000Z',
          deletedAt: '2026-09-12T01:00:00.000Z',
        },
        {
          id: '0198f7b1-4000-7abc-8def-123456789abc',
          status: 'published',
          slug: 'fourth-content',
          title: 'Fourth Content',
          body: '# Fourth Content',
          createdAt: '2026-09-13T00:00:00.000Z',
          publishedAt: '2026-09-13T00:00:00.000Z',
          updatedAt: '2026-09-13T00:00:00.000Z',
          deletedAt: '2026-09-13T01:00:00.000Z',
        },
      ]);
    });

    it('returns only deleted contents', async () => {
      const result = await repository.findTrash({ limit: 10 });

      expect(result.items).toHaveLength(3);
      expect(result.items.map(item => item.id)).toEqual([
        '0198f7b1-4000-7abc-8def-123456789abc',
        '0198f7b1-3000-7abc-8def-123456789abc',
        '0198f7b1-2000-7abc-8def-123456789abc',
      ]);
      expect(result.nextCursor).toBeNull();
    });

    it('limits the number of returned deleted content', async () => {
      const result = await repository.findTrash({ limit: 2 });

      expect(result.items).toHaveLength(2);
      expect(result.items.map(item => item.id)).toEqual([
        '0198f7b1-4000-7abc-8def-123456789abc',
        '0198f7b1-3000-7abc-8def-123456789abc',
      ]);
      expect(result.nextCursor).not.toBeNull();
    });

    it('returns deleted contents after the cursor boundary', async () => {
      const firstPage = await repository.findTrash({ limit: 2 });

      expect(firstPage.items).toHaveLength(2);
      expect(firstPage.items.map(item => item.id)).toEqual([
        '0198f7b1-4000-7abc-8def-123456789abc',
        '0198f7b1-3000-7abc-8def-123456789abc',
      ]);
      expect(firstPage.nextCursor).not.toBeNull();

      const secondPage = await repository.findTrash({
        limit: 2,
        cursor: firstPage.nextCursor!,
      });

      expect(secondPage.items).toHaveLength(1);
      expect(secondPage.items.map(item => item.id)).toEqual([
        '0198f7b1-2000-7abc-8def-123456789abc',
      ]);
      expect(secondPage.nextCursor).toBeNull();
    });
  });
});
