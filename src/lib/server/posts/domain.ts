import { normalizeTag, validateTags } from '../../admin-input';

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

type FieldError = 'required' | 'tooLong' | 'invalid' | 'duplicate' | 'tooMany';
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
  existingTags?: string[],
):
  { valid: true; content: PostContent } | { valid: false; errors: PostErrors } {
  const title = input.title.trim();
  const { body, categoryId } = input;
  const tags = input.tags.map(normalizeTag);
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
  const tagError = validateTags(tags, existingTags);
  if (tagError) errors.tags = tagError;
  return Object.keys(errors).length
    ? { valid: false, errors }
    : { valid: true, content: { title, body, categoryId, tags } };
}
