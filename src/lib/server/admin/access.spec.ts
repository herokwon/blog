import type { RequestEvent } from '@sveltejs/kit';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticateAdmin } from './access';

const fixture = vi.hoisted(() => ({
  dev: false,
  jwks: { keys: [] as Record<string, unknown>[] },
}));
vi.mock('$app/environment', () => fixture);
// Only the external certificate fetch is substituted. Signature and claims
// validation still execute in jose against freshly generated asymmetric keys.
vi.mock('jose', async importOriginal => {
  const jose = await importOriginal<typeof import('jose')>();
  return {
    ...jose,
    createRemoteJWKSet: (url: URL) =>
      jose.createRemoteJWKSet(url, {
        [jose.customFetch]: async input => {
          if (
            String(input) !==
            'https://test.cloudflareaccess.com/cdn-cgi/access/certs'
          )
            throw new Error('Unexpected certificate endpoint');
          return new Response(JSON.stringify(fixture.jwks), {
            headers: { 'Content-Type': 'application/json' },
          });
        },
      }),
  };
});

const issuer = 'https://test.cloudflareaccess.com';
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let wrongKeys: Awaited<ReturnType<typeof generateKeyPair>>;
function event(token?: string, emailHeader = 'admin@example.test') {
  const headers = new Headers({
    'Cf-Access-Authenticated-User-Email': emailHeader,
  });
  if (token) headers.set('Cf-Access-Jwt-Assertion', token);
  const url = new URL('https://blog.example/admin/posts');
  return {
    url,
    request: new Request(url, { headers }),
    locals: {},
    platform: {
      env: {
        ACCESS_ISSUER: issuer,
        ACCESS_AUDIENCE: 'admin-app',
        ADMIN_EMAILS: 'admin@example.test',
        ADMIN_LOCAL_AUTH: 'true',
      },
    },
  } as unknown as RequestEvent;
}
async function token(
  claims: Record<string, unknown> = {},
  signingKey?: CryptoKey,
) {
  return new SignJWT({
    iss: issuer,
    aud: 'admin-app',
    sub: 'user-id',
    email: 'admin@example.test',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'access-key' })
    .sign(signingKey ?? keys.privateKey);
}
describe('verified Access identity', () => {
  beforeAll(async () => {
    keys = await generateKeyPair('RS256', { extractable: true });
    wrongKeys = await generateKeyPair('RS256');
    fixture.jwks = {
      keys: [
        {
          ...(await exportJWK(keys.publicKey)),
          kid: 'access-key',
          alg: 'RS256',
          use: 'sig',
        },
      ],
    };
  });
  beforeEach(() => {
    fixture.dev = false;
  });

  it('ignores a forged identity header without a JWT', async () => {
    await expect(authenticateAdmin(event())).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });
  });
  it('returns only the verified allowlisted identity', async () => {
    await expect(
      authenticateAdmin(event(await token(), 'forged@example.test')),
    ).resolves.toEqual({ email: 'admin@example.test' });
  });
  it('rejects invalid signatures', async () => {
    await expect(
      authenticateAdmin(event(await token({}, wrongKeys.privateKey))),
    ).rejects.toMatchObject({ status: 401 });
  });
  it.each([
    { iss: 'https://other.cloudflareaccess.com' },
    { aud: 'other-app' },
    { exp: 1 },
    { nbf: 4102444800 },
    { email: null },
    { exp: undefined },
    { iat: undefined },
  ])('rejects invalid or missing claims: %j', async claims => {
    await expect(
      authenticateAdmin(event(await token(claims))),
    ).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  });
  it('rejects a valid identity outside the allowlist', async () => {
    await expect(
      authenticateAdmin(event(await token({ email: 'other@example.test' }))),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });
  it('does not leak identity across concurrent requests', async () => {
    const good = event(await token());
    const other = event(await token({ email: 'other@example.test' }));
    const outcomes = await Promise.allSettled([
      authenticateAdmin(good),
      authenticateAdmin(other),
    ]);
    expect(outcomes[0]).toEqual({
      status: 'fulfilled',
      value: { email: 'admin@example.test' },
    });
    expect(outcomes[1]).toMatchObject({
      status: 'rejected',
      reason: { status: 403 },
    });
    expect(good.locals).toEqual({});
    expect(other.locals).toEqual({});
  });
  it('uses a fixed test identity only on an explicitly enabled dev loopback', async () => {
    fixture.dev = true;
    const local = event();
    local.url = new URL('http://localhost:5173/admin');
    await expect(authenticateAdmin(local)).resolves.toEqual({
      email: 'local-admin@example.invalid',
    });
  });
  it('does not trust the local flag in deployed bundles on loopback', async () => {
    const local = event();
    local.url = new URL('http://localhost:5173/admin');
    await expect(authenticateAdmin(local)).rejects.toMatchObject({
      status: 401,
    });
  });
  it('fails closed for an unsafe issuer configuration', async () => {
    const request = event(await token());
    request.platform!.env.ACCESS_ISSUER = 'http://localhost:9999';
    await expect(authenticateAdmin(request)).rejects.toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
    });
  });
});
