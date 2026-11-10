import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { getPlatformProxy, type PlatformProxy } from 'wrangler';
import { getPost, mutatePost, type PostInput } from './db/posts';
import { imageReferences, MediaError, serveMedia, uploadMedia } from './media';

let platform: PlatformProxy<{ DB: D1Database; ATTACHMENTS: R2Bucket }>;
let db: D1Database;
let bucket: R2Bucket;
const png = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
    'base64',
  ),
);
const input: PostInput = {
  title: 'Image post',
  body: 'Body',
  slug: 'image-post',
  categoryId: 'category',
  tags: [],
};
const request = (body: Uint8Array<ArrayBuffer> = png, type = 'image/png') =>
  new Request('https://blog.test/admin/media', {
    method: 'POST',
    headers: { 'content-type': type },
    body,
  });

beforeAll(async () => {
  platform = await getPlatformProxy<{ DB: D1Database; ATTACHMENTS: R2Bucket }>({
    persist: false,
    remoteBindings: false,
  });
  db = platform.env.DB;
  bucket = platform.env.ATTACHMENTS;
  for (const file of readdirSync('drizzle')
    .filter(name => name.endsWith('.sql'))
    .sort())
    for (const statement of readFileSync(`drizzle/${file}`, 'utf8').split(
      '--> statement-breakpoint',
    ))
      await db.prepare(statement).run();
}, 30_000);
beforeEach(async () => {
  await db.batch(
    [
      'DROP TRIGGER IF EXISTS reject_media',
      'DROP TRIGGER IF EXISTS ignore_parent',
      'DROP TRIGGER IF EXISTS reject_metadata',
      'DELETE FROM post_attachments',
      'DELETE FROM post_owned_tags',
      'DELETE FROM posts',
      'DELETE FROM attachments',
      'DELETE FROM categories',
      "INSERT INTO categories (id, name) VALUES ('category', 'Notes')",
    ].map(query => db.prepare(query)),
  );
  const objects = await bucket.list();
  if (objects.objects.length)
    await bucket.delete(objects.objects.map(object => object.key));
});
afterAll(async () => {
  await platform?.dispose();
});

test('supported signatures upload privately and metadata failure removes the new R2 object', async () => {
  const image = await uploadMedia(db, bucket, request());
  expect(image.url).toBe(`/media/${image.id}`);
  expect((await serveMedia(db, bucket, image.id, false)).status).toBe(404);
  const preview = await serveMedia(db, bucket, image.id, true);
  expect(preview.status).toBe(200);
  expect(preview.headers.get('content-type')).toBe('image/png');
  expect(preview.headers.get('cache-control')).toContain('no-store');
  expect(new Uint8Array(await preview.arrayBuffer())).toEqual(png);
  for (const [type, bytes] of [
    ['image/jpeg', Uint8Array.from([255, 216, 255, 217])],
    [
      'image/gif',
      Uint8Array.from(
        Buffer.from(
          'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
          'base64',
        ),
      ),
    ],
    [
      'image/webp',
      Uint8Array.from(
        Buffer.from(
          'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
          'base64',
        ),
      ),
    ],
  ] as const)
    expect(
      (await uploadMedia(db, bucket, request(bytes, type))).id,
    ).toBeTruthy();
  const before = (await bucket.list()).objects.length;
  await db
    .prepare(
      "CREATE TRIGGER reject_metadata BEFORE INSERT ON attachments BEGIN SELECT RAISE(ABORT, 'metadata rejected'); END",
    )
    .run();
  await expect(uploadMedia(db, bucket, request())).rejects.toThrow();
  expect((await bucket.list()).objects).toHaveLength(before);
});

test('unsupported, empty, mismatched and oversized actual bodies are rejected without storage writes', async () => {
  for (const [value, status] of [
    [request(png, 'image/svg+xml'), 415],
    [request(png, 'image/jpeg'), 415],
    [request(new Uint8Array()), 400],
    [request(new Uint8Array(10 * 1024 * 1024 + 1)), 413],
  ] as const)
    await expect(uploadMedia(db, bucket, value)).rejects.toMatchObject({
      status,
    });
  expect((await bucket.list()).objects).toEqual([]);
  expect(
    await db
      .prepare('SELECT count(*) AS count FROM attachments')
      .first<number>('count'),
  ).toBe(0);
});

