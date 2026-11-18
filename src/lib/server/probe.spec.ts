import { expect, it, vi } from 'vitest';
import { getPlatformProxy } from 'wrangler';

import { GET } from '../../routes/admin/api/deployment-check/+server';
import type { RequestEvent } from '../../routes/admin/api/deployment-check/$types';
import { env } from './runtime';

const native = vi.hoisted(() => ({ env: {} }));
// Node has no native Workers module; bridge it to real isolated Miniflare bindings.
vi.mock('./runtime', () => native);

it('reads native Worker bindings without relying on event.platform', async () => {
  const proxy = await getPlatformProxy<Cloudflare.Env>({
    environment: 'preview',
    persist: false,
  });
  Object.assign(native.env, proxy.env, { DEPLOYMENT_SHA: 'a'.repeat(40) });
  await env.BUCKET.put('__deployment_check__/ready.txt', 'local test fixture');
  try {
    const response = await GET({} as RequestEvent);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      sha: 'a'.repeat(40),
      environment: 'preview',
    });
  } finally {
    await env.BUCKET.delete('__deployment_check__/ready.txt');
    await proxy.dispose();
  }
});
