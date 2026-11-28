import { error } from '@sveltejs/kit';

import {
  listPublishedPosts,
  publicPageSize,
} from '../../lib/server/db/public-posts';
import { env } from '../../lib/server/runtime';

export async function loadPostList(url: URL) {
  const values = url.searchParams.getAll('page');
  const value = values[0] ?? '1';
  const pageNumber = Number(value);
  if (
    values.length > 1 ||
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger((pageNumber - 1) * publicPageSize)
  ) {
    error(404);
  }

  const result = await listPublishedPosts(env.DB, pageNumber).catch(() =>
    error(503),
  );
  if (pageNumber > 1 && !result.posts.length) error(404);
  return { ...result, pageNumber };
}
