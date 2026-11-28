import { error } from '@sveltejs/kit';

import { findPublishedPost } from '../../../../lib/server/db/public-posts';
import { renderPublicPostMarkdown } from '../../../../lib/server/posts/markdown';
import { env } from '../../../../lib/server/runtime';
import type { PageServerLoad } from './$types';

export const load = (async ({ params }) => {
  const post = await findPublishedPost(env.DB, params.id).catch(() =>
    error(503),
  );
  if (!post) error(404);
  const { body, ...detail } = post;
  return { post: { ...detail, html: renderPublicPostMarkdown(body) } };
}) satisfies PageServerLoad;
