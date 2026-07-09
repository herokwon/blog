import { defineConfig } from 'drizzle-kit';

function env(name: string): string {
  const value = process.env[name];

  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export default defineConfig({
  schema: './src/lib/server/db/schema/**/*.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId: env('CLOUDFLARE_ACCOUNT_ID'),
    databaseId: env('CLOUDFLARE_DATABASE_ID'),
    token: env('CLOUDFLARE_D1_TOKEN'),
  },
  verbose: true,
  strict: true,
});
