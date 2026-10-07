// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
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
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
  }
}

export {};
