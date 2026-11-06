import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import {
  env,
  main,
  mergeReady,
  output,
  positiveInteger,
  prNumber,
  Repository,
  sleep,
  summary,
} from './github.ts';
import {
  compareVersions,
  object,
  parseReleaseBranch,
  type PullRequest,
} from './policy.ts';

export function releaseInput(
  pull: PullRequest,
  repo: string,
  mainVersion: string | null,
) {
  if (
    pull.state !== 'open' ||
    pull.draft ||
    pull.base.ref !== 'main' ||
    pull.head.repo?.full_name !== repo ||
    pull.base.repo.full_name !== repo
  )
    throw new Error(
      'Expected an open same-repository release PR targeting main',
    );
  const release = parseReleaseBranch(pull.head.ref);
  if (
    mainVersion !== null &&
    compareVersions(release.version, mainVersion) <= 0
  )
    throw new Error('Release version must be newer than production');
  return release;
}

export function validateVersionChange(
  before: unknown,
  after: unknown,
  version: string,
) {
  const original = object(before),
    changed = object(after);
  return Boolean(
    original &&
    changed &&
    changed.version === version &&
    isDeepStrictEqual({ ...original, version }, changed),
  );
}

const git = (...args: string[]) =>
  execFileSync('git', args, { encoding: 'utf8' }).trim();

async function currentRelease(repo: Repository, number: number) {
  const pull = await repo.pull(number);
  const release = releaseInput(
    pull,
    repo.name,
    await repo.version(await repo.ref('main')),
  );
  if ((await repo.ref(release.branch)) !== pull.head.sha)
    throw new Error('Release PR head is stale');
  return { pull, release, branch: `automation/release/${release.version}` };
}

export async function prepareReleaseVersion(repo: Repository, number: number) {
  const { pull, release, branch } = await currentRelease(repo, number);
  const existing = (
    await repo.api.paginate<PullRequest>(
      `${repo.path}/pulls?state=open&base=${encodeURIComponent(release.branch)}&head=${encodeURIComponent(repo.name.split('/')[0] + ':' + branch)}`,
    )
  )[0];
  if (existing && existing.user.id !== positiveInteger(env('APP_BOT_ID')))
    throw new Error('Preparation PR is not owned by the configured App');
  output('changed', false);
  output('needs-pr', false);
  if (!existing && (await repo.version(pull.head.sha)) === release.version) {
    summary('Release package version is already correct');
    return;
  }
  if (
    !existing &&
    (await repo.api.optional(
      `${repo.path}/git/ref/heads/${encodeURIComponent(branch)}`,
    ))
  )
    throw new Error(
      'Preparation branch exists without an open App PR; owner cleanup required',
    );
  git('config', 'user.name', `${env('APP_SLUG')}[bot]`);
  git(
    'config',
    'user.email',
    `${env('APP_BOT_ID')}+${env('APP_SLUG')}[bot]@users.noreply.github.com`,
  );
  let originalHead: string | null = null;
  if (existing) {
    git(
      'fetch',
      'origin',
      `refs/heads/${branch}:refs/remotes/origin/${branch}`,
    );
    originalHead = git('rev-parse', `refs/remotes/origin/${branch}`);
    if (originalHead !== existing.head.sha)
      throw new Error('Preparation head changed before checkout');
    git('switch', '--detach', originalHead);
    git('merge', '--no-edit', pull.head.sha);
  } else git('switch', '-c', branch, pull.head.sha);
  const before = JSON.parse(readFileSync('package.json', 'utf8')) as unknown;
  const previous = object(before)?.version;
  if (
    typeof previous !== 'string' ||
    compareVersions(previous, release.version) > 0
  )
    throw new Error('Cannot downgrade package version');
  const sourcePackage = JSON.parse(
    git('show', `${pull.head.sha}:package.json`),
  ) as unknown;
  const branchChanges = git('diff', '--name-only', pull.head.sha, 'HEAD')
    .split('\n')
    .filter(Boolean);
  if (
    !validateVersionChange(sourcePackage, before, previous) ||
    branchChanges.some(
      file => file !== 'package.json' && file !== 'pnpm-lock.yaml',
    )
  )
    throw new Error(
      'Preparation branch contains unreviewed changes beyond version files',
    );
  if (previous !== release.version) {
    execFileSync(
      'pnpm',
      ['--ignore-scripts', 'version', release.version, '--no-git-tag-version'],
      { stdio: 'inherit' },
    );
    execFileSync('pnpm', ['format'], { stdio: 'inherit' });
    const after = JSON.parse(readFileSync('package.json', 'utf8')) as unknown;
    if (!validateVersionChange(before, after, release.version))
      throw new Error('Unexpected package edit during version preparation');
    const changed = git('diff', '--name-only').split('\n').filter(Boolean);
    if (
      changed.some(
        path => path !== 'package.json' && path !== 'pnpm-lock.yaml',
      ) ||
      git('ls-files', '--others', '--exclude-standard')
    )
      throw new Error('Unrelated files changed during version preparation');
    git('add', '--', 'package.json', 'pnpm-lock.yaml');
    git('commit', '-m', `chore(release): bump version to ${release.version}`);
  }
  output('changed', originalHead !== git('rev-parse', 'HEAD'));
  output('needs-pr', true);
  output('branch', branch);
  output('release-branch', release.branch);
  output('version', release.version);
  output('head-sha', git('rev-parse', 'HEAD'));
  if (existing) output('pr-number', existing.number);
}

