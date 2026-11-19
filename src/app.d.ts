// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      identity?: import('./lib/server/access').Identity;
    }
    // interface PageData {}
    // interface PageState {}
  }
}

export {};
