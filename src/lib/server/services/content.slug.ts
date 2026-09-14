export function generateSlug(title: string): string {
  const slug = title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[/?#]/g, '')
    .replace(/[^\p{L}\p{N}+]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (slug.length === 0) {
    throw new Error('Slug cannot be empty');
  }

  return slug;
}
