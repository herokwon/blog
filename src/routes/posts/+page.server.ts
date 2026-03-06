import type { ListPostsApiResponse } from '$lib/types/api';
import type { Post } from '$lib/types/post';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
  const res = await fetch('/api/posts');
  const response: ListPostsApiResponse = await res.json();

  if (!response.success) {
    return { posts: [] as Post[], loadError: response.error.message };
  }

  return { posts: response.data };
};
