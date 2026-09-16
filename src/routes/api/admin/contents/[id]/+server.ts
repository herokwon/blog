import { createGetContentHandler } from '$lib/api/handlers/admin/contents';
import { getDb } from '$lib/server/db';
import { ContentRepository } from '$lib/server/repositories';
import { ContentService } from '$lib/server/services';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async event => {
  const db = getDb(event.platform!.env.DB);
  const repository = new ContentRepository(db);
  const service = new ContentService(repository);

  return createGetContentHandler(service)(event);
};
