import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  auditDecision,
  deploymentTarget,
  releaseBranches,
  versionDecision,
} from './policy.ts';

test('release version comparison never downgrades and rejects malformed input', () => {
  assert.deepEqual(versionDecision('release/0.1.0', '0.0.1'), {
    target: '0.1.0',
    bump: true,
  });
  assert.deepEqual(versionDecision('release/0.1.0', '0.1.0'), {
    target: '0.1.0',
    bump: false,
  });
  assert.throws(() => versionDecision('release/0.1.0', '0.2.0'), /higher/);
  for (const branch of [
    'main',
    'release/latest',
    'release/01.1.0',
    'release/0.1.0/extra',
  ])
    assert.throws(() => versionDecision(branch, '0.0.1'));
});

test('only merged same-repository work and release PRs resolve deployment targets', () => {
  const pr = {
    merged: true,
    merge_commit_sha: 'a'.repeat(40),
    base: { ref: 'release/0.1.0', repo: { full_name: 'owner/blog' } },
    head: { ref: 'codex/work', repo: { full_name: 'owner/blog' } },
  };
  assert.equal(deploymentTarget(pr, 'owner/blog')?.environment, 'preview');
  assert.equal(deploymentTarget({ ...pr, merged: false }, 'owner/blog'), null);
  assert.equal(
    deploymentTarget(
      {
        ...pr,
        base: { ...pr.base, ref: 'main' },
        head: { ...pr.head, ref: 'release/0.1.0' },
      },
      'owner/blog',
    )?.environment,
    'production',
  );
  assert.throws(
    () =>
      deploymentTarget(
        { ...pr, base: { ...pr.base, ref: 'main' } },
        'owner/blog',
      ),
    /release/,
  );
  assert.throws(
    () =>
      deploymentTarget(
        { ...pr, head: { ...pr.head, repo: { full_name: 'fork/blog' } } },
        'owner/blog',
      ),
    /repository/,
  );
});

test('scheduled audit detects ambiguous releases and supports a release-free interval', () => {
  assert.deepEqual(releaseBranches(['main']), ['main']);
  assert.deepEqual(releaseBranches(['main', 'release/0.1.0', 'codex/test']), [
    'main',
    'release/0.1.0',
  ]);
  assert.throws(
    () => releaseBranches(['release/0.1.0', 'release/0.2.0']),
    /multiple/,
  );
});

test('audit fails on high findings, invalid reports and expired exceptions', () => {
  const report = {
    advisories: {
      1: {
        severity: 'high',
        url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc',
      },
    },
  };
  assert.equal(auditDecision(report, []).length, 1);
  assert.equal(
    auditDecision(report, [
      {
        ghsa: 'GHSA-aaaa-bbbb-cccc',
        reason: 'Not reachable',
        reviewBy: '2099-01-01',
      },
    ]).length,
    0,
  );
  assert.throws(
    () =>
      auditDecision(report, [
        {
          ghsa: 'GHSA-aaaa-bbbb-cccc',
          reason: 'Not reachable',
          reviewBy: '2000-01-01',
        },
      ]),
    /expired/,
  );
  assert.throws(
    () => auditDecision({ error: 'registry unavailable' }, []),
    /Invalid audit/,
  );
});
