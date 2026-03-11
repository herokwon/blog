import { spawn } from 'child_process';
import { chromium } from 'playwright';

async function main(): Promise<void> {
  const server = await chromium.launchServer({ headless: true });
  process.env.PW_WS_ENDPOINT = server.wsEndpoint();
  console.log('Started Playwright server:', process.env.PW_WS_ENDPOINT);

  const child = spawn('pnpm exec vitest run --coverage', {
    stdio: 'inherit',
    env: process.env,
    shell: true,
  });

  const cleanup = async () => {
    try {
      await server.close();
    } catch (e) {
      console.error('Error closing Playwright server:', e);
    }
  };

  child.on(
    'exit',
    async (code: number | null, signal: NodeJS.Signals | null) => {
      await cleanup();
      if (signal) process.kill(process.pid, signal);
      process.exit(code ?? 0);
    },
  );

  process.on('SIGINT', async () => {
    child.kill('SIGINT');
    await cleanup();
    process.exit(130);
  });

  process.on('SIGTERM', async () => {
    child.kill('SIGTERM');
    await cleanup();
    process.exit(143);
  });
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
