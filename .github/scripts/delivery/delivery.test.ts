/* eslint-disable @typescript-eslint/require-await -- Fetch test doubles resolve without real I/O. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  authenticateNativeHead,
  readIntake,
  runDependabotPullRequest,
  validSynchronization,
} from './dependabot.ts';
import {
  cleanup,
  mergedPullForPush,
  publishRelease,
  renderComment,
  verifyHttp,
  verifyInBrowser,
} from './deployment.ts';
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

function requestBody(init?: RequestInit): string {
  if (typeof init?.body !== 'string')
    throw new Error('Expected serialized GitHub request body');
  return init.body;
}

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

async function withEnvironment(
  values: Record<string, string | undefined>,
  run: () => Promise<void>,
) {
  const previous = Object.fromEntries(
    Object.keys(values).map(key => [key, process.env[key]]),
  );
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

await test('fresh metadata cannot authorize extra commits beyond the signed Dependabot update', async () => {
  const native = {
    ...pull,
    state: 'open',
    merged: false,
    head: { ...pull.head, ref: 'dependabot/npm/test' },
  };
  const signed = {
    sha: native.head.sha,
    author: { login: 'dependabot[bot]' },
    commit: { verification: { verified: true } },
  };
  const repository = (commits: unknown[]) => {
    const repo = new Repository(
      'herokwon/blog',
      'token',
      new GitHubClient('token', async input => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        return Response.json(url.includes('/pulls/') ? commits : commits[0]);
      }),
    );
    repo.pull = async () => native;
    return repo;
  };
  await assert.rejects(
    authenticateNativeHead(
      repository([signed, { ...signed, sha }]),
      native,
      native.head.sha,
    ),
    /single signed Dependabot/,
  );
  await authenticateNativeHead(repository([signed]), native, native.head.sha);
});

await test('a waiting Dependabot run cannot merge a new head under its old intake classification', async () => {
  await withEnvironment(
    {
      APP_BOT_ID: '123',
      APP_SLUG: 'blog-bot',
      DEPENDABOT_METADATA: undefined,
      GITHUB_STEP_SUMMARY: undefined,
    },
    async () => {
      const next = 'b'.repeat(40),
        mergedHeads: string[] = [];
      const native = {
        ...pull,
        state: 'open',
        merged: false,
        head: { ...pull.head, ref: 'dependabot/npm/test', sha },
        base: { ...pull.base, ref: 'release/1.3.0' },
      };
      const advanced = { ...native, head: { ...native.head, sha: next } };
      const api = new GitHubClient('token', async (input, init) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (url.includes('/branches'))
          return Response.json([{ name: 'release/1.3.0' }]);
        if (url.includes('/actions/workflows/ci.yml/runs'))
          return Response.json({
            workflow_runs: [
              {
                id: 5,
                head_sha: next,
                run_attempt: 1,
                status: 'completed',
                conclusion: 'success',
              },
            ],
          });
        if (url.includes('/actions/runs/5/jobs'))
          return Response.json({
            jobs: ['Lint', 'Type Check', 'Build', 'Test'].map(name => ({
              name,
              status: 'completed',
              conclusion: 'success',
            })),
          });
        if (url.endsWith('/pulls/3/merge')) {
          mergedHeads.push(
            (JSON.parse(requestBody(init)) as { sha: string }).sha,
          );
          return Response.json({ merged: true });
        }
        throw new Error(`Unexpected request: ${url}`);
      });
      const repo = new Repository('herokwon/blog', 'token', api);
      let reads = 0;
      repo.pull = async () => (++reads === 1 ? native : advanced);
      repo.comments = async () => [
        {
          id: 1,
          user: { id: 123, login: 'blog-bot[bot]', type: 'Bot' },
          body: `<!-- dependabot-intake:v1 ${JSON.stringify({ pr: 3, headSha: sha, originalSha: sha, updates: [update] })} -->`,
        },
        { ...review(next), id: 2 },
      ];
      repo.frozenReleases = async () => [];
      repo.version = async () => '1.2.0';
      repo.ref = async () => sha;
      repo.assignMilestone = async () => {};
      repo.synchronize = async () => false;
      repo.behind = async () => false;
      await runDependabotPullRequest(repo, 3);
      assert.deepEqual(mergedHeads, []);
    },
  );
});

await test('new failed delivery blocks older success and native PR-head runs need merged-SHA association', async () => {
  let failed = true,
    head = sha;
  const repo = new Repository(
    'herokwon/blog',
    'token',
    new GitHubClient('token', async input => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.includes('/deployments?'))
        return Response.json(
          (failed ? [20, 10] : [10]).map(id => ({
            id,
            sha,
            environment: 'production',
            creator: { id: 41898282 },
            performed_via_github_app: { id: 15368 },
          })),
        );
      if (url.includes('/deployments/') && url.includes('/statuses'))
        return Response.json([
          {
            state: url.includes('/20/') ? 'failure' : 'success',
            log_url: 'https://github.com/herokwon/blog/actions/runs/5/job/7',
            environment_url: production.url,
            creator: { id: 41898282 },
          },
        ]);
      if (url.endsWith('/actions/runs/5'))
        return Response.json({
          id: 5,
          head_sha: head,
          head_branch: 'release/0.1.0',
          path: '.github/workflows/deployment.yml',
          event: 'pull_request',
        });
      if (url.includes('/actions/runs/5/jobs'))
        return Response.json({
          jobs: [
            {
              id: 7,
              name: 'Deploy Worker',
              status: 'completed',
              conclusion: 'success',
            },
          ],
        });
      if (url.includes('/commits/') && url.includes('/pulls'))
        return Response.json([
          {
            ...pull,
            merged_at: '2026-11-06T00:00:00Z',
            head: { ...pull.head, ref: 'release/0.1.0', sha: 'b'.repeat(40) },
            base: { ...pull.base, ref: 'main' },
          },
        ]);
      throw new Error(`Unexpected evidence request: ${url}`);
    }),
  );
  assert.equal(await repo.verifiedDeployment(sha, 'production'), null);
  failed = false;
  head = 'b'.repeat(40);
  assert.deepEqual(await repo.verifiedDeployment(sha, 'production'), {
    deploymentId: 10,
    runId: 5,
  });
  head = 'c'.repeat(40);
  assert.equal(await repo.verifiedDeployment(sha, 'production'), null);
});

await test('cleanup recognizes an unchanged squash-merged head while preserving dependent work', async () => {
  await withEnvironment(
    { GITHUB_REF_NAME: 'release/0.1.0', GITHUB_STEP_SUMMARY: undefined },
    async () => {
      const source = 'work/squash',
        sourceSha = 'b'.repeat(40);
      const branches = new Map([[source, sourceSha]]);
      let dependent = false;
      const native = {
        ...pull,
        head: { ...pull.head, ref: source, sha: sourceSha },
      };
      const repo = new Repository(
        'herokwon/blog',
        'token',
        new GitHubClient('token', async input => {
          const url =
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.href
                : input.url;
          if (url.includes('/git/ref/heads/'))
            return Response.json({ object: { sha: branches.get(source) } });
          if (url.includes('/pulls?'))
            return Response.json(
              dependent
                ? [
                    {
                      ...native,
                      state: 'open',
                      base: { ...native.base, ref: source },
                    },
                  ]
                : [],
            );
          if (url.includes('/compare/')) return Response.json({ ahead_by: 1 }); // Squash deliberately preserves no head ancestry.
          throw new Error(`Unexpected cleanup request: ${url}`);
        }),
      );
      repo.pull = async () => native;
      repo.ref = async () => sha;
      const target = resolveTarget(native, 'herokwon/blog', sha);
      assert.ok(target);
      const remove = async (branch: string, expected: string) => {
        if (branches.get(branch) !== expected) throw new Error('Head changed');
        branches.delete(branch);
      };
      await cleanup(repo, target, remove);
      assert.equal(branches.has(source), false);
      branches.set(source, sourceSha);
      dependent = true;
      await cleanup(repo, target, remove);
      assert.equal(branches.has(source), true);
      dependent = false;
      branches.set(source, 'c'.repeat(40));
      await cleanup(repo, target, remove);
      assert.equal(branches.get(source), 'c'.repeat(40));
    },
  );
});

await test('concurrent milestone and release creation reuse the winner without overwriting its ref', async () => {
  let milestoneExists = false;
  const milestones = new Repository(
    'herokwon/blog',
    'token',
    new GitHubClient('token', async (_input, init) => {
      if (init?.method === 'POST') {
        milestoneExists = true;
        return new Response('', { status: 422 });
      }
      return Response.json(
        milestoneExists ? [{ number: 1, title: '1.2.1', state: 'open' }] : [],
      );
    }),
  );
  assert.equal(await milestones.milestone('1.2.1'), 1);
  await withEnvironment(
    {
      APP_BOT_ID: '123',
      APP_SLUG: 'blog-bot',
      DEPENDABOT_METADATA: undefined,
      GITHUB_STEP_SUMMARY: undefined,
    },
    async () => {
      let refExists = false,
        routed = '';
      const native = {
        ...pull,
        state: 'open',
        merged: false,
        head: { ...pull.head, ref: 'dependabot/npm/test', sha },
        base: { ...pull.base, ref: 'main' },
      };
      const repo = new Repository(
        'herokwon/blog',
        'token',
        new GitHubClient('token', async (input, init) => {
          const url =
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.href
                : input.url;
          if (url.endsWith('/git/refs') && init?.method === 'POST') {
            refExists = true;
            return new Response('', { status: 422 });
          }
          if (url.includes('/git/ref/heads/'))
            return refExists
              ? Response.json({ object: { sha } })
              : new Response('', { status: 404 });
          if (url.includes('/branches')) return Response.json([]);
          if (url.endsWith('/pulls/3') && init?.method === 'PATCH') {
            routed = (JSON.parse(requestBody(init)) as { base: string }).base;
            native.base.ref = routed;
            return Response.json(native);
          }
          throw new Error(`Unexpected creation request: ${url}`);
        }),
      );
      repo.pull = async () => native;
      repo.ref = async () => sha;
      repo.version = async () => '1.2.0';
      repo.frozenReleases = async () => [];
      repo.milestone = async () => 1;
      repo.assignMilestone = async () => {};
      repo.synchronize = async () => false;
      repo.comments = async () => [
        {
          id: 1,
          user: { id: 123, login: 'blog-bot[bot]', type: 'Bot' },
          body: `<!-- dependabot-intake:v1 ${JSON.stringify({ pr: 3, headSha: sha, originalSha: sha, updates: [{ ...update, updateType: 'version-update:semver-major', newVersion: '2.0.0' }] })} -->`,
        },
      ];
      await runDependabotPullRequest(repo, 3);
      assert.equal(routed, 'release/1.2.1');
    },
  );
});

await test('push deployment resolves only the exact merged PR on the pushed protected branch', async () => {
  let associated = [pull];
  const repo = new Repository(
    'herokwon/blog',
    'token',
    new GitHubClient('token', async () => Response.json(associated)),
  );
  assert.equal(await mergedPullForPush(repo, sha, 'release/0.1.0'), 3);
  associated = [{ ...pull, merge_commit_sha: 'b'.repeat(40) }];
  assert.equal(await mergedPullForPush(repo, sha, 'release/0.1.0'), null);
  associated = [{ ...pull, base: { ...pull.base, ref: 'main' } }];
  assert.equal(await mergedPullForPush(repo, sha, 'release/0.1.0'), null);
  associated = [{ ...pull, merged: false, state: 'open' }];
  assert.equal(await mergedPullForPush(repo, sha, 'release/0.1.0'), null);
  associated = [
    { ...pull, head: { ...pull.head, repo: { full_name: 'someone/blog' } } },
  ];
  assert.equal(await mergedPullForPush(repo, sha, 'release/0.1.0'), null);
});

await test('native environment evidence accepts the human actor through its authenticated GitHub Actions App', async () => {
  let appId = 15368;
  const repo = new Repository(
    'herokwon/blog',
    'token',
    new GitHubClient('token', async input => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.includes('/deployments?'))
        return Response.json([
          {
            id: 1,
            sha,
            environment: 'preview',
            creator: { id: 171362987 },
            performed_via_github_app: { id: appId },
          },
        ]);
      if (url.includes('/statuses'))
        return Response.json([
          {
            state: 'success',
            creator: { id: 171362987 },
            log_url: 'https://github.com/herokwon/blog/actions/runs/2/job/3',
          },
        ]);
      if (url.endsWith('/actions/runs/2'))
        return Response.json({
          id: 2,
          head_sha: sha,
          event: 'push',
          path: '.github/workflows/deployment.yml',
        });
      if (url.includes('/jobs'))
        return Response.json({
          jobs: [
            {
              id: 3,
              name: 'Deploy Worker',
              status: 'completed',
              conclusion: 'success',
            },
          ],
        });
      throw new Error(`Unexpected native evidence request: ${url}`);
    }),
  );
  assert.deepEqual(await repo.verifiedDeployment(sha, 'preview'), {
    deploymentId: 1,
    runId: 2,
  });
  appId = 999;
  assert.equal(await repo.verifiedDeployment(sha, 'preview'), null);
});

await test('only a Cloudflare challenge uses the fresh browser verifier within the same deadline', async () => {
  let browserChecks = 0;
  const deadline = Date.now() + 1000;
  const browser = async (target: { url: string }, end: number) => {
    assert.equal(target.url, production.url);
    assert.equal(end, deadline);
    browserChecks++;
  };
  await verifyHttp(
    production,
    deadline,
    async () =>
      new Response('', {
        status: 403,
        headers: { 'cf-mitigated': 'challenge' },
      }),
    async () => {},
    browser,
  );
  assert.equal(browserChecks, 1);
  await assert.rejects(
    verifyHttp(
      production,
      Date.now() - 1,
      async () => new Response('', { status: 403 }),
      async () => {},
      browser,
    ),
    /HTTP verification/,
  );
  assert.equal(browserChecks, 1);
});

await test('browser verification waits for the final root document and rejects a forbidden document with the right title', async () => {
  let forbidden = false;
  const server = createServer((request, response) => {
    if (!forbidden && request.url?.includes('cleared=1')) {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<title>Personal Blog</title><main>Ready</main>');
      return;
    }
    response.writeHead(403, {
      'content-type': 'text/html',
      'cf-mitigated': 'challenge',
    });
    response.end(
      forbidden
        ? '<title>Personal Blog</title>'
        : `<title>Checking</title><script>setTimeout(() => location.replace('/?cleared=1'), 20)</script>`,
    );
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const target = { ...production, url: `http://127.0.0.1:${address.port}/` };
  try {
    await verifyInBrowser(target, Date.now() + 10_000);
    forbidden = true;
    await assert.rejects(
      verifyInBrowser(target, Date.now() + 1500),
      /Browser verification/,
    );
  } finally {
    server.close();
    await once(server, 'close');
  }
});
