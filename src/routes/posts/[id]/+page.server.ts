import { error } from '@sveltejs/kit';

import type { GetPostByIdApiResponse } from '$lib/types/api';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, params }) => {
  const res = await fetch(`/api/posts/${params.id}`);
  const response: GetPostByIdApiResponse = await res.json();

  if (!response.success) {
    if (res.status === 404) {
      error(404, 'Post not found');
    }
    error(500, response.error.message);
  }

  return { post: response.data };
};
