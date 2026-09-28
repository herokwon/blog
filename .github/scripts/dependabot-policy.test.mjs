import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldAutoMerge } from './dependabot-policy.mjs';

const eligible = {
  author: 'dependabot[bot]',
  baseRef: 'release/v0.1.0',
  ecosystem: 'npm_and_yarn',
  updateType: 'version-update:semver-patch',
  securityUpdate: false,
};

test('allows npm and Actions patch/minor version updates', () => {
  for (const ecosystem of ['npm_and_yarn', 'github_actions']) {
    for (const updateType of [
      'version-update:semver-patch',
      'version-update:semver-minor',
    ]) {
      assert.equal(
        shouldAutoMerge({ ...eligible, ecosystem, updateType }),
        true,
      );
    }
  }
});

test('keeps a grouped PR with a major update for manual review', () => {
  assert.equal(
    shouldAutoMerge({ ...eligible, updateType: 'version-update:semver-major' }),
    false,
  );
});

test('rejects wrong author, target branch, ecosystem, or missing metadata', () => {
  assert.equal(shouldAutoMerge({ ...eligible, author: 'alice' }), false);
  assert.equal(shouldAutoMerge({ ...eligible, baseRef: 'main' }), false);
  assert.equal(shouldAutoMerge({ ...eligible, ecosystem: 'docker' }), false);
  assert.equal(shouldAutoMerge({ ...eligible, updateType: '' }), false);
});

test('never auto-merges a security update', () => {
  assert.equal(shouldAutoMerge({ ...eligible, securityUpdate: true }), false);
});
