import { error, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({
  platform,
  params,
}): Promise<Response> => {
  const bucket = platform?.env.BLOG_BUCKET;
  if (!bucket) {
    throw error(500, 'R2 binding not configured');
  }

  const key = params.path;
  if (!key) {
    throw error(400, 'Image path is required');
  }

  const object = await bucket.get(key);
  if (!object) {
    throw error(404, 'Image not found');
  }

  const headers = new Headers();
  headers.set(
    'Content-Type',
    object.httpMetadata?.contentType ?? 'application/octet-stream',
  );
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('ETag', object.etag);

  return new Response(object.body, { headers });
};
