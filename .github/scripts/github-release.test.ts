import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const workflow = readFileSync(
  new URL('../workflows/deployment.yml', import.meta.url),
  'utf8',
);
function jobCondition(job: string) {
  const block = workflow.split(`  ${job}:`)[1]?.split(/\r?\n {2}[\w-]+:/)[0];
  const condition = block?.match(
    /^ {4}if: >-\r?\n((?: {6}.*(?:\r?\n|$))+)/m,
  )?.[1];
  assert.ok(condition, `Missing condition for ${job}`);
  return condition.trim().replace(/needs\.([\w-]+)/g, 'needs["$1"]');
}

const expression = jobCondition('github-release');

function eligible(strategy: string, environment: string, result: string) {
  return runInNewContext(expression, {
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

test('failed tag validation blocks D1 and promotion even with a valid candidate', () => {
  for (const result of ['failure', 'cancelled', 'skipped']) {
    const context = {
      always: () => true,
      needs: {
        resolve: { result: 'success', outputs: { strategy: 'promote' } },
        'validate-release-tag': { result },
        'select-release-version': { result: 'success' },
        'migrate-d1': { result: 'success' },
      },
    };
    assert.equal(runInNewContext(jobCondition('migrate-d1'), context), false);
    assert.equal(
      runInNewContext(jobCondition('deploy-worker'), context),
      false,
    );
  }
});

test('successful preflight allows promotion while hotfix and preview bypass release gates', () => {
  const context = {
    always: () => true,
    needs: {
      resolve: { result: 'success', outputs: { strategy: 'promote' } },
      'validate-release-tag': { result: 'success' },
      'select-release-version': { result: 'success' },
      'migrate-d1': { result: 'success' },
    },
  };
  assert.equal(runInNewContext(jobCondition('migrate-d1'), context), true);
  assert.equal(runInNewContext(jobCondition('deploy-worker'), context), true);
  for (const strategy of ['hotfix', 'upload']) {
    context.needs.resolve.outputs.strategy = strategy;
    context.needs['validate-release-tag'].result = 'skipped';
    context.needs['select-release-version'].result = 'skipped';
    context.needs['migrate-d1'].result = 'skipped';
    assert.equal(runInNewContext(jobCondition('migrate-d1'), context), false);
    assert.equal(runInNewContext(jobCondition('deploy-worker'), context), true);
  }
});
