import { error } from '@sveltejs/kit';

import {
  listPublishedPosts,
  publicPageSize,
  type PublishedTopic,
} from '../../lib/server/db/public-posts';
import { env } from '../../lib/server/runtime';

export async function loadPostList(url: URL, topic?: PublishedTopic) {
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

  const result = await listPublishedPosts(env.DB, pageNumber, topic).catch(() =>
    error(503),
  );
  if ((topic || pageNumber > 1) && !result.posts.length) error(404);
  return { ...result, pageNumber };
}
