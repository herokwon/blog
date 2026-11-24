export const postStatuses = ['draft', 'published', 'archived'] as const;
export type PostStatus = (typeof postStatuses)[number];
export type PostAction = 'save' | 'publish' | 'archive';

export const postTitleLimit = 200;
const postBodyByteLimit = 256 * 1024;

export interface PostContent {
  title: string;
  body: string;
  categoryId: number;
  tags: string[];
}

type FieldError = 'required' | 'tooLong' | 'invalid' | 'duplicate';
export type PostErrors = Partial<Record<keyof PostContent, FieldError>>;

export function resolvePostStatus(
  current: PostStatus | null,
  action: PostAction,
): PostStatus | null {
  switch (action) {
    case 'save':
      return current ?? 'draft';
    case 'publish':
      return current === 'published' ? null : 'published';
    case 'archive':
      return current === 'published' ? 'archived' : null;
  }
}

export function validatePostContent(
  input: PostContent,
  status: PostStatus,
):
  { valid: true; content: PostContent } | { valid: false; errors: PostErrors } {
  const title = input.title.trim();
  const { body, categoryId } = input;
  // Fold ASCII letters only, keeping other scripts subject to the allowlist.
  const tags = input.tags.map(tag =>
    tag
      .trim()
      .normalize('NFC')
      .replace(/[A-Z]/g, letter => letter.toLowerCase()),
  );
  const errors: PostErrors = {};
  if (!title) {
    errors.title = 'required';
  } else if ([...title].length > postTitleLimit) {
    errors.title = 'tooLong';
  }
  if (status !== 'draft' && !body.trim()) {
    errors.body = 'required';
  } else if (new TextEncoder().encode(body).length > postBodyByteLimit) {
    errors.body = 'tooLong';
  }
  if (!Number.isSafeInteger(categoryId) || categoryId < 1) {
    errors.categoryId = 'required';
  }
  if (tags.some(tag => !/^[가-힣a-z0-9]+$/u.test(tag))) {
    errors.tags = 'invalid';
  } else if (new Set(tags).size !== tags.length) {
    errors.tags = 'duplicate';
  }
  return Object.keys(errors).length
    ? { valid: false, errors }
    : { valid: true, content: { title, body, categoryId, tags } };
}
