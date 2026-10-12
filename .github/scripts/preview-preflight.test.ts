import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
test('allows the same release or a later release with confirmed identity', () => {
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
});

test('rejects missing identity for bootstrap and secret-triggered deployments', () => {
  for (const message of [undefined, null, '', 'unconfirmed', 42]) {
    assert.throws(() => assertPreviewReleaseAllowed('release/v0.2.1', message));
    assert.throws(() => assertPreviewReleaseAllowed('release/v0.2.3', message));
  }
});

test('CLI checks live identity and fails closed on unavailable or incomplete traffic', () => {
  for (const scenario of [
    'valid',
    'missing',
    'empty',
    'no-traffic',
    'api-failure',
  ]) {
    const setup = `globalThis.fetch = async (url) => {
      const scenario = ${JSON.stringify(scenario)};
      if (scenario === 'api-failure') return new Response('{}', {status: 503});
      const result = String(url).endsWith('/deployments')
        ? {deployments: scenario === 'empty' ? [] : [{versions: [{version_id: 'test-version', percentage: scenario === 'no-traffic' ? 0 : 100}]}]}
        : {annotations: scenario === 'missing' ? {} : {'workers/message': 'release/v0.2.2 @ ' + 'b'.repeat(40)}};
      return Response.json({success: true, result});
    };`;
    const child = spawnSync(
      process.execPath,
      [
        '--import',
        'data:text/javascript,' + encodeURIComponent(setup),
        '.github/scripts/preview-preflight.ts',
      ],
      {
        env: {
          ...process.env,
          CLOUDFLARE_API_TOKEN: 'test',
          CLOUDFLARE_ACCOUNT_ID: 'test',
          RELEASE_REF: 'release/v0.2.2',
        },
        encoding: 'utf8',
      },
    );
    assert.equal(
      child.status === 0,
      scenario === 'valid',
      scenario + ': ' + child.stderr,
    );
  }
});
