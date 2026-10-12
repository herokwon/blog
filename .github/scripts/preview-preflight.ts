import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid Preview API object');
  return value as Record<string, unknown>;
}

export function assertPreviewReleaseAllowed(
  requested: string,
  deployedMessage: unknown,
) {
  const requestedVersion = /^release\/v(\d+)\.(\d+)\.(\d+)$/.exec(requested);
  if (!requestedVersion) throw new Error('Invalid release branch');
  if (deployedMessage == null) return; // Secret-only initial Worker has no release annotation.
  if (typeof deployedMessage !== 'string')
    throw new Error('Invalid deployed annotation');
  const deployed = /^release\/v(\d+)\.(\d+)\.(\d+) @ [0-9a-f]{40}$/.exec(
    deployedMessage,
  );
  if (!deployed) throw new Error('Preview release identity is unconfirmed');
  for (let index = 1; index <= 3; index++) {
    const requestedPart = BigInt(requestedVersion[index]);
    const deployedPart = BigInt(deployed[index]);
    if (requestedPart < deployedPart)
      throw new Error('Superseded release cannot replace Preview');
    if (requestedPart > deployedPart) return;
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const {
    CLOUDFLARE_API_TOKEN: token,
    CLOUDFLARE_ACCOUNT_ID: account,
    RELEASE_REF: release,
  } = process.env;
  if (!token || !account || !release)
    throw new Error('Missing Preview preflight context');
  assertPreviewReleaseAllowed(release, undefined);
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/workers/scripts/blog-preview`;
  async function result(path: string) {
    const response = await fetch(endpoint + path, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    });
    const body = record(await response.json());
    if (!response.ok || body.success !== true || !body.result)
      throw new Error('Unable to confirm live Preview identity');
    return record(body.result);
  }
  const deployments = (await result('/deployments')).deployments;
  if (!Array.isArray(deployments))
    throw new Error('Invalid Preview deployments response');
  if (deployments.length) {
    const versions = record(deployments[0]).versions;
    if (!Array.isArray(versions)) throw new Error('Invalid Preview deployment');
    for (const value of versions) {
      const deployed = record(value);
      if (
        typeof deployed.percentage !== 'number' ||
        typeof deployed.version_id !== 'string'
      )
        throw new Error('Invalid Preview traffic assignment');
      if (deployed.percentage <= 0) continue;
      const version = await result(
        `/versions/${encodeURIComponent(deployed.version_id)}`,
      );
      assertPreviewReleaseAllowed(
        release,
        version.annotations == null
          ? undefined
          : record(version.annotations)['workers/message'],
      );
    }
  }
}
