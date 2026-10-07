import type { RequestEvent } from '@sveltejs/kit';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { adminEnvironment, isLocalAdminEnabled } from './environment';
import { AdminApiError } from './errors';

export type AdminIdentity = { email: string };
// This cache contains only public verification keys, never a user's identity.
let certificates:
  { issuer: string; keys: ReturnType<typeof createRemoteJWKSet> } | undefined;

export async function authenticateAdmin(
  event: RequestEvent,
): Promise<AdminIdentity> {
  if (isLocalAdminEnabled(event))
    return { email: 'local-admin@example.invalid' };
  const token = event.request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token)
    throw new AdminApiError(
      401,
      'UNAUTHORIZED',
      'Admin authentication is required.',
    );

  const {
    ACCESS_ISSUER: issuer,
    ACCESS_AUDIENCE: audience,
    ADMIN_EMAILS: emails,
  } = adminEnvironment(event);
  let validIssuer = false;
  try {
    const url = new URL(issuer ?? '');
    validIssuer =
      url.protocol === 'https:' &&
      url.origin === issuer &&
      /^[a-z0-9-]+\.cloudflareaccess\.com$/.test(url.hostname);
  } catch {
    /* Reject configuration that could fetch an untrusted key server. */
  }
  const allowlist = emails
    ?.split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
  if (!validIssuer || !issuer || !audience?.trim() || !allowlist?.length) {
    throw new AdminApiError(
      500,
      'INTERNAL_ERROR',
      'Admin authentication is not configured.',
    );
  }
  if (certificates?.issuer !== issuer) {
    certificates = {
      issuer,
      keys: createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)),
    };
  }

  let email: string;
  try {
    const { payload } = await jwtVerify(token, certificates.keys, {
      issuer,
      audience,
      algorithms: ['RS256'],
      requiredClaims: ['exp', 'iat', 'sub', 'email'],
    });
    if (
      typeof payload.email !== 'string' ||
      !payload.email.includes('@') ||
      payload.email.trim() !== payload.email
    ) {
      throw new Error('Invalid email claim');
    }
    email = payload.email.toLowerCase();
  } catch {
    throw new AdminApiError(
      401,
      'UNAUTHORIZED',
      'Admin authentication could not be verified.',
    );
  }
  if (!allowlist.includes(email)) {
    throw new AdminApiError(
      403,
      'FORBIDDEN',
      'This identity cannot access Admin.',
    );
  }
  return { email };
}
