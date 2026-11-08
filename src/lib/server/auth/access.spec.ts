import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeAll, expect, test } from 'vitest';
import { AccessError, authorizeAdminRequest, isAdminPath } from './access';

const config = {
  ACCESS_ISSUER: 'https://issuer.example.test',
  ACCESS_AUD: 'admin',
  AUTHOR_EMAIL: 'author@example.test',
};
let signingKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
let keys: ReturnType<typeof createLocalJWKSet>;
beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  signingKey = pair.privateKey;
  keys = createLocalJWKSet({
    keys: [{ ...(await exportJWK(pair.publicKey)), kid: 'test', alg: 'RS256' }],
  });
});

async function token(overrides: Record<string, unknown> = {}) {
  return new SignJWT({ email: config.AUTHOR_EMAIL, ...overrides })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setSubject('author')
    .setIssuer(config.ACCESS_ISSUER)
    .setAudience(config.ACCESS_AUD)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(signingKey);
}

test('valid signed author is accepted; ordinary public paths are outside admin protection', async () => {
  const request = new Request('https://blog.example.test/admin/posts', {
    headers: { 'cf-access-jwt-assertion': await token() },
  });
  expect(await authorizeAdminRequest(request, config, keys)).toEqual({
    subject: 'author',
    email: config.AUTHOR_EMAIL,
  });
  for (const path of [
    '/admin',
    '/admin/posts',
    '/%61dmin/posts',
    '/admin%2fmedia',
  ])
    expect(isAdminPath(path)).toBe(true);
  for (const path of ['/', '/administrator', '/posts/admin'])
    expect(isAdminPath(path)).toBe(false);
});

test('missing configuration and spoofed identity headers fail closed', async () => {
  const request = new Request('https://blog.example.test/admin', {
    headers: { 'cf-access-authenticated-user-email': config.AUTHOR_EMAIL },
  });
  await expect(authorizeAdminRequest(request, {}, keys)).rejects.toMatchObject({
    status: 503,
  });
  await expect(
    authorizeAdminRequest(request, config, keys),
  ).rejects.toMatchObject({ status: 401 });
  expect(new AccessError(403)).toBeInstanceOf(Error);
});

test('wrong identity, expired claims, malformed and unsigned tokens are rejected', async () => {
  const expired = await new SignJWT({ email: config.AUTHOR_EMAIL })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setIssuer(config.ACCESS_ISSUER)
    .setAudience(config.ACCESS_AUD)
    .setSubject('author')
    .setIssuedAt()
    .setExpirationTime(1)
    .sign(signingKey);
  for (const value of [
    await token({ email: 'other@example.test' }),
    expired,
    'bad-token',
    'eyJhbGciOiJub25lIn0.eyJlbWFpbCI6ImF1dGhvckBleGFtcGxlLnRlc3QifQ.',
  ]) {
    await expect(
      authorizeAdminRequest(
        new Request('https://blog.example.test/admin', {
          headers: { 'cf-access-jwt-assertion': value },
        }),
        config,
        keys,
      ),
    ).rejects.toMatchObject({ status: 403 });
  }
  const valid = await token();
  for (const badConfig of [
    { ...config, ACCESS_ISSUER: 'https://other.example.test' },
    { ...config, ACCESS_AUD: 'other' },
  ]) {
    await expect(
      authorizeAdminRequest(
        new Request('https://blog.example.test/admin', {
          headers: { 'cf-access-jwt-assertion': valid },
        }),
        badConfig,
        keys,
      ),
    ).rejects.toMatchObject({ status: 403 });
  }
});

test('unsafe operations require exact same origin even with a valid author token', async () => {
  const jwt = await token();
  for (const origin of [null, 'https://evil.example.test', 'null']) {
    const headers = new Headers({ 'cf-access-jwt-assertion': jwt });
    if (origin) headers.set('origin', origin);
    await expect(
      authorizeAdminRequest(
        new Request('https://blog.example.test/admin/media', {
          method: 'POST',
          headers,
        }),
        config,
        keys,
      ),
    ).rejects.toMatchObject({ status: 403 });
  }
  expect(
    await authorizeAdminRequest(
      new Request('https://blog.example.test/admin/media', {
        method: 'POST',
        headers: {
          'cf-access-jwt-assertion': jwt,
          origin: 'https://blog.example.test',
        },
      }),
      config,
      keys,
    ),
  ).toMatchObject({ subject: 'author' });
});

test('missing required claims, foreign signatures and remote HTTP issuers cannot authorize', async () => {
  const payload = {
    iss: config.ACCESS_ISSUER,
    aud: config.ACCESS_AUD,
    sub: 'author',
    email: config.AUTHOR_EMAIL,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
  };
  for (const claim of ['exp', 'iat', 'sub', 'email']) {
    const incomplete: Record<string, unknown> = { ...payload };
    delete incomplete[claim];
    const signed = await new SignJWT(incomplete)
      .setProtectedHeader({ alg: 'RS256', kid: 'test' })
      .sign(signingKey);
    await expect(
      authorizeAdminRequest(
        new Request('https://blog.example.test/admin', {
          headers: { 'cf-access-jwt-assertion': signed },
        }),
        config,
        keys,
      ),
    ).rejects.toMatchObject({ status: 403 });
  }
  const foreign = await generateKeyPair('RS256');
  const signed = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .sign(foreign.privateKey);
  await expect(
    authorizeAdminRequest(
      new Request('https://blog.example.test/admin', {
        headers: { 'cf-access-jwt-assertion': signed },
      }),
      config,
      keys,
    ),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    authorizeAdminRequest(
      new Request('https://blog.example.test/admin'),
      { ...config, ACCESS_ISSUER: 'http://localhost:4174' },
      keys,
    ),
  ).rejects.toMatchObject({ status: 503 });
});
