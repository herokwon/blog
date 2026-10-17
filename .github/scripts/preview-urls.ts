import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

export async function verifyPreviewUrls(
  id: string,
  defaultUrl: string,
  transport: typeof fetch = fetch,
  timing: { now?: () => number; sleep?: (ms: number) => Promise<void> } = {},
) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id,
    ) ||
    !/^https:\/\/blog-preview\.[a-z0-9-]+\.workers\.dev$/.test(defaultUrl)
  )
    throw new Error('Invalid Preview identity');
  // Cloudflare Version URL format; Wrangler uses the first eight UUID characters.
  const versionUrl = defaultUrl.replace(
    'https://',
    `https://${id.slice(0, 8)}-`,
  );
  const now = timing.now ?? (() => performance.now());
  const sleep = timing.sleep ?? (ms => delay(ms));
  const started = now();
  const waits = [3000, 5000, 10000, 15000];
  for (const [label, origin] of [
    ['default URL', defaultUrl],
    ['Version URL', versionUrl],
  ]) {
    let last = 'not requested';
    const fail = (attempts: number, reason: string) =>
      new Error(
        `Preview ${label} verification failed: ${origin}/; Attempts: ${attempts}/5; Last response: ${last}; Elapsed: ${Math.round(now() - started)}ms; ${reason}`,
      );
    for (let attempt = 1; attempt <= 5; attempt++) {
      const remaining = 90000 - (now() - started);
      if (remaining <= 0) throw fail(attempt - 1, 'overall deadline exceeded');
      let status: number | undefined;
      try {
        const response = await transport(`${origin}/`, {
          redirect: 'manual',
          signal: AbortSignal.timeout(
            Math.max(1, Math.floor(Math.min(10000, remaining))),
          ),
        });
        status = response.status;
        last = `HTTP ${status}`;
        await response.body?.cancel();
      } catch (error) {
        last = error instanceof Error ? error.name : 'network error';
      }
      if (now() - started >= 90000)
        throw fail(attempt, 'overall deadline exceeded');
      if (status === 200) break;
      if (
        status !== undefined &&
        status !== 404 &&
        status !== 429 &&
        (status < 500 || status > 599)
      )
        throw fail(attempt, 'non-retryable response');
      if (attempt === 5) throw fail(attempt, 'attempt limit reached');
      if (now() - started + waits[attempt - 1] >= 90000)
        throw fail(attempt, 'overall deadline would be exceeded');
      await sleep(waits[attempt - 1]);
    }
  }
  return { versionUrl, defaultUrl };
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const urls = await verifyPreviewUrls(
    process.env.PREVIEW_VERSION_ID ?? '',
    process.env.PREVIEW_ORIGIN ?? '',
  );
  const output = `version-url=${urls.versionUrl}\ndefault-url=${urls.defaultUrl}\n`;
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, output);
  else process.stdout.write(output);
}
