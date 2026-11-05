/* eslint-disable @typescript-eslint/require-await -- Fetch test doubles resolve without real I/O. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { readIntake, validSynchronization } from './dependabot.ts';
import { publishRelease, renderComment, verifyHttp } from './deployment.ts';
import { GitHubClient, Repository } from './github.ts';
import {
  ciPassed,
  classifyUpdates,
  parseReleaseBranch,
  readReviewEvidence,
  resolveTarget,
  selectRelease,
} from './policy.ts';
import {
  prepareReleaseVersion,
  releaseInput,
  validateVersionChange,
} from './release-version.ts';

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
  assert.equal(selectRelease(['release/1.2.3'], [], '1.2.3').state, 'create');
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

await test('Dependabot receipts cannot authorize a different head, author, PR, or arbitrary descendant', () => {
  const receipt = { pr: 3, headSha: sha, originalSha: sha, updates: [update] };
  const comment = {
    id: 1,
    user: { id: 123, login: 'blog-bot[bot]', type: 'Bot' },
    body: `<!-- dependabot-intake:v1 ${JSON.stringify(receipt)} -->`,
  };
  assert.deepEqual(readIntake([comment], 3, sha, 123, 'blog-bot'), receipt);
  assert.equal(readIntake([comment], 4, sha, 123, 'blog-bot'), null);
  assert.equal(readIntake([comment], 3, 'b'.repeat(40), 123, 'blog-bot'), null);
  assert.equal(readIntake([comment], 3, sha, 999, 'blog-bot'), null);
  const commit = {
    author: { id: 123 },
    parents: [{ sha }, { sha: 'b'.repeat(40) }],
    commit: { verification: { verified: true } },
  };
  assert.equal(validSynchronization(commit, sha, 'b'.repeat(40), 123), true);
  assert.equal(
    validSynchronization(
      { ...commit, parents: [{ sha }] },
      sha,
      'b'.repeat(40),
      123,
    ),
    false,
  );
  assert.equal(
    validSynchronization(
      { ...commit, commit: { verification: { verified: false } } },
      sha,
      'b'.repeat(40),
      123,
    ),
    false,
  );
});

await test('release preparation rejects forks, drafts, downgrades, and unrelated package edits', () => {
  const releasePull = {
    ...pull,
    state: 'open',
    merged: false,
    head: { ...pull.head, ref: 'release/0.1.0' },
    base: { ...pull.base, ref: 'main' },
  };
  assert.equal(
    releaseInput(releasePull, 'herokwon/blog', null).version,
    '0.1.0',
  );
  assert.throws(() =>
    releaseInput({ ...releasePull, draft: true }, 'herokwon/blog', null),
  );
  assert.throws(() =>
    releaseInput(
      {
        ...releasePull,
        head: { ...releasePull.head, repo: { full_name: 'someone/blog' } },
      },
      'herokwon/blog',
      null,
    ),
  );
  assert.throws(() => releaseInput(releasePull, 'herokwon/blog', '0.1.0'));
  assert.equal(
    validateVersionChange(
      { version: '0.0.1', private: true },
      { version: '0.1.0', private: true },
      '0.1.0',
    ),
    true,
  );
  assert.equal(
    validateVersionChange(
      { version: '0.0.1', private: true },
      { version: '0.1.0', private: false },
      '0.1.0',
    ),
    false,
  );
});

await test('an unchanged existing version PR remains resumable for CI and review', async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), 'blog-delivery-'));
  const originalCwd = process.cwd();
  const originalEnv = {
    output: process.env.GITHUB_OUTPUT,
    id: process.env.APP_BOT_ID,
    slug: process.env.APP_SLUG,
  };
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: fixture,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  try {
    git('init', '--initial-branch=release/0.1.0');
    git('config', 'user.name', 'Test');
    git('config', 'user.email', 'test@example.com');
    writeFileSync(
      path.join(fixture, 'package.json'),
      '{"version":"0.0.1","private":true}',
    );
    writeFileSync(path.join(fixture, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
    git('add', '.');
    git('commit', '-m', 'initial');
    const source = git('rev-parse', 'HEAD');
    git('switch', '-c', 'automation/release/0.1.0');
    writeFileSync(
      path.join(fixture, 'package.json'),
      '{"version":"0.1.0","private":true}',
    );
    git('commit', '-am', 'version');
    const child = git('rev-parse', 'HEAD');
    git('switch', 'release/0.1.0');
    git('remote', 'add', 'origin', fixture);
    const original = {
      ...pull,
      state: 'open',
      merged: false,
      head: { ...pull.head, ref: 'release/0.1.0', sha: source },
      base: { ...pull.base, ref: 'main' },
    };
    const api = new GitHubClient('token', async input => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.includes('/pulls/3')) return Response.json(original);
      if (url.includes('/git/ref/heads/'))
        return Response.json({ object: { sha: source } });
      if (url.includes('/contents/package.json'))
        return Response.json({
          content: Buffer.from('{"version":"0.0.1","private":true}').toString(
            'base64',
          ),
        });
      if (url.includes('/pulls?'))
        return Response.json([
          {
            ...original,
            number: 4,
            user: { id: 123, login: 'blog-bot[bot]' },
            head: {
              ...original.head,
              ref: 'automation/release/0.1.0',
              sha: child,
            },
          },
        ]);
      throw new Error(`Unexpected fixture request: ${url}`);
    });
    process.env.GITHUB_OUTPUT = path.join(fixture, 'outputs');
    process.env.APP_BOT_ID = '123';
    process.env.APP_SLUG = 'blog-bot';
    process.chdir(fixture);
    await prepareReleaseVersion(
      new Repository('herokwon/blog', 'token', api),
      3,
    );
    assert.match(
      readFileSync(process.env.GITHUB_OUTPUT, 'utf8'),
      /needs-pr=true/,
    );
    assert.match(
      readFileSync(process.env.GITHUB_OUTPUT, 'utf8'),
      /changed=false/,
    );
  } finally {
    process.chdir(originalCwd);
    for (const [key, value] of Object.entries({
      GITHUB_OUTPUT: originalEnv.output,
      APP_BOT_ID: originalEnv.id,
      APP_SLUG: originalEnv.slug,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    assert.ok(fixture.startsWith(path.join(tmpdir(), 'blog-delivery-')));
    rmSync(fixture, { recursive: true, force: true });
  }
});

const production = {
  prNumber: 3,
  environment: 'production' as const,
  branch: 'main',
  sha,
  workerName: 'blog',
  url: 'https://blog.herokwon.dev',
  version: '0.1.0',
};

await test('HTTP verification retries transient errors but fails on a non-HTML or wrong homepage', async () => {
  let attempts = 0;
  await verifyHttp(
    production,
    Date.now() + 1000,
    async () => {
      attempts++;
      return attempts === 1
        ? new Response('', { status: 503 })
        : new Response('<title>Personal Blog</title>', {
            headers: { 'content-type': 'text/html' },
          });
    },
    async () => {},
  );
  assert.equal(attempts, 2);
  await assert.rejects(
    verifyHttp(
      production,
      Date.now() - 1,
      async () => new Response('wrong'),
      async () => {},
    ),
    /HTTP verification/,
  );
});

await test('publication reuses exact-SHA tags and releases and never moves a conflicting tag', async () => {
  const requests: string[] = [];
  const repository = (tagSha: string) =>
    new Repository(
      'herokwon/blog',
      'token',
      new GitHubClient('token', async (input, init) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        requests.push(`${init?.method} ${url}`);
        if (url.includes('/contents/package.json'))
          return Response.json({
            content: Buffer.from('{"version":"0.1.0"}').toString('base64'),
          });
        if (url.includes('/git/ref/tags/'))
          return Response.json({ object: { type: 'commit', sha: tagSha } });
        if (url.includes('/releases/tags/'))
          return Response.json({
            id: 1,
            tag_name: 'v0.1.0',
            draft: false,
            prerelease: false,
            html_url: 'https://github.com/herokwon/blog/releases/tag/v0.1.0',
          });
        throw new Error(`Unexpected publication mutation: ${url}`);
      }),
    );
  assert.match(await publishRelease(repository(sha), production), /v0\.1\.0/);
  assert.ok(requests.every(request => request.startsWith('GET ')));
  await assert.rejects(
    publishRelease(repository('b'.repeat(40)), production),
    /different commit/,
  );
});

await test('deployment comments distinguish successful delivery from publication failure with minimal content', () => {
  const partial = renderComment(
    production,
    'herokwon/blog',
    'https://github.com/herokwon/blog/actions/runs/1',
    { worker: true, publication: false, stage: 'Release publication' },
  );
  assert.match(partial, /Production deployed; release publication failed/);
  assert.match(partial, /<!-- deployment-result:production -->/);
  assert.doesNotMatch(partial, /avatar|Author|Dashboard|\|/);
  const failure = renderComment(
    production,
    'herokwon/blog',
    'https://github.com/herokwon/blog/actions/runs/1',
    { worker: false, publication: false, stage: 'HTTP verification' },
  );
  assert.match(failure, /HTTP verification/);
  assert.doesNotMatch(failure, /Open site/);
});
