import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { GitHub } from './github-types.ts';
import {
  bump,
  checkVersion,
  metadata,
  prepareDeployment,
  staleDeployment,
} from './github.ts';

const sha = 'a'.repeat(40);
const repo = { owner: 'owner', repo: 'blog' };

async function unexpectedCall(): Promise<never> {
  throw new Error('Unexpected API call');
}

function unexpectedSummary(): never {
  throw new Error('Unexpected summary');
}

function mockGitHub(): GitHub {
  return {
    async paginate(endpoint, params) {
      return (await endpoint(params)).data;
    },
    rest: {
      issues: {
        listMilestones: unexpectedCall,
        listForRepo: unexpectedCall,
        listComments: unexpectedCall,
        get: unexpectedCall,
        update: unexpectedCall,
        create: unexpectedCall,
        updateComment: unexpectedCall,
        createComment: unexpectedCall,
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

test('bump metadata derives the bot login from the authenticated app slug', async () => {
  const tracking = {
    number: 7,
    state: 'open',
    body: '<!-- version-bump:0.1.0 -->',
  };
  const pr = {
    number: 8,
    state: 'open',
    html_url: 'https://github.com/owner/blog/pull/8',
    base: { ref: 'release/0.1.0', repo: { full_name: 'owner/blog' } },
    head: { ref: 'codex/bump-0.1.0', sha, repo: { full_name: 'owner/blog' } },
    user: { login: 'current-app[bot]', type: 'Bot' },
    body: 'Refs: #7',
  };
  const savedComments: { body: string }[] = [];
  const github = mockGitHub();
  github.rest.pulls.get = async () => ({ data: pr });
  github.rest.issues.listMilestones = async () => ({
    data: [{ number: 2, title: '0.1.0' }],
  });
  github.rest.issues.listComments = async () => ({ data: [] });
  github.rest.issues.get = async () => ({ data: tracking });
  github.rest.issues.update = async () => ({ data: tracking });
  github.rest.issues.createComment = async args => {
    savedComments.push(args);
    return { data: args };
  };
  const input = {
    github,
    context: {
      repo,
      payload: { pull_request: pr, repository: { full_name: 'owner/blog' } },
    },
    core: { info() {}, setOutput() {}, summary: { addRaw: unexpectedSummary } },
    appSlug: 'current-app',
  };
  await metadata(input);
  assert.equal(savedComments.length, 1);
  assert.match(savedComments[0].body, /Related issue: #7/);
  savedComments.length = 0;
  await metadata({ ...input, appSlug: 'different-app' });
  assert.equal(savedComments.length, 0);
});

function fixture(version = '0.0.1') {
  const pr = {
    number: 1,
    state: 'open',
    body: null,
    html_url: 'https://github.com/owner/blog/pull/1',
    user: { login: 'author' },
    merged: true,
    merge_commit_sha: sha,
    base: { ref: 'main', repo: { full_name: 'owner/blog' } },
    head: { ref: 'release/0.1.0', sha, repo: { full_name: 'owner/blog' } },
  };
  const context = {
    repo,
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
  github.rest.git.getRef = async () => {
    throw Object.assign(new Error('Not found'), { status: 404 });
  };
  return { github, context, core, outputs, pr };
}

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

test('duplicate version preparation reuses tracking issue and open bump PR without writing Git refs', async () => {
  const input = fixture();
  const tracking = {
    number: 7,
    state: 'open',
    body: '<!-- version-bump:0.1.0 -->',
  };
  input.github.rest.issues.listMilestones = async () => ({
    data: [{ number: 2, title: '0.1.0' }],
  });
  input.github.rest.issues.listForRepo = async () => ({ data: [tracking] });
  input.github.rest.pulls.list = async () => ({ data: [{ state: 'open' }] });
  input.github.rest.issues.update = async args => {
    assert.equal(args.issue_number, 7);
    assert.equal(args.milestone, 2);
    return { data: tracking };
  };
  await bump(input);
  await bump(input);
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

test('a published but unverified identical SHA retries smoke without republishing', async () => {
  const input = fixture();
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
        { state: 'in_progress', description: `Worker published: ${sha}` },
      ],
    });
    await staleDeployment(input);
    assert.equal(input.outputs.skip, 'false');
    assert.equal(input.outputs.already_published, 'true');
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
