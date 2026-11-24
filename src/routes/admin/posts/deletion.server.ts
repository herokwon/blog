import { error, fail, redirect } from '@sveltejs/kit';

import { setPostDeletion } from '../../../lib/server/db/posts';
import { env } from '../../../lib/server/runtime';
import { positiveInteger, readFormText } from '../form-values.server';

export async function changePostDeletion(
  request: Request,
  action: 'delete' | 'restore',
  pathId?: string,
) {
  const form = await request.formData();
  const id = pathId ?? readFormText(form, 'id');
  const version = positiveInteger(readFormText(form, 'version'));
  if (!id || version === undefined) {
    return fail(422, { id, error: '게시글을 다시 열고 시도해 주세요.' });
  }

  const result = await setPostDeletion(env.DB, id, version, action).catch(
    () => null,
  );
  switch (result) {
    case 'missing':
      return error(404, '게시글을 찾을 수 없습니다.');
    case 'conflict':
      return fail(409, {
        id,
        error: '게시글이 변경됐습니다. 최신 상태를 확인해 주세요.',
      });
    case null:
      return fail(503, {
        id,
        error: '게시글 상태를 변경하지 못했습니다. 다시 시도해 주세요.',
      });
    case 'saved':
      return redirect(
        303,
        action === 'delete' ? '/admin/posts' : '/admin/trash',
      );
  }
}
