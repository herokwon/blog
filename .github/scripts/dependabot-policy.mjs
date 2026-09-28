import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const activeReleaseBranch = 'release/v0.1.0';
const autoMergeTypes = new Set([
  'version-update:semver-patch',
  'version-update:semver-minor',
]);
const ecosystems = new Set(['npm', 'github-actions']);

export function shouldAutoMerge({
  author,
  baseRef,
  ecosystem,
  updateType,
  securityUpdate,
}) {
  return (
    author === 'dependabot[bot]' &&
    baseRef === activeReleaseBranch &&
    ecosystems.has(ecosystem) &&
    autoMergeTypes.has(updateType) &&
    securityUpdate === false
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const eligible = shouldAutoMerge({
    author: process.env.PR_AUTHOR,
    baseRef: process.env.PR_BASE,
    ecosystem: process.env.DEPENDABOT_ECOSYSTEM,
    updateType: process.env.DEPENDABOT_UPDATE_TYPE,
    securityUpdate:
      process.env.DEPENDABOT_TARGET_BRANCH !== activeReleaseBranch,
  });
  appendFileSync(process.env.GITHUB_OUTPUT, `eligible=${eligible}\n`);
}
