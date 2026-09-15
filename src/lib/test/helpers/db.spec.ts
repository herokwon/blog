import { getDb } from '$lib/server/db';
import { content } from '$lib/server/db/schema';
import { env } from 'cloudflare:workers';
import { insertTestContent } from './content';
import { resetTestDb } from './db';

describe('[Test/Helpers] Database', () => {
  const db = getDb(env.DB);

  it('deletes all rows from the specified table', async () => {
    await insertTestContent(db);

    await resetTestDb(db, content);

    const rows = await db.select().from(content);

    expect(rows).toHaveLength(0);
  });
});