test('AST references ignore code, raw HTML, links and unused definitions, resolving actual image references', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const other = '00000000-0000-4000-8000-000000000002';
  const body = `![inline](/media/${id})\n![reference][picture]\n\n[picture]: /media/${id}\n[unused]: /media/${other}\n\n[link](/media/${other})\n\`![code](/media/${other})\`\n<img src="/media/${other}">`;
  expect(imageReferences(body)).toEqual([id]);
  expect(() => imageReferences(`![private](/admin/media/${id})`)).toThrow();
  expect(() => imageReferences('![unknown](/media/not-an-id)')).toThrow();
  expect(() => imageReferences('![invalid](http://)')).toThrow(MediaError);
});

test('saved publication membership controls GET and HEAD, including staging/removal/archive/trash/restore', async () => {
  const image = await uploadMedia(db, bucket, request());
  const body = `![image](${image.url})`;
  const created = await mutatePost(db, {
    action: 'publish',
    input: { ...input, body },
  });
  if (!created.ok) throw new Error(created.message);
  for (const method of ['GET', 'HEAD'] as const) {
    const response = await serveMedia(db, bucket, image.id, false, method);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    if (method === 'HEAD') expect(await response.text()).toBe('');
  }
  const staged = await uploadMedia(db, bucket, request());
  expect((await serveMedia(db, bucket, staged.id, false)).status).toBe(404);
  const first = (await getPost(db, created.id))!;
  expect(
    (
      await mutatePost(db, {
        action: 'save',
        id: first.id,
        revision: first.revision,
        input: { ...input, body: `![new](${staged.url})` },
      })
    ).ok,
  ).toBe(true);
  expect((await serveMedia(db, bucket, image.id, false)).status).toBe(404);
  expect((await serveMedia(db, bucket, staged.id, false)).status).toBe(200);
  for (const [action, status] of [
    ['archive', 404],
    ['republish', 200],
    ['trash', 404],
    ['restore', 404],
  ] as const) {
    const current = (await getPost(db, first.id))!;
    expect(
      (
        await mutatePost(db, {
          action,
          id: first.id,
          revision: current.revision,
          input: { ...input, body: `![new](${staged.url})` },
        })
      ).ok,
    ).toBe(true);
    expect((await serveMedia(db, bucket, staged.id, false)).status).toBe(
      status,
    );
  }
});

test('stale saves and dependent SQL failure cannot detach or publish new image references', async () => {
  const image = await uploadMedia(db, bucket, request());
  const created = await mutatePost(db, {
    action: 'publish',
    input: { ...input, body: `![image](${image.url})` },
  });
  if (!created.ok) throw new Error(created.message);
  const original = (await getPost(db, created.id))!;
  await mutatePost(db, {
    action: 'save',
    id: original.id,
    revision: original.revision,
    input: { ...input, body: original.body },
  });
  expect(
    await mutatePost(db, {
      action: 'save',
      id: original.id,
      revision: original.revision,
      input,
    }),
  ).toMatchObject({ ok: false, status: 409 });
  expect((await serveMedia(db, bucket, image.id, false)).status).toBe(200);
  const other = await uploadMedia(db, bucket, request());
  const current = (await getPost(db, original.id))!;
  await db
    .prepare(
      'CREATE TRIGGER ignore_parent BEFORE UPDATE ON posts BEGIN SELECT RAISE(IGNORE); END',
    )
    .run();
  expect(
    await mutatePost(db, {
      action: 'save',
      id: current.id,
      revision: current.revision,
      input: { ...input, body: `![new](${other.url})` },
    }),
  ).toMatchObject({ ok: false, status: 409 });
  expect(await getPost(db, current.id)).toEqual(current);
  expect((await serveMedia(db, bucket, image.id, false)).status).toBe(200);
  expect((await serveMedia(db, bucket, other.id, false)).status).toBe(404);
  await db.prepare('DROP TRIGGER ignore_parent').run();
  await db
    .prepare(
      "CREATE TRIGGER reject_media BEFORE INSERT ON post_attachments BEGIN SELECT RAISE(ABORT, 'relation rejected'); END",
    )
    .run();
  await expect(
    mutatePost(db, {
      action: 'save',
      id: current.id,
      revision: current.revision,
      input: { ...input, body: `![new](${other.url})` },
    }),
  ).rejects.toThrow();
  expect(await getPost(db, original.id)).toEqual(current);
  expect((await serveMedia(db, bucket, image.id, false)).status).toBe(200);
  expect((await serveMedia(db, bucket, other.id, false)).status).toBe(404);
});
