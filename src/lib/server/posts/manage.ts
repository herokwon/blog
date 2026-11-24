import { getPost, updatePost } from '../db/posts';
import {
  resolvePostStatus,
  validatePostContent,
  type PostAction,
  type PostContent,
  type PostErrors,
} from './domain';

type PostRevision = {
  id: string;
  version: number;
} & (
  | { action: 'save'; content: PostContent }
  | { action: Exclude<PostAction, 'save'> }
);

type RevisionResult =
  | { result: 'saved' | 'missing' | 'conflict' | 'category' | 'transition' }
  | { result: 'invalid'; errors: PostErrors };

export async function revisePost(
  d1: D1Database,
  revision: PostRevision,
  now = new Date(),
): Promise<RevisionResult> {
  const { id, version, action } = revision;
  const current = await getPost(d1, id);
  if (!current) return { result: 'missing' };
  if (version !== current.version) return { result: 'conflict' };

  const status = resolvePostStatus(current.status, action);
  if (status === null) return { result: 'transition' };

  const validated = validatePostContent(
    revision.action === 'save' ? revision.content : current,
    status,
    current.tags,
  );
  if (!validated.valid) return { result: 'invalid', errors: validated.errors };

  return {
    result: await updatePost(
      d1,
      { ...validated.content, id, version, status },
      now,
    ),
  };
}
