import { describe, expect, it } from 'vitest';
import { listContext, returnList, withListContext } from './list-context';

describe('Admin list return destinations', () => {
  it('keeps normal filters and pagination, and trash pagination', () => {
    expect(listContext('/admin/posts?status=archived&page=3&limit=2')).toBe(
      '/admin/posts?status=archived&page=3&limit=2',
    );
    expect(listContext('/admin/posts/trash?page=2&limit=1')).toBe(
      '/admin/posts/trash?page=2&limit=1',
    );
  });
  it.each([
    'https://evil.test/admin/posts',
    '//evil.test/admin/posts',
    '/admin/posts/123',
    '/admin/posts/../posts',
    '/admin/posts#fragment',
    '/admin/posts?status=unknown',
    '/admin/posts/trash?status=draft',
    '/admin/posts?page=0',
    '/admin/posts?limit=101',
    '/admin/posts?page=9007199254740991&limit=100',
    '/admin/posts?page=1&page=2',
    '/admin/posts?returnTo=/admin/posts',
    '/admin/posts?unknown=x',
    '/admin/posts?limit=1e2',
    '/admin/posts?status=draft%00',
    '/admin/posts\\?page=1',
  ])('rejects an unsupported destination: %s', destination => {
    expect(listContext(destination)).toBeNull();
    const query = new URLSearchParams({ returnTo: destination });
    expect(returnList(query, false)).toBe('/admin/posts');
    expect(returnList(query, true)).toBe('/admin/posts/trash');
  });
  it('defaults direct entries by current deletion state and rejects repeated context', () => {
    expect(returnList(new URLSearchParams(), true)).toBe('/admin/posts/trash');
    expect(
      returnList(
        new URLSearchParams(
          'returnTo=/admin/posts&returnTo=/admin/posts/trash',
        ),
        true,
      ),
    ).toBe('/admin/posts/trash');
  });
  it('retains a valid origin after state changes', () => {
    expect(
      returnList(
        new URLSearchParams({ returnTo: '/admin/posts?page=2&limit=1' }),
        true,
      ),
    ).toBe('/admin/posts?page=2&limit=1');
    expect(
      returnList(
        new URLSearchParams({ returnTo: '/admin/posts/trash?page=2&limit=1' }),
        false,
      ),
    ).toBe('/admin/posts/trash?page=2&limit=1');
  });
  it('adds context without losing publication feedback', () => {
    expect(
      withListContext(
        '/admin/posts/123?publication=failed',
        '/admin/posts?status=archived&page=3&limit=2',
      ),
    ).toBe(
      '/admin/posts/123?publication=failed&returnTo=%2Fadmin%2Fposts%3Fstatus%3Darchived%26page%3D3%26limit%3D2',
    );
    expect(withListContext('/admin/posts/new', null)).toBe('/admin/posts/new');
  });
});
