import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const releaseRef = 'release/v0.2.0';
const headSha = 'b'.repeat(40);
const oldSha = 'a'.repeat(40);
const script = fileURLToPath(
  new URL('./release-candidate.ts', import.meta.url),
);

function version(tag: string, ref = releaseRef) {
  return {
    id: '18f97339-c287-4872-9bdd-e2135c07ec12',
    number: 1,
    metadata: { created_on: '2026-10-04T00:00:00Z' },
    annotations: { 'workers/tag': tag, 'workers/message': `${ref} @ ${tag}` },
  };
}

function runCandidate(response: unknown, sha = headSha, ref = releaseRef) {
  const directory = mkdtempSync(join(tmpdir(), 'release-candidate-'));
  const output = join(directory, 'output');
  const summary = join(directory, 'summary');
  try {
    writeFileSync(output, '');
    writeFileSync(summary, '');
    const result = spawnSync(process.execPath, [script, ref, sha], {
      input: JSON.stringify(response),
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_OUTPUT: output,
        GITHUB_STEP_SUMMARY: summary,
      },
    });
    assert.ifError(result.error);
    return {
      ...result,
      output: readFileSync(output, 'utf8'),
      summary: readFileSync(summary, 'utf8'),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('selects the final PR head even when an older commit was uploaded later', () => {
  const old = version(oldSha);
  old.metadata.created_on = '2026-10-04T01:00:00Z';
  for (const items of [
    [old, version(headSha)],
    [version(headSha), old],
  ]) {
    const result = runCandidate({ success: true, result: { items } });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      result.output,
      `tag=${headSha}\nversion-id=18f97339-c287-4872-9bdd-e2135c07ec12\n`,
    );
    assert.match(result.summary, new RegExp(headSha));
  }
});

test('fails without outputs instead of falling back when the final upload is missing', () => {
  for (const items of [[], [version(oldSha)]]) {
    const result = runCandidate({ success: true, result: { items } });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /No deployable candidate/);
    assert.equal(result.output, '');
    assert.equal(result.summary, '');
  }
});

test('rejects the same SHA annotated for a different release branch', () => {
  const result = runCandidate({
    success: true,
    result: { items: [version(headSha, 'release/v0.3.0')] },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /No deployable candidate/);
  assert.equal(result.output, '');
});

test('ignores versions without the required annotations', () => {
  const result = runCandidate({
    success: true,
    result: { items: [{ id: 'unannotated' }, version(headSha)] },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.output,
    `tag=${headSha}\nversion-id=18f97339-c287-4872-9bdd-e2135c07ec12\n`,
  );
});

test('rejects failed or malformed API responses before publishing outputs', () => {
  for (const response of [
    { success: false, result: { items: [version(headSha)] } },
    { success: true, result: { items: {} } },
    { success: true },
    null,
  ]) {
    const result = runCandidate(response);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid Worker versions response/);
    assert.equal(result.output, '');
  }
});

test('rejects invalid release refs and SHAs before publishing outputs', () => {
  for (const [sha, ref] of [
    [headSha, 'release/v0.2'],
    ['short-sha', releaseRef],
    ['', releaseRef],
  ]) {
    const result = runCandidate(
      { success: true, result: { items: [] } },
      sha,
      ref,
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid release target/);
    assert.equal(result.output, '');
  }
});

test('production jobs stay blocked after missing candidate selection', () => {
  const workflow = readFileSync(
    new URL('../workflows/deployment.yml', import.meta.url),
    'utf8',
  );
  function condition(job: string) {
    const block = workflow.split(`  ${job}:`)[1]?.split(/\r?\n {2}[\w-]+:/)[0];
    const folded = block?.match(
      /^ {4}if: >-\r?\n((?: {6}.*(?:\r?\n|$))+)/m,
    )?.[1];
    assert.ok(folded, `Missing condition for ${job}`);
    return folded.trim().replace(/needs\.([\w-]+)/g, 'needs["$1"]');
  }
  const migration = condition('migrate-d1');
  const deployment = condition('deploy-worker');
  for (const result of ['failure', 'cancelled', 'skipped']) {
    const context = {
      always: () => true,
      needs: {
        resolve: { result: 'success', outputs: { strategy: 'promote' } },
        'validate-release-tag': { result: 'success' },
        'select-release-version': { result },
        'migrate-d1': { result: 'skipped' },
      },
    };
    assert.equal(runInNewContext(migration, context), false);
    assert.equal(runInNewContext(deployment, context), false);
  }
  const successful = {
    always: () => true,
    needs: {
      resolve: { result: 'success', outputs: { strategy: 'promote' } },
      'validate-release-tag': { result: 'success' },
      'select-release-version': { result: 'success' },
      'migrate-d1': { result: 'success' },
    },
  };
  assert.equal(runInNewContext(migration, successful), true);
  assert.equal(runInNewContext(deployment, successful), true);
  successful.needs.resolve.outputs.strategy = 'hotfix';
  successful.needs['select-release-version'].result = 'skipped';
  successful.needs['migrate-d1'].result = 'skipped';
  assert.equal(runInNewContext(migration, successful), false);
  assert.equal(runInNewContext(deployment, successful), true);
});
