import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyPreviewUrls } from './preview-urls.ts';

test('resolves and verifies exact Version URL after triggers even without upload URL', async () => {
  const requested: string[] = [];
  const result = await verifyPreviewUrls(
    '18f97339-c287-4872-9bdd-e2135c07ec12',
    'https://blog-preview.example.workers.dev',
    async url => {
      requested.push(String(url));
      return new Response('ok');
    },
  );
  assert.equal(
    result.versionUrl,
    'https://18f97339-blog-preview.example.workers.dev',
  );
  assert.deepEqual(requested, [
    'https://blog-preview.example.workers.dev/',
    'https://18f97339-blog-preview.example.workers.dev/',
  ]);
});
test('rejects invalid identity or unavailable entry points', async () => {
  await assert.rejects(
    verifyPreviewUrls('bad-id', 'https://blog-preview.example.workers.dev'),
  );
  await assert.rejects(
    verifyPreviewUrls(
      '18f97339-c287-4872-9bdd-e2135c07ec12',
      'https://blog-preview.example.workers.dev',
      async () => new Response('', { status: 503 }),
    ),
  );
});
