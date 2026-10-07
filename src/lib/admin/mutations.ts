import {
  adminPostSchema,
  apiErrorResponseSchema,
  type AdminPost,
  type ApiErrorResponse,
  type CreatePostInput,
  type PatchPostInput,
  type PostCommand,
  type RevisionInput,
} from './contracts';

export type MutationRequest =
  | { readonly kind: 'create'; readonly input: Readonly<CreatePostInput> }
  | {
      readonly kind: 'save';
      readonly id: string;
      readonly input: Readonly<PatchPostInput>;
    }
  | {
      readonly kind: PostCommand;
      readonly id: string;
      readonly input: Readonly<RevisionInput>;
    };

export type MutationCause =
  | { kind: 'network' | 'timeout' | 'invalid-response' }
  | { kind: 'http'; status: number; error?: ApiErrorResponse['error'] };

type Context = { request: MutationRequest; id?: string };
export type MutationResult = Context &
  (
    | { kind: 'confirmed'; id: string; post?: AdminPost }
    | { kind: 'observed'; id: string; post: AdminPost }
    | {
        kind: 'conflict' | 'rejected';
        status: number;
        error: ApiErrorResponse['error'];
      }
    | {
        kind: 'unresolved';
        cause: MutationCause;
        post?: AdminPost;
        recoveryCause?: MutationCause;
      }
  );

const rejectionStatuses = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  POST_NOT_FOUND: 404,
  INVALID_POST_STATE: 409,
  POST_VERSION_CONFLICT: 409,
} as const;

function networkCause(error: unknown): MutationCause {
  return {
    kind:
      error instanceof Error &&
      ['AbortError', 'TimeoutError'].includes(error.name)
        ? 'timeout'
        : 'network',
  };
}

async function attempt(
  request: MutationRequest,
  fetcher: typeof fetch,
): Promise<MutationResult> {
  const context: Context =
    request.kind === 'create' ? { request } : { request, id: request.id };
  const path =
    request.kind === 'create'
      ? '/api/admin/posts'
      : `/api/admin/posts/${request.id}`;
  const url = ['publish', 'archive', 'restore'].includes(request.kind)
    ? `${path}/${request.kind}`
    : path;
  let response: Response;
  try {
    response = await fetcher(url, {
      method:
        request.kind === 'save'
          ? 'PATCH'
          : request.kind === 'delete'
            ? 'DELETE'
            : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify(request.input),
    });
  } catch (error) {
    return { ...context, kind: 'unresolved', cause: networkCause(error) };
  }
  const expectedStatus =
    request.kind === 'create' ? 201 : request.kind === 'delete' ? 204 : 200;
  if (response.status === 204 && request.kind === 'delete')
    return { ...context, kind: 'confirmed', id: request.id };
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      ...context,
      kind: 'unresolved',
      cause: response.ok
        ? { kind: 'invalid-response' }
        : { kind: 'http', status: response.status },
    };
  }
  if (response.status === expectedStatus) {
    const parsed = adminPostSchema.safeParse(body);
    if (
      parsed.success &&
      (request.kind === 'create' || parsed.data.id === request.id)
    ) {
      return {
        ...context,
        kind: 'confirmed',
        id: parsed.data.id,
        post: parsed.data,
      };
    }
    return {
      ...context,
      kind: 'unresolved',
      cause: { kind: 'invalid-response' },
    };
  }
  const parsed = apiErrorResponseSchema.safeParse(body);
  if (
    parsed.success &&
    parsed.data.error.code !== 'INTERNAL_ERROR' &&
    rejectionStatuses[parsed.data.error.code] === response.status
  ) {
    return {
      ...context,
      kind:
        parsed.data.error.code === 'POST_VERSION_CONFLICT'
          ? 'conflict'
          : 'rejected',
      status: response.status,
      error: parsed.data.error,
    };
  }
  return {
    ...context,
    kind: 'unresolved',
    cause: {
      kind: 'http',
      status: response.status,
      ...(parsed.success ? { error: parsed.data.error } : {}),
    },
  };
}

/** The returned snapshot remains suitable for manual retry even if the caller edits its input. */
export async function runMutation(
  request: MutationRequest,
  fetcher: typeof fetch,
): Promise<MutationResult> {
  const snapshot = Object.freeze({
    ...request,
    input: Object.freeze({ ...request.input }),
  }) as MutationRequest;
  return attempt(snapshot, fetcher);
}
