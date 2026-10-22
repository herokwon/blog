import type { ResolvedPathname } from '$app/types';
import { adminListQuerySchema, trashListQuerySchema } from './contracts';

type ListPath = '/admin/posts' | '/admin/posts/trash';
type ListDestination = ListPath | `${ListPath}?${string}`;
type SearchParams = Pick<URLSearchParams, 'get' | 'getAll'>;

/** Only literal Admin list paths and validated, non-repeated list queries travel. */
export function listContext(
  destination: string | null,
): ListDestination | null {
  if (!destination) return null;
  const [path, search = '', ...extra] = destination.split('?');
  if (extra.length || !['/admin/posts', '/admin/posts/trash'].includes(path))
    return null;
  if (destination.includes('#')) return null;
  const params = new URLSearchParams(search);
  const values: Record<string, string> = Object.create(null);
  for (const [key, value] of params) {
    if (key in values) return null;
    values[key] = value;
  }
  const schema =
    path === '/admin/posts/trash' ? trashListQuerySchema : adminListQuerySchema;
  if (!schema.safeParse(values).success) return null;
  return (path + (params.size ? `?${params}` : '')) as ListDestination;
}

export function returnContext(params: SearchParams): ListDestination | null {
  return params.getAll('returnTo').length === 1
    ? listContext(params.get('returnTo'))
    : null;
}

export function returnList(
  params: SearchParams,
  deleted = false,
): ListDestination {
  return (
    returnContext(params) ?? (deleted ? '/admin/posts/trash' : '/admin/posts')
  );
}

/** Destination is an internal resolved post route; preserve its existing feedback. */
export function withListContext(
  destination: ResolvedPathname,
  context: string | null,
): ResolvedPathname {
  const valid = listContext(context);
  if (!valid) return destination;
  return `${destination}${destination.includes('?') ? '&' : '?'}returnTo=${encodeURIComponent(valid)}` as ResolvedPathname;
}
