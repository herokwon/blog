import { appendFileSync, readFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';
import {
  ciPassed,
  parseReleaseBranch,
  readReviewEvidence,
  type PullRequest,
} from './policy.ts';

export const sleep = async (ms: number) => {
  await setTimeout(ms);
};

export class GitHubError extends Error {
  status: number;
  constructor(status: number, path: string) {
    super(`GitHub ${status}: ${path}`);
    this.status = status;
  }
}

export class GitHubClient {
  private token: string;
  private transport: typeof fetch;
  private pause: (ms: number) => Promise<void>;
  constructor(token: string, transport: typeof fetch = fetch, pause = sleep) {
    if (!token) throw new Error('Missing GitHub token');
    this.token = token;
    this.transport = transport;
    this.pause = pause;
  }
  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (!path.startsWith('/repos/') || path.includes('://'))
      throw new Error('Invalid repository API path');
    for (let attempt = 0; ; attempt++) {
      let response: Response;
      try {
        response = await this.transport(`https://api.github.com${path}`, {
          method,
          signal: AbortSignal.timeout(30_000),
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      } catch {
        if (method !== 'GET' || attempt >= 2)
          throw new Error(`GitHub request interrupted: ${method} ${path}`);
        await this.pause(1000 * (attempt + 1));
        continue;
      }
      if (!response.ok) {
        const retryable =
          response.status >= 500 ||
          response.status === 429 ||
          (response.status === 403 &&
            (response.headers.has('retry-after') ||
              response.headers.get('x-ratelimit-remaining') === '0'));
        if (method === 'GET' && retryable && attempt < 2) {
          const delay = Math.max(
            Number(response.headers.get('retry-after') || 0) * 1000,
            1000 * (attempt + 1),
          );
          if (delay <= 30_000) {
            await this.pause(delay);
            continue;
          }
        }
        throw new GitHubError(response.status, path);
      }
      return response.status === 204
        ? (undefined as T)
        : ((await response.json()) as T);
    }
  }
  async paginate<T>(path: string, key?: string): Promise<T[]> {
    const items: T[] = [];
    for (let page = 1; page <= 100; page++) {
      const result = await this.request<T[] | Record<string, T[]>>(
        'GET',
        `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`,
      );
      const batch = key
        ? (result as Record<string, T[]>)[key]
        : (result as T[]);
      if (!Array.isArray(batch))
        throw new Error('Unexpected paginated GitHub response');
      items.push(...batch);
      if (batch.length < 100) return items;
    }
    throw new Error('GitHub pagination limit exceeded');
  }
  async optional<T>(path: string): Promise<T | null> {
    try {
      return await this.request<T>('GET', path);
    } catch (error) {
      if (error instanceof GitHubError && error.status === 404) return null;
      throw error;
    }
  }
}

export type Comment = {
  id: number;
  body: string;
  user: { id: number; login: string; type: string };
  html_url?: string;
};
export type Run = {
  id: number;
  head_sha: string;
  head_branch: string;
  status: string;
  conclusion: string | null;
  run_attempt: number;
  path: string;
  event: string;
};
export type Job = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
};
type Deployment = {
  id: number;
  sha: string;
  environment: string;
  creator: { id: number };
  performed_via_github_app: { id: number } | null;
};
type DeploymentStatus = {
  state: string;
  log_url: string;
  environment_url: string;
  creator: { id: number };
};
type Ref = { object: { sha: string; type: string } };
export type Release = {
  id: number;
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  html_url: string;
};

export class Repository {
  api: GitHubClient;
  name: string;
  path: string;
  constructor(
    name = env('GH_REPO'),
    token = env('GH_TOKEN'),
    api = new GitHubClient(token),
  ) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(name)) throw new Error('Invalid repository');
    this.name = name;
    this.path = `/repos/${name}`;
    this.api = api;
  }
  pull(number: number) {
    return this.api.request<PullRequest>(
      'GET',
      `${this.path}/pulls/${positiveInteger(number)}`,
    );
  }
  async ref(branch: string) {
    return (
      await this.api.request<Ref>(
        'GET',
        `${this.path}/git/ref/heads/${encodeURIComponent(branch)}`,
      )
    ).object.sha;
  }
  async file(path: string, ref: string) {
    const file = await this.api.optional<{ content: string }>(
      `${this.path}/contents/${path}?ref=${encodeURIComponent(ref)}`,
    );
    return file ? Buffer.from(file.content, 'base64').toString('utf8') : null;
  }
  async version(ref: string) {
    const file = await this.file('package.json', ref);
    if (!file) return null;
    const data = JSON.parse(file) as { version?: unknown };
    if (typeof data.version !== 'string')
      throw new Error('Missing package version');
    return data.version;
  }
  comments(number: number) {
    return this.api.paginate<Comment>(`${this.path}/issues/${number}/comments`);
  }
  async milestone(version: string) {
    const find = async () =>
      (
        await this.api.paginate<{
          number: number;
          title: string;
          state: string;
        }>(`${this.path}/milestones?state=all`)
      ).find(item => item.title === version);
    const use = async (item: { number: number; state: string }) => {
      if (item.state === 'closed')
        await this.api.request(
          'PATCH',
          `${this.path}/milestones/${item.number}`,
          { state: 'open' },
        );
      return item.number;
    };
    const found = await find();
    if (found) return use(found);
    try {
      return (
        await this.api.request<{ number: number }>(
          'POST',
          `${this.path}/milestones`,
          { title: version },
        )
      ).number;
    } catch (error) {
      if (error instanceof GitHubError && error.status === 422) {
        const raced = await find();
        if (raced) return use(raced);
      }
      throw error;
    }
  }
  async assignMilestone(number: number, branch: string) {
    const milestone = await this.milestone(parseReleaseBranch(branch).version);
    if ((await this.pull(number)).milestone?.number === milestone) return;
    await this.api.request('PATCH', `${this.path}/issues/${number}`, {
      milestone,
    });
  }
  async behind(pull: PullRequest) {
    const base = await this.ref(pull.base.ref);
    return (
      (
        await this.api.request<{ behind_by: number }>(
          'GET',
          `${this.path}/compare/${base}...${pull.head.sha}`,
        )
      ).behind_by > 0
    );
  }
  async synchronize(pull: PullRequest) {
    if (!(await this.behind(pull))) return false;
    try {
      await this.api.request(
        'PUT',
        `${this.path}/pulls/${pull.number}/update-branch`,
        { expected_head_sha: pull.head.sha },
      );
    } catch (error) {
      // A just-pushed head can reach the update endpoint before PR reads.
      // Revalidate the new head on the next pass; never retry a stale write.
      if (
        !(error instanceof GitHubError && error.status === 422) ||
        (await this.pull(pull.number)).head.sha === pull.head.sha
      )
        throw error;
    }
    return true;
  }
  async tagSha(tag: string) {
    const ref = await this.api.optional<Ref>(
      `${this.path}/git/ref/tags/${encodeURIComponent(tag)}`,
    );
    if (!ref) return null;
    let pointer = ref.object;
    for (let i = 0; i < 5 && pointer.type === 'tag'; i++)
      pointer = (
        await this.api.request<Ref>(
          'GET',
          `${this.path}/git/tags/${pointer.sha}`,
        )
      ).object;
    if (pointer.type !== 'commit')
      throw new Error('Release tag does not resolve to a commit');
    return pointer.sha;
  }
  async verifiedDeployment(sha: string, environment: string) {
    const deployments = await this.api.paginate<Deployment>(
      `${this.path}/deployments?sha=${sha}&environment=${environment}`,
    );
    const deployment = deployments
      .filter(item => item.sha === sha && item.environment === environment)
      .sort((a, b) => b.id - a.id)[0];
    if (!deployment || deployment.performed_via_github_app?.id !== 15368)
      return null;
    const statuses = await this.api.request<DeploymentStatus[]>(
      'GET',
      `${this.path}/deployments/${deployment.id}/statuses?per_page=1`,
    );
    const status = statuses[0];
    if (
      status?.state !== 'success' ||
      ![deployment.creator.id, 41898282].includes(status.creator.id)
    )
      return null;
    const prefix = `https://github.com/${this.name}/actions/runs/`;
    if (!status.log_url.startsWith(prefix)) return null;
    const runId = Number(status.log_url.slice(prefix.length).split('/')[0]);
    if (!Number.isSafeInteger(runId) || runId <= 0) return null;
    const run = await this.api.request<Run>(
      'GET',
      `${this.path}/actions/runs/${runId}`,
    );
    if (
      run.head_sha !== sha ||
      run.path.split('@')[0] !== '.github/workflows/deployment.yml' ||
      !['push', 'workflow_dispatch'].includes(run.event)
    )
      return null;
    const jobs = await this.api.paginate<Job>(
      `${this.path}/actions/runs/${runId}/jobs?filter=latest`,
      'jobs',
    );
    if (
      jobs.some(
        job =>
          job.name === 'Deploy Worker' &&
          job.status === 'completed' &&
          job.conclusion === 'success',
      )
    )
      return { deploymentId: deployment.id, runId };
    return null;
  }
  async productionComplete(sha = '') {
    const head = sha || (await this.ref('main'));
    const version = await this.version(head);
    if (!version) return true; // Initial empty main is not an incomplete release.
    const release = await this.api.optional<Release>(
      `${this.path}/releases/tags/v${version}`,
    );
    return Boolean(
      release &&
      !release.draft &&
      !release.prerelease &&
      (await this.tagSha(release.tag_name)) === head &&
      (await this.verifiedDeployment(head, 'production')),
    );
  }
  async frozenReleases() {
    if (await this.productionComplete()) return [];
    const main = await this.ref('main');
    const closed = await this.api.paginate<PullRequest>(
      `${this.path}/pulls?state=closed&base=main&sort=updated&direction=desc`,
    );
    const release = closed.find(
      pull =>
        Boolean(pull.merged_at) &&
        pull.merge_commit_sha === main &&
        pull.head.repo?.full_name === this.name,
    );
    if (!release)
      throw new Error(
        'Production is incomplete; resume delivery before dependency routing',
      );
    parseReleaseBranch(release.head.ref);
    return [release.head.ref];
  }
}

