import { pathToFileURL } from 'node:url';

type SmokeConfig = {
  url: string;
  sha: string;
  environment: 'preview' | 'production';
  id: string;
  secret: string;
};

type Send = (url: string, options: RequestInit) => Promise<Response>;

export async function verifyDeployment(
  config: SmokeConfig,
  send: Send = fetch,
) {
  const headers = {
    'CF-Access-Client-Id': config.id,
    'CF-Access-Client-Secret': config.secret,
  };
  const get = (path: string, authenticated = false) =>
    send(`${config.url}${path}`, {
      headers: authenticated ? headers : {},
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    });
  const response = await get('/admin/api/deployment-check', true);
  if (response.status !== 200)
    throw new Error(`Resource probe returned ${response.status}`);
  const body = (await response.json()) as Partial<{
    ok: boolean;
    sha: string;
    environment: string;
  }>;
  if (
    !body.ok ||
    body.sha !== config.sha ||
    body.environment !== config.environment
  )
    throw new Error('Resource probe SHA, environment or connectivity mismatch');
  for (const path of ['/admin', '/admin/api/deployment-check']) {
    const unauthenticated = await get(path);
    if (![302, 303, 401, 403].includes(unauthenticated.status))
      throw new Error('Unauthenticated administrator path was not denied');
  }
  const serviceAdmin = await get('/admin', true);
  if (![302, 303, 401, 403].includes(serviceAdmin.status))
    throw new Error('Service identity gained administrator access');
  const root = await get('/');
  if (
    config.environment === 'production'
      ? root.status !== 200
      : ![302, 303, 401, 403].includes(root.status)
  )
    throw new Error('Unexpected public access policy');
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const config = {
    url: process.env.DEPLOY_URL,
    sha: process.env.DEPLOY_SHA,
    environment: process.env.DEPLOY_ENVIRONMENT,
    id: process.env.CF_ACCESS_CLIENT_ID,
    secret: process.env.CF_ACCESS_CLIENT_SECRET,
  };
  const expectedUrl =
    config.environment === 'production'
      ? 'https://blog.herokwon.dev'
      : 'https://blog-preview.herokwon.dev';
  if (
    config.url !== expectedUrl ||
    !config.id ||
    !config.secret ||
    !config.sha ||
    (config.environment !== 'production' && config.environment !== 'preview')
  )
    throw new Error('Incomplete smoke configuration');
  // Bounded propagation retry, not deployment or publication recovery.
  for (let attempt = 1; ; attempt++) {
    try {
      await verifyDeployment({
        url: config.url,
        sha: config.sha,
        environment: config.environment,
        id: config.id,
        secret: config.secret,
      });
      console.log(`Verified ${config.environment} ${config.sha}`);
      break;
    } catch (error) {
      if (attempt === 5) throw error;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}
