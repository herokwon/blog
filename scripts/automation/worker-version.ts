import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function workerVersionId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
  )
    throw new Error('Invalid Worker version ID');
  return value;
}

export function publishedVersion(output: string, environment: string) {
  const entries = output
    .trim()
    .split('\n')
    .map(
      line =>
        JSON.parse(line) as {
          type: string;
          version: number;
          wrangler_environment?: string;
          version_id?: unknown;
        },
    );
  const deployments = entries.filter(
    entry =>
      entry.type === 'deploy' &&
      entry.version === 1 &&
      entry.wrangler_environment === environment,
  );
  if (deployments.length !== 1)
    throw new Error('Unexpected Wrangler publication output');
  return workerVersionId(deployments[0].version_id);
}

export function verifyActiveVersion(
  deployment: unknown,
  version: unknown,
  expectedId: string,
  sha: string,
) {
  const id = workerVersionId(expectedId);
  const shares = (
    deployment as {
      versions?: { version_id?: string; percentage?: number }[];
    } | null
  )?.versions;
  if (
    !Array.isArray(shares) ||
    shares.length !== 1 ||
    shares[0]?.version_id !== id ||
    shares[0].percentage !== 100
  )
    throw new Error('Expected Worker version is not active at 100%');
  const details = version as {
    id?: string;
    annotations?: Record<string, string>;
  } | null;
  if (
    !/^[a-f0-9]{40}$/.test(sha) ||
    details?.id !== id ||
    details.annotations?.['workers/tag'] !== sha
  )
    throw new Error('Worker version metadata does not match the merge SHA');
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [command, first, second] = process.argv.slice(2);
  if (command === 'published' && first && second) {
    console.log(publishedVersion(readFileSync(first, 'utf8'), second));
  } else if (command === 'verify' && first && second) {
    const id = workerVersionId(process.env.WORKER_VERSION_ID);
    const sha = process.env.DEPLOY_SHA ?? '';
    verifyActiveVersion(
      JSON.parse(readFileSync(first, 'utf8')),
      JSON.parse(readFileSync(second, 'utf8')),
      id,
      sha,
    );
    console.log(`Verified active Worker version ${id} for ${sha}`);
  } else {
    throw new Error('Invalid Worker verification command');
  }
}
