// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { AdminIdentity } from '$lib/server/admin/access';
import type { AdminEnvironment } from '$lib/server/admin/environment';

declare global {
  namespace App {
    interface Platform {
      env: Env & AdminEnvironment;
      ctx: ExecutionContext;
      caches: CacheStorage;
      cf?: IncomingRequestCfProperties;
    }

    // interface Error {}
    interface Locals {
      admin?: AdminIdentity;
    }
    // interface PageData {}
    // interface PageState {}
  }
}

export {};
