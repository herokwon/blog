import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function versionFromReleaseRef(ref: string): string | null {
  return /^release\/v(\d+\.\d+\.\d+)$/.exec(ref)?.[1] ?? null;
}

export function syncPackageVersion(
  jsonText: string,
  version: string,
): { text: string; changed: boolean } {
  const packageJson: unknown = JSON.parse(jsonText);
  if (
    !packageJson ||
    typeof packageJson !== 'object' ||
    !('version' in packageJson) ||
    typeof packageJson.version !== 'string'
  ) {
    throw new Error('package.json must contain a string version');
  }

  if (packageJson.version === version) {
    return { text: jsonText, changed: false };
  }

  packageJson.version = version;
  return {
    text: `${JSON.stringify(packageJson, null, 2)}\n`,
    changed: true,
  };
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const [, , command, releaseRef, packagePath] = process.argv;
  if (!['check', 'sync'].includes(command) || !releaseRef || !packagePath) {
    throw new Error(
      'Usage: release-version.ts <check|sync> <release-ref> <package.json>',
    );
  }

  const version = versionFromReleaseRef(releaseRef);
  if (!version) {
    throw new Error(`Invalid release branch: ${releaseRef}`);
  }

  const { text, changed } = syncPackageVersion(
    readFileSync(packagePath, 'utf8'),
    version,
  );
  if (command === 'check' && changed) {
    throw new Error(
      `package.json version must be ${version} for ${releaseRef}`,
    );
  }

  if (command === 'sync') {
    if (changed) writeFileSync(packagePath, text);
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        `version=${version}\nbranch=automation/release/v${version}\nchanged=${changed}\n`,
      );
    }
  }
}
