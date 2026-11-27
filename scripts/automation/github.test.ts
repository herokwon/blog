import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { GitHub } from './github-types.ts';
import {
  bump,
  checkMetadata,
  checkVersion,
  metadata,
  prepareDeployment,
  readAuditLockfile,
  staleDeployment,
} from './github.ts';

const sha = 'a'.repeat(40);
const repo = { owner: 'owner', repo: 'blog' };

async function unexpectedCall(): Promise<never> {
  throw new Error('Unexpected API call');
}

function mockGitHub(): GitHub {
  return {
    async paginate(endpoint, params) {
      return (await endpoint(params)).data;
    },
    rest: {
      issues: {
        listMilestones: unexpectedCall,
        update: unexpectedCall,
      },
      pulls: {
        get: unexpectedCall,
        list: unexpectedCall,
        create: unexpectedCall,
      },
      repos: {
        getContent: unexpectedCall,
        listBranches: unexpectedCall,
        listDeployments: unexpectedCall,
        listDeploymentStatuses: unexpectedCall,
        compareCommits: unexpectedCall,
        createDeploymentStatus: unexpectedCall,
        getReleaseByTag: unexpectedCall,
        createRelease: unexpectedCall,
      },
      git: {
        getRef: unexpectedCall,
        createRef: unexpectedCall,
        createBlob: unexpectedCall,
        getCommit: unexpectedCall,
        createTree: unexpectedCall,
        createCommit: unexpectedCall,
      },
    },
  };
}

function fixture(version = '0.0.1') {
  const pr = {
    number: 1,
    state: 'open',
    body: null,
    user: { login: 'author' },
    merged: true,
    merge_commit_sha: sha,
    base: { ref: 'main', repo: { full_name: 'owner/blog' } },
    head: { ref: 'release/0.1.0', sha, repo: { full_name: 'owner/blog' } },
  };
  const context = {
    repo,
    ref: 'refs/heads/main',
    sha,
    payload: { pull_request: pr, repository: { full_name: 'owner/blog' } },
  };
  const outputs: Record<string, string> = {};
  const core = {
    info() {},
    setOutput(key: string, value: string) {
      outputs[key] = value;
    },
    summary: {
      addRaw() {
        return this;
      },
      async write() {},
    },
  };
  const github = mockGitHub();
  github.rest.repos.getContent = async () => ({
    data: {
      type: 'file',
      encoding: 'base64',
      content: Buffer.from(JSON.stringify({ name: 'blog', version })).toString(
        'base64',
      ),
    },
  });
  github.rest.pulls.get = async () => ({ data: pr });
  github.rest.pulls.list = async () => ({
    data: [{ ...pr, state: 'closed', merged_at: '2026-11-18T14:39:39Z' }],
  });
  github.rest.git.getRef = async () => {
    throw Object.assign(new Error('Not found'), { status: 404 });
  };
  return { github, context, core, outputs, pr };
}

test('reads only the lockfile at the selected audit commit', async () => {
  const github = mockGitHub();
  const lockfile = Buffer.from("lockfileVersion: '9.0'\n");
  github.rest.repos.getContent = async params => {
    assert.deepEqual(params, { ...repo, path: 'pnpm-lock.yaml', ref: sha });
    return {
      data: {
        type: 'file',
        encoding: 'base64',
        content: lockfile.toString('base64'),
      },
    };
  };

  assert.deepEqual(await readAuditLockfile(github, repo, sha), lockfile);
});

test('rejects invalid audit refs and unavailable lockfile content', async () => {
  const github = mockGitHub();
  await assert.rejects(readAuditLockfile(github, repo, 'main'), /commit SHA/);

  github.rest.repos.getContent = async () => ({
    data: { type: 'file', encoding: 'base64', content: '' },
  });
  await assert.rejects(
    readAuditLockfile(github, repo, sha),
    /lockfile is empty/,
  );

  github.rest.repos.getContent = async () => {
    throw Object.assign(new Error('Not found'), { status: 404 });
  };
  await assert.rejects(readAuditLockfile(github, repo, sha), /Not found/);
});

test('validates milestones for work, release, and Version Bump PRs without issue references', async () => {
  for (const [head, base, author] of [
    ['codex/work', 'release/0.1.0', 'author'],
    ['release/0.1.0', 'main', 'author'],
    ['codex/bump-0.1.0', 'release/0.1.0', 'current-app[bot]'],
    ['renovate/dependency', 'release/0.1.0', 'author'],
  ]) {
    const input = fixture();
    const pr = {
      ...input.pr,
      base: { ...input.pr.base, ref: base },
      head: { ...input.pr.head, ref: head },
      user: { login: author },
    };
    const milestone = { number: 2, title: '0.1.0' };
    input.context.payload.pull_request = pr;
    input.github.rest.issues.listMilestones = async () => ({
      data: [milestone],
    });
    const updates: number[] = [];
    input.github.rest.issues.update = async args => {
      assert.deepEqual(args, {
        ...repo,
        issue_number: pr.number,
        milestone: 2,
      });
      updates.push(args.milestone);
      return { data: {} };
    };
    input.github.rest.pulls.get = async () => ({ data: { ...pr, milestone } });

    await metadata(input);
    assert.deepEqual(updates, [milestone.number]);
    await checkMetadata(input);

    input.github.rest.pulls.get = async () => ({
      data: { ...pr, milestone: { number: 3, title: '0.2.0' } },
    });
    await assert.rejects(checkMetadata(input), /milestone does not match/);
  }
});

