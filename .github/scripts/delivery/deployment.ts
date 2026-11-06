import { execFileSync } from 'node:child_process';
import {
  env,
  main,
  output,
  prNumber,
  Repository,
  sleep,
  summary,
  type Release,
} from './github.ts';
import {
  parseReleaseBranch,
  resolveTarget,
  type DeploymentTarget,
  type PullRequest,
} from './policy.ts';

export async function resolveDeployment(repo: Repository, number: number) {
  const pull = await repo.pull(number);
  if (
    !pull.merged ||
    pull.state !== 'closed' ||
    pull.head.repo?.full_name !== repo.name
  )
    return null;
  return resolveTarget(pull, repo.name, await repo.ref(pull.base.ref));
}

export async function mergedPullForPush(
  repo: Repository,
  sha: string,
  branch: string,
): Promise<number | null> {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid pushed commit');
  if (branch !== 'main') parseReleaseBranch(branch);
  const related = await repo.api.paginate<PullRequest>(
    `${repo.path}/commits/${sha}/pulls`,
  );
  const matching = related.filter(
    pull =>
      pull.state === 'closed' &&
      (pull.merged || pull.merged_at) &&
      pull.merge_commit_sha === sha &&
      pull.base.ref === branch &&
      pull.base.repo.full_name === repo.name &&
      pull.head.repo?.full_name === repo.name,
  );
  if (matching.length > 1)
    throw new Error('Ambiguous merged PR for pushed commit');
  return matching[0]?.number ?? null;
}

async function assertCurrent(repo: Repository, target: DeploymentTarget) {
  const current = await resolveDeployment(repo, target.prNumber);
  if (
    !current ||
    current.sha !== target.sha ||
    current.environment !== target.environment ||
    current.branch !== target.branch
  )
    throw new Error(
      'Deployment commit was superseded; refusing to overwrite the current target',
    );
  if (
    process.env.GITHUB_REF_NAME &&
    process.env.GITHUB_REF_NAME !== target.branch
  )
    throw new Error(`Run this recovery workflow on ${target.branch}`);
}

export async function verifyHttp(
  target: DeploymentTarget,
  deadline = Date.now() + 5 * 60_000,
  transport: typeof fetch = fetch,
  pause = sleep,
): Promise<void> {
  let reason: string;
  do {
    try {
      const response = await transport(target.url, {
        signal: AbortSignal.timeout(10_000),
        cache: 'no-store',
        redirect: 'error',
      });
      if (
        response.status === 200 &&
        response.headers.get('content-type')?.includes('text/html') &&
        /<title>\s*Personal Blog\s*<\/title>/i.test(await response.text())
      )
        return;
      reason = `Unexpected HTTP status or homepage content (${response.status})`;
    } catch {
      reason = 'Site request failed';
    }
    if (Date.now() >= deadline) break;
    await pause(Math.min(10_000, deadline - Date.now()));
  } while (Date.now() < deadline);
  throw new Error(
    `HTTP verification failed: ${reason}. The uploaded Worker may already be serving traffic.`,
  );
}

export async function publishRelease(
  repo: Repository,
  target: DeploymentTarget,
): Promise<string> {
  if (
    target.environment !== 'production' ||
    !target.version ||
    (await repo.version(target.sha)) !== target.version
  )
    throw new Error('Production package and release version disagree');
  const tag = `v${target.version}`;
  let existingSha = await repo.tagSha(tag);
  if (existingSha && existingSha !== target.sha)
    throw new Error(`Tag ${tag} points to a different commit`);
  if (!existingSha) {
    await repo.api.request('POST', `${repo.path}/git/refs`, {
      ref: `refs/tags/${tag}`,
      sha: target.sha,
    });
    existingSha = await repo.tagSha(tag);
    if (existingSha !== target.sha)
      throw new Error('New tag could not be verified');
  }
  const existing = await repo.api.optional<Release>(
    `${repo.path}/releases/tags/${tag}`,
  );
  if (existing) {
    if (existing.tag_name !== tag || existing.draft || existing.prerelease)
      throw new Error('Existing release needs owner review');
    return existing.html_url;
  }
  return (
    await repo.api.request<Release>('POST', `${repo.path}/releases`, {
      tag_name: tag,
      target_commitish: target.sha,
      name: tag,
      generate_release_notes: true,
      draft: false,
      prerelease: false,
    })
  ).html_url;
}

type Result = {
  worker: boolean;
  publication: boolean;
  stage: string;
  releaseUrl?: string;
};

export function renderComment(
  target: DeploymentTarget,
  repo: string,
  logs: string,
  result: Result,
): string {
  const production = target.environment === 'production',
    name = production ? 'Production' : 'Preview';
  const links = `[Commit \`${target.sha.slice(0, 7)}\`](https://github.com/${repo}/commit/${target.sha}) · [View logs](${logs})`;
  const marker = `<!-- deployment-result:${target.environment} -->`;
  if (result.worker && (!production || result.publication)) {
    const release =
      production && result.releaseUrl
        ? ` · [Release v${target.version}](${result.releaseUrl})`
        : '';
    return `${marker}\n### ✅ ${name} deployed\n\n[${production ? 'Open site' : 'Open preview'}](${target.url}) · ${links}${release}`;
  }
  if (result.worker)
    return `${marker}\n### ⚠️ Production deployed; release publication failed\n\n[Open site](${target.url}) · ${links}`;
  return `${marker}\n### ❌ ${name} deployment failed\n\n**Stage:** ${result.stage}\n\n${result.stage === 'HTTP verification' ? 'The site did not return the expected HTTP 200 HTML response within five minutes.' : 'The workflow could not complete this stage.'}\n\n${links}`;
}

