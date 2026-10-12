import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function verifyPreviewUrls(
  id: string,
  defaultUrl: string,
  transport: typeof fetch = fetch,
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
  for (const origin of [defaultUrl, versionUrl]) {
    const response = await transport(`${origin}/`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    });
    await response.body?.cancel();
    if (response.status !== 200)
      throw new Error(`Preview entry point unavailable (${response.status})`);
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
