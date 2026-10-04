import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type ReleaseOptions = {
  repository: string;
  version: string;
  mergeSha: string;
  token: string;
  apiUrl: string;
};

export async function runGithubRelease(
  command: 'check' | 'create',
  options: ReleaseOptions,
) {
  const { repository, version, mergeSha, token, apiUrl } = options;
  if (
    !/^[\w.-]+\/[\w.-]+$/.test(repository) ||
    !/^\d+\.\d+\.\d+$/.test(version) ||
    !/^[0-9a-f]{40}$/.test(mergeSha) ||
    !token
  )
    throw new Error(
      'Expected repository, package version, full merge SHA, and GitHub token',
    );

  const tag = `v${version}`;
  const base = `${apiUrl.replace(/\/$/, '')}/repos/${repository}`;
  async function request(path: string, body?: unknown) {
    return fetch(`${base}/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30_000),
    });
  }
  async function json(response: Response) {
    if (!response.ok)
      throw new Error(
        `GitHub lookup or publication failed (HTTP ${response.status})`,
      );
    return response.json();
  }
  async function checkTag(): Promise<'missing' | 'matching'> {
    // Unlike GET git/ref, this endpoint returns 200 with [] for an absent tag.
    // Authentication/permission failures (including 404) must fail closed.
    const refs: unknown = await json(
      await request(`git/matching-refs/tags/${tag}`),
    );
    if (
      !Array.isArray(refs) ||
      refs.some(
        ref =>
          !ref ||
          typeof ref.ref !== 'string' ||
          !ref.ref.startsWith(`refs/tags/${tag}`) ||
          !ref.object ||
          !['commit', 'tag', 'tree', 'blob'].includes(ref.object.type) ||
          !/^[0-9a-f]{40}$/.test(ref.object.sha),
      )
    )
      throw new Error('Invalid GitHub references response');
    const reference = refs.find(ref => ref?.ref === `refs/tags/${tag}`);
    if (!reference) return 'missing';
    let object = reference.object;
    const visited = new Set<string>();
    while (object?.type === 'tag') {
      if (!/^[0-9a-f]{40}$/.test(object.sha) || visited.has(object.sha)) {
        throw new Error('Invalid annotated tag chain');
      }
      visited.add(object.sha);
      const annotated = await json(await request(`git/tags/${object.sha}`));
      if (
        !annotated ||
        typeof annotated !== 'object' ||
        !('object' in annotated)
      ) {
        throw new Error('Invalid annotated tag response');
      }
      object = annotated.object;
    }
    if (object?.type !== 'commit' || !/^[0-9a-f]{40}$/.test(object.sha)) {
      throw new Error('Release tag must resolve to a full commit SHA');
    }
    if (object.sha !== mergeSha) {
      throw new Error(
        `Release tag ${tag} mismatch. Expected ${mergeSha}; actual ${object.sha}`,
      );
    }
    return 'matching';
  }

  const state = await checkTag();
  if (command === 'check') return state;
  // Recheck after deployment: a preflight result is not a permanent guarantee.
  const existing = await request(`releases/tags/${tag}`);
  if (existing.ok) {
    const release = await json(existing);
    if (
      state !== 'matching' ||
      !release ||
      typeof release !== 'object' ||
      !('tag_name' in release) ||
      release.tag_name !== tag
    ) {
      throw new Error('Existing Release has no matching release tag');
    }
    return 'existing';
  }
  if (existing.status !== 404) await json(existing);

  if (state === 'missing') {
    // Create the exact ref before publishing, so a competing tag is never moved.
    const created = await request('git/refs', {
      ref: `refs/tags/${tag}`,
      sha: mergeSha,
    });
    if ([409, 422].includes(created.status)) {
      if ((await checkTag()) !== 'matching') await json(created);
    } else {
      await json(created);
    }
  }
  await json(
    await request('releases', {
      tag_name: tag,
      target_commitish: mergeSha,
      name: tag,
      generate_release_notes: true,
    }),
  );
  return 'created';
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const command = process.argv[2];
  if (command !== 'check' && command !== 'create') {
    throw new Error('Usage: github-release.ts <check|create>');
  }
  const result = await runGithubRelease(command, {
    repository: process.env.GH_REPO ?? '',
    version: process.env.PACKAGE_VERSION ?? '',
    mergeSha: process.env.MERGE_SHA ?? '',
    token: process.env.GH_TOKEN ?? '',
    apiUrl: process.env.GH_API_URL ?? 'https://api.github.com',
  });
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `Release v${process.env.PACKAGE_VERSION}: ${result} at ${process.env.MERGE_SHA}.\n`,
    );
  }
}