export async function waitForMergeReadiness(
  repo: Repository,
  number: number,
  guard: () => Promise<boolean> = () => Promise.resolve(true),
  deadline = Date.now() + 30 * 60_000,
  afterSync?: (previous: PullRequest) => Promise<void>,
) {
  while (Date.now() < deadline) {
    const pull = await repo.pull(number);
    if (pull.state !== 'open')
      return { state: 'closed', reason: 'PR is no longer open' } as const;
    if (pull.draft || !(await guard()))
      return {
        state: 'blocked',
        reason: 'Draft or original release is no longer eligible',
      } as const;
    if (await repo.synchronize(pull)) {
      await sleep(10_000);
      if (afterSync) await afterSync(pull);
      continue;
    }
    const runs = await repo.api.paginate<Run>(
      `${repo.path}/actions/workflows/ci.yml/runs?event=pull_request&head_sha=${pull.head.sha}`,
      'workflow_runs',
    );
    const run = runs
      .filter(item => item.head_sha === pull.head.sha)
      .sort((a, b) => b.id - a.id)[0];
    if (run?.status === 'completed' && run.conclusion !== 'success')
      return {
        state: 'blocked',
        reason: `CI ${run.conclusion ?? 'unknown'}`,
      } as const;
    const evidence = readReviewEvidence(
      await repo.comments(number),
      pull.head.sha,
    );
    if (evidence?.completed && evidence.hasFindings)
      return {
        state: 'blocked',
        reason: 'Codex findings require owner review',
      } as const;
    if (run && evidence?.completed && !evidence.hasFindings) {
      const jobs = await repo.api.paginate<Job>(
        `${repo.path}/actions/runs/${run.id}/jobs?filter=latest`,
        'jobs',
      );
      const fresh = await repo.pull(number);
      const latestRuns = await repo.api.paginate<Run>(
        `${repo.path}/actions/workflows/ci.yml/runs?event=pull_request&head_sha=${pull.head.sha}`,
        'workflow_runs',
      );
      const latest = latestRuns.sort((a, b) => b.id - a.id)[0];
      if (
        fresh.head.sha === pull.head.sha &&
        fresh.state === 'open' &&
        !fresh.draft &&
        !(await repo.behind(fresh)) &&
        (await guard()) &&
        latest?.id === run.id &&
        latest.run_attempt === run.run_attempt &&
        latest.status === 'completed' &&
        latest.conclusion === 'success' &&
        ciPassed(run, jobs)
      )
        return { state: 'ready', headSha: pull.head.sha } as const;
    }
    await sleep(10_000);
  }
  return {
    state: 'timeout',
    reason:
      'CI or current-head Codex review did not complete within 30 minutes; resume manually',
  } as const;
}

