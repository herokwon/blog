import {
  env,
  GitHubError,
  main,
  mergeReady,
  output,
  positiveInteger,
  prNumber,
  Repository,
  summary,
} from './github.ts';
import {
  classifyUpdates,
  object,
  parseReleaseBranch,
  selectRelease,
  versionParts,
  type DependencyUpdate,
  type PullRequest,
} from './policy.ts';

type Intake = {
  pr: number;
  headSha: string;
  originalSha: string;
  updates: DependencyUpdate[];
};

export async function authenticateNativeHead(
  repo: Repository,
  pull: PullRequest,
  metadataSha: string,
): Promise<void> {
  const commits = await repo.api.paginate<{ sha: string }>(
    `${repo.path}/pulls/${pull.number}/commits`,
  );
  if (
    commits.length !== 1 ||
    commits[0].sha !== metadataSha ||
    pull.head.sha !== metadataSha
  )
    throw new Error(
      'Fresh intake requires a single signed Dependabot commit accounting for the complete head',
    );
  const commit = await repo.api.request<{
    author: { login: string } | null;
    commit: { verification: { verified: boolean } };
  }>('GET', `${repo.path}/commits/${metadataSha}`);
  if (
    commit.author?.login !== 'dependabot[bot]' ||
    commit.commit.verification.verified !== true ||
    (await repo.pull(pull.number)).head.sha !== metadataSha
  )
    throw new Error(
      'Fresh intake requires a single signed Dependabot commit at the unchanged head',
    );
}

function updates(value: unknown): DependencyUpdate[] {
  if (
    !Array.isArray(value) ||
    !value.length ||
    !value.every(item => {
      const data = object(item);
      return (
        data &&
        [
          'dependencyName',
          'dependencyType',
          'packageEcosystem',
          'prevVersion',
          'newVersion',
        ].every(key => typeof data[key] === 'string') &&
        (data.updateType === null || typeof data.updateType === 'string')
      );
    })
  )
    throw new Error('Invalid verified dependency metadata');
  return value as DependencyUpdate[];
}

export function readIntake(
  comments: unknown[],
  pr: number,
  sha: string,
  id: number,
  slug: string,
): Intake | null {
  for (const raw of [...comments].reverse()) {
    const comment = object(raw),
      user = object(comment?.user);
    if (
      user?.id !== id ||
      user.login !== `${slug}[bot]` ||
      user.type !== 'Bot' ||
      typeof comment?.body !== 'string'
    )
      continue;
    const match = /^<!-- dependabot-intake:v1 (\{[^\r\n]*\}) -->$/.exec(
      comment.body,
    );
    if (!match) continue;
    try {
      const receipt = object(JSON.parse(match[1]));
      if (
        receipt?.pr !== pr ||
        receipt.headSha !== sha ||
        typeof receipt.originalSha !== 'string' ||
        !/^[a-f0-9]{40}$/.test(receipt.originalSha)
      )
        continue;
      return {
        pr,
        headSha: sha,
        originalSha: receipt.originalSha,
        updates: updates(receipt.updates),
      };
    } catch {
      return null;
    }
  }
  return null;
}

export function validSynchronization(
  value: unknown,
  head: string,
  base: string,
  id: number,
) {
  const commit = object(value),
    author = object(commit?.author),
    detail = object(commit?.commit);
  const parents = commit?.parents;
  return (
    author?.id === id &&
    object(detail?.verification)?.verified === true &&
    Array.isArray(parents) &&
    parents.length === 2 &&
    object(parents[0])?.sha === head &&
    object(parents[1])?.sha === base
  );
}

export async function inspectDependabotPullRequest(
  repo: Repository,
  number: number,
) {
  const pull = await repo.pull(number);
  if (pull.state !== 'open' || pull.draft) return null;
  if (
    pull.user.login !== 'dependabot[bot]' ||
    !pull.head.ref.startsWith('dependabot/') ||
    pull.head.repo?.full_name !== repo.name ||
    pull.base.repo.full_name !== repo.name
  )
    throw new Error('Not a same-repository Dependabot PR');
  if (pull.base.ref !== 'main') parseReleaseBranch(pull.base.ref);
  return pull;
}

async function saveIntake(repo: Repository, receipt: Intake) {
  if ((await repo.pull(receipt.pr)).head.sha !== receipt.headSha)
    throw new Error('Dependabot head changed during intake');
  const id = positiveInteger(env('APP_BOT_ID')),
    slug = env('APP_SLUG');
  const comments = await repo.comments(receipt.pr);
  const existing = comments.find(
    comment =>
      comment.user.id === id &&
      comment.user.login === `${slug}[bot]` &&
      comment.body.startsWith('<!-- dependabot-intake:v1 '),
  );
  const body = `<!-- dependabot-intake:v1 ${JSON.stringify(receipt)} -->`;
  if (existing)
    await repo.api.request(
      'PATCH',
      `${repo.path}/issues/comments/${existing.id}`,
      { body },
    );
  else
    await repo.api.request(
      'POST',
      `${repo.path}/issues/${receipt.pr}/comments`,
      { body },
    );
}

