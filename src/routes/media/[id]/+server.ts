import { serveMedia } from '#lib/server/media.js';
import { env } from 'cloudflare:workers';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, request }) =>
  serveMedia(
    env.DB,
    env.ATTACHMENTS,
    params.id,
    false,
    request.method === 'HEAD' ? 'HEAD' : 'GET',
  );
export const HEAD = GET;
