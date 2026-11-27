import type { Action, ActionContext, GitHub } from './github-types.ts';
import {
  deploymentTarget,
  releaseBranches,
  releaseVersion,
  versionDecision,
} from './policy.ts';
import { workerVersionId } from './worker-version.ts';

type Repository = ActionContext['context']['repo'];

function isNotFound(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === 404
  );
}

async function packageAt(github: GitHub, repo: Repository, ref: string) {
  const { data } = await github.rest.repos.getContent({
    ...repo,
    path: 'package.json',
    ref,
  });
  if (Array.isArray(data) || data.type !== 'file' || data.encoding !== 'base64')
    throw new Error('package.json is not a regular file');
  const value: { version: string; [key: string]: unknown } = JSON.parse(
    Buffer.from(data.content, 'base64').toString('utf8'),
  );
  return { data, value };
}

async function milestoneFor(github: GitHub, repo: Repository, version: string) {
  const milestones = await github.paginate(github.rest.issues.listMilestones, {
    ...repo,
    state: 'open',
    per_page: 100,
  });
  const matches = milestones.filter(item => item.title === version);
  if (matches.length !== 1)
    throw new Error(`Expected one open milestone named ${version}`);
  return matches[0].number;
}

function isRenovateDependencyPR(
  pr: NonNullable<ActionContext['context']['payload']['pull_request']>,
  repository: string,
) {
  return (
    pr.base.ref.startsWith('release/') &&
    pr.head.repo?.full_name === repository &&
    pr.user.login === 'renovate[bot]' &&
    pr.head.ref.startsWith('renovate/')
  );
}

export async function metadata({ github, context }: ActionContext) {
  const pr = context.payload.pull_request;
  const repository = context.payload.repository.full_name;
  if (
    !pr ||
    pr.head.repo?.full_name !== repository ||
    isRenovateDependencyPR(pr, repository)
  )
    return;
  const version = releaseVersion(
    pr.base.ref === 'main' ? pr.head.ref : pr.base.ref,
  );
  const milestone = await milestoneFor(github, context.repo, version);
  await github.rest.issues.update({
    ...context.repo,
    issue_number: pr.number,
    milestone,
  });
}

export async function checkMetadata({ github, context }: ActionContext) {
  const pr = context.payload.pull_request;
  if (!pr || isRenovateDependencyPR(pr, context.payload.repository.full_name))
    return;
  const version = releaseVersion(
    pr.base.ref === 'main' ? pr.head.ref : pr.base.ref,
  );
  const { data: fresh } = await github.rest.pulls.get({
    ...context.repo,
    pull_number: pr.number,
  });
  if (fresh.milestone?.title !== version)
    throw new Error('PR milestone does not match target release');
}

