const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export type DeploymentPR = {
  merged?: boolean;
  merge_commit_sha?: string | null;
  base: { ref: string; repo: { full_name: string } };
  head: { ref: string; repo: { full_name: string } | null };
};

export type AuditReport = {
  error?: unknown;
  advisories?: Record<
    string,
    {
      severity: string;
      url?: string;
      module_name?: string;
      github_advisory_id?: string;
      id?: number;
    }
  >;
};

export type AuditException = { ghsa: string; reason: string; reviewBy: string };

export function releaseVersion(branch: string) {
  const target = branch.startsWith('release/') ? branch.slice(8) : '';
  if (!versionPattern.test(target))
    throw new Error('Invalid release branch version');
  return target;
}

export function versionDecision(branch: string, current: string) {
  const target = releaseVersion(branch);
  if (!versionPattern.test(current)) throw new Error('Invalid package version');
  const a = current.split('.').map(BigInt);
  const b = target.split('.').map(BigInt);
  let comparison = 0;
  for (let i = 0; i < 3; i++)
    if (a[i] !== b[i]) {
      comparison = a[i] > b[i] ? 1 : -1;
      break;
    }
  if (comparison > 0)
    throw new Error('Package version is higher than release target');
  return { target, bump: comparison < 0 };
}

export function deploymentTarget(
  pr: DeploymentPR | undefined,
  repository: string,
) {
  if (!pr?.merged) return null;
  if (
    pr.base.repo.full_name !== repository ||
    pr.head.repo?.full_name !== repository
  )
    throw new Error('Unexpected repository');
  if (!pr.merge_commit_sha || !/^[a-f0-9]{40}$/.test(pr.merge_commit_sha))
    throw new Error('Invalid merge SHA');
  const production = pr.base.ref === 'main';
  if (production) releaseVersion(pr.head.ref);
  else releaseVersion(pr.base.ref);
  return {
    environment: production ? 'production' : 'preview',
    url: production
      ? 'https://blog.herokwon.dev'
      : 'https://blog-preview.herokwon.dev',
    sha: pr.merge_commit_sha,
    branch: pr.base.ref,
    version: releaseVersion(production ? pr.head.ref : pr.base.ref),
  };
}

export function releaseBranches(branches: string[]) {
  const releases = branches.filter(branch => branch.startsWith('release/'));
  if (releases.length > 1) throw new Error('Found multiple release branches');
  releases.forEach(releaseVersion);
  return ['main', ...releases];
}

export function auditDecision(
  report: AuditReport,
  exceptions: AuditException[],
  now = new Date(),
) {
  if (
    !report ||
    report.error ||
    !report.advisories ||
    typeof report.advisories !== 'object' ||
    Array.isArray(report.advisories)
  )
    throw new Error('Invalid audit report');
  const allowed = new Set<string>();
  for (const item of exceptions) {
    if (
      !/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(item.ghsa) ||
      !item.reason?.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(item.reviewBy) ||
      !Number.isFinite(Date.parse(item.reviewBy))
    )
      throw new Error('Invalid audit exception');
    if (Date.parse(`${item.reviewBy}T23:59:59Z`) < now.getTime())
      throw new Error(`Audit exception expired: ${item.ghsa}`);
    allowed.add(item.ghsa);
  }
  return Object.values(report.advisories).filter(item => {
    if (
      !['info', 'low', 'moderate', 'high', 'critical'].includes(item.severity)
    )
      throw new Error('Invalid audit severity');
    const ghsa = item.url?.match(
      /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/,
    )?.[0];
    return (
      ['high', 'critical'].includes(item.severity) &&
      (!ghsa || !allowed.has(ghsa))
    );
  });
}