test('skips metadata API calls for same-repository Renovate dependency PRs', async () => {
  const input = fixture();
  input.context.payload.pull_request = {
    ...input.pr,
    base: { ...input.pr.base, ref: 'release/0.1.0' },
    head: { ...input.pr.head, ref: 'renovate/dependency' },
    user: { login: 'renovate[bot]' },
  };
  input.github.rest.pulls.get = unexpectedCall;
  await metadata(input);
  await checkMetadata(input);
});

test('still validates forked Renovate PR milestones', async () => {
  const input = fixture();
  const pr = {
    ...input.pr,
    base: { ...input.pr.base, ref: 'release/0.1.0' },
    head: {
      ...input.pr.head,
      ref: 'renovate/dependency',
      repo: { full_name: 'fork/blog' },
    },
    user: { login: 'renovate[bot]' },
  };
  input.context.payload.pull_request = pr;
  input.github.rest.pulls.get = async () => ({ data: pr });
  await metadata(input);
  await assert.rejects(checkMetadata(input), /milestone does not match/);
});

test('matching package version does not create issues, commits or bump PRs', async () => {
  const input = fixture('0.1.0');
  await bump(input); // Any unexpected API write is absent and would throw.
  await checkVersion(input);
});

test('version gate rejects mismatch and deployment preflight rejects conflicting tags', async () => {
  const input = fixture();
  await assert.rejects(checkVersion(input), /must merge/);
  await assert.rejects(prepareDeployment(input), /version mismatch/);
  const ready = fixture('0.1.0');
  ready.github.rest.git.getRef = async () => ({
    data: { object: { type: 'commit', sha: 'b'.repeat(40) } },
  });
  await assert.rejects(prepareDeployment(ready), /conflicts/);
});

test('a release branch push deploys the exact merged PR and retains its number for reporting', async () => {
  const input = fixture('0.1.0');
  const branch = 'release/0.1.0';
  const base = { ...input.pr.base, ref: branch };
  const head = { ...input.pr.head, ref: 'codex/work' };
  const candidate = { ...input.pr, base, head, state: 'closed' };
  const mergedAt = '2026-11-18T14:39:39Z';
  input.context.ref = `refs/heads/${branch}`;
  input.github.rest.pulls.list = async params => {
    assert.equal(params.state, 'closed');
    assert.equal(params.base, branch);
    return {
      data: [
        { ...candidate, number: 2, merged_at: null },
        {
          ...candidate,
          number: 3,
          merge_commit_sha: 'b'.repeat(40),
          merged_at: mergedAt,
        },
        { ...candidate, number: 8, merged_at: mergedAt },
      ],
    };
  };
  await prepareDeployment(input);
  assert.equal(input.outputs.environment, 'preview');
  assert.equal(input.outputs.sha, sha);
  assert.equal(input.outputs.pr_number, '8');
});

test('a push without a merged PR targeting the pushed branch does not deploy', async () => {
  const input = fixture('0.1.0');
  input.context.ref = 'refs/heads/release/0.1.0';
  input.github.rest.repos.getContent = unexpectedCall;
  await prepareDeployment(input);
  assert.deepEqual(input.outputs, {});
});

