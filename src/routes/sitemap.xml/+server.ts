import { escapeXml } from '#lib/server/discovery.js';
import { listPublicSitemap } from '#lib/server/public-posts.js';
import { SITE_ORIGIN } from '#lib/site.js';
import { env } from 'cloudflare:workers';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const posts = await listPublicSitemap(env.DB);
  const entries = [
    '<url><loc>' + SITE_ORIGIN + '/</loc></url>',
    ...posts.map(
      post =>
        '<url><loc>' +
        escapeXml(SITE_ORIGIN + '/posts/' + post.slug) +
        '</loc><lastmod>' +
        escapeXml(post.updatedAt) +
        '</lastmod></url>',
    ),
  ];
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      entries.join('') +
      '</urlset>',
    {
      headers: {
        'content-type': 'application/xml; charset=utf-8',
        'cache-control': 'no-store',
      },
    },
  );
};
