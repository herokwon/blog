import { appendFileSync, readFileSync } from 'node:fs';

const [, , releaseRef, headSha] = process.argv;
if (
  !/^release\/v\d+\.\d+\.\d+$/.test(releaseRef ?? '') ||
  !/^[0-9a-f]{40}$/.test(headSha ?? '')
) {
  throw new Error(
    'Invalid release target: expected a versioned release branch and full head SHA',
  );
}

type Version = {
  annotations?: { 'workers/tag'?: string; 'workers/message'?: string };
};

const response = JSON.parse(readFileSync(0, 'utf8'));
if (response?.success !== true || !Array.isArray(response?.result?.items)) {
  throw new Error('Invalid Worker versions response');
}
const versions: Version[] = response.result.items;
const candidate = versions.find(
  version =>
    version.annotations?.['workers/tag'] === headSha &&
    version.annotations?.['workers/message'] === `${releaseRef} @ ${headSha}`,
);
if (!candidate) {
  throw new Error(`No deployable candidate matches ${releaseRef} @ ${headSha}`);
}
const tag = headSha;
if (process.env.GITHUB_OUTPUT)
  appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\n`);
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `Promoting release candidate ${tag}.\n`,
  );
