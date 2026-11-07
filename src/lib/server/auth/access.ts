import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export type AccessConfig = {
  ACCESS_ISSUER: string;
  ACCESS_AUD: string;
  AUTHOR_EMAIL: string;
};
export type Author = { subject: string; email: string };
export class AccessError extends Error {
  readonly status: number;
  constructor(status: number) {
    super('Administrator access denied');
    this.status = status;
  }
}
const resolvers = new Map<string, JWTVerifyGetKey>();
const loopback = (host: string) =>
  ['localhost', '127.0.0.1', '[::1]'].includes(host);

export function isAdminPath(path: string): boolean {
  try {
    path = decodeURIComponent(path);
  } catch {
    throw new AccessError(400);
  }
  return path === '/admin' || path.startsWith('/admin/');
}

export async function authorizeAdminRequest(
  request: Request,
  config: Partial<AccessConfig>,
  keys?: JWTVerifyGetKey,
): Promise<Author> {
  const {
    ACCESS_ISSUER: issuer,
    ACCESS_AUD: audience,
    AUTHOR_EMAIL: email,
  } = config;
  if (
    !issuer ||
    !audience?.trim() ||
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
    throw new AccessError(503);
  let issuerUrl: URL;
  try {
    issuerUrl = new URL(issuer);
  } catch {
    throw new AccessError(503);
  }
  const url = new URL(request.url);
  if (
    issuerUrl.origin !== issuer ||
    (issuerUrl.protocol !== 'https:' &&
      !(
        issuerUrl.protocol === 'http:' &&
        loopback(issuerUrl.hostname) &&
        loopback(url.hostname)
      ))
  )
    throw new AccessError(503);
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
    request.headers.get('origin') !== url.origin
  )
    throw new AccessError(403);
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) throw new AccessError(401);
  if (token.length > 16384) throw new AccessError(403);
  try {
    if (!keys) {
      keys = resolvers.get(issuer);
      if (!keys) {
        keys = createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer), {
          timeoutDuration: 5000,
        });
        resolvers.set(issuer, keys);
      }
    }
    const { payload } = await jwtVerify(token, keys, {
      issuer,
      audience,
      algorithms: ['RS256'],
      requiredClaims: ['exp', 'iat', 'sub', 'email'],
    });
    if (
      payload.email !== email ||
      typeof payload.sub !== 'string' ||
      !payload.sub
    )
      throw new AccessError(403);
    return { subject: payload.sub, email };
  } catch {
    throw new AccessError(403);
  }
}
