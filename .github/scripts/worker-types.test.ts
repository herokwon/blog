import assert from 'node:assert/strict';
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runWorkerTypes } from './worker-types.ts';

test('types remain stable when the built entrypoint appears and reject stale bindings', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'worker-types-test-'));
  const configPath = join(directory, 'wrangler.jsonc');
  const outputPath = join(directory, 'worker.d.ts');
  const config = `{
    // JSONC comments and trailing commas are supported.
    "name": "types-test",
    "compatibility_date": "2026-09-25",
    "main": "worker.js",
    "vars": { "GREETING": "hello" },
  }`;
  try {
    writeFileSync(configPath, config);
    assert.equal(await runWorkerTypes('generate', configPath, outputPath), 0);
    const before = readFileSync(outputPath, 'utf8');
    assert.match(before, /GREETING/);
    assert.doesNotMatch(
      before.split('// Begin runtime types')[0],
      /mainModule/,
    );
    writeFileSync(
      join(directory, 'worker.js'),
      'export default { fetch() { return new Response("ok"); } };',
    );
    assert.equal(await runWorkerTypes('check', configPath, outputPath), 0);
    assert.equal(await runWorkerTypes('generate', configPath, outputPath), 0);
    assert.equal(readFileSync(outputPath, 'utf8'), before);
    writeFileSync(configPath, config.replace('GREETING', 'CHANGED_BINDING'));
    assert.notEqual(await runWorkerTypes('check', configPath, outputPath), 0);
    assert.equal(readFileSync(outputPath, 'utf8'), before);
    assert.equal(await runWorkerTypes('generate', configPath, outputPath), 0);
    assert.equal(await runWorkerTypes('check', configPath, outputPath), 0);
    assert.equal(
      readdirSync(directory).some(name => name.startsWith('.worker-types-')),
      false,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
