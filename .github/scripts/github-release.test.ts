import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const workflow = readFileSync(
  new URL('../workflows/deployment.yml', import.meta.url),
  'utf8',
);
const expression = workflow
  .split('  github-release:')[1]
  ?.match(/ {4}if: >-\r?\n([\s\S]*?) {4}runs-on:/)?.[1]
  .trim()
  .replaceAll('needs.deploy-worker', "needs['deploy-worker']");
assert.ok(expression, 'GitHub Release job must have an eligibility condition');

function eligible(strategy: string, environment: string, result: string) {
  return runInNewContext(expression!, {
    needs: {
      resolve: { outputs: { strategy, environment } },
      'deploy-worker': { result },
    },
  });
}

test('successful regular promotion is eligible for a GitHub Release', () => {
  assert.equal(eligible('promote', 'production', 'success'), true);
});

test('successful hotfix deployment does not create a GitHub Release', () => {
  assert.equal(eligible('hotfix', 'production', 'success'), false);
});

test('candidate upload does not create a GitHub Release', () => {
  assert.equal(eligible('upload', 'preview', 'success'), false);
});

test('failed, cancelled, or skipped promotion does not create a GitHub Release', () => {
  for (const result of ['failure', 'cancelled', 'skipped']) {
    assert.equal(eligible('promote', 'production', result), false, result);
  }
});
