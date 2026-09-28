import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldAutoMerge } from './dependabot-policy.ts';

const eligible = {
  author: 'dependabot[bot]',
  baseRef: 'release/v0.1.0',
  targetBranch: 'release/v0.1.0',
  ecosystem: 'npm_and_yarn',
  updateType: 'version-update:semver-patch',
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

test('accepts future release branches when the metadata target matches the PR base', () => {
  for (const baseRef of ['release/v0.2.0', 'release/2027/q1']) {
    assert.equal(
      shouldAutoMerge({ ...eligible, baseRef, targetBranch: baseRef }),
      true,
    );
  }
});

test('rejects wrong author, target branch, ecosystem, or missing metadata', () => {
  assert.equal(shouldAutoMerge({ ...eligible, author: 'alice' }), false);
  assert.equal(shouldAutoMerge({ ...eligible, baseRef: 'main' }), false);
  assert.equal(shouldAutoMerge({ ...eligible, baseRef: 'release/' }), false);
  assert.equal(
    shouldAutoMerge({ ...eligible, baseRef: 'release-candidate' }),
    false,
  );
  assert.equal(shouldAutoMerge({ ...eligible, ecosystem: 'docker' }), false);
  assert.equal(shouldAutoMerge({ ...eligible, updateType: '' }), false);
});

test('rejects metadata targeting a different release branch', () => {
  assert.equal(
    shouldAutoMerge({ ...eligible, targetBranch: 'release/v0.2.0' }),
    false,
  );
});