async function comment(repo: Repository, target: DeploymentTarget) {
  const body = renderComment(
    target,
    repo.name,
    `https://github.com/${repo.name}/actions/runs/${env('GITHUB_RUN_ID')}`,
    {
      worker: process.env.WORKER_SUCCEEDED === 'true',
      publication: process.env.PUBLICATION_SUCCEEDED === 'true',
      stage: process.env.FAILED_STAGE || 'Deployment',
      releaseUrl: process.env.RELEASE_URL,
    },
  );
  const existing = (await repo.comments(target.prNumber)).find(
    item =>
      item.user.id === 41898282 &&
      item.user.login === 'github-actions[bot]' &&
      item.user.type === 'Bot' &&
      item.body.startsWith(`<!-- deployment-result:${target.environment} -->`),
  );
  if (existing)
    await repo.api.request(
      'PATCH',
      `${repo.path}/issues/comments/${existing.id}`,
      { body },
    );
  else
    await repo.api.request(
      'POST',
      `${repo.path}/issues/${target.prNumber}/comments`,
      { body },
    );
}

function deleteWithLease(branch: string, sha: string): Promise<void> {
  execFileSync(
    'git',
    [
      'push',
      `--force-with-lease=refs/heads/${branch}:${sha}`,
      'origin',
      `:refs/heads/${branch}`,
    ],
    { stdio: 'inherit' },
  );
  return Promise.resolve();
}

export async function cleanup(
  repo: Repository,
  target: DeploymentTarget,
  remove: (branch: string, sha: string) => Promise<void> = deleteWithLease,
) {
  await assertCurrent(repo, target);
  if (
    target.environment === 'production' &&
    !(await repo.productionComplete(target.sha))
  )
    throw new Error('Production completion evidence is missing');
  const pull = await repo.pull(target.prNumber),
    source = pull.head.ref;
  const sourceRef = await repo.api.optional<{ object: { sha: string } }>(
    `${repo.path}/git/ref/heads/${encodeURIComponent(source)}`,
  );
  if (
    source !== 'main' &&
    !(target.environment === 'preview' && source.startsWith('release/')) &&
    sourceRef
  ) {
    const open = await repo.api.paginate<PullRequest>(
      `${repo.path}/pulls?state=open`,
    );
    const dependent = open.some(
      item => item.base.ref === source || item.head.ref === source,
    );
    if (
      pull.merged &&
      pull.merge_commit_sha === target.sha &&
      sourceRef.object.sha === pull.head.sha &&
      !dependent
    )
      await remove(source, sourceRef.object.sha);
    else
      summary(
        'Source branch retained because it changed or has remaining/dependent work',
      );
  }
  if (target.environment === 'production') {
    const open = await repo.api.paginate<PullRequest>(
      `${repo.path}/pulls?state=open`,
    );
    for (const item of open.filter(
      pr =>
        pr.user.login === 'dependabot[bot]' &&
        pr.head.repo?.full_name === repo.name &&
        !pr.draft,
    ))
      await repo.api.request(
        'POST',
        `${repo.path}/actions/workflows/dependabot.yml/dispatches`,
        { ref: 'main', inputs: { 'pr-number': String(item.number) } },
      );
  }
}

if (import.meta.main)
  await main(async () => {
    const repo = new Repository();
    if (process.argv[2] === 'resolve') {
      let number: number | null;
      if (process.env.GITHUB_EVENT_NAME === 'push') {
        const sha = env('GITHUB_SHA'),
          branch = env('GITHUB_REF_NAME');
        number = await mergedPullForPush(repo, sha, branch);
        const deadline = Date.now() + 60_000;
        while (
          !number &&
          Date.now() < deadline &&
          (await repo.ref(branch)) === sha
        ) {
          await sleep(10_000);
          number = await mergedPullForPush(repo, sha, branch);
        }
      } else number = prNumber();
      const target = number ? await resolveDeployment(repo, number) : null;
      output('active', Boolean(target));
      if (!target) {
        summary(
          'Unmerged, unsupported, or superseded deployment; nothing to deploy',
        );
        return;
      }
      await assertCurrent(repo, target);
      if (
        process.env.DEPLOY_MODE === 'publish' &&
        target.environment !== 'production'
      )
        throw new Error('Publication-only recovery is production-only');
      output('target', JSON.stringify(target));
      for (const [key, value] of Object.entries(target))
        if (value !== null) output(key, value);
      return;
    }
    const target = JSON.parse(env('DEPLOY_TARGET')) as DeploymentTarget;
    if (process.argv[2] === 'comment') {
      await comment(repo, target);
      return;
    }
    await assertCurrent(repo, target);
    switch (process.argv[2]) {
      case 'assert-current':
        break;
      case 'verify-http':
        await verifyHttp(target);
        break;
      case 'verify-publication': {
        const deadline = Date.now() + 60_000;
        while (!(await repo.verifiedDeployment(target.sha, 'production'))) {
          if (Date.now() >= deadline)
            throw new Error(
              'Trusted successful production delivery evidence is missing',
            );
          await sleep(10_000);
        }
        output('worker-verified', true);
        break;
      }
      case 'publish':
        output('release-url', await publishRelease(repo, target));
        break;
      case 'cleanup':
        await cleanup(repo, target);
        break;
      default:
        throw new Error('Unknown deployment command');
    }
  });
