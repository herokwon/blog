import { getAdminContext } from '#lib/server/admin/environment.ts';
import type { LayoutServerLoad } from './$types';

// Let the authenticated hook canonicalize Admin pages with uncached responses.
export const trailingSlash = 'ignore';

export const load: LayoutServerLoad = event => ({
  adminContext: getAdminContext(event),
});
