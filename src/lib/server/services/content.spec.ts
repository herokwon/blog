import { createTestContent } from '$lib/test/fixtures';
import type { ContentRepository } from '../repositories';
import { ContentService } from './content';

describe('[Server/Service] Content Service', () => {
  const contentId = '0198f7b1-1234-7abc-8def-123456789abc';

  describe('getContent', () => {
    it('throws CONTENT_NOT_FOUND error when content does not exist', async () => {
      const repository = {
        findById: vi.fn().mockResolvedValue(null),
      } as unknown as ContentRepository;

      const service = new ContentService(repository);

      await expect(service.getContent(contentId)).rejects.toThrow(
        'CONTENT_NOT_FOUND',
      );
      expect(repository.findById).toHaveBeenCalledWith(contentId);
    });

    it('returns conten when content exists', async () => {
      const testContent = createTestContent({
        id: contentId,
      });

      const repository = {
        findById: vi.fn().mockResolvedValue(testContent),
      } as unknown as ContentRepository;

      const service = new ContentService(repository);

      await expect(service.getContent(contentId)).resolves.toEqual(testContent);
      expect(repository.findById).toHaveBeenCalledWith(contentId);
    });
  });

  describe('listContents', () => {
    it('returns contents from the repository', async () => {
      const testContent = createTestContent({
        id: contentId,
      });
      const result = {
        items: [testContent],
        nextCursor: null,
      };

      const repository = {
        findMany: vi.fn().mockResolvedValue(result),
      } as unknown as ContentRepository;

      const service = new ContentService(repository);

      await expect(service.listContents({ limit: 10 })).resolves.toEqual(
        result,
      );
      expect(repository.findMany).toHaveBeenCalledWith({
        limit: 10,
      });
    });

    it('passes cursor to the repository', async () => {
      const result = {
        items: [],
        nextCursor: null,
      };

      const repository = {
        findMany: vi.fn().mockResolvedValue(result),
      } as unknown as ContentRepository;

      const service = new ContentService(repository);

      await expect(
        service.listContents({
          limit: 10,
          cursor: `2026-01-01T00:00:00.000Z:${contentId}`,
        }),
      ).resolves.toEqual(result);
      expect(repository.findMany).toHaveBeenCalledWith({
        limit: 10,
        cursor: `2026-01-01T00:00:00.000Z:${contentId}`,
      });
    });
  });

  describe('listTrash', () => {
    it('returns trash contents and next cursor from the repository', async () => {
      const createdAt = '2026-01-01T00:00:00.000Z';
      const deletedAt = '2026-01-01T01:00:00.000Z';

      const testContent = createTestContent({
        id: contentId,
        createdAt,
        publishedAt: createdAt,
        updatedAt: deletedAt,
        deletedAt,
      });
      const result = {
        items: [testContent],
        nextCursor: null,
      };

      const repository = {
        findTrash: vi.fn().mockResolvedValue(result),
      } as unknown as ContentRepository;

      const service = new ContentService(repository);

      await expect(service.listTrash({ limit: 10 })).resolves.toEqual(result);
      expect(repository.findTrash).toHaveBeenCalledWith({ limit: 10 });
    });
  });
});
