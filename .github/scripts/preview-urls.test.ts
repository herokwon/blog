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
      { sleep: async () => {} },
    ),
  );
});

test('retries transient responses and verifies both origins', async () => {
  const waits: number[] = [];
  let calls = 0;
  await verifyPreviewUrls(
    '18f97339-c287-4872-9bdd-e2135c07ec12',
    'https://blog-preview.example.workers.dev',
    async () => new Response('', { status: ++calls === 1 ? 404 : 200 }),
    {
      sleep: async ms => {
        waits.push(ms);
      },
    },
  );
  assert.equal(calls, 3);
  assert.deepEqual(waits, [3000]);
});

test('429 and server failures use bounded backoff before success', async () => {
  const waits: number[] = [];
  const statuses = [429, 500, 503, 404, 200, 200];
  await verifyPreviewUrls(
    '18f97339-c287-4872-9bdd-e2135c07ec12',
    'https://blog-preview.example.workers.dev',
    async () => new Response(null, { status: statuses.shift() }),
    {
      sleep: async ms => {
        waits.push(ms);
      },
    },
  );
  assert.deepEqual(waits, [3000, 5000, 10000, 15000]);
  assert.equal(statuses.length, 0);
});

test('exhaustion identifies Version URL, last status and attempts', async () => {
  let calls = 0;
  await assert.rejects(
    verifyPreviewUrls(
      '18f97339-c287-4872-9bdd-e2135c07ec12',
      'https://blog-preview.example.workers.dev',
      async () => new Response('', { status: ++calls === 1 ? 200 : 404 }),
      { sleep: async () => {} },
    ),
    /Version URL.*18f97339.*Attempts: 5\/5.*HTTP 404.*Elapsed:/s,
  );
  assert.equal(calls, 6);
});

test('redirects and authorization errors fail immediately', async () => {
  for (const status of [204, 302, 400, 401, 403]) {
    let calls = 0;
    await assert.rejects(
      verifyPreviewUrls(
        '18f97339-c287-4872-9bdd-e2135c07ec12',
        'https://blog-preview.example.workers.dev',
        async (_url, options) => {
          calls++;
          assert.equal(options?.redirect, 'manual');
          return new Response(null, { status });
        },
        {
          sleep: async () => {
            throw new Error('unexpected wait');
          },
        },
      ),
    );
    assert.equal(calls, 1);
  }
});

test('Version URL inherits remaining deadline and clamps request timeout', async t => {
  let time = 0;
  const timeouts: number[] = [];
  t.mock.method(AbortSignal, 'timeout', (ms: number) => {
    timeouts.push(ms);
    return new AbortController().signal;
  });
  let calls = 0;
  await assert.rejects(
    verifyPreviewUrls(
      '18f97339-c287-4872-9bdd-e2135c07ec12',
      'https://blog-preview.example.workers.dev',
      async () => {
        if (++calls === 1) {
          time += 86000;
          return new Response('');
        }
        time += 4000;
        throw new DOMException('request timed out', 'TimeoutError');
      },
      {
        now: () => time,
        sleep: async () => {
          throw new Error('unexpected wait');
        },
      },
    ),
    /Version URL.*TimeoutError.*overall deadline/s,
  );
  assert.equal(calls, 2);
  assert.deepEqual(timeouts, [10000, 4000]);
});

test('request timeout is retried', async () => {
  let calls = 0;
  await verifyPreviewUrls(
    '18f97339-c287-4872-9bdd-e2135c07ec12',
    'https://blog-preview.example.workers.dev',
    async () => {
      if (++calls === 1) throw new DOMException('timeout', 'TimeoutError');
      return new Response('');
    },
    { sleep: async () => {} },
  );
  assert.equal(calls, 3);
});

test('network failures retry and the shared deadline bounds both origins', async () => {
  let calls = 0;
  await verifyPreviewUrls(
    '18f97339-c287-4872-9bdd-e2135c07ec12',
    'https://blog-preview.example.workers.dev',
    async () => {
      if (++calls === 1) throw new TypeError('fetch failed');
      return new Response('');
    },
    { sleep: async () => {} },
  );
  assert.equal(calls, 3);
  let time = 0;
  calls = 0;
  await assert.rejects(
    verifyPreviewUrls(
      '18f97339-c287-4872-9bdd-e2135c07ec12',
      'https://blog-preview.example.workers.dev',
      async () => {
        calls++;
        time += 89_000;
        return new Response('', { status: 404 });
      },
      {
        now: () => time,
        sleep: async ms => {
          time += ms;
        },
      },
    ),
    /overall deadline/,
  );
  assert.equal(calls, 1);
});
