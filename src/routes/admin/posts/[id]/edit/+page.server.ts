import { error, isHttpError, redirect } from '@sveltejs/kit';

import {
  getPost,
  listCategories,
  updatePost,
} from '../../../../../lib/server/db/posts';
import { env } from '../../../../../lib/server/runtime';
import { postFormFailure, readPostForm, validateForm } from '../../form.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const result = await Promise.all([
    getPost(env.DB, params.id),
    listCategories(env.DB),
  ]).catch(() => null);
  // A native failed POST renders this load alongside the submitted form values.
  if (!result) return { post: null, categories: null };
  const [post, categories] = result;
  if (!post) error(404, '게시글을 찾을 수 없습니다.');
  return { post, categories };
};

export const actions = {
  async save({ params, request }) {
    const values = readPostForm(await request.formData(), params.id);
    const version = Number(values.version);

    try {
      const post = await getPost(env.DB, params.id);
      if (!post) error(404, '게시글을 찾을 수 없습니다.');
      if (!Number.isSafeInteger(version) || version !== post.version) {
        return postFormFailure(
          409,
          values,
          '게시글이 변경됐습니다. 목록에서 최신 글을 다시 열어 주세요.',
        );
      }
      const input = validateForm(values, post.status);
      if (!input.valid)
        return postFormFailure(422, values, undefined, input.errors);
      const result = await updatePost(env.DB, {
        ...input.content,
        id: params.id,
        version,
        status: post.status,
      });
      if (result === 'category')
        return postFormFailure(409, values, '카테고리를 다시 선택해 주세요.');
      if (result === 'conflict')
        return postFormFailure(
          409,
          values,
          '게시글이 변경됐습니다. 목록에서 최신 글을 다시 열어 주세요.',
        );
    } catch (cause) {
      if (isHttpError(cause, 404)) throw cause;
      return postFormFailure(
        503,
        values,
        '게시글을 저장하지 못했습니다. 다시 시도해 주세요.',
      );
    }
    redirect(303, '/admin/posts');
  },
} satisfies Actions;
