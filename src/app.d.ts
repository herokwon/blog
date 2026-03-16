// See https://svelte.dev/docs/kit/types#app.d.ts
import type { PublicUser, Session } from '$lib/types/auth';

// for information about these interfaces
declare global {
  namespace App {
    interface Platform {
      env: Env;
      ctx: ExecutionContext;
      caches: CacheStorage;
      cf?: IncomingRequestCfProperties;
    }

    // interface Error {}
    interface Locals {
      user: Pick<PublicUser, 'id' | 'username' | 'role'> | null;
      session: Pick<Session, 'id' | 'expiresAt'> | null;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
