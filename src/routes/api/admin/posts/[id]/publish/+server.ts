import { postCommandHandler } from '#lib/server/admin/http.ts';
import type { RequestHandler } from './$types';

export const trailingSlash = 'ignore';
export const POST: RequestHandler = postCommandHandler('publish');
