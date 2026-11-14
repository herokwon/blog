export const SITE_ORIGIN = 'https://blog.herokwon.dev';
export const SITE_NAME = 'Personal Blog';
export function publicIndexable(
  production: boolean,
  url: Pick<URL, 'origin' | 'pathname'> & {
    searchParams: Pick<URLSearchParams, 'get'>;
  },
  status = 200,
) {
  if (!production || url.origin !== SITE_ORIGIN || status >= 400) return false;
  if (url.pathname === '/')
    return !['q', 'category', 'tag'].some(key =>
      url.searchParams.get(key)?.trim(),
    );
  return /^\/posts\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url.pathname);
}
