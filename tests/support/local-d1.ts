import { readdir, readFile } from 'node:fs/promises';
import { getPlatformProxy } from 'wrangler';

const migrations = new URL('../../drizzle/', import.meta.url);

export async function createLocalD1() {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({
    environment: 'preview',
    envFiles: [],
    persist: false,
    remoteBindings: false,
  });
  try {
    for (const name of (await readdir(migrations))
      .filter(name => name.endsWith('.sql'))
      .sort()) {
      const migration = await readFile(new URL(name, migrations), 'utf8');
      const statements = migration
        .split('--> statement-breakpoint')
        .filter(sql => sql.trim());
      await proxy.env.DB.batch(
        statements.map(sql => proxy.env.DB.prepare(sql)),
      );
    }
    return proxy;
  } catch (error) {
    await proxy.dispose();
    throw error;
  }
}
