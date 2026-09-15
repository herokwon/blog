import type { ContentStatus } from '$lib/api/schemas';
import { getDb } from '$lib/server/db';
import { content } from '$lib/server/db/schema';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { insertTestContent } from './content';

describe('[Test/Helpers] Content', () => {
  describe('insertTestContent', () => {
    const db = getDb(env.DB);

    it('inserts test content into the database and returns the inserted row', async () => {
      const inserted = await insertTestContent(db);

      const [found] = await db
        .select()
        .from(content)
        .where(eq(content.id, inserted.id));

      expect(found).toEqual(inserted);
    });

    it('inserts test content with the provided overrides', async () => {
      const overrides = {
        status: 'published' as ContentStatus,
        slug: 'overridden-slug',
        title: 'Overridden Title',
        body: '# Overridden Body',
      };

      const inserted = await insertTestContent(db, overrides);

      expect(inserted.status).toEqual(overrides.status);
      expect(inserted.slug).toEqual(overrides.slug);
      expect(inserted.title).toEqual(overrides.title);
      expect(inserted.body).toEqual(overrides.body);
    });

    it('inserts test content with provided timestamps', async () => {
      const createdAt = '2026-01-01T00:00:00.000Z';
      const updatedAt = '2026-01-02T00:00:00.000Z';

      const inserted = await insertTestContent(db, {
        createdAt,
        updatedAt,
      });

      expect(inserted.createdAt).toEqual(createdAt);
      expect(inserted.updatedAt).toEqual(updatedAt);
    });
  });
});
