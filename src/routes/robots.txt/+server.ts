import { SITE_ORIGIN } from '#lib/site.js';
import { env } from 'cloudflare:workers';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
  new Response(
    String(env.SITE_ENVIRONMENT) === 'production'
      ? 'User-agent: *\nDisallow: /admin\nSitemap: ' +
          SITE_ORIGIN +
          '/sitemap.xml\n'
      : 'User-agent: *\nDisallow: /\n',
    {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      },
    },
  );
