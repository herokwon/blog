import { verifyAccessToken } from '../lib/server/access';
import { env } from '../lib/server/runtime';
import type { LayoutServerLoad } from './$types';

export const load = (async ({ cookies, locals, url, setHeaders }) => {
  const identity =
    locals.identity ??
    (await verifyAccessToken(cookies.get('CF_Authorization'), env));
  setHeaders({ 'cache-control': 'no-store' });
  return {
    signedIn: identity?.kind === 'admin',
    returnTo: new URL('/', url.origin).href,
  };
}) satisfies LayoutServerLoad;
