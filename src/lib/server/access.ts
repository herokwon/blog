import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export interface AccessConfig {
  ACCESS_ISSUER?: string;
  ACCESS_AUDIENCE?: string;
  ADMIN_EMAIL?: string;
  CI_ACCESS_CLIENT_ID?: string;
}

export type Identity = { kind: 'admin'; email: string } | { kind: 'service' };

const resolvers = new Map<string, JWTVerifyGetKey>();

export async function authorize(
  request: Request,
  config: AccessConfig,
  allowService: boolean,
  resolveKey?: JWTVerifyGetKey,
): Promise<Identity | null> {
  const { ACCESS_ISSUER: issuer, ACCESS_AUDIENCE: audience } = config;
  if (
    !issuer ||
    !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer) ||
    !audience ||
    !config.ADMIN_EMAIL
  )
    return null;
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return null;
  try {
    let key = resolveKey ?? resolvers.get(issuer);
    if (!key) {
      key = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), {
        timeoutDuration: 5000,
      });
      resolvers.set(issuer, key);
    }
    const { payload } = await jwtVerify(token, key, {
      issuer,
      audience,
      algorithms: ['RS256'],
      requiredClaims: ['exp', 'iat', 'iss', 'aud'],
    });
    if (payload.common_name !== undefined) {
      return allowService &&
        config.CI_ACCESS_CLIENT_ID &&
        payload.common_name === config.CI_ACCESS_CLIENT_ID
        ? { kind: 'service' }
        : null;
    }
    return payload.email === config.ADMIN_EMAIL &&
      typeof payload.sub === 'string' &&
      payload.sub.length > 0
      ? { kind: 'admin', email: config.ADMIN_EMAIL }
      : null;
  } catch {
    return null;
  }
}
