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

/** Bounds headers and body consumption; aborting cannot prove the server rolled back. */
async function readResponse(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
  empty = false,
): Promise<{ response: Response; body: unknown }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new DOMException('Request timed out.', 'TimeoutError'));
      controller.abort();
    }, 30_000);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(url, {
          ...init,
          signal: controller.signal,
        });
        if (
          (empty && response.status === 204) ||
          response.status >= 500 ||
          (init.method === 'GET' && response.status !== 200)
        )
          return { response, body: undefined };
        try {
          return { response, body: (await response.json()) as unknown };
        } catch (error) {
          if (response.ok && !(error instanceof SyntaxError)) throw error;
          return { response, body: undefined };
        }
      })(),
      timeout,
    ]);
  } finally {
    clearTimeout(timer!);
  }
}

/** Explicit conflict reload shares the same bounded headers/body read as mutation recovery. */
export async function readAdminPost(
  id: string,
  fetcher: typeof fetch,
): Promise<AdminPost> {
  const { response, body } = await readResponse(
    fetcher,
    `/api/admin/posts/${id}`,
    {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    },
  );
  if (response.status !== 200) throw new Error('Post could not be loaded.');
  const post = adminPostSchema.parse(body);
  if (post.id !== id) throw new Error('Post identity does not match.');
  return post;
}

async function attempt(
  request: MutationRequest,
  fetcher: typeof fetch,
): Promise<Exclude<MutationResult, { kind: 'observed' }>> {
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
  let body: unknown;
  try {
    ({ response, body } = await readResponse(
      fetcher,
      url,
      {
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
      },
      request.kind === 'delete',
    ));
  } catch (error) {
    return { ...context, kind: 'unresolved', cause: networkCause(error) };
  }
  const expectedStatus =
    request.kind === 'create' ? 201 : request.kind === 'delete' ? 204 : 200;
  if (response.status === 204 && request.kind === 'delete')
    return { ...context, kind: 'confirmed', id: request.id };
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
  const first = await attempt(snapshot, fetcher);
  if (
    snapshot.kind === 'create' ||
    first.kind !== 'unresolved' ||
    !retryable(first.cause)
  )
    return first;
  await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
  const retry = await attempt(snapshot, fetcher);
  if (retry.kind === 'confirmed') return retry;
  // A later rejection cannot tell us whether the earlier uncertain attempt committed.
  const cause: MutationCause =
    retry.kind === 'unresolved'
      ? retry.cause
      : { kind: 'http', status: retry.status, error: retry.error };
  return inspect(snapshot, cause, fetcher);
}

function retryable(cause: MutationCause): boolean {
  return (
    cause.kind === 'network' ||
    cause.kind === 'timeout' ||
    (cause.kind === 'http' && [502, 503, 504].includes(cause.status))
  );
}

function matches(
  request: Exclude<MutationRequest, { kind: 'create' }>,
  post: AdminPost,
): boolean {
  switch (request.kind) {
    case 'save':
      return (
        (request.input.title === undefined ||
          request.input.title === post.title) &&
        (request.input.body === undefined || request.input.body === post.body)
      );
    case 'publish':
      return post.status === 'published' && post.deleted_at === null;
    case 'archive':
      return post.status === 'archived' && post.deleted_at === null;
    case 'delete':
      return post.deleted_at !== null;
    case 'restore':
      return post.deleted_at === null;
  }
}

async function inspect(
  request: Exclude<MutationRequest, { kind: 'create' }>,
  cause: MutationCause,
  fetcher: typeof fetch,
): Promise<MutationResult> {
  const context = { request, id: request.id, cause };
  let response: Response;
  let body: unknown;
  try {
    ({ response, body } = await readResponse(
      fetcher,
      `/api/admin/posts/${request.id}`,
      {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      },
    ));
  } catch (error) {
    return {
      ...context,
      kind: 'unresolved',
      recoveryCause: networkCause(error),
    };
  }
  if (response.status !== 200)
    return {
      ...context,
      kind: 'unresolved',
      recoveryCause: { kind: 'http', status: response.status },
    };
  try {
    const parsed = adminPostSchema.safeParse(body);
    if (!parsed.success || parsed.data.id !== request.id)
      return {
        ...context,
        kind: 'unresolved',
        recoveryCause: { kind: 'invalid-response' },
      };
    if (matches(request, parsed.data))
      return { request, id: request.id, kind: 'observed', post: parsed.data };
    return { ...context, kind: 'unresolved', post: parsed.data };
  } catch {
    return {
      ...context,
      kind: 'unresolved',
      recoveryCause: { kind: 'invalid-response' },
    };
  }
}
