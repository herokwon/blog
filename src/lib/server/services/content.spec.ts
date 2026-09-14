import type {
  Content,
  contentSchema,
  PaginatedResponse,
} from '$lib/api/schemas';
import type { ContentRepository } from '../repositories';
import { ContentService } from './content';

describe('[Server/Service] Content Service', () => {
  describe('getContent', () => {
    it('throws CONTENT_NOT_FOUND error when content does not exist', async () => {
      const repository = {
        findById: vi.fn().mockResolvedValue(null),
      } as unknown as ContentRepository;

      const service = new ContentService(repository);

      await expect(
        service.getContent('0198f7b1-1234-7abc-8def-123456789abc'),
      ).rejects.toThrow('CONTENT_NOT_FOUND');
      expect(repository.findById).toHaveBeenCalledWith(
        '0198f7b1-1234-7abc-8def-123456789abc',
      );
    });

    it('returns conten when content exists', async () => {
      const content = {
        id: '0198f7b1-1234-7abc-8def-123456789abc',
        status: 'published',
        slug: 'test-content',
        title: 'Test Content',
        body: '# Test Content',
        createdAt: '2026-09-10T00:00:00.000Z',
        publishedAt: '2026-09-10T00:00:00.000Z',
        updatedAt: '2026-09-10T00:00:00.000Z',
        deletedAt: null,
      } satisfies Content;

      const repository = {
        findById: vi.fn().mockResolvedValue(content),
      } as unknown as ContentRepository;

      const service = new ContentService(repository);

      await expect(
        service.getContent('0198f7b1-1234-7abc-8def-123456789abc'),
      ).resolves.toEqual(content);
      expect(repository.findById).toHaveBeenCalledWith(content.id);
    });
  });

  describe('listContents', () => {
    it('returns contents from the repository', async () => {
      const result = {
        items: [
          {
            id: '0198f7b1-1234-7abc-8def-123456789abc',
            status: 'draft',
            slug: null,
            title: 'Test Content',
            body: '# Test Content',
            createdAt: '2026-09-10T00:00:00.000Z',
            publishedAt: null,
            updatedAt: '2026-09-10T00:00:00.000Z',
            deletedAt: null,
          },
        ] satisfies Content[],
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
          cursor:
            '2026-09-14T00:00:00.000Z:0198f7b1-1234-7abc-8def-123456789abc',
        }),
      ).resolves.toEqual(result);
      expect(repository.findMany).toHaveBeenCalledWith({
        limit: 10,
        cursor: '2026-09-14T00:00:00.000Z:0198f7b1-1234-7abc-8def-123456789abc',
      });
    });
  });

  describe('listTrash', () => {
    it('returns trash contents and next cursor from the repository', async () => {
      const result = {
        items: [
          {
            id: '0198f7b1-1234-7abc-8def-123456789abc',
            status: 'draft',
            slug: null,
            title: 'Deleted Content',
            body: '# Deleted Content',
            createdAt: '2026-09-10T00:00:00.000Z',
            publishedAt: null,
            updatedAt: '2026-09-11T00:00:00.000Z',
            deletedAt: '2026-09-11T00:00:00.000Z',
          },
        ],
        nextCursor: null,
      } satisfies PaginatedResponse<typeof contentSchema>;

      const repository = {
        findTrash: vi.fn().mockResolvedValue(result),
      } as unknown as ContentRepository;

      const service = new ContentService(repository);

      await expect(service.listTrash({ limit: 10 })).resolves.toEqual(result);
      expect(repository.findTrash).toHaveBeenCalledWith({ limit: 10 });
    });
  });
});
