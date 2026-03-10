import type { RequestEvent } from '@sveltejs/kit';

export type MockBucket = {
  put?: (key: string, value: string) => void;
  get?: (key: string) => Promise<{ json: <T>() => Promise<T> } | null>;
  delete?: (key: string) => void;
  list?: (options?: { cursor?: string }) => Promise<{
    objects: { key: string }[];
    truncated: boolean;
    cursor?: string;
  }>;
};

export function createMockPlatform(bucketImpl?: MockBucket) {
  return {
    env: {
      BLOG: bucketImpl,
    },
    ctx: {},
    caches: {},
  };
}

export function createMockEvent({
  request,
  platform,
  postId = '',
  routeId,
}: {
  request: Request;
  platform?: object;
  postId?: string;
  routeId: string;
}): RequestEvent {
  return {
    request,
    platform,
    cookies: {
      get: () => undefined,
      getAll: () => [],
      set: () => {},
      delete: () => {},
      serialize: () => '',
    },
    fetch: global.fetch,
    getClientAddress: () => '',
    locals: {},
    params: { id: postId },
    route: { id: routeId },
    url: new URL(request.url),
    setHeaders: () => {},
    isDataRequest: false,
    isSubRequest: false,
    tracing: { enabled: false, root: null, current: null },
    isRemoteRequest: false,
  } as RequestEvent;
}
