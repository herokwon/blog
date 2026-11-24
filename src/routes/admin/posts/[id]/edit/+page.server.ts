import { error, redirect } from '@sveltejs/kit';

import { getPost, listCategories } from '../../../../../lib/server/db/posts';
import type { PostAction } from '../../../../../lib/server/posts/domain';
import { revisePost } from '../../../../../lib/server/posts/manage';
import { env } from '../../../../../lib/server/runtime';
import {
  postFormFailure,
  readPostContent,
  readPostForm,
} from '../../form.server';
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

function revise(action: PostAction): Actions[string] {
  return async ({ params, request }) => {
    const values = readPostForm(await request.formData(), params.id);
    const outcome = await revisePost(env.DB, {
      id: params.id,
      version: Number(values.version),
      action,
      content: readPostContent(values),
    }).catch(() => null);
    if (!outcome) {
      return postFormFailure(
        503,
        values,
        '게시글을 저장하지 못했습니다. 다시 시도해 주세요.',
      );
    }
    switch (outcome.result) {
      case 'missing':
        return error(404, '게시글을 찾을 수 없습니다.');
      case 'invalid':
        return postFormFailure(422, values, undefined, outcome.errors);
      case 'category':
        return postFormFailure(409, values, '카테고리를 다시 선택해 주세요.');
      case 'conflict':
        return postFormFailure(
          409,
          values,
          '게시글이 변경됐습니다. 목록에서 최신 글을 다시 열어 주세요.',
        );
      case 'transition':
        return postFormFailure(
          409,
          values,
          '현재 게시글 상태에서는 이 작업을 할 수 없습니다.',
        );
      case 'saved':
        return redirect(303, '/admin/posts');
    }
  };
}

export const actions = {
  save: revise('save'),
  publish: revise('publish'),
  archive: revise('archive'),
} satisfies Actions;
