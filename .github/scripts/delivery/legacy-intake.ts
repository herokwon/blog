import { readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { migrateIntake, readCheckIntake, readIntake } from './dependabot.ts';
import { env, main, Repository, summary, type Comment } from './github.ts';
import { object } from './policy.ts';

const targets = [
  {
    pr: 15,
    comment: 6685921679,
    sha: '2ef712e17d8dcd4faa8044223b49f7b873dfd4bc',
    original: '2ef712e17d8dcd4faa8044223b49f7b873dfd4bc',
  },
  {
    pr: 16,
    comment: 6685936862,
    sha: '9a58bc5ba256f6808f3f65f8765dc50f2e792212',
    original: '93e5602690b1d8ef1f5ffcdf182e32901ae08660',
  },
];
const appId = 5622834,
  botId = 352761549,
  slug = 'herokwon-blog-bot';

function assertScope(repo: Repository) {
  if (
    repo.name !== 'herokwon/blog' ||
    env('APP_ID') !== String(appId) ||
    env('APP_BOT_ID') !== String(botId) ||
    env('APP_SLUG') !== slug
  )
    throw new Error(
      'Legacy migration repository or App identity does not match the fixed scope',
    );
}

export async function snapshotLegacyIntake(repo: Repository) {
  assertScope(repo);
  const records = [];
  for (const target of targets) {
    const pull = await repo.pull(target.pr);
    if (
      pull.state !== 'closed' ||
      pull.user.login !== 'dependabot[bot]' ||
      pull.head.repo?.full_name !== repo.name ||
      pull.base.repo.full_name !== repo.name
    )
      throw new Error(
        `PR #${target.pr} is not the expected closed same-repository Dependabot PR`,
      );
    const comments = await repo.comments(target.pr);
    const source =
      comments.find(comment => comment.id === target.comment) ?? null;
    const checks = (
      await repo.api.paginate<unknown>(
        `${repo.path}/commits/${target.sha}/check-runs?filter=all`,
        'check_runs',
      )
    )
      .filter(check =>
        readCheckIntake([check], target.pr, target.sha, appId, slug),
      )
      .sort((a, b) => Number(object(a)?.id) - Number(object(b)?.id));
    const receipt = source
      ? readIntake([source], target.pr, target.sha, botId, slug)
      : readCheckIntake(checks, target.pr, target.sha, appId, slug);
    if (
      !receipt ||
      receipt.originalSha !== target.original ||
      checks.length > 1
    )
      throw new Error(
        `PR #${target.pr} has missing, conflicting or unauthenticated legacy evidence`,
      );
    records.push({ pr: target.pr, sha: target.sha, source, comments, checks });
  }
  return { repository: repo.name, records };
}

export async function migrateLegacyIntake(repo: Repository, backup: unknown) {
  const before = await snapshotLegacyIntake(repo);
  if (!isDeepStrictEqual(before, backup))
    throw new Error(
      'Legacy evidence changed after backup; refusing all mutations',
    );
  const scoped = new Repository(repo.name, 'unused', repo.api);
  scoped.comments = async (pr: number): Promise<Comment[]> => {
    const target = targets.find(item => item.pr === pr);
    const saved = before.records.find(item => item.pr === pr);
    if (!target || !saved) throw new Error('PR outside legacy migration scope');
    const source =
      (await repo.comments(pr)).find(
        comment => comment.id === target.comment,
      ) ?? null;
    if (source && !isDeepStrictEqual(source, saved.source))
      throw new Error('Legacy comment changed after backup');
    return source ? [source] : [];
  };
  for (const target of targets) await migrateIntake(scoped, target.pr);
  const first = await snapshotLegacyIntake(repo);
  for (const record of first.records) {
    const previous = before.records.find(item => item.pr === record.pr);
    if (
      record.source ||
      record.checks.length !== 1 ||
      !isDeepStrictEqual(
        record.comments,
        previous?.comments.filter(
          comment => comment.id !== previous.source?.id,
        ),
      )
    )
      throw new Error(
        'Legacy migration did not preserve unrelated comments or produce one matching Check',
      );
  }
  // Repeat the real migration function against closed PRs, then compare persisted state.
  for (const target of targets) await migrateIntake(scoped, target.pr);
  const second = await snapshotLegacyIntake(repo);
  if (!isDeepStrictEqual(first, second))
    throw new Error('Legacy migration rerun was not idempotent');
  return second.records.map(record => ({
    pr: record.pr,
    sha: record.sha,
    appId,
    slug,
    checkId: object(record.checks[0])?.id,
    sourceCommentId: targets.find(target => target.pr === record.pr)?.comment,
    idempotent: true,
  }));
}

if (import.meta.main)
  await main(async () => {
    if (
      process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
      process.env.GITHUB_REF !== 'refs/heads/main'
    )
      throw new Error('Legacy migration requires a manual run on main');
    const repo = new Repository();
    const file = env('LEGACY_EVIDENCE');
    if (process.argv[2] === 'snapshot') {
      writeFileSync(
        file,
        JSON.stringify(await snapshotLegacyIntake(repo), null, 2),
      );
      summary(
        'Authenticated legacy intake snapshot prepared for PRs #15 and #16; no mutations performed',
      );
    } else if (process.argv[2] === 'migrate') {
      const report = await migrateLegacyIntake(
        repo,
        JSON.parse(readFileSync(file, 'utf8')) as unknown,
      );
      writeFileSync(`${file}.result.json`, JSON.stringify(report, null, 2));
      for (const item of report)
        summary(`Legacy intake verified: ${JSON.stringify(item)}`);
    } else throw new Error('Expected snapshot or migrate');
  });
