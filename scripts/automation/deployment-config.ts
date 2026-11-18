import { readFileSync, writeFileSync } from 'node:fs';

const required = [
  'DEPLOY_ENVIRONMENT',
  'DEPLOY_SHA',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_API_TOKEN',
  'ACCESS_ISSUER',
  'ACCESS_AUDIENCE',
  'ADMIN_EMAIL',
  'CF_ACCESS_CLIENT_ID',
  'CF_ACCESS_CLIENT_SECRET',
];
for (const name of required)
  if (!process.env[name])
    throw new Error(`Missing deployment setting: ${name}`);
const { DEPLOY_ENVIRONMENT, DEPLOY_SHA, ACCESS_ISSUER } = process.env;
if (DEPLOY_ENVIRONMENT !== 'preview' && DEPLOY_ENVIRONMENT !== 'production')
  throw new Error('Invalid environment');
if (!DEPLOY_SHA || !/^[a-f0-9]{40}$/.test(DEPLOY_SHA))
  throw new Error('Invalid deployment SHA');
if (
  !ACCESS_ISSUER ||
  !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(ACCESS_ISSUER)
)
  throw new Error('Invalid Access issuer');
type WorkerEnvironment = {
  d1_databases?: { database_id?: string }[];
  vars?: Record<string, unknown>;
};
const config: { env: Record<'preview' | 'production', WorkerEnvironment> } =
  JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
const environment = config.env[DEPLOY_ENVIRONMENT];
if (!environment.d1_databases?.[0]?.database_id)
  throw new Error('D1 has not been provisioned');
environment.vars = {
  ...environment.vars,
  APP_ENVIRONMENT: process.env.DEPLOY_ENVIRONMENT,
  DEPLOYMENT_SHA: process.env.DEPLOY_SHA,
  ACCESS_ISSUER: process.env.ACCESS_ISSUER,
  ACCESS_AUDIENCE: process.env.ACCESS_AUDIENCE,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  CI_ACCESS_CLIENT_ID: process.env.CF_ACCESS_CLIENT_ID,
};
// Only non-secret runtime identity settings enter the ephemeral config.
// API tokens and Access Client Secrets remain step-scoped process variables.
writeFileSync('wrangler.jsonc', JSON.stringify(config, null, 2) + '\n');
