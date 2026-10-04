import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { generateTriggerConfig } from './trigger-config.ts';

test('generated trigger config preserves settings and works without built assets', () => {
  const directory = mkdtempSync(join(tmpdir(), 'trigger-config-'));
  const original = join(directory, 'wrangler.jsonc');
  const generated = join(directory, 'wrangler.trigger.json');
  const source = `{
    // Promotion deliberately has no local build.
    "name": "trigger-test",
    "compatibility_date": "2026-09-25",
    "main": ".svelte-kit/cloudflare/_worker.js",
    "assets": { "binding": "ASSETS", "directory": ".svelte-kit/cloudflare" },
    "workers_dev": false,
    "preview_urls": false,
    "routes": [{ "pattern": "blog.example.com", "custom_domain": true }],
    "triggers": { "crons": ["0 * * * *"] },
    "vars": { "GREETING": "hello" },
  }`;
  try {
    writeFileSync(original, source);
    generateTriggerConfig(original, generated);
    assert.deepEqual(JSON.parse(readFileSync(generated, 'utf8')), {
      name: 'trigger-test',
      compatibility_date: '2026-09-25',
      main: '.svelte-kit/cloudflare/_worker.js',
      workers_dev: false,
      preview_urls: false,
      routes: [{ pattern: 'blog.example.com', custom_domain: true }],
      triggers: { crons: ['0 * * * *'] },
      vars: { GREETING: 'hello' },
    });
    assert.equal(readFileSync(original, 'utf8'), source);
    const require = createRequire(import.meta.url);
    const cli = resolve(
      dirname(require.resolve('wrangler')),
      '../bin/wrangler.js',
    );
    const result = spawnSync(
      process.execPath,
      [cli, 'triggers', 'deploy', '--config', generated, '--dry-run'],
      {
        encoding: 'utf8',
        timeout: 30_000,
        env: {
          ...process.env,
          WRANGLER_SEND_METRICS: 'false',
          WRANGLER_LOG_PATH: join(directory, 'wrangler.log'),
        },
      },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /--dry-run: exiting now/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('malformed trigger source is rejected before writing configuration', () => {
  const directory = mkdtempSync(join(tmpdir(), 'trigger-invalid-'));
  try {
    const source = join(directory, 'wrangler.jsonc');
    const output = join(directory, 'wrangler.trigger.json');
    for (const value of ['{', '[]', 'null']) {
      writeFileSync(source, value);
      assert.throws(() => generateTriggerConfig(source, output));
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
