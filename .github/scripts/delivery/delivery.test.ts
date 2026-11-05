/* eslint-disable @typescript-eslint/require-await -- Fetch test doubles resolve without real I/O. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GitHubClient } from './github.ts';
import {
  ciPassed,
  classifyUpdates,
  parseReleaseBranch,
  readReviewEvidence,
  resolveTarget,
  selectRelease,
} from './policy.ts';

const sha = 'a'.repeat(40);
const update = {
  dependencyName: 'vite',
  dependencyType: 'direct:development',
  packageEcosystem: 'npm_and_yarn',
  updateType: 'version-update:semver-minor',
  prevVersion: '1.2.3',
  newVersion: '1.3.0',
};

await test('release versions are stable, canonical, and do not accept injected refs', () => {
  assert.deepEqual(parseReleaseBranch('release/1.2.3'), {
    version: '1.2.3',
    branch: 'release/1.2.3',
    tag: 'v1.2.3',
  });
  for (const ref of [
    'release/v1.2.3',
    'release/01.2.3',
    'release/1.2.3-beta',
    'release/1.2.3\n',
    'release/1.2.3;id',
  ]) {
    assert.throws(() => parseReleaseBranch(ref));
  }
});

await test('a mixed dependency group is eligible only when every dependency qualifies', () => {
  assert.equal(classifyUpdates([update]).eligible, true);
  for (const blocked of [
    { ...update, dependencyType: 'direct:production' },
    { ...update, prevVersion: '0.2.0', newVersion: '0.3.0' },
    {
      ...update,
      prevVersion: '1.2.3',
      newVersion: '2.0.0',
      updateType: 'version-update:semver-major',
    },
    { ...update, dependencyType: 'indirect' },
    { ...update, updateType: null, prevVersion: '^1.2.3' },
    { ...update, updateType: 'version-update:semver-patch' },
  ])
    assert.equal(classifyUpdates([update, blocked]).eligible, false);
  assert.equal(
    classifyUpdates([{ ...update, updateType: null }]).eligible,
    true,
  );
  assert.equal(
    classifyUpdates([
      {
        ...update,
        dependencyType: 'direct:production',
        updateType: null,
        newVersion: '1.2.4',
      },
    ]).eligible,
    true,
  );
  assert.equal(
    classifyUpdates([
      {
        ...update,
        packageEcosystem: 'github_actions',
        dependencyType: 'unknown',
      },
    ]).eligible,
    true,
  );
  assert.equal(classifyUpdates([]).eligible, false);
});

function review(head = sha, changes: Record<string, unknown> = {}) {
  return {
    user: { id: 199175422, login: 'chatgpt-codex-connector[bot]', type: 'Bot' },
    html_url: 'https://github.com/herokwon/blog/pull/3#issuecomment-1',
    body: `<!-- codex-review-state:v1 ${JSON.stringify({ code_review: { commit_sha: head, status: 'completed', has_any_findings: false, has_unresolved_findings: false, ...changes } })} -->`,
  };
}

await test('only authenticated current-head completed no-findings Codex reviews pass', () => {
  assert.equal(readReviewEvidence([review()], sha)?.hasFindings, false);
  assert.equal(readReviewEvidence([review('b'.repeat(40))], sha), null);
  assert.equal(
    readReviewEvidence([{ ...review(), user: { login: 'someone' } }], sha),
    null,
  );
  assert.equal(
    readReviewEvidence([review(sha, { status: 'pending' })], sha)?.completed,
    false,
  );
  assert.equal(
    readReviewEvidence([review(sha, { has_any_findings: true })], sha)
      ?.hasFindings,
    true,
  );
  assert.equal(
    readReviewEvidence(
      [{ ...review(), body: '<!-- codex-review-state:v2 {} -->' }],
      sha,
    ),
    null,
  );
  assert.equal(
    readReviewEvidence([review(), review(sha, { has_any_findings: true })], sha)
      ?.hasFindings,
    true,
  );
});

await test('release selection excludes frozen branches and blocks ambiguity', () => {
  assert.equal(selectRelease(['release/1.2.3'], []).branch, 'release/1.2.3');
  assert.equal(
    selectRelease(['release/1.2.3'], ['release/1.2.3']).state,
    'deferred',
  );
  assert.throws(() => selectRelease(['release/1.2.3', 'release/1.3.0'], []));
  assert.equal(selectRelease([], []).state, 'create');
});

const pull = {
  number: 3,
  state: 'closed',
  draft: false,
  merged: true,
  merge_commit_sha: sha,
  head: {
    ref: 'work/test',
    sha: 'b'.repeat(40),
    repo: { full_name: 'herokwon/blog' },
  },
  base: { ref: 'release/0.1.0', sha, repo: { full_name: 'herokwon/blog' } },
  user: { login: 'dependabot[bot]' },
};

await test('deployment selects the actual merge SHA, accepts bots, and rejects stale or unsupported sources', () => {
  assert.equal(resolveTarget(pull, 'herokwon/blog', sha)?.sha, sha);
  assert.equal(resolveTarget(pull, 'herokwon/blog', 'c'.repeat(40)), null);
  assert.equal(
    resolveTarget({ ...pull, merged: false }, 'herokwon/blog', sha),
    null,
  );
  assert.throws(() =>
    resolveTarget(
      { ...pull, base: { ...pull.base, ref: 'main' } },
      'herokwon/blog',
      sha,
    ),
  );
  assert.equal(
    resolveTarget(
      {
        ...pull,
        head: { ...pull.head, ref: 'release/0.1.0' },
        base: { ...pull.base, ref: 'main' },
      },
      'herokwon/blog',
      sha,
    )?.environment,
    'production',
  );
});

await test('a failed or pending rerun and skipped required jobs cannot reuse earlier CI success', () => {
  const jobs = ['Lint', 'Type Check', 'Build', 'Test'].map(name => ({
    name,
    conclusion: 'success',
    status: 'completed',
  }));
  assert.equal(
    ciPassed({ status: 'completed', conclusion: 'success' }, jobs),
    true,
  );
  assert.equal(
    ciPassed({ status: 'in_progress', conclusion: null }, jobs),
    false,
  );
  assert.equal(
    ciPassed({ status: 'completed', conclusion: 'failure' }, jobs),
    false,
  );
  assert.equal(
    ciPassed({ status: 'completed', conclusion: 'success' }, jobs.slice(1)),
    false,
  );
  assert.equal(
    ciPassed(
      { status: 'completed', conclusion: 'success' },
      jobs.map(j => ({ ...j, conclusion: 'skipped' })),
    ),
    false,
  );
});

await test('GitHub reads retry transient failures and paginate without masking authorization errors', async () => {
  let calls = 0;
  const client = new GitHubClient(
    'token',
    async input => {
      calls++;
      if (calls === 1) return new Response('', { status: 503 });
      if (
        (typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url
        ).includes('page=2')
      )
        return Response.json([]);
      return Response.json(Array.from({ length: 100 }, (_, id) => ({ id })));
    },
    async () => {},
  );
  assert.equal(
    (await client.paginate('/repos/herokwon/blog/issues')).length,
    100,
  );
  assert.equal(calls, 3);
  const forbidden = new GitHubClient(
    'token',
    async () => new Response('', { status: 403 }),
    async () => {},
  );
  await assert.rejects(
    forbidden.optional('/repos/herokwon/blog/contents/package.json'),
    /403/,
  );
});

await test('GitHub mutations are not blindly retried after an uncertain network result', async () => {
  let calls = 0;
  const client = new GitHubClient(
    'token',
    async () => {
      calls++;
      throw new Error('network');
    },
    async () => {},
  );
  await assert.rejects(
    client.request('POST', '/repos/herokwon/blog/issues', {}),
  );
  assert.equal(calls, 1);
});
