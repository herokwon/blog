import { expect, test } from 'vitest';
import { escapeXml } from './server/discovery.js';
import { publicIndexable, SITE_ORIGIN } from './site.js';

test('indexing requires production identity, canonical origin, successful public routes and no discovery filters', () => {
  expect(publicIndexable(true, new URL('/?page=2', SITE_ORIGIN))).toBe(true);
  expect(publicIndexable(true, new URL('/posts/example', SITE_ORIGIN))).toBe(
    true,
  );
  expect(publicIndexable(false, new URL('/', SITE_ORIGIN))).toBe(false);
  expect(publicIndexable(true, new URL('https://spoof.example/'))).toBe(false);
  for (const path of [
    '/?q=hello',
    '/?category=id',
    '/?tag=Some%20Tag',
    '/admin',
    '/unknown',
  ])
    expect(publicIndexable(true, new URL(path, SITE_ORIGIN))).toBe(false);
  expect(
    publicIndexable(true, new URL('/posts/example', SITE_ORIGIN), 404),
  ).toBe(false);
});

test('discovery XML escapes markup and removes invalid XML controls without corrupting Unicode', () => {
  expect(escapeXml('한글😀 & <tag> "quote" ' + String.fromCharCode(1))).toBe(
    '한글😀 &amp; &lt;tag&gt; &quot;quote&quot; ',
  );
});