async function intake(repo: Repository, pull: PullRequest) {
  const previous = readIntake(
    await repo.comments(pull.number),
    pull.number,
    pull.head.sha,
    positiveInteger(env('APP_BOT_ID')),
    env('APP_SLUG'),
  );
  if (process.env.DEPENDABOT_METADATA) {
    if (env('METADATA_SHA') !== pull.head.sha)
      throw new Error('Metadata is for a stale Dependabot head');
    await authenticateNativeHead(repo, pull, env('METADATA_SHA'));
    const receipt = {
      pr: pull.number,
      headSha: pull.head.sha,
      originalSha: pull.head.sha,
      updates: updates(JSON.parse(env('DEPENDABOT_METADATA'))),
    };
    await saveIntake(repo, receipt);
    return receipt;
  }
  if (!previous)
    throw new Error(
      'Verified intake missing; trigger a fresh Dependabot update before manual resumption',
    );
  return previous;
}

export async function runDependabotPullRequest(
  repo: Repository,
  number: number,
) {
  const pull = await inspectDependabotPullRequest(repo, number);
  if (!pull) {
    summary('PR is closed or draft; nothing to do');
    return;
  }
  const receipt = await intake(repo, pull);
  const branches = await repo.api.paginate<{ name: string }>(
    `${repo.path}/branches`,
  );
  const selected = selectRelease(
    branches.map(branch => branch.name),
    await repo.frozenReleases(),
    await repo.version(await repo.ref('main')),
  );
  if (selected.state === 'deferred') {
    summary(
      'Dependency routing deferred until production delivery and publication complete',
    );
    return;
  }
  let branch = selected.branch;
  if (selected.state === 'create') {
    const head = await repo.ref('main'),
      version = await repo.version(head);
    if (!version) throw new Error('Default branch is not bootstrapped');
    const parts = versionParts(version);
    parts[2]++;
    branch = `release/${parts.join('.')}`;
    const existing = await repo.api.optional<{ object: { sha: string } }>(
      `${repo.path}/git/ref/heads/${encodeURIComponent(branch)}`,
    );
    if (existing && existing.object.sha !== head)
      throw new Error(
        'Release branch appeared with a different head; restart routing',
      );
    if (!existing) {
      try {
        await repo.api.request('POST', `${repo.path}/git/refs`, {
          ref: `refs/heads/${branch}`,
          sha: head,
        });
      } catch (error) {
        if (!(
          error instanceof GitHubError &&
          error.status === 422 &&
          (await repo.ref(branch)) === head
        ))
          throw error;
      }
    }
    await repo.milestone(parseReleaseBranch(branch).version);
  }
  if (!branch) throw new Error('No release branch selected');
  await repo.assignMilestone(number, branch);
  if (pull.base.ref !== branch)
    await repo.api.request('PATCH', `${repo.path}/pulls/${number}`, {
      base: branch,
    });
  const afterSync = async (previous: PullRequest) => {
    if (previous.head.sha !== receipt.headSha)
      throw new Error(
        'Synchronization no longer starts at the authenticated intake head',
      );
    const fresh = await repo.pull(number);
    const commit = await repo.api.request<unknown>(
      'GET',
      `${repo.path}/commits/${fresh.head.sha}`,
    );
    if (
      !validSynchronization(
        commit,
        previous.head.sha,
        previous.base.sha,
        positiveInteger(env('APP_BOT_ID')),
      )
    )
      throw new Error(
        'Cannot authenticate synchronized Dependabot head; manual recovery required',
      );
    receipt.headSha = fresh.head.sha;
    await saveIntake(repo, receipt);
  };
  const decision = classifyUpdates(receipt.updates);
  summary(`Dependency policy: ${decision.reason}`);
  if (!decision.eligible) {
    const current = await repo.pull(number);
    if (await repo.synchronize(current)) {
      await new Promise(resolve => setTimeout(resolve, 10_000));
      await afterSync(current);
    }
    summary(
      'Routed and synchronized for owner-controlled review; automatic merging is disabled',
    );
    return;
  }
  await mergeReady(
    repo,
    number,
    async () => {
      const current = await inspectDependabotPullRequest(repo, number);
      if (
        !current ||
        current.base.ref !== branch ||
        current.head.sha !== receipt.headSha
      )
        return false;
      const authenticated = readIntake(
        await repo.comments(number),
        number,
        current.head.sha,
        positiveInteger(env('APP_BOT_ID')),
        env('APP_SLUG'),
      );
      return (
        authenticated?.originalSha === receipt.originalSha &&
        JSON.stringify(authenticated.updates) ===
          JSON.stringify(receipt.updates) &&
        (await repo.frozenReleases()).length === 0
      );
    },
    afterSync,
  );
}

if (import.meta.main)
  await main(async () => {
    const repo = new Repository(),
      number = prNumber();
    if (process.argv[2] === 'inspect') {
      const pull = await inspectDependabotPullRequest(repo, number);
      output('active', Boolean(pull));
      if (!pull) return;
      const receipt = readIntake(
        await repo.comments(number),
        number,
        pull.head.sha,
        positiveInteger(env('APP_BOT_ID')),
        env('APP_SLUG'),
      );
      if (
        !receipt &&
        (process.env.GITHUB_EVENT_NAME !== 'pull_request_target' ||
          process.env.EVENT_HEAD_SHA !== pull.head.sha)
      )
        throw new Error(
          'Fresh signed Dependabot metadata requires a current native PR event',
        );
      output('needs-metadata', !receipt);
      output('head-sha', pull.head.sha);
    } else await runDependabotPullRequest(repo, number);
  });
