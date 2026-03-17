import { type ChildProcess, spawn } from 'child_process';
import { type BrowserServer, chromium } from 'playwright';

async function main(): Promise<void> {
  const server: BrowserServer = await chromium.launchServer({
    headless: true,
  });
  process.env.PW_WS_ENDPOINT = server.wsEndpoint();
  console.log('Started Playwright server:', process.env.PW_WS_ENDPOINT);

  const child: ChildProcess = spawn('pnpm exec vitest run --coverage', {
    stdio: 'inherit',
    env: process.env,
    shell: true,
  });

  let cleanedUp: boolean = false;
  const cleanup = async (): Promise<void> => {
    if (cleanedUp) return;
    cleanedUp = true;

    try {
      await server.close();
      console.log('Closed Playwright server');
    } catch (error: unknown) {
      console.error(
        'Error closing Playwright server:',
        error instanceof Error ? error.message : String(error),
      );
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

main().catch((error: unknown) => {
  console.error(
    'Fatal error:',
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
