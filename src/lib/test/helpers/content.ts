import type { Content } from '$lib/api/schemas';
import type { getDb } from '$lib/server/db';
import { content } from '$lib/server/db/schema';
import { createTestContent } from '../fixtures';

export async function insertTestContent(
  db: ReturnType<typeof getDb>,
  overrides: Partial<Content> = {},
) {
  const { createdAt, updatedAt, ...testContent } = createTestContent(overrides);

  const [inserted] = await db
    .insert(content)
    .values({
      ...testContent,
      ...(overrides.createdAt !== undefined && { createdAt }),
      ...(overrides.updatedAt !== undefined && { updatedAt }),
    })
    .returning();

  return inserted;
}
