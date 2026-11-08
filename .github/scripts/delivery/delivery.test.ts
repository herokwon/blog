/* eslint-disable @typescript-eslint/require-await -- Fetch test doubles resolve without real I/O. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  authenticateNativeHead,
  migrateIntake,
  nativeIntakeAllowed,
  readCheckIntake,
  readIntake,
  resolveIntake,
  runDependabotPullRequest,
  saveIntake,
  validSynchronization,
} from './dependabot.ts';
import {
  cleanup,
  mergedPullForPush,
  publishRelease,
  renderComment,
  verifyWorkerActivation,
} from './deployment.ts';
import {
  GitHubClient,
  GitHubError,
  latestPullCi,
  mergeReady,
  Repository,
} from './github.ts';
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
  requestVersionReview,
  validateVersionChange,
  verifyReleaseReadiness,
} from './release-version.ts';

// Test fixtures must not be published to the real Actions job summary.
delete process.env.GITHUB_STEP_SUMMARY;

function requestBody(init?: RequestInit): string {
  if (typeof init?.body !== 'string')
    throw new Error('Expected serialized GitHub request body');
  return init.body;
}

function intakeCheck(receipt: unknown) {
  return {
    id: 9,
    name: 'Dependabot Intake',
    app: { id: 456, slug: 'blog-bot' },
    head_sha: sha,
    external_id: 'dependabot-intake:v1:3',
    status: 'completed',
    conclusion: 'neutral',
    output: { text: JSON.stringify(receipt) },
  };
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

await test('deployment comments separate stage outcomes and show the URL only for verified delivery', () => {
  const updatedAt = '2026-11-07T00:00:00.000Z';
  const logs = 'https://github.com/herokwon/blog/actions/runs/123';
  const releaseUrl = 'https://github.com/herokwon/blog/releases/tag/v0.1.0';
  const cases = [
    {
      name: 'preview success',
      preview: true,
      worker: true,
      publication: false,
      publicationResult: 'skipped',
      release: '',
      failed: '',
    },
    {
      name: 'preview failure',
      preview: true,
      worker: false,
      publication: false,
      publicationResult: 'skipped',
      release: '',
      failed: 'Build',
    },
    {
      name: 'preview ignores publication',
      preview: true,
      worker: true,
      publication: true,
      publicationResult: 'success',
      release: '',
      failed: '',
    },
    {
      name: 'production success or recovered publication',
      preview: false,
      worker: true,
      publication: true,
      publicationResult: 'success',
      release: '✅ **Published** · [v0.1.0](' + releaseUrl + ')',
      failed: '',
    },
    {
      name: 'publication failure after deployment or verified recovery',
      preview: false,
      worker: true,
      publication: false,
      publicationResult: 'failure',
      release: '❌ **Failed**',
      failed: 'Release publication',
    },
    {
      name: 'deployment activation failure skips publication',
      preview: false,
      worker: false,
      publication: false,
      publicationResult: 'skipped',
      release: '⏭️ **Not run**',
      failed: 'Worker activation verification',
    },
    {
      name: 'publication recovery fails before delivery verification',
      preview: false,
      worker: false,
      publication: false,
      publicationResult: 'failure',
      release: '❌ **Failed**',
      failed: 'Release publication',
    },
    {
      name: 'cancelled publication is not skipped',
      preview: false,
      worker: true,
      publication: false,
      publicationResult: 'cancelled',
      release: '❌ **Failed**',
      failed: 'Release publication',
    },
  ];
  for (const item of cases) {
    const target = item.preview
      ? {
          ...production,
          environment: 'preview' as const,
          url: 'https://blog-preview.herokwon.dev',
        }
      : production;
    const body = renderComment(target, 'herokwon/blog', logs, {
      worker: item.worker,
      publication: item.publication,
      publicationResult: item.publicationResult,
      stage:
        item.failed === 'Release publication' && item.worker
          ? 'Deployment'
          : item.failed,
      updatedAt,
      releaseUrl,
    });
    assert.ok(
      body.startsWith(
        '<!-- deployment-result:' + target.environment + ' -->\n',
      ),
      item.name,
    );
    assert.ok(
      body.includes(
        'Commit: [`aaaaaaa`](https://github.com/herokwon/blog/commit/' +
          sha +
          ')',
      ),
      item.name,
    );
    assert.ok(
      body.includes(
        'Updated: <relative-time datetime="' +
          updatedAt +
          '">' +
          updatedAt +
          '</relative-time>',
      ),
      item.name,
    );
    assert.equal(body.split('[View logs](' + logs + ')').length, 2, item.name);
    assert.equal(body.split('Commit:').length, 2, item.name);
    assert.equal(body.split('Updated:').length, 2, item.name);
    const tableAt = body.indexOf('| Stage | Status |\n| --- | --- |');
    assert.ok(tableAt >= 0, item.name);
    const name = item.preview
      ? '🔍 **Preview deployment**'
      : '🚀 **Production deployment**';
    assert.ok(
      body.includes(
        '| ' +
          name +
          ' | ' +
          (item.worker ? '✅ **Deployed**' : '❌ **Failed**') +
          ' |',
      ),
      item.name,
    );
    if (item.worker) {
      const linkAt = body.indexOf('Link: [View URL](' + target.url + ')');
      assert.ok(linkAt >= 0 && linkAt < tableAt, item.name);
      assert.equal(body.split(target.url).length, 2, item.name);
    } else assert.ok(!body.includes(target.url), item.name);
    if (item.preview) assert.ok(!body.includes('GitHub Release'), item.name);
    else
      assert.ok(
        body.includes('| 📦 **GitHub Release** | ' + item.release + ' |'),
        item.name,
      );
    if (item.failed) {
      const failureAt = body.indexOf('Failed stage: **' + item.failed + '**');
      assert.ok(failureAt > tableAt, item.name);
    } else assert.ok(!body.includes('Failed stage:'), item.name);
  }
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
      APP_ID: '456',
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
        if (url.includes('/check-runs'))
          return Response.json({
            check_runs: [
              intakeCheck({
                pr: 3,
                headSha: sha,
                originalSha: sha,
                updates: [update],
              }),
            ],
          });
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
      repo.comments = async () => [{ ...review(next), id: 2 }];
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

await test('newest deployment proof requires the exact SHA and a supported branch event', async () => {
  let failed = true,
    head = sha,
    event = 'push';
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
          head_branch: 'main',
          path: '.github/workflows/deployment.yml',
          event,
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
      throw new Error(`Unexpected evidence request: ${url}`);
    }),
  );
  assert.equal(await repo.verifiedDeployment(sha, 'production'), null);
  failed = false;
  head = sha;
  assert.deepEqual(await repo.verifiedDeployment(sha, 'production'), {
    deploymentId: 10,
    runId: 5,
  });
  head = 'c'.repeat(40);
  assert.equal(await repo.verifiedDeployment(sha, 'production'), null);
  head = sha;
  event = 'pull_request';
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
      APP_ID: '456',
      APP_SLUG: 'blog-bot',
      DEPENDABOT_METADATA: undefined,
      GITHUB_STEP_SUMMARY: undefined,
    },
    async () => {
      let refExists = false,
        routed = '';
      const synchronizedHead = 'b'.repeat(40);
      let synchronizedCheck: unknown = null;
      const native = {
        ...pull,
        state: 'open',
        merged: false,
        head: { ...pull.head, ref: 'dependabot/npm/test', sha },
        base: { ...pull.base, ref: 'main', sha: 'd'.repeat(40) },
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
          if (url.includes('/check-runs') && init?.method === 'POST') {
            synchronizedCheck = {
              ...(JSON.parse(requestBody(init)) as object),
              id: 10,
              app: { id: 456, slug: 'blog-bot' },
            };
            return Response.json(synchronizedCheck);
          }
          if (url.includes(`/commits/${synchronizedHead}/check-runs`))
            return Response.json({
              check_runs: synchronizedCheck ? [synchronizedCheck] : [],
            });
          if (url.includes('/check-runs'))
            return Response.json({
              check_runs: [
                intakeCheck({
                  pr: 3,
                  headSha: sha,
                  originalSha: sha,
                  updates: [
                    {
                      ...update,
                      updateType: 'version-update:semver-major',
                      newVersion: '2.0.0',
                    },
                  ],
                }),
              ],
            });
          if (url.endsWith(`/commits/${synchronizedHead}`))
            return Response.json({
              author: { id: 123 },
              commit: { verification: { verified: true } },
              parents: [{ sha }, { sha }],
            });
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
      repo.pull = async () => structuredClone(native);
      repo.ref = async () => sha;
      repo.version = async () => '1.2.0';
      repo.frozenReleases = async () => [];
      repo.milestone = async () => 1;
      repo.assignMilestone = async () => {};
      repo.synchronize = async () => {
        native.head.sha = synchronizedHead;
        return true;
      };
      repo.comments = async () => [];
      await runDependabotPullRequest(repo, 3);
      assert.equal(routed, 'release/1.2.1');
      assert.ok(synchronizedCheck);
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

await test('native environment evidence correlates absent App attribution with the run actor and environment branch', async () => {
  let appId: number | null = null,
    actorId = 171362987,
    branch = 'release/0.1.1',
    workerResult = 'success';
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
            performed_via_github_app: appId === null ? null : { id: appId },
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
          head_branch: branch,
          actor: { id: actorId },
        });
      if (url.includes('/jobs'))
        return Response.json({
          jobs: [
            {
              id: 3,
              name: 'Deploy Worker',
              status: 'completed',
              conclusion: workerResult,
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
  actorId = 999;
  assert.equal(await repo.verifiedDeployment(sha, 'preview'), null);
  actorId = 171362987;
  branch = 'main';
  assert.equal(await repo.verifiedDeployment(sha, 'preview'), null);
  branch = 'release/0.1.1';
  workerResult = 'failure';
  assert.equal(await repo.verifiedDeployment(sha, 'preview'), null);
  workerResult = 'success';
  appId = 15368;
  assert.deepEqual(await repo.verifiedDeployment(sha, 'preview'), {
    deploymentId: 1,
    runId: 2,
  });
  appId = 999;
  assert.equal(await repo.verifiedDeployment(sha, 'preview'), null);
});

await test('milestone assignment avoids writing a PR already assigned to the correct version', async () => {
  let assigned: number | null = 1,
    writes = 0;
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
      if (url.includes('/milestones?'))
        return Response.json([{ number: 1, title: '0.1.0', state: 'open' }]);
      if (url.endsWith('/pulls/3'))
        return Response.json({
          ...pull,
          milestone: assigned ? { number: assigned } : null,
        });
      if (url.endsWith('/issues/3') && init?.method === 'PATCH') {
        assigned = (JSON.parse(requestBody(init)) as { milestone: number })
          .milestone;
        writes++;
        return Response.json({});
      }
      throw new Error(`Unexpected milestone request: ${url}`);
    }),
  );
  await repo.assignMilestone(3, 'release/0.1.0');
  assert.equal(writes, 0);
  assigned = null;
  await repo.assignMilestone(3, 'release/0.1.0');
  assert.equal(assigned, 1);
  assert.equal(writes, 1);
});

await test('Worker activation requires 100 percent active traffic and the deployed commit tag', async () => {
  let percentage = 100,
    tag = sha,
    authorized = true;
  const transport: typeof fetch = async (input, init) => {
    if (
      !authorized ||
      new Headers(init?.headers).get('Authorization') !== 'Bearer test-token'
    )
      return Response.json({ success: false }, { status: 403 });
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url.endsWith('/deployments'))
      return Response.json({
        success: true,
        result: {
          deployments: [
            { versions: [{ version_id: 'version-1', percentage }] },
          ],
        },
      });
    if (url.endsWith('/versions/version-1'))
      return Response.json({
        success: true,
        result: { id: 'version-1', annotations: { 'workers/tag': tag } },
      });
    throw new Error('Unexpected Worker API resource');
  };
  await verifyWorkerActivation(
    production,
    'a'.repeat(32),
    'test-token',
    transport,
  );
  percentage = 50;
  await assert.rejects(
    verifyWorkerActivation(production, 'a'.repeat(32), 'test-token', transport),
    /100%/,
  );
  percentage = 100;
  tag = 'b'.repeat(40);
  await assert.rejects(
    verifyWorkerActivation(production, 'a'.repeat(32), 'test-token', transport),
    /commit/,
  );
  tag = sha;
  authorized = false;
  await assert.rejects(
    verifyWorkerActivation(production, 'a'.repeat(32), 'test-token', transport),
    /Cloudflare API/,
  );
});

await test('synchronization tolerates only a changed-head 422 and preserves other failures', async () => {
  let status = 422;
  let current = { ...pull, head: { ...pull.head, sha: 'c'.repeat(40) } };
  let writes = 0;
  const repo = new Repository(
    'herokwon/blog',
    'token',
    new GitHubClient('token', async () => {
      writes++;
      return new Response('', { status });
    }),
  );
  repo.behind = async () => true;
  repo.pull = async () => current;
  assert.equal(await repo.synchronize(pull), true);
  assert.equal(writes, 1);
  current = pull;
  await assert.rejects(
    repo.synchronize(pull),
    (error: unknown) => error instanceof GitHubError && error.status === 422,
  );
  current = { ...pull, head: { ...pull.head, sha: 'c'.repeat(40) } };
  status = 403;
  await assert.rejects(
    repo.synchronize(pull),
    (error: unknown) => error instanceof GitHubError && error.status === 403,
  );
});

await test('intake checks bind App identity, PR, exact head, and completed neutral provenance', () => {
  const receipt = {
    pr: 3,
    headSha: 'a'.repeat(40),
    originalSha: 'a'.repeat(40),
    updates: [
      {
        dependencyName: 'vite',
        dependencyType: 'direct:development',
        packageEcosystem: 'npm_and_yarn',
        updateType: 'version-update:semver-minor',
        prevVersion: '1.0.0',
        newVersion: '1.1.0',
      },
    ],
  };
  const check = {
    id: 9,
    name: 'Dependabot Intake',
    app: { id: 456, slug: 'blog-bot' },
    head_sha: receipt.headSha,
    external_id: 'dependabot-intake:v1:3',
    status: 'completed',
    conclusion: 'neutral',
    output: { text: JSON.stringify(receipt) },
  };
  assert.deepEqual(
    readCheckIntake([check], 3, receipt.headSha, 456, 'blog-bot'),
    receipt,
  );
  for (const changed of [
    { app: { id: 999, slug: 'blog-bot' } },
    { app: { id: 456, slug: 'other' } },
    { head_sha: 'b'.repeat(40) },
    { external_id: 'dependabot-intake:v1:4' },
    { status: 'in_progress' },
    { conclusion: 'success' },
    { output: { text: '{bad' } },
  ]) {
    assert.equal(
      readCheckIntake(
        [{ ...check, ...changed }],
        3,
        receipt.headSha,
        456,
        'blog-bot',
      ),
      null,
    );
  }
  assert.equal(
    readCheckIntake([check], 4, receipt.headSha, 456, 'blog-bot'),
    null,
  );
});

await test('intake check writes require authenticated read-back and do not claim success on missing records', async () => {
  await withEnvironment({ APP_ID: '456', APP_SLUG: 'blog-bot' }, async () => {
    const receipt = {
      pr: 3,
      headSha: 'a'.repeat(40),
      originalSha: 'a'.repeat(40),
      updates: [update],
    };
    let stored: unknown = null;
    const requests: string[] = [];
    const repo = new Repository(
      'herokwon/blog',
      'token',
      new GitHubClient('token', async (_input, init) => {
        requests.push(init?.method || 'GET');
        if (init?.method === 'POST') {
          stored = {
            ...(JSON.parse(requestBody(init)) as object),
            id: 9,
            app: { id: 456, slug: 'blog-bot' },
          };
          return Response.json(stored);
        }
        return Response.json({ check_runs: stored ? [stored] : [] });
      }),
    );
    await saveIntake(repo, receipt);
    await saveIntake(repo, receipt);
    assert.equal(requests.filter(method => method === 'POST').length, 1);
    const broken = new Repository(
      'herokwon/blog',
      'token',
      new GitHubClient('token', async () => Response.json({ check_runs: [] })),
    );
    await assert.rejects(saveIntake(broken, receipt), /read-back/);
  });
});

await test('legacy migration preserves exact old heads and deletes only after matching authenticated read-back', async () => {
  await withEnvironment(
    { APP_ID: '456', APP_BOT_ID: '123', APP_SLUG: 'blog-bot' },
    async () => {
      for (const mode of [
        'ok',
        'missing-read-back',
        'write-failure',
        'edited-comment',
        'foreign-app',
      ] as const) {
        const events: string[] = [];
        const receipt = {
          pr: 3,
          headSha: sha,
          originalSha: sha,
          updates: [{ ...update, unused: 'discard' }],
        };
        const comment = {
          id: 7,
          user: { id: 123, login: 'blog-bot[bot]', type: 'Bot' },
          body: `<!-- dependabot-intake:v1 ${JSON.stringify(receipt)} -->`,
        };
        let stored: unknown = null;
        const api = new GitHubClient('token', async (input, init) => {
          const url =
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.href
                : input.url;
          if (init?.method === 'POST') {
            events.push('write');
            if (mode === 'write-failure')
              return new Response('', { status: 403 });
            stored = {
              ...(JSON.parse(requestBody(init)) as object),
              id: 9,
              app: { id: mode === 'foreign-app' ? 999 : 456, slug: 'blog-bot' },
            };
            return Response.json(stored);
          }
          if (url.includes('/check-runs')) {
            events.push('read');
            return Response.json({
              check_runs:
                stored && mode !== 'missing-read-back' ? [stored] : [],
            });
          }
          if (init?.method === 'DELETE') {
            events.push('delete');
            return new Response(null, { status: 204 });
          }
          return Response.json(
            mode === 'edited-comment'
              ? { ...comment, body: 'changed' }
              : comment,
          );
        });
        const repo = new Repository('herokwon/blog', 'token', api);
        repo.comments = async () => [comment];
        if (['ok', 'edited-comment'].includes(mode))
          await migrateIntake(repo, 3);
        else await assert.rejects(migrateIntake(repo, 3));
        assert.equal(events.includes('delete'), mode === 'ok');
        if (mode === 'ok') {
          const saved = readCheckIntake([stored], 3, sha, 456, 'blog-bot');
          assert.ok(saved);
          assert.deepEqual(saved.updates, [update]);
          assert.equal(events.at(-1), 'delete');
        }
      }
    },
  );
});

await test('only signed App synchronization can carry an old check forward; human heads remain blocked', async () => {
  await withEnvironment(
    { APP_ID: '456', APP_BOT_ID: '123', APP_SLUG: 'blog-bot' },
    async () => {
      for (const [author, status] of [
        [123, 'ahead'],
        [123, 'diverged'],
        [789, 'ahead'],
      ] as const) {
        const next = 'b'.repeat(40),
          base = 'c'.repeat(40);
        const receipt = {
          pr: 3,
          headSha: sha,
          originalSha: sha,
          updates: [update],
        };
        let stored: unknown = null;
        const api = new GitHubClient('token', async (input, init) => {
          const url =
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.href
                : input.url;
          if (init?.method === 'POST') {
            stored = {
              ...(JSON.parse(requestBody(init)) as object),
              id: 10,
              app: { id: 456, slug: 'blog-bot' },
            };
            return Response.json(stored);
          }
          if (url.includes(`/commits/${sha}/check-runs`))
            return Response.json({ check_runs: [intakeCheck(receipt)] });
          if (url.includes('/check-runs'))
            return Response.json({ check_runs: stored ? [stored] : [] });
          if (url.includes('/compare/')) return Response.json({ status });
          if (url.includes('/commits/'))
            return Response.json({
              author: { id: author },
              commit: { verification: { verified: true } },
              parents: [{ sha }, { sha: base }],
            });
          if (url.includes('/pulls/'))
            return Response.json([{ sha }, { sha: next }]);
          throw new Error(`Unexpected ${url}`);
        });
        const repo = new Repository('herokwon/blog', 'token', api);
        repo.comments = async () => [];
        const current = {
          ...pull,
          head: { ...pull.head, sha: next },
          base: { ...pull.base, sha: 'd'.repeat(40) },
        };
        const resolved = await resolveIntake(repo, current);
        assert.equal(
          resolved?.headSha ?? null,
          author === 123 && status === 'ahead' ? next : null,
        );
        assert.equal(await nativeIntakeAllowed(repo, current), false);
      }
    },
  );
});

await test('merge CI selection binds PR, repository, target and head before choosing latest attempt', () => {
  const current = { ...pull, state: 'open', merged: false };
  const run = {
    id: 10,
    head_sha: current.head.sha,
    head_branch: current.head.ref,
    path: '.github/workflows/ci.yml',
    event: 'pull_request',
    status: 'completed',
    conclusion: 'success',
    run_attempt: 2,
    repository: { id: 1, full_name: 'herokwon/blog' },
    pull_requests: [
      {
        number: current.number,
        head: { sha: current.head.sha, ref: current.head.ref, repo: { id: 1 } },
        base: { ref: current.base.ref, repo: { id: 1 } },
      },
    ],
  };
  assert.equal(latestPullCi([run], current, 'herokwon/blog')?.id, 10);
  const unrelated = [
    { ...run, id: 11, pull_requests: [] },
    {
      ...run,
      id: 12,
      pull_requests: [{ ...run.pull_requests[0], number: 999 }],
    },
    {
      ...run,
      id: 13,
      pull_requests: [
        { ...run.pull_requests[0], base: { ref: 'main', repo: { id: 1 } } },
      ],
    },
    { ...run, id: 14, repository: { id: 2, full_name: 'someone/blog' } },
    { ...run, id: 15, head_sha: sha },
    { ...run, id: 16, event: 'workflow_dispatch' },
    {
      ...run,
      id: 17,
      pull_requests: [
        {
          ...run.pull_requests[0],
          head: { ...run.pull_requests[0].head, repo: { id: 2 } },
        },
      ],
    },
  ];
  assert.equal(latestPullCi(unrelated, current, 'herokwon/blog'), undefined);
  assert.equal(
    latestPullCi([...unrelated, run], current, 'herokwon/blog')?.id,
    10,
  );
  assert.equal(
    latestPullCi([{ ...run, run_attempt: 1 }, run], current, 'herokwon/blog')
      ?.run_attempt,
    2,
  );
});

await test('a newer CI attempt immediately before merging blocks the exact-head mutation', async () => {
  const current = { ...pull, state: 'open', merged: false };
  let queries = 0,
    mutations = 0;
  const run = {
    id: 10,
    head_sha: current.head.sha,
    head_branch: current.head.ref,
    path: '.github/workflows/ci.yml',
    event: 'pull_request',
    status: 'completed',
    conclusion: 'success',
    run_attempt: 1,
    repository: { id: 1, full_name: 'herokwon/blog' },
    pull_requests: [
      {
        number: 3,
        head: { sha: current.head.sha, ref: current.head.ref, repo: { id: 1 } },
        base: { ref: current.base.ref, repo: { id: 1 } },
      },
    ],
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
      if (init?.method === 'PUT') {
        mutations++;
        return Response.json({ merged: true });
      }
      if (url.includes('/jobs?'))
        return Response.json({
          jobs: ['Lint', 'Type Check', 'Build', 'Test'].map(name => ({
            name,
            status: 'completed',
            conclusion: 'success',
          })),
        });
      if (url.includes('/ci.yml/runs'))
        return Response.json({
          workflow_runs: [
            {
              ...run,
              run_attempt: ++queries >= 3 ? 2 : 1,
              status: queries >= 3 ? 'in_progress' : 'completed',
            },
          ],
        });
      throw new Error(url);
    }),
  );
  repo.pull = async () => current;
  repo.comments = async () => [{ ...review(current.head.sha), id: 1 }];
  repo.synchronize = async () => false;
  repo.behind = async () => false;
  await assert.rejects(mergeReady(repo, 3), /CI changed before merge/);
  assert.equal(mutations, 0);
});

await test('metadata-only skipped CI cannot displace successful validation for the same PR', async () => {
  const current = { ...pull, state: 'open', merged: false };
  const run = {
    id: 10,
    head_sha: current.head.sha,
    head_branch: current.head.ref,
    path: '.github/workflows/ci.yml',
    event: 'pull_request',
    status: 'completed',
    conclusion: 'success',
    run_attempt: 1,
    repository: { id: 1, full_name: 'herokwon/blog' },
    pull_requests: [
      {
        number: 3,
        head: { sha: current.head.sha, ref: current.head.ref, repo: { id: 1 } },
        base: { ref: current.base.ref, repo: { id: 1 } },
      },
    ],
  };
  let mutations = 0;
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
      if (init?.method === 'PUT') {
        mutations++;
        return Response.json({ merged: true });
      }
      if (url.includes('/ci.yml/runs'))
        return Response.json({ workflow_runs: [{ ...run, id: 11 }, run] });
      if (url.includes('/jobs?'))
        return Response.json({
          jobs: ['Lint', 'Type Check', 'Build', 'Test'].map(name => ({
            name: url.includes('/11/') ? `Ignored · ${name}` : name,
            status: 'completed',
            conclusion: url.includes('/11/') ? 'skipped' : 'success',
          })),
        });
      throw new Error(url);
    }),
  );
  repo.pull = async () => current;
  repo.comments = async () => [{ ...review(current.head.sha), id: 1 }];
  repo.synchronize = async () => false;
  repo.behind = async () => false;
  // A bounded fixture makes selecting the skipped run fail immediately rather than waiting 30 minutes.
  let guards = 0;
  const result = await mergeReady(repo, 3, async () => ++guards < 4);
  assert.equal(result.state, 'merged');
  assert.equal(mutations, 1);
});

await test('readiness retries inconsistent snapshots but never accepts a stale or invalid release', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 100000 });
  const fresh = 'c'.repeat(40);
  let reads = 0,
    sleeps = 0;
  const original = {
    ...pull,
    number: 49,
    state: 'open',
    merged: false,
    head: { ...pull.head, ref: 'release/0.2.1', sha },
    base: { ...pull.base, ref: 'main' },
  };
  const repo = new Repository('herokwon/blog', 'token');
  repo.pull = async () => ({
    ...original,
    head: { ...original.head, sha: ++reads === 1 ? sha : fresh },
  });
  repo.ref = async branch => (branch === 'main' ? sha : fresh);
  repo.version = async head => (head === sha ? '0.2.0' : '0.2.1');
  repo.verifiedDeployment = async () => ({ deploymentId: 1, runId: 1 });
  repo.behind = async () => false;
  const pause = async () => {
    sleeps++;
  };
  await verifyReleaseReadiness(repo, 49, Date.now() + 1000, pause);
  assert.equal(sleeps, 1);
  repo.pull = async () => original;
  await assert.rejects(
    verifyReleaseReadiness(repo, 49, Date.now() + 1000, async () => {
      t.mock.timers.tick(1000);
    }),
    /missing after 30 minutes/,
  );
  reads = 0;
  repo.pull = async () =>
    ++reads === 1
      ? original
      : { ...original, head: { ...original.head, ref: 'release/0.2.2' } };
  await assert.rejects(
    verifyReleaseReadiness(repo, 49, Date.now() + 1000, pause),
    /source changed/,
  );
  repo.pull = async () => ({
    ...original,
    head: { ...original.head, sha: fresh },
  });
  repo.verifiedDeployment = async () => null;
  await assert.rejects(
    verifyReleaseReadiness(repo, 49, Date.now() + 1000, async () => {
      t.mock.timers.tick(1000);
    }),
    /missing after 30 minutes/,
  );
  repo.pull = async () => ({ ...original, state: 'closed' });
  await assert.rejects(
    verifyReleaseReadiness(repo, 49, Date.now() + 1000, pause),
    /open same-repository/,
  );
  repo.pull = async () => ({ ...original, draft: true });
  await assert.rejects(
    verifyReleaseReadiness(repo, 49, Date.now() + 1000, pause),
    /open same-repository/,
  );
  repo.pull = async () => ({
    ...original,
    base: { ...original.base, ref: 'release/0.2.1' },
  });
  await assert.rejects(
    verifyReleaseReadiness(repo, 49, Date.now() + 1000, pause),
    /open same-repository/,
  );
  repo.pull = async () => {
    throw new Error('API unavailable');
  };
  await assert.rejects(
    verifyReleaseReadiness(repo, 49, Date.now() + 1000, pause),
    /API unavailable/,
  );
});

await test('publication proof unavailable is distinct from a failed Worker deployment', () => {
  const body = renderComment(
    production,
    'herokwon/blog',
    'https://example.com/logs',
    {
      updatedAt: '2026-11-08T00:00:00Z',
      publicationResult: 'failure',
      worker: 'unknown',
      publication: false,
      stage: 'Production delivery verification',
    },
  );
  assert.match(
    body,
    /Production deployment\*\* \| ⚠️ \*\*Verification unavailable/,
  );
  assert.doesNotMatch(body, /Production deployment\*\* \| ❌/);
  assert.doesNotMatch(body, /Link: /);
  assert.match(body, /Production delivery verification/);
});

await test('version review requests are authenticated, once per SHA and restricted to App-owned preparation', async () => {
  await withEnvironment(
    { APP_BOT_ID: '123', APP_SLUG: 'blog-bot' },
    async () => {
      const current = {
        ...pull,
        state: 'open',
        merged: false,
        user: { login: 'blog-bot[bot]', id: 123 },
        head: { ...pull.head, ref: 'automation/release/0.2.1' },
        base: { ...pull.base, ref: 'release/0.2.1' },
      };
      let comments: {
        id: number;
        body: string;
        user: { login: string; id: number; type: string };
      }[] = [];
      let posts = 0;
      const repo = new Repository(
        'herokwon/blog',
        'token',
        new GitHubClient('token', async (_input, init) => {
          posts++;
          const body = (JSON.parse(requestBody(init)) as { body: string }).body;
          comments.push({
            id: posts,
            body,
            user: { id: 123, login: 'blog-bot[bot]', type: 'Bot' },
          });
          return Response.json(comments.at(-1));
        }),
      );
      repo.pull = async () => current;
      repo.comments = async () => comments;
      await requestVersionReview(repo, current, 'release/0.2.1');
      await requestVersionReview(repo, current, 'release/0.2.1');
      assert.equal(posts, 1);
      assert.match(comments[0].body, /@codex review/);
      const next = {
        ...current,
        head: { ...current.head, sha: 'd'.repeat(40) },
      };
      repo.pull = async () => next;
      await requestVersionReview(repo, next, 'release/0.2.1');
      assert.equal(posts, 2);
      comments = comments.map(item => ({
        ...item,
        user: { ...item.user, id: 999 },
      }));
      await requestVersionReview(repo, next, 'release/0.2.1');
      assert.equal(posts, 3);
      comments = [{ ...review(next.head.sha), id: 99 }];
      await requestVersionReview(repo, next, 'release/0.2.1');
      assert.equal(posts, 3);
      comments = [
        {
          ...review(next.head.sha, {
            status: 'running',
            has_any_findings: null,
            has_unresolved_findings: null,
          }),
          id: 99,
        },
      ];
      await requestVersionReview(repo, next, 'release/0.2.1');
      assert.equal(posts, 3);
      await assert.rejects(
        requestVersionReview(
          repo,
          { ...next, user: { login: 'someone', id: 1 } },
          'release/0.2.1',
        ),
        /App-owned/,
      );
      comments = [];
      repo.api = new GitHubClient('token', async () => {
        throw new Error('request interrupted');
      });
      await assert.rejects(
        requestVersionReview(repo, next, 'release/0.2.1'),
        /interrupted/,
      );
    },
  );
});
