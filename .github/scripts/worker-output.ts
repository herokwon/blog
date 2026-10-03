import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function readUploadedVersion(text: string): { id: string; url: string } {
  const uploads = text
    .split(/\r?\n/)
    .filter(line => line.trim())
    .map(line => JSON.parse(line))
    .filter(entry => entry.type === 'version-upload');
  if (
    uploads.length !== 1 ||
    uploads[0].version !== 1 ||
    typeof uploads[0].version_id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      uploads[0].version_id,
    )
  ) {
    throw new Error(
      'Expected one structured Worker version upload with a valid Version ID',
    );
  }
  const url = uploads[0].preview_url;
  if (
    url != null &&
    (typeof url !== 'string' || !/^https:\/\/[^\s]+$/.test(url))
  ) {
    throw new Error('Invalid preview URL');
  }
  return { id: uploads[0].version_id, url: url ?? '' };
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const upload = readUploadedVersion(readFileSync(process.argv[2], 'utf8'));
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `version-id=${upload.id}\nurl=${upload.url}\n`,
    );
}