export async function mergeReady(
  repo: Repository,
  number: number,
  guard?: () => Promise<boolean>,
  afterSync?: (previous: PullRequest) => Promise<void>,
) {
  const result = await waitForMergeReadiness(
    repo,
    number,
    guard,
    undefined,
    afterSync,
  );
  if (result.state !== 'ready') {
    summary(result.reason);
    return result;
  }
  const fresh = await repo.pull(number);
  const evidence = readReviewEvidence(
    await repo.comments(number),
    result.headSha,
  );
  if (
    fresh.head.sha !== result.headSha ||
    fresh.state !== 'open' ||
    fresh.draft ||
    (await repo.behind(fresh)) ||
    !evidence?.completed ||
    evidence.hasFindings ||
    (guard && !(await guard()))
  )
    throw new Error('PR changed before merge; resume validation');
  const merged = await repo.api.request<{ merged: boolean }>(
    'PUT',
    `${repo.path}/pulls/${number}/merge`,
    { sha: result.headSha, merge_method: 'squash' },
  );
  if (!merged.merged) throw new Error('GitHub refused the exact-head merge');
  summary(`Merged PR #${number} at verified head ${result.headSha}`);
  return { state: 'merged' } as const;
}

export function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
export function positiveInteger(value: unknown) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0)
    throw new Error('Expected positive integer');
  return number;
}
export function prNumber() {
  return positiveInteger(env('PR_NUMBER'));
}
export function output(name: string, value: string | number | boolean) {
  const text = String(value);
  if (!/^[\w-]+$/.test(name) || /[\r\n]/.test(text))
    throw new Error('Invalid workflow output');
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${text}\n`);
}
export function summary(message: string) {
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
  else console.log(message);
}
export function event() {
  return JSON.parse(readFileSync(env('GITHUB_EVENT_PATH'), 'utf8')) as Record<
    string,
    unknown
  >;
}
export async function main(run: () => Promise<void>) {
  try {
    await run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Automation failed');
    process.exitCode = 1;
  }
}
