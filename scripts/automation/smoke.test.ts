import assert from 'node:assert/strict';
import { test } from 'node:test';

import { verifyDeployment } from './smoke.ts';

const config = {
  url: 'https://blog.herokwon.dev',
  sha: 'a'.repeat(40),
  environment: 'production' as const,
  id: 'test',
  secret: 'test-secret',
};
test('smoke verification rejects stale deployments and service administrator access', async () => {
  const respond =
    (sha: string, adminStatus = 403) =>
    async (url: string, options: RequestInit) => {
      const path = new URL(url).pathname;
      const authenticated = new Headers(options.headers).has(
        'CF-Access-Client-Id',
      );
      if (path === '/admin/api/deployment-check' && authenticated)
        return Response.json({ ok: true, sha, environment: 'production' });
      if (path.startsWith('/admin'))
        return new Response('', { status: authenticated ? adminStatus : 302 });
      return new Response('public', { status: 200 });
    };
  await verifyDeployment(config, respond(config.sha));
  await assert.rejects(
    verifyDeployment(config, respond('b'.repeat(40))),
    /SHA/,
  );
  await assert.rejects(
    verifyDeployment(config, respond(config.sha, 200)),
    /administrator/,
  );
});

test('smoke never accepts a login redirect as resource verification', async () => {
  await assert.rejects(
    verifyDeployment(config, async () => new Response('', { status: 302 })),
    /probe/,
  );
});