export async function bump({ github, context, core }: Action) {
  const pr = context.payload.pull_request;
  if (
    !pr ||
    pr.base.ref !== 'main' ||
    pr.head.repo?.full_name !== context.payload.repository.full_name
  )
    return;
  const { data: fresh } = await github.rest.pulls.get({
    ...context.repo,
    pull_number: pr.number,
  });
  if (fresh.state !== 'open') return;
  const { value } = await packageAt(github, context.repo, fresh.head.sha);
  const decision = versionDecision(fresh.head.ref, value.version);
  if (!decision.bump) {
    core.info('Version already matches');
    return;
  }
  const milestone = await milestoneFor(github, context.repo, decision.target);
  const branch = `codex/bump-${decision.target}`;
  const existing = await github.paginate(github.rest.pulls.list, {
    ...context.repo,
    state: 'all',
    head: `${context.repo.owner}:${branch}`,
    base: fresh.head.ref,
    per_page: 100,
  });
  const open = existing.find(item => item.state === 'open');
  if (open) {
    if (open.milestone?.number !== milestone)
      await github.rest.issues.update({
        ...context.repo,
        issue_number: open.number,
        milestone,
      });
    core.info(
      'Existing bump PR retained; resolve drift/conflicts without force-push',
    );
    return;
  }
  try {
    await github.rest.git.getRef({ ...context.repo, ref: `heads/${branch}` });
    throw new Error('Bump branch already exists; manual resolution required');
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  const updated = { ...value, version: decision.target };
  const blob = await github.rest.git.createBlob({
    ...context.repo,
    content: JSON.stringify(updated, null, 2) + '\n',
    encoding: 'utf-8',
  });
  const { data: base } = await github.rest.git.getCommit({
    ...context.repo,
    commit_sha: fresh.head.sha,
  });
  const tree = await github.rest.git.createTree({
    ...context.repo,
    base_tree: base.tree.sha,
    tree: [
      {
        path: 'package.json',
        mode: '100644',
        type: 'blob',
        sha: blob.data.sha,
      },
    ],
  });
  const commit = await github.rest.git.createCommit({
    ...context.repo,
    message: `chore(release): bump version to ${decision.target}`,
    tree: tree.data.sha,
    parents: [fresh.head.sha],
  });
  // Recheck the source before writing a new branch; never update or force an existing ref.
  const { data: latest } = await github.rest.pulls.get({
    ...context.repo,
    pull_number: pr.number,
  });
  if (latest.head.sha !== fresh.head.sha)
    throw new Error('Release head changed; rerun version preparation');
  await github.rest.git.createRef({
    ...context.repo,
    ref: `refs/heads/${branch}`,
    sha: commit.data.sha,
  });
  const created = await github.rest.pulls.create({
    ...context.repo,
    head: branch,
    base: fresh.head.ref,
    title: `chore(release): bump version to ${decision.target}`,
    body: `## 🗝️ Changes

- Set the package version to ${decision.target} for release PR #${pr.number}.

## 🧪 Verification

- CI and Codex review are pending.`,
  });
  await github.rest.issues.update({
    ...context.repo,
    issue_number: created.data.number,
    milestone,
  });
}

export async function checkVersion({ github, context }: ActionContext) {
  const pr = context.payload.pull_request;
  if (!pr || pr.base.ref !== 'main') return;
  const { value } = await packageAt(github, context.repo, pr.head.sha);
  if (versionDecision(pr.head.ref, value.version).bump)
    throw new Error('Version bump must merge before this release');
}

export async function scheduledTargets({ github, context, core }: Action) {
  const branches = await github.paginate(github.rest.repos.listBranches, {
    ...context.repo,
    per_page: 100,
  });
  const names = releaseBranches(branches.map(item => item.name));
  core.setOutput(
    'matrix',
    JSON.stringify(
      names.map(name => {
        const branch = branches.find(item => item.name === name);
        if (!branch) throw new Error(`Audit branch not found: ${name}`);
        return { branch: name, sha: branch.commit.sha };
      }),
    ),
  );
}

export async function readAuditLockfile(
  github: GitHub,
  repo: Repository,
  sha: string,
) {
  if (!/^[a-f0-9]{40}$/i.test(sha))
    throw new Error('Expected a full audit commit SHA');
  const { data } = await github.rest.repos.getContent({
    ...repo,
    path: 'pnpm-lock.yaml',
    ref: sha,
  });
  if (Array.isArray(data) || data.type !== 'file' || data.encoding !== 'base64')
    throw new Error('Expected base64-encoded pnpm-lock.yaml content');
  const lockfile = Buffer.from(data.content, 'base64');
  if (!lockfile.length) throw new Error('Audit lockfile is empty');
  return lockfile;
}

export async function prepareDeployment({
  github,
  context,
  core,
}: Action & { context: { ref: string; sha: string } }) {
  if (!context.ref.startsWith('refs/heads/')) return;
  const branch = context.ref.slice('refs/heads/'.length);
  if (branch !== 'main') releaseVersion(branch);
  const pulls = await github.paginate(github.rest.pulls.list, {
    ...context.repo,
    state: 'closed',
    base: branch,
    per_page: 100,
  });
  const matches = pulls.filter(
    pr =>
      pr.merged_at &&
      pr.base.ref === branch &&
      pr.merge_commit_sha === context.sha,
  );
  if (!matches.length) {
    core.info(
      `No merged PR found for ${branch} at ${context.sha}; skipping deployment`,
    );
    return;
  }
  if (matches.length !== 1)
    throw new Error('Multiple merged PRs match the push');
  const [pr] = matches;
  const target = deploymentTarget(
    { ...pr, merged: true },
    context.payload.repository.full_name,
  );
  if (!target) return;
  const { value } = await packageAt(github, context.repo, target.sha);
  if (target.environment === 'production') {
    if (value.version !== target.version)
      throw new Error('Production version mismatch');
    try {
      const { data } = await github.rest.git.getRef({
        ...context.repo,
        ref: `tags/v${target.version}`,
      });
      // This workflow only creates lightweight tags; annotated/external tags require manual review.
      if (data.object.type !== 'commit' || data.object.sha !== target.sha)
        throw new Error('Existing tag conflicts with deployment SHA');
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }
  for (const [key, value] of Object.entries(target)) core.setOutput(key, value);
  core.setOutput('pr_number', String(pr.number));
}

export async function staleDeployment({ github, context, core }: Action) {
  const sha = process.env.DEPLOY_SHA;
  const environment = process.env.DEPLOY_ENVIRONMENT;
  if (!sha || !environment) throw new Error('Missing deployment target');
  const deployments = await github.paginate(github.rest.repos.listDeployments, {
    ...context.repo,
    environment,
    per_page: 100,
  });
  let retryVersion: string | undefined;
  for (const deployment of deployments) {
    const statuses = await github.paginate(
      github.rest.repos.listDeploymentStatuses,
      { ...context.repo, deployment_id: deployment.id, per_page: 100 },
    );
    const published = statuses.find(item =>
      item.description?.startsWith('Worker published:'),
    );
    const started = statuses.some(item =>
      item.description?.startsWith('Publication started:'),
    );
    if (!published && !started) continue;
    const { data } = await github.rest.repos.compareCommits({
      ...context.repo,
      base: sha,
      head: deployment.sha,
    });
    if (data.status === 'ahead' && !published)
      throw new Error(
        'Publication status is uncertain; review the deployed Worker before proceeding',
      );
    if (data.status === 'identical' && !published) continue;
    if (
      data.status === 'identical' &&
      !statuses.some(item => item.state === 'success')
    ) {
      const prefix = `Worker published: ${sha} `;
      if (!published?.description?.startsWith(prefix))
        throw new Error(
          'Published Worker version ID is missing; review the deployment manually',
        );
      const id = workerVersionId(published.description.slice(prefix.length));
      if (retryVersion && retryVersion !== id)
        throw new Error(
          'Multiple published Worker versions match this SHA; review manually',
        );
      retryVersion = id;
      continue;
    }
    if (data.status === 'ahead' || data.status === 'identical') {
      core.setOutput('skip', 'true');
      await core.summary
        .addRaw(
          `Skipped ${sha}: ${deployment.sha} has already been published.\n`,
        )
        .write();
      return;
    }
    if (data.status === 'diverged')
      throw new Error('Deployment history diverged; review manually');
  }
  if (retryVersion) {
    core.setOutput('already_published', 'true');
    core.setOutput('worker_version_id', retryVersion);
  }
  core.setOutput('skip', 'false');
}

export async function markPublished({ github, context }: ActionContext) {
  const versionId = workerVersionId(process.env.WORKER_VERSION_ID);
  return recordPublication({ github, context }, 'Worker published:', versionId);
}

export async function markIntent({ github, context }: ActionContext) {
  return recordPublication({ github, context }, 'Publication started:');
}

async function recordPublication(
  { github, context }: ActionContext,
  marker: string,
  versionId?: string,
) {
  const { data } = await github.rest.repos.listDeployments({
    ...context.repo,
    environment: process.env.DEPLOY_ENVIRONMENT,
    sha: process.env.DEPLOY_SHA,
    per_page: 100,
  });
  if (!data.length) throw new Error('Environment deployment record is missing');
  await github.rest.repos.createDeploymentStatus({
    ...context.repo,
    deployment_id: data[0].id,
    state: 'in_progress',
    description: `${marker} ${process.env.DEPLOY_SHA}${versionId ? ` ${versionId}` : ''}`,
    environment_url: process.env.DEPLOY_URL,
  });
}

export async function publishRelease({ github, context, core }: Action) {
  const sha = process.env.DEPLOY_SHA;
  const tag = `v${process.env.RELEASE_VERSION}`;
  if (!sha) throw new Error('Missing deployment SHA');
  try {
    const { data } = await github.rest.git.getRef({
      ...context.repo,
      ref: `tags/${tag}`,
    });
    if (data.object.type !== 'commit' || data.object.sha !== sha)
      throw new Error('Tag points to another commit');
  } catch (error) {
    if (!isNotFound(error)) throw error;
    await github.rest.git.createRef({
      ...context.repo,
      ref: `refs/tags/${tag}`,
      sha,
    });
  }
  try {
    await github.rest.repos.getReleaseByTag({ ...context.repo, tag });
    core.info('Release already exists; left unchanged');
  } catch (error) {
    if (!isNotFound(error)) throw error;
    await github.rest.repos.createRelease({
      ...context.repo,
      tag_name: tag,
      target_commitish: sha,
      name: tag,
      generate_release_notes: true,
    });
  }
}
