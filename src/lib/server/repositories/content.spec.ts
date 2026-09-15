import { createTestContent } from '$lib/test/fixtures';
import { insertTestContent, resetTestDb } from '$lib/test/helpers';
import { env } from 'cloudflare:workers';
import { getDb } from '../db';
import { content } from '../db/schema';
import { ContentRepository } from './content';

describe('[Server/Repository] Content Repository', () => {
  const db = getDb(env.DB);
  const repository = new ContentRepository(db);
  const contentId = '0198f7b1-1234-7abc-8def-123456789abc';
  const createdAt = '2026-01-01T00:00:00.000Z';

  describe('findById', async () => {
    beforeEach(async () => {
      await resetTestDb(db, content);
    });

    it('returns content when the record exists', async () => {
      await insertTestContent(db, {
        id: contentId,
        createdAt,
        updatedAt: createdAt,
      });

      const result = await repository.findById(contentId);

      expect(result).toEqual({
        id: contentId,
        status: 'draft',
        slug: null,
        title: 'Test Content',
        body: '# Test Content',
        createdAt: createdAt,
        publishedAt: null,
        updatedAt: createdAt,
        deletedAt: null,
      });
    });

    it('returns null when the record does not exist', async () => {
      const result = await repository.findById(contentId);

      expect(result).toBeNull();
    });
  });

  describe('findBySlug', async () => {
    beforeEach(async () => {
      await resetTestDb(db, content);
    });

    it('returns content when the record exists', async () => {
      const slug = 'test-content';

      await insertTestContent(db, {
        id: contentId,
        status: 'published',
        slug,
        createdAt,
        publishedAt: createdAt,
        updatedAt: createdAt,
      });

      const result = await repository.findBySlug(slug);

      expect(result).toEqual({
        id: contentId,
        status: 'published',
        slug,
        title: 'Test Content',
        body: '# Test Content',
        createdAt,
        publishedAt: createdAt,
        updatedAt: createdAt,
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
      await resetTestDb(db, content);
    });

    it('creates and returns content', async () => {
      const input = createTestContent();

      const result = await repository.create(input);

      expect(result).toEqual(input);
    });
  });

  describe('update', async () => {
    beforeEach(async () => {
      await resetTestDb(db, content);
    });

    it('updates and returns content', async () => {
      await insertTestContent(db, {
        id: contentId,
        createdAt,
        updatedAt: createdAt,
      });

      const updatedAt = '2026-01-01T01:00:00.000Z';

      const result = await repository.update(contentId, {
        title: 'Updated Title',
        body: '# Updated Content',
        updatedAt,
      });

      expect(result).toEqual({
        id: contentId,
        status: 'draft',
        slug: null,
        title: 'Updated Title',
        body: '# Updated Content',
        createdAt,
        publishedAt: null,
        updatedAt,
        deletedAt: null,
      });
    });

    it('returns null when the record does not exist', async () => {
      const result = await repository.update(contentId, {
        title: 'Updated Title',
      });

      expect(result).toBeNull();
    });
  });

  describe('softDelete', async () => {
    const deletedAt = '2026-01-01T01:00:00.000Z';

    beforeEach(async () => {
      await resetTestDb(db, content);
    });

    it('soft deletes and returns content', async () => {
      await insertTestContent(db, {
        id: contentId,
        status: 'published',
        slug: 'soft-delete-test',
        createdAt,
        publishedAt: createdAt,
        updatedAt: createdAt,
      });

      const result = await repository.softDelete(contentId, deletedAt);

      expect(result).toEqual({
        id: contentId,
        status: 'published',
        slug: 'soft-delete-test',
        title: 'Test Content',
        body: '# Test Content',
        createdAt,
        publishedAt: createdAt,
        updatedAt: deletedAt,
        deletedAt,
      });
    });

    it('returns null when the record does not exist', async () => {
      const result = await repository.softDelete(contentId, deletedAt);

      expect(result).toBeNull();
    });
  });

  describe('restore', async () => {
    const deletedAt = '2026-01-01T00:30:00.000Z';
    const restoredAt = '2026-01-01T01:00:00.000Z';

    beforeEach(async () => {
      await resetTestDb(db, content);
    });

    it('restores and returns content', async () => {
      await insertTestContent(db, {
        id: contentId,
        status: 'published',
        slug: 'restore-test-content',
        createdAt,
        publishedAt: createdAt,
        updatedAt: createdAt,
        deletedAt,
      });

      const result = await repository.restore(contentId, restoredAt);

      expect(result).toEqual({
        id: contentId,
        status: 'published',
        slug: 'restore-test-content',
        title: 'Test Content',
        body: '# Test Content',
        createdAt,
        publishedAt: createdAt,
        updatedAt: restoredAt,
        deletedAt: null,
      });
    });

    it('returns null when the record does not exist', async () => {
      const result = await repository.restore(contentId, restoredAt);

      expect(result).toBeNull();
    });
  });

  describe('findMany', () => {
    const contentId1 = '0198f7b1-1000-7abc-8def-123456789abc';
    const contentId2 = '0198f7b1-2000-7abc-8def-123456789abc';
    const contentId3 = '0198f7b1-3000-7abc-8def-123456789abc';
    const contentId4 = '0198f7b1-4000-7abc-8def-123456789abc';

    beforeAll(async () => {
      await resetTestDb(db, content);

      await Promise.all([
        insertTestContent(db, {
          id: contentId1,
          title: 'Draft Content',
          body: '# Draft Content',
          createdAt,
          updatedAt: createdAt,
        }),
        insertTestContent(db, {
          id: contentId2,
          status: 'published',
          slug: 'published-content',
          title: 'Published Content',
          body: '# Published Content',
          createdAt,
          publishedAt: createdAt,
          updatedAt: createdAt,
        }),
        insertTestContent(db, {
          id: contentId3,
          status: 'archived',
          slug: 'archived-content',
          title: 'Archived Content',
          body: '# Archived Content',
          createdAt,
          publishedAt: createdAt,
          updatedAt: createdAt,
        }),
        insertTestContent(db, {
          id: contentId4,
          status: 'published',
          slug: 'deleted-content',
          title: 'Deleted Content',
          body: '# Deleted Content',
          createdAt,
          publishedAt: createdAt,
          updatedAt: createdAt,
          deletedAt: '2026-01-01T01:00:00.000Z',
        }),
      ]);
    });

    it('returns non-deleted contents ordered by createdAt and is descending', async () => {
      const result = await repository.findMany({ limit: 10 });

      expect(result.items).toHaveLength(3);
      expect(result.items.map(item => item.id)).toEqual([
        contentId3,
        contentId2,
        contentId1,
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
        contentId3,
        contentId2,
      ]);
      expect(firstPage.nextCursor).not.toBeNull();

      const secondPage = await repository.findMany({
        limit: 2,
        cursor: firstPage.nextCursor!,
      });

      expect(secondPage.items.map(item => item.id)).toEqual([contentId1]);
      expect(secondPage.nextCursor).toBeNull();
    });
  });

  describe('findTrash', async () => {
    const contentId1 = '0198f7b1-1000-7abc-8def-123456789abc';
    const contentId2 = '0198f7b1-2000-7abc-8def-123456789abc';
    const contentId3 = '0198f7b1-3000-7abc-8def-123456789abc';
    const contentId4 = '0198f7b1-4000-7abc-8def-123456789abc';

    beforeAll(async () => {
      await resetTestDb(db, content);

      await Promise.all([
        insertTestContent(db, {
          id: contentId1,
          title: 'Draft Content',
          body: '# Draft Content',
          createdAt,
          updatedAt: createdAt,
        }),
        insertTestContent(db, {
          id: contentId2,
          status: 'published',
          slug: 'published-content',
          title: 'Published Content',
          body: '# Published Content',
          createdAt,
          publishedAt: createdAt,
          updatedAt: createdAt,
          deletedAt: '2026-01-01T00:20:00.000Z',
        }),
        insertTestContent(db, {
          id: contentId3,
          status: 'archived',
          slug: 'archived-content',
          title: 'Archived Content',
          body: '# Archived Content',
          createdAt,
          publishedAt: createdAt,
          updatedAt: createdAt,
          deletedAt: '2026-01-01T00:40:00.000Z',
        }),
        insertTestContent(db, {
          id: contentId4,
          status: 'published',
          slug: 'deleted-content',
          title: 'Deleted Content',
          body: '# Deleted Content',
          createdAt,
          publishedAt: createdAt,
          updatedAt: createdAt,
          deletedAt: '2026-01-01T01:00:00.000Z',
        }),
      ]);
    });

    it('returns only deleted contents', async () => {
      const result = await repository.findTrash({ limit: 10 });

      expect(result.items).toHaveLength(3);
      expect(result.items.map(item => item.id)).toEqual([
        contentId4,
        contentId3,
        contentId2,
      ]);
      expect(result.nextCursor).toBeNull();
    });

    it('limits the number of returned deleted content', async () => {
      const result = await repository.findTrash({ limit: 2 });

      expect(result.items).toHaveLength(2);
      expect(result.items.map(item => item.id)).toEqual([
        contentId4,
        contentId3,
      ]);
      expect(result.nextCursor).not.toBeNull();
    });

    it('returns deleted contents after the cursor boundary', async () => {
      const firstPage = await repository.findTrash({ limit: 2 });

      expect(firstPage.items).toHaveLength(2);
      expect(firstPage.items.map(item => item.id)).toEqual([
        contentId4,
        contentId3,
      ]);
      expect(firstPage.nextCursor).not.toBeNull();

      const secondPage = await repository.findTrash({
        limit: 2,
        cursor: firstPage.nextCursor!,
      });

      expect(secondPage.items).toHaveLength(1);
      expect(secondPage.items.map(item => item.id)).toEqual([contentId2]);
      expect(secondPage.nextCursor).toBeNull();
    });
  });
});
