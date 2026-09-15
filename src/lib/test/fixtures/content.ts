import type { Content } from '$lib/api/schemas';
import { generateUuidv7 } from '$lib/utils';

export function createTestContentId(): string {
  return generateUuidv7();
}

export function createTestContent(overrides: Partial<Content> = {}): Content {
  return {
    id: createTestContentId(),
    status: 'draft',
    slug: null,
    title: 'Test Content',
    body: '# Test Content',
    createdAt: '2026-01-01T00:00:00.000Z',
    publishedAt: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}
