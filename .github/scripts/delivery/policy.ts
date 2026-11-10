export type PullRequest = {
  number: number;
  state: string;
  draft: boolean;
  merged: boolean;
  merge_commit_sha: string | null;
  head: { ref: string; sha: string; repo: { full_name: string } | null };
  base: { ref: string; sha: string; repo: { full_name: string } };
  user: { login: string; id?: number };
  title?: string;
  html_url?: string;
  mergeable_state?: string;
  merged_at?: string | null;
  milestone?: { number: number } | null;
};

export type DependencyUpdate = {
  dependencyName: string;
  dependencyType: string;
  updateType: string | null;
  packageEcosystem: string;
  prevVersion: string;
  newVersion: string;
};

export function versionParts(version: string): number[] {
  if (
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) ||
    version.includes('\n')
  )
    throw new Error('Expected stable X.Y.Z version');
  const parts = version.split('.').map(Number);
  if (parts.some(part => !Number.isSafeInteger(part)))
    throw new Error('Version component exceeds safe integer range');
  return parts;
}

export function compareVersions(a: string, b: string): number {
  const left = versionParts(a),
    right = versionParts(b);
  for (let i = 0; i < 3; i++)
    if (left[i] !== right[i]) return left[i] - right[i];
  return 0;
}

export function parseReleaseBranch(ref: string) {
  if (!ref.startsWith('release/')) throw new Error('Expected release/X.Y.Z');
  const version = ref.slice(8);
  versionParts(version);
  return { version, branch: ref, tag: `v${version}` };
}

export function classifyUpdates(updates: DependencyUpdate[]) {
  if (!Array.isArray(updates) || updates.length === 0)
    return { eligible: false, reason: 'missing-metadata' };
  for (const item of updates) {
    const actions = item.packageEcosystem === 'github_actions';
    if (!actions && item.packageEcosystem !== 'npm_and_yarn')
      return { eligible: false, reason: 'unknown-ecosystem' };
    let kind = item.updateType?.replace('version-update:semver-', '') ?? '';
    let previous: number[] | undefined;
    try {
      previous = versionParts(
        actions ? item.prevVersion.replace(/^v/, '') : item.prevVersion,
      );
      const next = versionParts(
        actions ? item.newVersion.replace(/^v/, '') : item.newVersion,
      );
      const inferred =
        next[0] !== previous[0]
          ? 'major'
          : next[1] !== previous[1]
            ? 'minor'
            : 'patch';
      if (
        compareVersions(next.join('.'), previous.join('.')) <= 0 ||
        (kind && kind !== inferred)
      )
        return { eligible: false, reason: 'inconsistent-version' };
      kind ||= inferred;
    } catch {
      // Only verified Actions metadata can classify non-X.Y.Z tags/SHA updates.
      if (!actions || !kind || /^v?0(?:\.|$)/.test(item.prevVersion))
        return { eligible: false, reason: 'invalid-version' };
    }
    if (kind !== 'patch' && kind !== 'minor')
      return { eligible: false, reason: 'major-or-unknown' };
    if (previous?.[0] === 0 && kind === 'minor')
      return { eligible: false, reason: 'zero-major-minor' };
    if (
      !actions &&
      item.dependencyType !== 'direct:development' &&
      !(item.dependencyType === 'direct:production' && kind === 'patch')
    )
      return { eligible: false, reason: 'dependency-policy' };
  }
  return { eligible: true, reason: 'all-dependencies-eligible' };
}

export function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function readReviewEvidence(comments: unknown[], headSha: string) {
  for (const raw of [...comments].reverse()) {
    const comment = object(raw),
      user = object(comment?.user);
    if (
      user?.id !== 199175422 ||
      user.login !== 'chatgpt-codex-connector[bot]' ||
      user.type !== 'Bot' ||
      typeof comment?.body !== 'string'
    )
      continue;
    const match = /<!-- codex-review-state:v1 (\{[^\r\n]*\}) -->/.exec(
      comment.body,
    );
    if (!match) continue;
    try {
      const review = object(object(JSON.parse(match[1]))?.code_review);
      if (review?.commit_sha !== headSha) continue;
      return {
        headSha,
        status: review.status,
        completed:
          review.status === 'completed' &&
          typeof review.has_any_findings === 'boolean' &&
          typeof review.has_unresolved_findings === 'boolean',
        hasFindings:
          review.has_any_findings !== false ||
          review.has_unresolved_findings !== false,
        url: typeof comment.html_url === 'string' ? comment.html_url : '',
      };
    } catch {
      return null;
    }
  }
  return null;
}

export function selectRelease(
  branches: string[],
  frozen: string[],
  productionVersion?: string | null,
) {
  if (frozen.length) return { state: 'deferred' as const };
  const eligible = branches.filter(branch => {
    try {
      const release = parseReleaseBranch(branch);
      return (
        !productionVersion ||
        compareVersions(release.version, productionVersion) > 0
      );
    } catch {
      return false;
    }
  });
  if (eligible.length > 1)
    throw new Error('Multiple active release branches require owner selection');
  return eligible.length
    ? { state: 'active' as const, branch: eligible[0] }
    : { state: 'create' as const };
}

export type DeploymentTarget = {
  prNumber: number;
  environment: 'preview' | 'production';
  branch: string;
  sha: string;
  workerName: string;
  url: string;
  version: string | null;
};

export function resolveTarget(
  pull: PullRequest,
  repo: string,
  latest: string,
): DeploymentTarget | null {
  if (
    !pull.merged ||
    pull.state !== 'closed' ||
    pull.head.repo?.full_name !== repo ||
    pull.base.repo.full_name !== repo
  )
    return null;
  const sha = pull.merge_commit_sha;
  if (!sha || !/^[a-f0-9]{40}$/.test(sha) || sha !== latest) return null;
  const production = pull.base.ref === 'main';
  const release = parseReleaseBranch(
    production ? pull.head.ref : pull.base.ref,
  );
  return {
    prNumber: pull.number,
    environment: production ? 'production' : 'preview',
    branch: pull.base.ref,
    sha,
    workerName: production ? 'blog' : 'blog-preview',
    url: production
      ? 'https://blog.herokwon.dev'
      : 'https://blog-preview.herokwon.dev',
    version: production ? release.version : null,
  };
}

export function ciPassed(
  run: { status: string; conclusion: string | null },
  jobs: { name: string; status: string; conclusion: string | null }[],
): boolean {
  return (
    run.status === 'completed' &&
    run.conclusion === 'success' &&
    ['Lint', 'Type Check', 'Build', 'Test'].every(name =>
      jobs.some(
        job =>
          job.name === name &&
          job.status === 'completed' &&
          job.conclusion === 'success',
      ),
    )
  );
}