async function publishPreparation(repo: Repository, number: number) {
  const { pull, release, branch } = await currentRelease(repo, number);
  if (
    branch !== env('VERSION_BRANCH') ||
    git('rev-parse', 'HEAD') !== env('PREPARED_SHA')
  )
    throw new Error('Prepared branch or SHA mismatch');
  const existing = (
    await repo.api.paginate<PullRequest>(
      `${repo.path}/pulls?state=open&base=${encodeURIComponent(release.branch)}&head=${encodeURIComponent(repo.name.split('/')[0] + ':' + branch)}`,
    )
  )[0];
  if (existing && existing.user.id !== positiveInteger(env('APP_BOT_ID')))
    throw new Error('Preparation PR ownership changed');
  git('push', 'origin', `HEAD:refs/heads/${branch}`);
  const child =
    existing ??
    (await repo.api.request<PullRequest>('POST', `${repo.path}/pulls`, {
      base: release.branch,
      head: branch,
      title: `chore(release): bump version to ${release.version}`,
      body: `Prepare package version ${release.version} for ${pull.html_url ?? `release PR #${number}`}.

This PR is merged only after current-head CI and Codex review satisfy repository policy.`,
    }));
  await repo.assignMilestone(child.number, release.branch);
  await mergeReady(repo, child.number, async () => {
    const original = await repo.pull(number);
    return (
      original.state === 'open' &&
      !original.draft &&
      original.head.ref === release.branch &&
      original.base.ref === 'main'
    );
  });
}

export async function verifyReleaseReadiness(
  repo: Repository,
  number: number,
  deadline = Date.now() + 30 * 60_000,
) {
  while (Date.now() < deadline) {
    const { pull, release } = await currentRelease(repo, number);
    if (
      (await repo.version(pull.head.sha)) === release.version &&
      (await repo.verifiedDeployment(pull.head.sha, 'preview'))
    ) {
      const latest = await repo.pull(number);
      if (
        latest.head.sha === pull.head.sha &&
        latest.state === 'open' &&
        !latest.draft &&
        !(await repo.behind(latest))
      ) {
        summary(`Release ${release.version} is ready at ${pull.head.sha}`);
        return;
      }
    }
    await sleep(10_000);
  }
  throw new Error(
    'Release version or exact-head verified preview is missing after 30 minutes; resume readiness',
  );
}

if (import.meta.main)
  await main(async () => {
    const repo = new Repository(),
      number = prNumber();
    switch (process.argv[2]) {
      case 'resolve': {
        const { pull, release } = await currentRelease(repo, number);
        const branch = await repo.api.request<{ protected: boolean }>(
          'GET',
          `${repo.path}/branches/${encodeURIComponent(release.branch)}`,
        );
        if (!branch.protected)
          throw new Error(
            'Release branch protection must be configured before preparation',
          );
        await repo.assignMilestone(number, release.branch);
        output('sha', pull.head.sha);
        output('branch', release.branch);
        output('version', release.version);
        break;
      }
      case 'prepare':
        await prepareReleaseVersion(repo, number);
        break;
      case 'publish':
        await publishPreparation(repo, number);
        break;
      case 'verify':
        await verifyReleaseReadiness(repo, number);
        break;
      default:
        throw new Error('Unknown release preparation command');
    }
  });
