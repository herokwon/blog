import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { resolveWorkerTarget } from './worker-target.ts';

function config() {
  return {
    name: 'blog',
    vars: {
      ADMIN_ORIGIN: 'https://blog.example.com',
      APP_ENVIRONMENT: 'production',
      ACCESS_AUDIENCE: 'production-audience',
    },
    d1_databases: [
      { binding: 'DB', database_name: 'blog', database_id: 'production-id' },
    ],
    env: {
      preview: {
        name: 'blog-preview',
        routes: [],
        workers_dev: true,
        preview_urls: true,
        vars: {
          ADMIN_ORIGIN: 'https://blog-preview.example.workers.dev',
          PREVIEW_ORIGIN: 'https://blog-preview.example.workers.dev',
          APP_ENVIRONMENT: 'preview',
          ACCESS_AUDIENCE: 'preview-audience',
        },
        d1_databases: [
          {
            binding: 'DB',
            database_name: 'blog-preview',
            database_id: 'preview-id',
          },
        ],
      },
    },
  };
}

function withConfig(value: unknown, check: (path: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), 'blog-target-'));
  const path = join(directory, 'wrangler.jsonc');
  try {
    writeFileSync(
      path,
      `// JSONC fixture\n${JSON.stringify(value).replace(/\n?}$/, ',\n}')}`,
    );
    check(path);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('resolves explicit production and preview targets from JSONC', () => {
  withConfig(config(), path => {
    assert.deepEqual(resolveWorkerTarget(path, 'production'), {
      name: 'blog',
      databaseName: 'blog',
      databaseId: 'production-id',
      adminOrigin: 'https://blog.example.com',
    });
    assert.deepEqual(resolveWorkerTarget(path, 'preview'), {
      name: 'blog-preview',
      databaseName: 'blog-preview',
      databaseId: 'preview-id',
      adminOrigin: 'https://blog-preview.example.workers.dev',
    });
  });
});

test('rejects_preview_production_resource_overlap before resolving either target', () => {
  const mutations = [
    (value: ReturnType<typeof config>) => {
      value.env.preview.d1_databases[0].database_id = 'production-id';
    },
    (value: ReturnType<typeof config>) => {
      value.env.preview.d1_databases[0].database_name = 'blog';
    },
    (value: ReturnType<typeof config>) => {
      Object.assign(value.env.preview, {
        routes: [{ pattern: 'blog.example.com', custom_domain: true }],
      });
    },
    (value: ReturnType<typeof config>) => {
      value.env.preview.name = 'blog';
    },
    (value: ReturnType<typeof config>) => {
      value.name = 'blog-preview';
    },
    (value: ReturnType<typeof config>) => {
      value.env.preview.workers_dev = false;
    },
    (value: ReturnType<typeof config>) => {
      value.env.preview.preview_urls = false;
    },
    (value: ReturnType<typeof config>) => {
      value.env.preview.vars.ADMIN_ORIGIN =
        'https://version-blog-preview.example.workers.dev';
    },
    (value: ReturnType<typeof config>) => {
      value.env.preview.vars.PREVIEW_ORIGIN = 'https://blog.example.com';
    },
    (value: ReturnType<typeof config>) => {
      value.env.preview.vars.ACCESS_AUDIENCE = 'production-audience';
    },
    (value: ReturnType<typeof config>) => {
      Object.assign(value.env, { preview: {} });
    },
  ];
  for (const mutate of mutations) {
    const value = config();
    mutate(value);
    withConfig(value, path => {
      for (const target of ['production', 'preview'] as const)
        assert.throws(() => resolveWorkerTarget(path, target));
    });
  }
});

test('rejects malformed configuration and ambiguous DB bindings', () => {
  withConfig([], path =>
    assert.throws(() => resolveWorkerTarget(path, 'preview')),
  );
  const value = config();
  value.env.preview.d1_databases.push({
    binding: 'DB',
    database_name: 'other',
    database_id: 'other-id',
  });
  withConfig(value, path =>
    assert.throws(() => resolveWorkerTarget(path, 'preview')),
  );
});

test('rejects an additional Preview binding to any Production D1 resource', () => {
  const value = config();
  value.env.preview.d1_databases.push({
    binding: 'OTHER',
    database_name: 'blog',
    database_id: 'production-id',
  });
  withConfig(value, path =>
    assert.throws(() => resolveWorkerTarget(path, 'preview')),
  );
});
