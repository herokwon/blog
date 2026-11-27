import { fail } from '@sveltejs/kit';

import { splitTags } from '../../../lib/admin-input';
import {
  validatePostContent,
  type PostErrors,
  type PostStatus,
} from '../../../lib/server/posts/domain';

export function readPostForm(form: FormData, id: string) {
  function text(name: string) {
    const value = form.get(name);
    return typeof value === 'string' ? value : '';
  }

  return {
    id,
    title: text('title'),
    body: text('body'),
    categoryId: text('categoryId'),
    tags: text('tags'),
    version: text('version'),
  };
}

type Values = ReturnType<typeof readPostForm>;

export function readPostContent(values: Values) {
  return {
    title: values.title,
    body: values.body,
    categoryId: Number(values.categoryId),
    tags: splitTags(values.tags),
  };
}

export function validateForm(values: Values, status: PostStatus) {
  return validatePostContent(readPostContent(values), status);
}

export function postFormFailure(
  status: 409 | 422 | 503,
  values: Values,
  message?: string,
  errors: PostErrors = {},
) {
  return fail(status, { values, errors, message });
}
