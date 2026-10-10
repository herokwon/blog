import type { RequestEvent } from '@sveltejs/kit';
import { dev } from '$app/env';
import { env } from 'cloudflare:workers';
import { AdminApiError } from './errors';

export interface AdminEnvironment {
  ADMIN_ORIGIN?: string;
  ACCESS_ISSUER?: string;
  ACCESS_AUDIENCE?: string;
  ADMIN_EMAILS?: string;
  ADMIN_LOCAL_AUTH?: string;
}

export function adminEnvironment(): AdminEnvironment {
  return env;
}

export function isAdminPath(path: string): boolean {
  // Match SvelteKit's decode_pathname semantics before route matching:
  // decode letters, but retain encoded reserved characters and percent signs.
  try {
    path = path.split('%25').map(decodeURI).join('%25');
  } catch {
    return false;
  } // The router also rejects malformed URI encoding.
  return ['/admin', '/api/admin'].some(
    prefix => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function isLocalAdminEnabled(event: RequestEvent): boolean {
  // SvelteKit replaces dev with false in every production bundle. Neither a
  // forged Host nor a mistakenly deployed local flag can enable this branch.
  return (
    dev &&
    ['localhost', '127.0.0.1', '[::1]'].includes(event.url.hostname) &&
    adminEnvironment().ADMIN_LOCAL_AUTH === 'true'
  );
}

export function assertAdminMutationAllowed(event: RequestEvent): void {
  const expected = isLocalAdminEnabled(event)
    ? event.url.origin
    : adminEnvironment().ADMIN_ORIGIN;
  const origin = event.request.headers.get('origin');
  let validOrigin = false;
  try {
    const parsed = new URL(origin ?? '');
    validOrigin =
      ['https:', 'http:'].includes(parsed.protocol) && parsed.origin === origin;
  } catch {
    /* Missing and malformed origins fail closed. */
  }

  // Only the explicitly configured production origin permits deployed writes.
  // All other hosts (including Version URLs and workers.dev aliases) are read-only.
  if (
    !expected ||
    event.url.origin !== expected ||
    origin !== expected ||
    !validOrigin
  ) {
    throw new AdminApiError(
      403,
      'FORBIDDEN',
      'Admin mutations require the trusted application origin.',
    );
  }
}
