// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { AdminIdentity } from '#lib/server/admin/access.ts';
import type { AdminEnvironment } from '#lib/server/admin/environment.ts';

declare global {
  namespace Cloudflare {
    // Merge application secrets with Wrangler's generated binding types.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Env extends AdminEnvironment {}
  }
  namespace App {
    // interface Error {}
    interface Locals {
      admin?: AdminIdentity;
    }
    // interface PageData {}
    // interface PageState {}
  }
}

export {};
