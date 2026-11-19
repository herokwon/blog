import assert from 'node:assert/strict';
import { test } from 'node:test';

import { publishedVersion, verifyActiveVersion } from './worker-version.ts';

const id = '5c34bb02-3817-4ac7-8f56-f8d0a62968c0';
const other = '0f9c2b1b-1097-4e2a-8c45-97aa1b08b5c7';
const sha = 'a'.repeat(40);
const version = { id, annotations: { 'workers/tag': sha } };
const deployment = (version_id: string, percentage = 100) => ({
  versions: [{ version_id, percentage }],
});

test('captures the version ID of the published environment from Wrangler output', () => {
  const output = [
    { type: 'wrangler-session' },
    {
      type: 'deploy',
      version: 1,
      wrangler_environment: 'preview',
      version_id: id,
    },
  ]
    .map(entry => JSON.stringify(entry))
    .join('\n');
  assert.equal(publishedVersion(output, 'preview'), id);
  assert.throws(
    () => publishedVersion(output, 'production'),
    /publication output/,
  );
  assert.throws(
    () => publishedVersion(output.replace(id, 'bad-id'), 'preview'),
    /version ID/,
  );
});

test('requires the published version to be the sole active version and tagged with the merge SHA', () => {
  verifyActiveVersion(deployment(id), version, id, sha);
  assert.throws(
    () => verifyActiveVersion(deployment(other), version, id, sha),
    /active/,
  );
  assert.throws(
    () => verifyActiveVersion(deployment(id, 99), version, id, sha),
    /active/,
  );
  assert.throws(
    () =>
      verifyActiveVersion(deployment(id), { ...version, id: other }, id, sha),
    /version metadata/,
  );
  assert.throws(
    () => verifyActiveVersion(deployment(id), version, id, 'b'.repeat(40)),
    /version metadata/,
  );
});
