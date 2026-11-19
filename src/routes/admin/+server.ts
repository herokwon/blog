import { json } from '@sveltejs/kit';

export const GET = ({ locals }: import('./$types').RequestEvent) =>
  json(
    { authenticated: locals.identity?.kind === 'admin' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
