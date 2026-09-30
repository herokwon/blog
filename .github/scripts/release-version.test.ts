import assert from 'node:assert/strict';
import test from 'node:test';
import {
  syncPackageVersion,
  versionFromReleaseRef,
} from './release-version.ts';

test('extracts the version only from a release branch', () => {
  assert.equal(versionFromReleaseRef('release/v0.1.0'), '0.1.0');
  assert.equal(versionFromReleaseRef('release/v12.34.56'), '12.34.56');
  for (const ref of [
    'release/0.1.0',
    'release/v0.1',
    'release/v0.1.0/extra',
    'release/v0.1.0-beta',
    'feature/v0.1.0',
  ]) {
    assert.equal(versionFromReleaseRef(ref), null);
  }
});

test('keeps a matching package unchanged', () => {
  const original = '{\n  "name": "blog",\n  "version": "0.1.0"\n}\n';
  assert.deepEqual(syncPackageVersion(original, '0.1.0'), {
    text: original,
    changed: false,
  });
});

test('changes only the package version when it differs', () => {
  const original = '{\n  "name": "blog",\n  "version": "0.0.1"\n}\n';
  assert.deepEqual(syncPackageVersion(original, '0.1.0'), {
    text: '{\n  "name": "blog",\n  "version": "0.1.0"\n}\n',
    changed: true,
  });
});

test('rejects a package without a string version', () => {
  assert.throws(() => syncPackageVersion('{"name":"blog"}', '0.1.0'));
  assert.throws(() => syncPackageVersion('{"version":42}', '0.1.0'));
});
