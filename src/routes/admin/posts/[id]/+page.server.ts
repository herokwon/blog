import { error, fail, redirect } from '@sveltejs/kit';

import { revisePost } from '../../../../lib/server/posts/manage';
import { getPostDetail } from '../../../../lib/server/posts/markdown';
import { env } from '../../../../lib/server/runtime';
import { positiveInteger, readFormText } from '../../form-values.server';
import { changePostDeletion } from '../deletion.server';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ params, request }) => {
  const post = await getPostDetail(env.DB, params.id).catch(() => null);
  // After a failed native POST, preserve the action status when reloading.
  if (!post && request.method !== 'POST') {
    if (post === null) error(503, '게시글을 불러오지 못했습니다.');
    error(404, '게시글을 찾을 수 없습니다.');
  }
  return { post: post ?? null };
}) satisfies PageServerLoad;

function transition(action: 'publish' | 'archive'): Actions[string] {
  return async ({ params, request }) => {
    const version = positiveInteger(
      readFormText(await request.formData(), 'version'),
    );
    if (version === undefined)
      return fail(422, { error: '게시글을 다시 열고 시도해 주세요.' });
    const result = await revisePost(env.DB, {
      id: params.id,
      version,
      action,
    }).catch(() => null);
    switch (result?.result) {
      case 'saved':
        return redirect(303, `/admin/posts/${encodeURIComponent(params.id)}`);
      case 'missing':
        return error(404, '게시글을 찾을 수 없습니다.');
      case 'conflict':
        return fail(409, {
          error: '게시글이 변경됐습니다. 최신 상태를 확인해 주세요.',
        });
      case 'transition':
        return fail(409, {
          error: '현재 게시글 상태에서는 이 작업을 할 수 없습니다.',
        });
      case 'category':
        return fail(409, {
          error: '수정 화면에서 카테고리를 다시 선택해 주세요.',
        });
      case 'invalid':
        return fail(422, {
          error:
            result.errors.body === 'required'
              ? '발행하려면 수정 화면에서 본문을 먼저 입력해 주세요.'
              : '발행하려면 수정 화면에서 입력을 확인해 주세요.',
        });
      default:
        return fail(503, {
          error: '게시글 상태를 변경하지 못했습니다. 다시 시도해 주세요.',
        });
    }
  };
}

export const actions = {
  publish: transition('publish'),
  archive: transition('archive'),
  delete: ({ request, params }) =>
    changePostDeletion(request, 'delete', params.id),
} satisfies Actions;
