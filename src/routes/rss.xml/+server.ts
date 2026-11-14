import { escapeXml } from '#lib/server/discovery.js';
import { summarizeMarkdown } from '#lib/server/markdown.js';
import { listPublicFeed } from '#lib/server/public-posts.js';
import { SITE_NAME, SITE_ORIGIN } from '#lib/site.js';
import { env } from 'cloudflare:workers';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const posts = await listPublicFeed(env.DB);
  const items = posts.map(post => {
    const link = escapeXml(SITE_ORIGIN + '/posts/' + post.slug);
    return (
      '<item><title>' +
      escapeXml(post.title) +
      '</title><link>' +
      link +
      '</link><guid isPermaLink="true">' +
      link +
      '</guid><pubDate>' +
      new Date(post.publishedAt).toUTCString() +
      '</pubDate><description>' +
      escapeXml(summarizeMarkdown(post.body, post.title)) +
      '</description></item>'
    );
  });
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>' +
    SITE_NAME +
    '</title><link>' +
    SITE_ORIGIN +
    '/</link><description>Latest published posts from Personal Blog.</description><atom:link href="' +
    SITE_ORIGIN +
    '/rss.xml" rel="self" type="application/rss+xml" />' +
    items.join('') +
    '</channel></rss>';
  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
};
