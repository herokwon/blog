// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      author?: import('#lib/server/auth/access.js').Author;
    }
    // interface PageData {}
    // interface PageState {}
  }
  namespace Cloudflare {
    interface Env {
      ACCESS_ISSUER?: string;
      ACCESS_AUD?: string;
      AUTHOR_EMAIL?: string;
    }
  }
}

export {};
