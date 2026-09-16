import { ApiError } from '$lib/api/errors';
import type {
  Content,
  contentSchema,
  PaginatedResponse,
  Pagination,
} from '$lib/api/schemas';
import type { ContentRepository } from '../repositories';

export class ContentService {
  constructor(private readonly repository: ContentRepository) {}

  async getContent(id: string): Promise<Content> {
    const content = await this.repository.findById(id);

    if (!content) {
      throw new ApiError({
        code: 'CONTENT_NOT_FOUND',
        message: 'Content not found.',
        details: [],
      });
    }

    return content;
  }

  async listContents(
    input: Required<Pick<Pagination, 'limit'>> & Pick<Pagination, 'cursor'>,
  ): Promise<PaginatedResponse<typeof contentSchema>> {
    return await this.repository.findMany(input);
  }

  async listTrash(
    input: Required<Pick<Pagination, 'limit'>> & Pick<Pagination, 'cursor'>,
  ): Promise<PaginatedResponse<typeof contentSchema>> {
    return await this.repository.findTrash(input);
  }
}
