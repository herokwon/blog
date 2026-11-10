import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { getPlatformProxy, type PlatformProxy } from 'wrangler';
import { getPublicPost, listPublicPosts, renderMarkdown } from './public-posts';

let platform: PlatformProxy<{ DB: D1Database }>;
let db: D1Database;
beforeAll(async () => {
  platform = await getPlatformProxy<{ DB: D1Database }>({
    persist: false,
    remoteBindings: false,
  });
  db = platform.env.DB;
  for (const file of readdirSync('drizzle')
    .filter(file => file.endsWith('.sql'))
    .sort())
    for (const statement of readFileSync(`drizzle/${file}`, 'utf8').split(
      '--> statement-breakpoint',
    ))
      await db.prepare(statement).run();
}, 30_000);
beforeEach(async () => {
  await db.batch(
    [
      'DELETE FROM post_owned_tags',
      'DELETE FROM posts',
      'DELETE FROM categories',
      "INSERT INTO categories (id,name) VALUES ('category','Notes')",
    ].map(query => db.prepare(query)),
  );
});
afterAll(async () => {
  await platform?.dispose();
});

async function post(
  id: string,
  status = 'published',
  deleted: string | null = null,
  published = '2026-11-08T00:00:00.000Z',
) {
  await db
    .prepare(
      "INSERT INTO posts (id,title,body,status,slug,category_id,published_at,deleted_at,revision) VALUES (?, ?, 'Body', ?, ?, 'category', ?, ?, 'private-revision')",
    )
    .bind(
      id,
      `Title ${id}`,
      status,
      id,
      status === 'draft' ? null : published,
      deleted,
    )
    .run();
}

test('public queries exclude every nonpublic state and expose only reader fields', async () => {
  await post('public');
  await post('draft', 'draft');
  await post('archived', 'archived');
  await post('trashed', 'archived', '2026-11-08T00:00:00.000Z');
  for (const slug of ['draft', 'archived', 'trashed', 'unknown'])
    expect(await getPublicPost(db, slug)).toBeNull();
  expect((await listPublicPosts(db)).posts).toEqual([
    {
      title: 'Title public',
      slug: 'public',
      publishedAt: '2026-11-08T00:00:00.000Z',
      category: 'Notes',
    },
  ]);
  await db
    .prepare("INSERT INTO post_owned_tags VALUES ('public','Svelte',0)")
    .run();
  expect(await getPublicPost(db, 'public')).toEqual({
    title: 'Title public',
    body: 'Body',
    slug: 'public',
    publishedAt: '2026-11-08T00:00:00.000Z',
    category: 'Notes',
    tags: ['Svelte'],
  });
  await db.prepare("UPDATE categories SET name = 'Renamed'").run();
  expect((await getPublicPost(db, 'public'))?.category).toBe('Renamed');
  await db
    .prepare("UPDATE posts SET status = 'archived' WHERE id = 'public'")
    .run();
  expect(await getPublicPost(db, 'public')).toBeNull();
  expect((await listPublicPosts(db)).posts).toEqual([]);
});

test('public pages order by first publication date and ID, never later update time', async () => {
  for (let i = 0; i < 21; i++) await post(`post-${String(i).padStart(2, '0')}`);
  await post('newer', 'published', null, '2026-11-09T00:00:00.000Z');
  await db
    .prepare(
      "UPDATE posts SET updated_at = '2099-01-01T00:00:00.000Z' WHERE id = 'post-00'",
    )
    .run();
  const first = await listPublicPosts(db);
  expect(first.posts.map(post => post.slug)).toEqual([
    'newer',
    ...Array.from(
      { length: 19 },
      (_, i) => `post-${String(20 - i).padStart(2, '0')}`,
    ),
  ]);
  expect(first.hasNext).toBe(true);
  const second = await listPublicPosts(db, 2);
  expect(second.posts.map(post => post.slug)).toEqual(['post-01', 'post-00']);
  expect(second.hasNext).toBe(false);
});

test('server Markdown preserves CommonMark/GFM structures and safe public image URLs', async () => {
  const html = await renderMarkdown(
    '## Heading\n\n**Strong** and *emphasis* and ~~removed~~.\n\n- [x] Task\n- Item\n\n> Quote\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n```js\nconst x = "<script>";\n```\n\n[Link](https://example.com) ![Alt](/media/00000000-0000-4000-8000-000000000001)',
  );
  expect(html).toMatch(/&(?:lt|#x3C|#60);script(?:>|&(?:gt|#x3E|#62);)/i);
  for (const fragment of [
    '<h2>Heading</h2>',
    '<strong>Strong</strong>',
    '<em>emphasis</em>',
    '<del>removed</del>',
    '<table>',
    '<blockquote>',
    'type="checkbox"',
    'disabled',
    'href="https://example.com"',
    'src="/media/00000000-0000-4000-8000-000000000001"',
  ])
    expect(html).toContain(fragment);
});

test('server Markdown drops raw executable HTML and unsafe link/image protocols', async () => {
  const html = await renderMarkdown(
    '<script>globalThis.pwned=true</script>\n\n<a id="location" name="document">Clobber</a>\n\n<img src="x" onerror="alert(1)">\n\n<iframe srcdoc="bad"></iframe>\n\n[bad](javascript:alert%281%29) [encoded](java&#x73;cript:alert%281%29) [vb](vbscript:bad) [file](file:///secret) ![data](data:image/svg+xml;base64,PHN2Zz4=)\n\n[ok](/posts/safe)',
  );
  expect(html).not.toMatch(
    /<script|<img[^>]*onerror|<iframe|globalThis\.pwned|(?:href|src)="(?:javascript|vbscript|file|data):/i,
  );
  expect(html).toContain('href="/posts/safe"');
  expect(html).not.toMatch(/(?:id|name)="(?:location|document|constructor)"/);
});

test('sanitized GFM footnote navigation and return links resolve to actual IDs', async () => {
  const html = await renderMarkdown(
    'Text[^constructor]\n\n[^constructor]: Note',
  );
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  const fragments = [...html.matchAll(/href="#([^"]+)"/g)].map(match =>
    decodeURIComponent(match[1]),
  );
  expect(fragments).toHaveLength(2);
  for (const fragment of fragments) expect(ids).toContain(fragment);
  for (const match of html.matchAll(/aria-describedby="([^"]+)"/g))
    for (const id of match[1].split(/\s+/)) expect(ids).toContain(id);
});
