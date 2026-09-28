import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const autoMergeTypes = new Set([
  'version-update:semver-patch',
  'version-update:semver-minor',
]);
const ecosystems = new Set(['npm_and_yarn', 'github_actions']);

export function shouldAutoMerge({
  author,
  baseRef,
  targetBranch,
  ecosystem,
  updateType,
}) {
  return (
    author === 'dependabot[bot]' &&
    baseRef.startsWith('release/') &&
    baseRef.length > 'release/'.length &&
    targetBranch === baseRef &&
    ecosystems.has(ecosystem) &&
    autoMergeTypes.has(updateType)
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const eligible = shouldAutoMerge({
    author: process.env.PR_AUTHOR,
    baseRef: process.env.PR_BASE,
    targetBranch: process.env.DEPENDABOT_TARGET_BRANCH,
    ecosystem: process.env.DEPENDABOT_ECOSYSTEM,
    updateType: process.env.DEPENDABOT_UPDATE_TYPE,
  });
  appendFileSync(process.env.GITHUB_OUTPUT, `eligible=${eligible}\n`);
}
