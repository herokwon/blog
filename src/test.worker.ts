import type { ProvidedEnv } from 'cloudflare:test';

export type ResponseData = {
  environment: string;
  url: string;
  method: string;
};

export default {
  async fetch(
    request: Request,

    env: ProvidedEnv,

    ctx: ExecutionContext,
  ): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    ctx.waitUntil(
      Promise.resolve(console.log(`Request: ${request.method} ${pathname}`)),
    );

    const isProduction = env.NEXTJS_ENV === 'production';

    if (pathname === '/404') return new Response('Not found', { status: 404 });

    if (pathname === '/debug' && !isProduction)
      return new Response(
        JSON.stringify({
          environment: env.NEXTJS_ENV,
          url: request.url,
          method: request.method,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

    return new Response('Hello World!');
  },
} satisfies ExportedHandler<ProvidedEnv>;
