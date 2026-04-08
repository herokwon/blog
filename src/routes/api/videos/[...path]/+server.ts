import { error, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({
  request,
  platform,
  params,
}): Promise<Response> => {
  const bucket = platform?.env.BLOG_BUCKET;
  if (!bucket) throw error(500, 'R2 binding not configured');

  const key = params.path ?? '';
  if (key.length === 0) throw error(400, 'Video path is required');

  const object = await bucket.get(key);
  if (!object) throw error(404, 'Video not found');

  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch === object.etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: object.etag,
      },
    });
  }

  return new Response(object.body, {
    headers: {
      'Content-Type':
        object.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      ETag: object.etag,
    },
  });
};
