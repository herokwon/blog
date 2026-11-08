import { json } from '@sveltejs/kit';
import { MediaError, uploadMedia } from '#lib/server/media.js';
import { env } from 'cloudflare:workers';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    return json(await uploadMedia(env.DB, env.ATTACHMENTS, request), {
      status: 201,
    });
  } catch (cause) {
    return json(
      {
        message:
          cause instanceof MediaError
            ? cause.message
            : 'The image could not be uploaded. Please retry.',
      },
      { status: cause instanceof MediaError ? cause.status : 503 },
    );
  }
};
