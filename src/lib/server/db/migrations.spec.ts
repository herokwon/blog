import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';

test('Wrangler applies committed SQL once and preserves data on repeat application', () => {
  const state = mkdtempSync(join(tmpdir(), 'blog-d1-migrations-'));
  const run = (...args: string[]) =>
    execFileSync(
      process.execPath,
      [
        resolve('node_modules/wrangler/bin/wrangler.js'),
        'd1',
        ...args,
        '--local',
        '--env',
        'preview',
        '--persist-to',
        state,
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, CI: 'true' },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
  try {
    run('migrations', 'apply', 'DB');
    run(
      'execute',
      'DB',
      '--command',
      "INSERT INTO posts (id, revision) VALUES ('migration-canary', 'initial')",
    );
    run('migrations', 'apply', 'DB');
    const result = JSON.parse(
      run(
        'execute',
        'DB',
        '--json',
        '--command',
        "SELECT name FROM d1_migrations; SELECT count(*) AS count FROM posts WHERE id = 'migration-canary'",
      ),
    ) as { results: Record<string, unknown>[] }[];
    expect(result.flatMap(item => item.results)).toEqual([
      { name: '0000_post-classification-schema.sql' },
      { count: 1 },
    ]);
    const migrations = join(state, 'migrations');
    mkdirSync(migrations);
    copyFileSync(
      resolve('drizzle/0000_post-classification-schema.sql'),
      join(migrations, '0000_post-classification-schema.sql'),
    );
    writeFileSync(
      join(migrations, '0001_invalid.sql'),
      'CREATE TABLE partial_migration (id TEXT); INSERT INTO missing_table VALUES (1);',
    );
    const config = JSON.parse(
      readFileSync(resolve('wrangler.jsonc'), 'utf8'),
    ) as {
      env: {
        preview: {
          d1_databases: {
            binding: string;
            database_id: string;
            database_name: string;
          }[];
        };
      };
    };
    const configPath = join(state, 'wrangler.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        name: 'migration-test',
        compatibility_date: '2026-11-04',
        env: {
          preview: {
            d1_databases: [
              {
                ...config.env.preview.d1_databases[0],
                migrations_dir: migrations,
              },
            ],
          },
        },
      }),
    );
    expect(() =>
      run('migrations', 'apply', 'DB', '--config', configPath),
    ).toThrow(/missing_table/);
    const afterFailure = JSON.parse(
      run(
        'execute',
        'DB',
        '--json',
        '--command',
        "SELECT name FROM d1_migrations; SELECT name FROM sqlite_master WHERE name = 'partial_migration'; SELECT count(*) AS count FROM posts WHERE id = 'migration-canary'",
      ),
    ) as { results: Record<string, unknown>[] }[];
    expect(afterFailure.map(item => item.results)).toEqual([
      [{ name: '0000_post-classification-schema.sql' }],
      [],
      [{ count: 1 }],
    ]);
  } finally {
    rmSync(state, { recursive: true, force: true });
  }
}, 90_000);
