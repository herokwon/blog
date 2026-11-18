import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';

import { authorize } from './access';

const keys = await generateKeyPair('RS256');
const jwk = await exportJWK(keys.publicKey);
const resolveKey = createLocalJWKSet({
  keys: [{ ...jwk, kid: 'test', alg: 'RS256' }],
});
const config = {
  ACCESS_ISSUER: 'https://test.cloudflareaccess.com',
  ACCESS_AUDIENCE: 'expected-audience',
  ADMIN_EMAIL: 'owner@example.com',
  CI_ACCESS_CLIENT_ID: 'ci-client.access',
};
async function request(
  claims: Record<string, unknown>,
  audience = 'expected-audience',
  expiration = '2m',
) {
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setIssuer(config.ACCESS_ISSUER)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(keys.privateKey);
  return new Request('https://blog.herokwon.dev/admin', {
    headers: { 'Cf-Access-Jwt-Assertion': token },
  });
}

describe('Access authorization', () => {
  it('allows the exact administrator but rejects another email', async () => {
    expect(
      await authorize(
        await request({ email: 'owner@example.com', sub: 'human' }),
        config,
        false,
        resolveKey,
      ),
    ).toEqual({ kind: 'admin', email: 'owner@example.com' });
    expect(
      await authorize(
        await request({ email: 'other@example.com', sub: 'human' }),
        config,
        false,
        resolveKey,
      ),
    ).toBeNull();
  });
  it('allows the configured service only for deployment verification', async () => {
    const req = await request({ common_name: 'ci-client.access', sub: '' });
    expect(await authorize(req, config, true, resolveKey)).toEqual({
      kind: 'service',
    });
    expect(await authorize(req, config, false, resolveKey)).toBeNull();
    expect(
      await authorize(
        await request({ common_name: 'other.access', sub: '' }),
        config,
        true,
        resolveKey,
      ),
    ).toBeNull();
  });
  it('rejects missing, forged, expired, wrong-audience and wrong-issuer tokens', async () => {
    const valid = await request({ email: config.ADMIN_EMAIL, sub: 'human' });
    const token = valid.headers.get('Cf-Access-Jwt-Assertion')!;
    const parts = token.split('.');
    const forged = new Request(valid, {
      headers: { 'Cf-Access-Jwt-Assertion': `${parts[0]}.${parts[1]}.AAAA` },
    });
    const wrongIssuer = {
      ...config,
      ACCESS_ISSUER: 'https://other.cloudflareaccess.com',
    };
    for (const req of [
      new Request(valid.url),
      forged,
      await request({ email: config.ADMIN_EMAIL }, 'other'),
      await request({ email: config.ADMIN_EMAIL }, 'expected-audience', '-1s'),
    ]) {
      expect(await authorize(req, config, false, resolveKey)).toBeNull();
    }
    expect(await authorize(valid, wrongIssuer, false, resolveKey)).toBeNull();
  });
  it('fails closed when identity configuration is absent or issuer is untrusted', async () => {
    const req = await request({ email: config.ADMIN_EMAIL, sub: 'human' });
    expect(await authorize(req, {}, true, resolveKey)).toBeNull();
    expect(
      await authorize(
        req,
        { ...config, ACCESS_ISSUER: 'http://localhost' },
        true,
        resolveKey,
      ),
    ).toBeNull();
    expect(
      await authorize(
        await request({
          common_name: config.CI_ACCESS_CLIENT_ID,
          email: config.ADMIN_EMAIL,
        }),
        config,
        false,
        resolveKey,
      ),
    ).toBeNull();
  });
});
