import type { Handle } from '@sveltejs/kit/hooks';

import { authorize } from './lib/server/access';
import { env } from './lib/server/runtime';

export const handle: Handle = async ({ event, resolve }) => {
  // Route IDs reflect SvelteKit's decoded routing, unlike raw URL pathnames.
  const path = event.route.id ?? event.url.pathname;
  // Also cover SvelteKit's data requests and the exact /admin root.
  const admin = path === '/admin' || path.startsWith('/admin/');
  const probe = path === '/admin/api/deployment-check';
  const remotePreview = event.url.hostname === 'blog-preview.herokwon.dev';
  if (admin || remotePreview) {
    const identity = await authorize(event.request, env, probe);
    if (!identity)
      return new Response('Access denied', {
        status: 403,
        headers: { 'Cache-Control': 'no-store' },
      });
    event.locals.identity = identity;
  }
  const response = await resolve(event);
  if (admin || remotePreview) response.headers.set('Cache-Control', 'no-store');
  return response;
};
