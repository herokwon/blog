import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { runGithubRelease } from './github-release.ts';

const mergeSha = 'a'.repeat(40);
const otherSha = 'b'.repeat(40);
const tagSha = 'c'.repeat(40);
const prefix = '/repos/herokwon/blog';
const refs = `${prefix}/git/matching-refs/tags/v0.1.0`;
const release = `${prefix}/releases/tags/v0.1.0`;
function ref(type = 'commit', sha = mergeSha, name = 'v0.1.0') {
  return { ref: `refs/tags/${name}`, object: { type, sha } };
}

type Reply = { path: string; status?: number; body: unknown; method?: string };
async function scenario(command: 'check' | 'create', replies: Reply[]) {
  const requests: { path: string; method: string; body: unknown }[] = [];
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    requests.push({
      path: request.url!,
      method: request.method!,
      body: body ? JSON.parse(body) : null,
    });
    const reply = replies[requests.length - 1];
    response.writeHead(reply?.status ?? (reply ? 200 : 500), {
      'content-type': 'application/json',
    });
    response.end(
      JSON.stringify(reply?.body ?? { message: 'Unexpected request' }),
    );
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  let result: unknown;
  let error: unknown;
  try {
    result = await runGithubRelease(command, {
      repository: 'herokwon/blog',
      version: '0.1.0',
      mergeSha,
      token: 'test-token',
      apiUrl: `http://127.0.0.1:${address.port}`,
    });
  } catch (caught) {
    error = caught;
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close(err => (err ? reject(err) : resolve())),
    );
  }
  assert.equal(requests.length, replies.length);
  requests.forEach((request, index) => {
    assert.equal(request.path, replies[index].path);
    assert.equal(request.method, replies[index].method ?? 'GET');
  });
  return { result, error, requests };
}

test('preflight allows a missing exact tag without confusing prefix matches', async () => {
  const result = await scenario('check', [
    { path: refs, body: [ref('tree', otherSha, 'v0.1.0-rc.1')] },
  ]);
  assert.ifError(result.error);
  assert.equal(result.result, 'missing');
});

test('preflight accepts a matching lightweight tag without publishing', async () => {
  const result = await scenario('check', [{ path: refs, body: [ref()] }]);
  assert.ifError(result.error);
  assert.equal(result.result, 'matching');
});

test('preflight resolves annotated tags to the final commit', async () => {
  const result = await scenario('check', [
    { path: refs, body: [ref('tag', tagSha)] },
    {
      path: `${prefix}/git/tags/${tagSha}`,
      body: { object: { type: 'commit', sha: mergeSha } },
    },
  ]);
  assert.ifError(result.error);
  assert.equal(result.result, 'matching');
});

test('mismatched lightweight and annotated tags fail before any mutation', async () => {
  for (const annotated of [false, true]) {
    const replies: Reply[] = [
      {
        path: refs,
        body: [
          ref(annotated ? 'tag' : 'commit', annotated ? tagSha : otherSha),
        ],
      },
    ];
    if (annotated)
      replies.push({
        path: `${prefix}/git/tags/${tagSha}`,
        body: { object: { type: 'commit', sha: otherSha } },
      });
    const result = await scenario('check', replies);
    assert.match(
      String(result.error),
      new RegExp(`Expected ${mergeSha}; actual ${otherSha}`),
    );
  }
});

test('tag lookup errors are never treated as a missing tag', async () => {
  for (const status of [401, 403, 404, 409, 429, 500]) {
    const result = await scenario('check', [
      { path: refs, status, body: { message: 'API failure' } },
    ]);
    assert.match(String(result.error), new RegExp(`HTTP ${status}`));
  }
});

test('malformed tag responses and non-commit targets fail closed', async () => {
  for (const body of [
    {},
    [null],
    [{}],
    [ref('tree')],
    [ref('commit', 'short')],
  ]) {
    const result = await scenario('check', [{ path: refs, body }]);
    assert.ok(result.error);
  }
});

test('creates a missing tag at the merge SHA and publishes a Release', async () => {
  const result = await scenario('create', [
    { path: refs, body: [] },
    { path: release, status: 404, body: { message: 'Not Found' } },
    { path: `${prefix}/git/refs`, method: 'POST', status: 201, body: ref() },
    {
      path: `${prefix}/releases`,
      method: 'POST',
      status: 201,
      body: { tag_name: 'v0.1.0' },
    },
  ]);
  assert.ifError(result.error);
  assert.equal(result.result, 'created');
  assert.deepEqual(result.requests[2].body, {
    ref: 'refs/tags/v0.1.0',
    sha: mergeSha,
  });
  assert.deepEqual(result.requests[3].body, {
    tag_name: 'v0.1.0',
    target_commitish: mergeSha,
    name: 'v0.1.0',
    generate_release_notes: true,
  });
});

test('creates a missing Release from an existing matching tag', async () => {
  const result = await scenario('create', [
    { path: refs, body: [ref()] },
    { path: release, status: 404, body: { message: 'Not Found' } },
    {
      path: `${prefix}/releases`,
      method: 'POST',
      status: 201,
      body: { tag_name: 'v0.1.0' },
    },
  ]);
  assert.ifError(result.error);
  assert.equal(result.result, 'created');
});

test('reuses an existing Release only after revalidating its tag', async () => {
  const result = await scenario('create', [
    { path: refs, body: [ref()] },
    { path: release, body: { tag_name: 'v0.1.0' } },
  ]);
  assert.ifError(result.error);
  assert.equal(result.result, 'existing');
  const mismatch = await scenario('create', [
    { path: refs, body: [ref('commit', otherSha)] },
  ]);
  assert.ok(mismatch.error);
});

test('Release lookup failures do not cause publication', async () => {
  for (const status of [401, 403, 429, 500]) {
    const result = await scenario('create', [
      { path: refs, body: [ref()] },
      { path: release, status, body: { message: 'API failure' } },
    ]);
    assert.match(String(result.error), new RegExp(`HTTP ${status}`));
  }
});

test('a competing tag creation is verified rather than overwritten', async () => {
  for (const sha of [mergeSha, otherSha]) {
    const replies: Reply[] = [
      { path: refs, body: [] },
      { path: release, status: 404, body: { message: 'Not Found' } },
      {
        path: `${prefix}/git/refs`,
        method: 'POST',
        status: 422,
        body: { message: 'Reference already exists' },
      },
      { path: refs, body: [ref('commit', sha)] },
    ];
    if (sha === mergeSha)
      replies.push({
        path: `${prefix}/releases`,
        method: 'POST',
        status: 201,
        body: { tag_name: 'v0.1.0' },
      });
    const result = await scenario('create', replies);
    if (sha === mergeSha) assert.ifError(result.error);
    else assert.ok(result.error);
  }
});

test('network failures block preflight', async () => {
  await assert.rejects(
    runGithubRelease('check', {
      repository: 'herokwon/blog',
      version: '0.1.0',
      mergeSha,
      token: 'test-token',
      apiUrl: 'http://127.0.0.1:1',
    }),
  );
});
