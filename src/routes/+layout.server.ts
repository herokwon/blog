import { env } from 'cloudflare:workers';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => ({
  production: String(env.SITE_ENVIRONMENT) === 'production',
});
