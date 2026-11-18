import type { Action, ActionContext, GitHub } from './github-types.ts';
import {
  deploymentTarget,
  releaseBranches,
  releaseVersion,
  versionDecision,
} from './policy.ts';

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

async function ensureIssue(
  github: GitHub,
  repo: Repository,
  marker: string,
  title: string,
  body: string,
  milestone: number,
) {
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    ...repo,
    state: 'all',
    per_page: 100,
  });
  const existing = issues.filter(
    item => !item.pull_request && item.body?.includes(marker),
  );
  if (existing.length > 1)
    throw new Error('Duplicate tracking issues require manual resolution');
  if (existing.length) {
    if (existing[0].state !== 'open')
      throw new Error('Tracking issue is closed; review manually');
    await github.rest.issues.update({
      ...repo,
      issue_number: existing[0].number,
      milestone,
    });
    return existing[0];
  }
  const { data } = await github.rest.issues.create({
    ...repo,
    title,
    milestone,
    body: `${marker}\n${body}\n\nRecommended metadata: Priority p2; Size xs; Estimate 1 hour.`,
  });
  return data;
}

export async function metadata({
  github,
  context,
  core,
  appSlug,
}: Action & { appSlug?: string }) {
  const pr = context.payload.pull_request;
  if (!pr || pr.head.repo?.full_name !== context.payload.repository.full_name)
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
  const automation =
    pr.head.ref.startsWith('codex/bump-') &&
    Boolean(appSlug) &&
    pr.user.login === `${appSlug}[bot]`;
  const renovate =
    pr.user.login === 'renovate[bot]' && pr.head.ref.startsWith('renovate/');
  if (!automation && !renovate) return;
  let issue;
  if (automation) {
    const { data } = await github.rest.pulls.get({
      ...context.repo,
      pull_number: pr.number,
    });
    const issueNumber = data.body?.match(/Refs: #(\d+)/)?.[1];
    if (!issueNumber)
      throw new Error('Bump PR must reference its pre-existing issue');
    ({ data: issue } = await github.rest.issues.get({
      ...context.repo,
      issue_number: Number(issueNumber),
    }));
    if (
      issue.pull_request ||
      issue.state !== 'open' ||
      !issue.body?.includes(`<!-- version-bump:${version} -->`)
    )
      throw new Error('Invalid bump tracking issue');
    await github.rest.issues.update({
      ...context.repo,
      issue_number: issue.number,
      milestone,
    });
  } else {
    issue = await ensureIssue(
      github,
      context.repo,
      `<!-- bot-pr:${pr.number} -->`,
      `chore(deps): track dependency PR #${pr.number}`,
      `Track ${pr.html_url}.\n\n## Acceptance Criteria\n- [ ] Review dependency and lockfile changes.\n- [ ] Required CI and current Codex review pass; valid findings are resolved.\n- [ ] Verify release deployment before owner-authorized closure.`,
      milestone,
    );
  }
  const marker = '<!-- bot-tracking -->';
  const comments = await github.paginate(github.rest.issues.listComments, {
    ...context.repo,
    issue_number: pr.number,
    per_page: 100,
  });
  const body = `${marker}\nRelated issue: #${issue.number}\nTarget milestone: ${version}\nNo automatic issue closure.`;
  const comment = comments.find(
    item => item.user?.type === 'Bot' && item.body?.startsWith(marker),
  );
  if (comment)
    await github.rest.issues.updateComment({
      ...context.repo,
      comment_id: comment.id,
      body,
    });
  else
    await github.rest.issues.createComment({
      ...context.repo,
      issue_number: pr.number,
      body,
    });
  core.info(`Tracking issue #${issue.number}`);
}

export async function checkMetadata({ github, context }: ActionContext) {
  const pr = context.payload.pull_request;
  if (!pr) return;
  const version = releaseVersion(
    pr.base.ref === 'main' ? pr.head.ref : pr.base.ref,
  );
  const { data: fresh } = await github.rest.pulls.get({
    ...context.repo,
    pull_number: pr.number,
  });
  if (fresh.milestone?.title !== version)
    throw new Error('PR milestone does not match target release');
  const comments = await github.paginate(github.rest.issues.listComments, {
    ...context.repo,
    issue_number: pr.number,
    per_page: 100,
  });
  const trusted = comments.find(
    item =>
      item.user?.type === 'Bot' &&
      item.body?.startsWith('<!-- bot-tracking -->'),
  );
  const issueNumber =
    fresh.body?.match(/Refs: #(\d+)/)?.[1] ??
    trusted?.body?.match(/Related issue: #(\d+)/)?.[1];
  // A release PR describes multiple work issues; its own milestone is the gate.
  if (pr.base.ref === 'main') return;
  if (!issueNumber)
    throw new Error('Missing related issue (use Refs: #number)');
  const { data: issue } = await github.rest.issues.get({
    ...context.repo,
    issue_number: Number(issueNumber),
  });
  if (
    issue.pull_request ||
    issue.state !== 'open' ||
    issue.milestone?.title !== version
  )
    throw new Error(
      'Related issue must be open and share the target milestone',
    );
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
  const issue = await ensureIssue(
    github,
    context.repo,
    `<!-- version-bump:${decision.target} -->`,
    `chore(release): prepare version ${decision.target}`,
    `Prepare release PR #${pr.number}.\n\n## Acceptance Criteria\n- [ ] Package version equals ${decision.target}.\n- [ ] CI, metadata and latest Codex review pass.\n- [ ] Merge bump PR into ${fresh.head.ref} and recheck release PR.\n- [ ] Verify production before owner-authorized closure.`,
    milestone,
  );
  const branch = `codex/bump-${decision.target}`;
  const existing = await github.paginate(github.rest.pulls.list, {
    ...context.repo,
    state: 'all',
    head: `${context.repo.owner}:${branch}`,
    base: fresh.head.ref,
    per_page: 100,
  });
  if (existing.some(item => item.state === 'open')) {
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
    body: `## Related Issues\nRefs: #${issue.number}\n\n## Changes\nSet package version to ${decision.target}; dependencies are unchanged.\n\n## Verification\nCI and current Codex review are pending. Agent checks and merges; no automatic merge.`,
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

export async function prepareDeployment({ github, context, core }: Action) {
  const target = deploymentTarget(
    context.payload.pull_request,
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
  for (const deployment of deployments) {
    const statuses = await github.paginate(
      github.rest.repos.listDeploymentStatuses,
      { ...context.repo, deployment_id: deployment.id, per_page: 100 },
    );
    const published = statuses.some(item =>
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
      core.setOutput('already_published', 'true');
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
  core.setOutput('skip', 'false');
}

export async function markPublished({ github, context }: ActionContext) {
  return recordPublication({ github, context }, 'Worker published:');
}

export async function markIntent({ github, context }: ActionContext) {
  return recordPublication({ github, context }, 'Publication started:');
}

async function recordPublication(
  { github, context }: ActionContext,
  marker: string,
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
    description: `${marker} ${process.env.DEPLOY_SHA}`,
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
