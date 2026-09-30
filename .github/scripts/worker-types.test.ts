import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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

function runTypes(
  command: 'generate' | 'check',
  configPath: string,
  outputPath: string,
  expectedCode = 0,
): void {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `const { runWorkerTypes } = await import(process.argv[1]);
       process.exitCode = await runWorkerTypes(process.argv[2], process.argv[3], process.argv[4]);`,
      new URL('./worker-types.ts', import.meta.url).href,
      command,
      configPath,
      outputPath,
    ],
    {
      encoding: 'utf8',
      timeout: 60_000,
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    },
  );
  const diagnostics = [
    `Wrangler ${command}: expected exit ${expectedCode}, received ${result.status} (signal: ${result.signal})`,
    result.error?.message,
    result.stdout,
    result.stderr,
  ]
    .filter(Boolean)
    .join('\n');
  assert.equal(result.error, undefined, diagnostics);
  assert.equal(result.signal, null, diagnostics);
  assert.equal(result.status, expectedCode, diagnostics);
  assert.doesNotMatch(result.stderr, /Assertion failed:/, diagnostics);
  if (expectedCode === 1) {
    assert.match(result.stderr, /Types at .+ are out of date\./, diagnostics);
  }
}

test('types remain stable when the built entrypoint appears and reject stale bindings', () => {
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
    runTypes('generate', configPath, outputPath);
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
    runTypes('check', configPath, outputPath);
    runTypes('generate', configPath, outputPath);
    assert.equal(readFileSync(outputPath, 'utf8'), before);
    writeFileSync(configPath, config.replace('GREETING', 'CHANGED_BINDING'));
    runTypes('check', configPath, outputPath, 1);
    assert.equal(readFileSync(outputPath, 'utf8'), before);
    runTypes('generate', configPath, outputPath);
    runTypes('check', configPath, outputPath);
    assert.equal(
      readdirSync(directory).some(name => name.startsWith('.worker-types-')),
      false,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
