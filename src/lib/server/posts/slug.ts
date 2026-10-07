/** Publication-only normalization; authoring source is never rewritten. */
export function normalizeSlug(title: string): string {
  return title
    .normalize('NFC')
    .replace(/[A-Z]/g, letter => letter.toLowerCase())
    .replace(/[\s_]/gu, '-')
    .replace(/[^\p{L}\p{N}+\-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function slugCandidate(base: string, attempt: number): string {
  const suffix = attempt === 1 ? '' : `-${attempt}`;
  const title = Array.from(base)
    .slice(0, 100 - suffix.length)
    .join('')
    .replace(/-+$/g, '');
  return title + suffix;
}
