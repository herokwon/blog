import { json } from '@sveltejs/kit';

import { env } from '../../../../lib/server/runtime';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  if (!env?.DB || !env.BUCKET || !env.DEPLOYMENT_SHA)
    return json({ ok: false }, { status: 503 });
  try {
    const [row, object] = await Promise.all([
      env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>(),
      env.BUCKET.head('__deployment_check__/ready.txt'),
    ]);
    const ok = row?.ok === 1 && object !== null;
    return json(
      { ok, sha: env.DEPLOYMENT_SHA, environment: env.APP_ENVIRONMENT },
      {
        status: ok ? 200 : 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch {
    return json(
      { ok: false },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
};
