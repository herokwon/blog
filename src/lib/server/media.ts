import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

const maximum = 10 * 1024 * 1024;
const markdown = unified().use(remarkParse).use(remarkGfm);
const idPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export class MediaError extends Error {
  constructor(
    readonly status: 400 | 413 | 415 | 503,
    message: string,
  ) {
    super(message);
  }
}

export function imageReferences(body: string) {
  const tree = markdown.parse(body);
  const definitions = new Map<string, string>();
  visit(tree, 'definition', node => {
    if (!definitions.has(node.identifier))
      definitions.set(node.identifier, node.url);
  });
  const ids = new Set<string>();
  const collect = (value: string) => {
    let url: URL;
    let path: string;
    try {
      url = new URL(value, 'https://managed.invalid');
      path = decodeURIComponent(url.pathname);
    } catch {
      throw new MediaError(400, 'Invalid image URL.');
    }
    if (path.startsWith('/admin/media/'))
      throw new MediaError(
        400,
        'Use stable /media/ URLs in Markdown, not administrator preview URLs.',
      );
    if (url.origin !== 'https://managed.invalid' || !path.startsWith('/media/'))
      return;
    const id = path.slice('/media/'.length);
    if (!idPattern.test(id))
      throw new MediaError(400, 'Invalid managed image URL.');
    ids.add(id);
  };
  visit(tree, 'image', node => collect(node.url));
  visit(tree, 'imageReference', node => {
    const value = definitions.get(node.identifier);
    if (value) collect(value);
  });
  return [...ids].sort();
}

function signature(bytes: Uint8Array) {
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value,
    )
  )
    return 'image/png';
  if (
    bytes.length >= 4 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return 'image/jpeg';
  if (bytes.length >= 13 && ['GIF87a', 'GIF89a'].includes(ascii(0, 6)))
    return 'image/gif';
  if (bytes.length >= 16 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP')
    return 'image/webp';
  return null;
}

export async function uploadMedia(
  db: D1Database,
  bucket: R2Bucket,
  request: Request,
) {
  const type = request.headers.get('content-type')?.split(';')[0].trim();
  if (
    !type ||
    !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(type)
  )
    throw new MediaError(415, 'Upload a JPEG, PNG, GIF or WebP image.');
  if (Number(request.headers.get('content-length')) > maximum)
    throw new MediaError(413, 'Images must be at most 10 MiB.');
  if (!request.body) throw new MediaError(400, 'An image is required.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new MediaError(413, 'Images must be at most 10 MiB.');
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!size) throw new MediaError(400, 'An image is required.');
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  if (signature(bytes) !== type)
    throw new MediaError(
      415,
      'The image contents do not match its declared format.',
    );
  const id = crypto.randomUUID();
  const key = `media/${id}`;
  await bucket.put(key, bytes, { httpMetadata: { contentType: type } });
  try {
    await db
      .prepare(
        'INSERT INTO attachments (id, object_key, content_type, size) VALUES (?, ?, ?, ?)',
      )
      .bind(id, key, type, size)
      .run();
  } catch {
    try {
      await bucket.delete(key);
    } catch {
      console.error('Staged image cleanup failed', { attachmentId: id });
    }
    throw new MediaError(503, 'The image could not be stored. Please retry.');
  }
  return { id, url: `/media/${id}` };
}

export async function serveMedia(
  db: D1Database,
  bucket: R2Bucket,
  id: string,
  privatePreview: boolean,
  method: 'GET' | 'HEAD' = 'GET',
) {
  const headers = new Headers({
    'cache-control': privatePreview ? 'private, no-store' : 'no-store',
    'x-content-type-options': 'nosniff',
  });
  const missing = () =>
    new Response(method === 'HEAD' ? null : 'Not found.', {
      status: 404,
      headers,
    });
  if (!idPattern.test(id)) return missing();
  const row = await db
    .prepare(
      `SELECT object_key, content_type, size FROM attachments WHERE id = ? ${privatePreview ? '' : "AND EXISTS (SELECT 1 FROM post_attachments JOIN posts ON posts.id = post_attachments.post_id WHERE post_attachments.attachment_id = attachments.id AND posts.status = 'published' AND posts.deleted_at IS NULL)"}`,
    )
    .bind(id)
    .first<{ object_key: string; content_type: string; size: number }>();
  if (!row) return missing();
  const object =
    method === 'HEAD'
      ? await bucket.head(row.object_key)
      : await bucket.get(row.object_key);
  if (!object) return missing();
  headers.set('content-type', row.content_type);
  headers.set('content-length', String(row.size));
  headers.set('etag', object.httpEtag);
  return new Response(
    method === 'HEAD' ? null : (object as R2ObjectBody).body,
    { headers },
  );
}
