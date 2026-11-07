import type { Handle } from '@sveltejs/kit/hooks';
import {
  AccessError,
  authorizeAdminRequest,
  isAdminPath,
} from '#lib/server/auth/access.js';
import { env } from 'cloudflare:workers';

export const handle: Handle = async ({ event, resolve }) => {
  const route = event.route.id;
  let protectedPath: boolean;
  try {
    protectedPath =
      isAdminPath(event.url.pathname) ||
      route === '/admin' ||
      Boolean(route?.startsWith('/admin/'));
  } catch {
    return new Response('Invalid path.', {
      status: 400,
      headers: { 'cache-control': 'private, no-store' },
    });
  }
  if (!protectedPath) return resolve(event);
  try {
    event.locals.author = await authorizeAdminRequest(event.request, env);
  } catch (cause) {
    const status = cause instanceof AccessError ? cause.status : 403;
    return new Response(
      status === 503
        ? 'Administrator access is not configured.'
        : 'Administrator access denied.',
      { status, headers: { 'cache-control': 'private, no-store' } },
    );
  }
  const response = await resolve(event);
  response.headers.set('cache-control', 'private, no-store');
  return response;
};
