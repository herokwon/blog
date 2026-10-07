import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { test as base, type APIRequestContext } from '@playwright/test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import {
  convertV4MiniflareOptions,
  Response as LocalResponse,
  Miniflare,
  type V4MiniflareOptions,
} from 'miniflare';

const issuer = 'https://test.cloudflareaccess.com';
const audience = 'admin-api-tests';

export const test = base.extend<
  { api: APIRequestContext },
  { localD1: Awaited<ReturnType<typeof startLocalD1>> }
>({
  api: async ({ localD1, playwright }, use) => {
    const api = await playwright.request.newContext({
      baseURL: localD1.origin,
      extraHTTPHeaders: {
        Origin: localD1.origin,
        'Cf-Access-Jwt-Assertion': await localD1.token(),
      },
    });
    try {
      await use(api);
    } finally {
      await api.dispose();
    }
  },
  localD1: [
    // Playwright requires a destructured dependency list, including when empty.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const fixture = await startLocalD1();
      try {
        await use(fixture);
      } finally {
        await fixture.dispose();
      }
    },
    { scope: 'worker' },
  ],
});

// No Wrangler config, real database IDs, remote proxy or external fetch is used.
// Only the public certificate fetch is substituted; JWT verification stays real.
async function startLocalD1() {
  const root = resolve('.wrangler/admin-api-tests');
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(resolve(root, 'run-'));
  const removeDirectory = async () => {
    const child = relative(root, directory);
    if (!child || child.startsWith('..') || isAbsolute(child))
      throw new Error('Unsafe fixture cleanup');
    await rm(directory, { recursive: true, force: true });
  };
  let runtime: Miniflare | undefined;
  try {
    const keys = await generateKeyPair('RS256');
    const publicKey = {
      ...(await exportJWK(keys.publicKey)),
      kid: 'local-test',
      alg: 'RS256',
    };
    const options: V4MiniflareOptions = {
      modules: true,
      scriptPath: '.wrangler/admin-api-build/_worker.js',
      compatibilityDate: '2026-09-25',
      compatibilityFlags: ['nodejs_als'],
      host: '127.0.0.1',
      port: 0,
      resourcePersistencePath: directory,
      d1Databases: { DB: 'admin-api-test-only' },
      bindings: {
        ACCESS_ISSUER: issuer,
        ACCESS_AUDIENCE: audience,
        ADMIN_EMAILS: 'admin@example.test',
      },
      serviceBindings: {
        ASSETS: () => new LocalResponse('Not found', { status: 404 }),
      },
      outboundService: request => {
        if (request.url !== `${issuer}/cdn-cgi/access/certs`)
          throw new Error('External request refused');
        return new LocalResponse(JSON.stringify({ keys: [publicKey] }), {
          headers: { 'Content-Type': 'application/json' },
        });
      },
    };
    const mf = new Miniflare(convertV4MiniflareOptions(options));
    runtime = mf;
    const url = await mf.ready;
    assertLocalOrigin(url.origin);
    // Set the application's trusted origin to this isolated instance's URL.
    await mf.setOptions(
      convertV4MiniflareOptions({
        ...options,
        port: Number(url.port),
        bindings: { ...options.bindings, ADMIN_ORIGIN: url.origin },
      }),
    );
    const db = await mf.getD1Database('DB');
    for (const filename of (await readdir('drizzle'))
      .filter(name => name.endsWith('.sql'))
      .sort()) {
      const statements = (await readFile(resolve('drizzle', filename), 'utf8'))
        .split('--> statement-breakpoint')
        .map(sql => db.prepare(sql));
      await db.batch(statements);
    }
    const token = async (email = 'admin@example.test') =>
      new SignJWT({ email })
        .setProtectedHeader({ alg: 'RS256', kid: 'local-test' })
        .setIssuer(issuer)
        .setAudience(audience)
        .setSubject(email)
        .setIssuedAt()
        .setExpirationTime('10m')
        .sign(keys.privateKey);
    return {
      origin: url.origin,
      db,
      token,
      // In-process URL simulation only; no request is sent to this candidate host.
      candidateFetch: async (path: string, body: unknown) =>
        mf.dispatchFetch(`https://candidate-blog.example.workers.dev${path}`, {
          method: 'POST',
          headers: {
            Origin: 'https://candidate-blog.example.workers.dev',
            'Cf-Access-Jwt-Assertion': await token(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }),
      async dispose() {
        try {
          await mf.dispose();
        } finally {
          await removeDirectory();
        }
      },
    };
  } catch (error) {
    try {
      await runtime?.dispose();
    } finally {
      await removeDirectory();
    }
    throw error;
  }
}

export function assertLocalOrigin(origin: string) {
  const url = new URL(origin);
  if (
    url.protocol !== 'http:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.origin !== origin
  )
    throw new Error('Only exact loopback HTTP origins are allowed');
}
