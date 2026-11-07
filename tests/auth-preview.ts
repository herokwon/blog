import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

// Test-only issuer. No keys or authorization bypass are shipped to the Worker.
const issuer = 'http://127.0.0.1:4174';
const { privateKey, publicKey } = await generateKeyPair('RS256');
const jwk = {
  ...(await exportJWK(publicKey)),
  kid: 'local-test',
  alg: 'RS256',
};
const server = createServer((request, response) => {
  response.setHeader('cache-control', 'no-store');
  if (request.url === '/cdn-cgi/access/certs') {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ keys: [jwk] }));
  } else if (request.url === '/token') {
    void new SignJWT({ email: 'author@example.test' })
      .setProtectedHeader({ alg: 'RS256', kid: 'local-test' })
      .setSubject('local-author')
      .setIssuer(issuer)
      .setAudience('local-admin')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey)
      .then(token => response.end(token))
      .catch(() => {
        response.statusCode = 500;
        response.end();
      });
  } else {
    response.statusCode = 404;
    response.end();
  }
});
await new Promise<void>((ready, reject) => {
  server.once('error', reject);
  server.listen(4174, '127.0.0.1', ready);
});
const worker = spawn(
  process.execPath,
  [
    resolve('node_modules/wrangler/bin/wrangler.js'),
    'dev',
    '.svelte-kit/cloudflare/_worker.js',
    '--port',
    '4173',
    '--var',
    `ACCESS_ISSUER:${issuer}`,
    '--var',
    'ACCESS_AUD:local-admin',
    '--var',
    'AUTHOR_EMAIL:author@example.test',
  ],
  { stdio: 'inherit' },
);
worker.once('exit', code => {
  server.close();
  process.exit(code ?? 1);
});
worker.once('error', () => {
  server.close();
  process.exit(1);
});
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.once(signal, () => {
    worker.kill(signal);
    server.close();
  });