test('version preparation creates no issue and repairs a failed PR milestone assignment on retry', async () => {
  const input = fixture();
  const { issues, git, pulls } = input.github.rest;
  const targetMilestone = { number: 2, title: '0.1.0' };
  issues.listMilestones = async () => ({ data: [targetMilestone] });
  let created = 0;
  let milestoneUpdates = 0;
  let assignedMilestone: typeof targetMilestone | null = null;
  pulls.list = async ({ head, base }) => {
    assert.equal(head, 'owner:codex/bump-0.1.0');
    assert.equal(base, 'release/0.1.0');
    return {
      data: created
        ? [
            {
              ...input.pr,
              number: 8,
              state: 'open',
              merged_at: null,
              milestone: assignedMilestone,
            },
          ]
        : [],
    };
  };
  git.createBlob = async ({ content }) => {
    assert.deepEqual(JSON.parse(content), { name: 'blog', version: '0.1.0' });
    return { data: { sha } };
  };
  git.getCommit = async () => ({ data: { tree: { sha } } });
  git.createTree = async ({ tree }) => {
    assert.deepEqual(
      tree.map(entry => entry.path),
      ['package.json'],
    );
    return { data: { sha } };
  };
  git.createCommit = async () => ({ data: { sha } });
  git.createRef = async ({ ref }) => {
    assert.equal(ref, 'refs/heads/codex/bump-0.1.0');
    return { data: {} };
  };
  pulls.create = async ({ head, base, body }) => {
    assert.equal(head, 'codex/bump-0.1.0');
    assert.equal(base, 'release/0.1.0');
    assert.doesNotMatch(body, /Refs:/);
    assert.match(body, /release PR #1/);
    created++;
    return { data: { number: 8 } };
  };
  issues.update = async ({ issue_number, milestone }) => {
    assert.equal(issue_number, 8);
    assert.equal(milestone, targetMilestone.number);
    milestoneUpdates++;
    if (milestoneUpdates === 1) throw new Error('Milestone API unavailable');
    assignedMilestone = targetMilestone;
    return { data: {} };
  };
  await assert.rejects(bump(input), /Milestone API unavailable/);
  assert.equal(created, 1);
  assert.equal(milestoneUpdates, 1);
  git.getRef = unexpectedCall;
  await bump(input);
  assert.equal(created, 1);
  assert.equal(milestoneUpdates, 2);
  await bump(input);
  assert.equal(created, 1);
  assert.equal(milestoneUpdates, 2);
});

test('stale deployment skips descendants, but never assumes a failed unpublished deployment is deployed', async () => {
  const input = fixture();
  const previousEnv = {
    sha: process.env.DEPLOY_SHA,
    environment: process.env.DEPLOY_ENVIRONMENT,
  };
  process.env.DEPLOY_SHA = sha;
  process.env.DEPLOY_ENVIRONMENT = 'production';
  try {
    input.github.rest.repos.compareCommits = async () => ({
      data: { status: 'ahead' },
    });
    let published = true;
    input.github.rest.repos.listDeployments = async () => ({
      data: [{ id: 1, sha: 'b'.repeat(40) }],
    });
    input.github.rest.repos.listDeploymentStatuses = async () => ({
      data: published
        ? [
            { state: 'failure' },
            { state: 'in_progress', description: 'Worker published: abc' },
          ]
        : [{ state: 'failure' }],
    });
    await staleDeployment(input);
    assert.equal(input.outputs.skip, 'true');
    published = false;
    await staleDeployment(input);
    assert.equal(input.outputs.skip, 'false');
  } finally {
    for (const [key, value] of [
      ['DEPLOY_SHA', previousEnv.sha],
      ['DEPLOY_ENVIRONMENT', previousEnv.environment],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('a published but unverified identical SHA retries the recorded version without republishing', async () => {
  const input = fixture();
  const versionId = '5c34bb02-3817-4ac7-8f56-f8d0a62968c0';
  const oldSha = process.env.DEPLOY_SHA;
  const oldEnvironment = process.env.DEPLOY_ENVIRONMENT;
  process.env.DEPLOY_SHA = sha;
  process.env.DEPLOY_ENVIRONMENT = 'production';
  try {
    input.github.rest.repos.compareCommits = async () => ({
      data: { status: 'identical' },
    });
    input.github.rest.repos.listDeployments = async () => ({
      data: [{ id: 1, sha }],
    });
    input.github.rest.repos.listDeploymentStatuses = async () => ({
      data: [
        { state: 'failure' },
        {
          state: 'in_progress',
          description: `Worker published: ${sha} ${versionId}`,
        },
      ],
    });
    await staleDeployment(input);
    assert.equal(input.outputs.skip, 'false');
    assert.equal(input.outputs.already_published, 'true');
    assert.equal(input.outputs.worker_version_id, versionId);
  } finally {
    if (oldSha === undefined) delete process.env.DEPLOY_SHA;
    else process.env.DEPLOY_SHA = oldSha;
    if (oldEnvironment === undefined) delete process.env.DEPLOY_ENVIRONMENT;
    else process.env.DEPLOY_ENVIRONMENT = oldEnvironment;
  }
});

test('uncertain publication of a descendant blocks an older deployment', async () => {
  const input = fixture();

  input.github.rest.repos.compareCommits = async () => ({
    data: { status: 'ahead' },
  });
  input.github.rest.repos.listDeployments = async () => ({
    data: [{ id: 1, sha: 'b'.repeat(40) }],
  });
  input.github.rest.repos.listDeploymentStatuses = async () => ({
    data: [
      { state: 'failure' },
      { state: 'in_progress', description: 'Publication started: bbbbb' },
    ],
  });
  const previous = {
    DEPLOY_SHA: process.env.DEPLOY_SHA,
    DEPLOY_ENVIRONMENT: process.env.DEPLOY_ENVIRONMENT,
  };
  process.env.DEPLOY_SHA = sha;
  process.env.DEPLOY_ENVIRONMENT = 'production';
  try {
    await assert.rejects(staleDeployment(input), /uncertain/);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
