import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';

import { authorize, verifyAccessToken } from './access';

const keys = await generateKeyPair('RS256');
const jwk = await exportJWK(keys.publicKey);
const resolveKey = createLocalJWKSet({
  keys: [{ ...jwk, kid: 'test', alg: 'RS256' }],
});
const config = {
  ACCESS_ISSUER: 'https://test.cloudflareaccess.com',
  ACCESS_AUDIENCE: 'expected-audience',
  ADMIN_EMAIL: 'owner@example.com',
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
  it('recognizes a signed application cookie without authorizing protected requests from that cookie alone', async () => {
    const signed = await request({ email: config.ADMIN_EMAIL, sub: 'human' });
    const token = signed.headers.get('Cf-Access-Jwt-Assertion')!;
    expect(await verifyAccessToken(token, config, resolveKey)).toMatchObject({
      kind: 'admin',
    });
    expect(await verifyAccessToken('invalid', config, resolveKey)).toBeNull();
    const cookieOnly = new Request(signed.url, {
      headers: { cookie: `CF_Authorization=${token}` },
    });
    expect(await authorize(cookieOnly, config, resolveKey)).toBeNull();
  });
  it('allows the exact administrator but rejects another email', async () => {
    expect(
      await authorize(
        await request({ email: 'owner@example.com', sub: 'human' }),
        config,
        resolveKey,
      ),
    ).toEqual({ kind: 'admin', email: 'owner@example.com' });
    expect(
      await authorize(
        await request({ email: 'other@example.com', sub: 'human' }),
        config,
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
      expect(await authorize(req, config, resolveKey)).toBeNull();
    }
    expect(await authorize(valid, wrongIssuer, resolveKey)).toBeNull();
  });
  it('fails closed when identity configuration is absent or issuer is untrusted', async () => {
    const req = await request({ email: config.ADMIN_EMAIL, sub: 'human' });
    expect(await authorize(req, {}, resolveKey)).toBeNull();
    expect(
      await authorize(
        req,
        { ...config, ACCESS_ISSUER: 'http://localhost' },
        resolveKey,
      ),
    ).toBeNull();
  });
  it('rejects service identities even with the administrator audience', async () => {
    for (const serviceClaim of [
      { common_name: 'ci-client.access' },
      { service_token_id: 'ci-client.access' },
    ]) {
      const req = await request({
        ...serviceClaim,
        email: config.ADMIN_EMAIL,
        sub: 'human',
      });
      expect(await authorize(req, config, resolveKey)).toBeNull();
    }
  });
});
