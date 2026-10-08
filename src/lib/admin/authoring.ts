import type { AdminPost, AuthoringInput, PatchPostInput } from './contracts';
import {
  runMutation,
  type MutationRequest,
  type MutationResult,
} from './mutations';

export type AuthoringState = {
  input: AuthoringInput;
  base: AdminPost | null;
  bodyDirty: boolean;
  created: AdminPost | null;
  pending: boolean;
  request: MutationRequest | null;
  submitted: AuthoringInput | null;
  result: MutationResult | null;
  destination: string | null;
};

export function createAuthoringState(post?: AdminPost): AuthoringState {
  return {
    input: { title: post?.title ?? '', body: post?.body ?? '' },
    base: post ?? null,
    bodyDirty: false,
    created: null,
    pending: false,
    request: null,
    submitted: null,
    result: null,
    destination: null,
  };
}

export function buildSaveInput(state: AuthoringState): PatchPostInput {
  if (!state.base) throw new Error('A saved post is required.');
  return {
    title: state.input.title,
    expected_revision: state.base.revision,
    ...(state.bodyDirty ? { body: state.input.body } : {}),
  };
}

/** The caller serializes edited body before submission, and owns recovery cleanup/navigation. */
export async function submitAuthoring(
  state: AuthoringState,
  intent: 'save' | 'publish' | 'retry',
  fetcher: typeof fetch,
): Promise<void> {
  if (state.pending) return;
  if (intent === 'retry' && (!state.request || state.request.kind === 'create'))
    return;
  const submitted = intent === 'retry' ? state.submitted! : { ...state.input };
  const request: MutationRequest =
    intent === 'retry'
      ? state.request!
      : state.base
        ? { kind: 'save', id: state.base.id, input: buildSaveInput(state) }
        : state.created
          ? {
              kind: 'publish',
              id: state.created.id,
              input: { expected_revision: state.created.revision },
            }
          : { kind: 'create', input: { ...submitted } };
  state.pending = true;
  state.destination = null;
  state.submitted = { ...submitted };
  const unchanged = () =>
    state.input.title === submitted.title &&
    state.input.body === submitted.body;
  try {
    let result = await runMutation(request, fetcher);
    if (
      result.kind === 'confirmed' &&
      result.post &&
      request.kind === 'create'
    ) {
      state.created = result.post;
      state.base = result.post;
      state.bodyDirty = state.input.body !== result.post.body;
      if (intent === 'publish') {
        result = await runMutation(
          {
            kind: 'publish',
            id: result.post.id,
            input: { expected_revision: result.post.revision },
          },
          fetcher,
        );
        if (
          (result.kind === 'confirmed' || result.kind === 'observed') &&
          result.post
        ) {
          state.base = result.post;
          state.created = result.post;
        }
        if (unchanged())
          state.destination =
            result.kind === 'confirmed'
              ? `/admin/posts/${state.created.id}`
              : result.kind === 'observed'
                ? `/admin/posts/${state.created.id}/edit`
                : `/admin/posts/${state.created.id}/edit?publication=${result.kind === 'unresolved' ? 'unconfirmed' : 'failed'}`;
      } else if (unchanged())
        state.destination = `/admin/posts/${state.created.id}/edit`;
    } else if (
      (result.kind === 'confirmed' || result.kind === 'observed') &&
      result.post
    ) {
      if (state.base) {
        state.base = result.post;
        state.bodyDirty = state.input.body !== result.post.body;
      } else state.created = result.post;
      if (result.kind === 'confirmed' && unchanged())
        state.destination = `/admin/posts/${result.id}`;
    }
    state.result = result;
    state.request = result.request;
  } finally {
    state.pending = false;
  }
}
