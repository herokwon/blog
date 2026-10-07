import { error, type RequestEvent } from '@sveltejs/kit';
import { getDb, type BlogDb } from '$lib/server/db';
import { AdminApiError } from './errors';

/** Page loaders share API validation and persistence, with Kit page errors. */
export async function adminPage<T>(
  event: RequestEvent,
  read: (db: BlogDb) => Promise<T>,
): Promise<T> {
  if (!event.locals.admin) error(401, 'Admin authentication is required.');
  if (!event.platform?.env.DB)
    error(500, 'The Admin page could not be loaded.');
  try {
    return await read(getDb(event.platform.env.DB));
  } catch (failure) {
    if (failure instanceof AdminApiError)
      error(failure.status, failure.message);
    error(500, 'The Admin page could not be loaded.');
  }
}
