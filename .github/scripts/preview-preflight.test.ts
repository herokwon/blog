import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPreviewReleaseAllowed } from './preview-preflight.ts';

test('rejects a superseded release even when its own branch head is unchanged', () => {
  assert.throws(() =>
    assertPreviewReleaseAllowed(
      'release/v0.2.1',
      'release/v0.2.2 @ ' + 'b'.repeat(40),
    ),
  );
  assert.throws(() =>
    assertPreviewReleaseAllowed(
      'release/v0.9.0',
      'release/v0.10.0 @ ' + 'b'.repeat(40),
    ),
  );
});
test('allows the same release or a later release and initial bootstrap', () => {
  assert.doesNotThrow(() =>
    assertPreviewReleaseAllowed(
      'release/v0.2.2',
      'release/v0.2.2 @ ' + 'b'.repeat(40),
    ),
  );
  assert.doesNotThrow(() =>
    assertPreviewReleaseAllowed(
      'release/v0.2.3',
      'release/v0.2.2 @ ' + 'b'.repeat(40),
    ),
  );
  assert.doesNotThrow(() =>
    assertPreviewReleaseAllowed('release/v0.2.1', undefined),
  );
});
