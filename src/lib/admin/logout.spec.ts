import { describe, expect, it } from 'vitest';
import { completeLogout } from './logout';

describe('verified logout', () => {
  it('requires the logout redirect and subsequent Access challenge', async () => {
    const calls: string[] = [];
    await completeLogout(false, async (url, options) => {
      calls.push(String(url));
      expect(options?.redirect).toBe('manual');
      expect(options?.credentials).toBe('same-origin');
      return { type: 'opaqueredirect', status: 0 } as Response;
    });
    expect(calls).toEqual(['/cdn-cgi/access/logout', '/api/admin/posts']);
  });
  it('rejects an authenticated probe or ambiguous transport outcome', async () => {
    let calls = 0;
    await expect(
      completeLogout(false, async () =>
        ++calls === 1
          ? ({ type: 'opaqueredirect', status: 0 } as Response)
          : new Response('{}'),
      ),
    ).rejects.toThrow();
    await expect(
      completeLogout(false, async () => {
        throw new TypeError('network');
      }),
    ).rejects.toThrow();
  });
  it('Local does not invoke Access', async () => {
    await expect(
      completeLogout(true, async () => {
        throw new Error('unexpected Access request');
      }),
    ).resolves.toBeUndefined();
  });
  it('rejects unexpected logout responses and timeouts', async () => {
    await expect(
      completeLogout(false, async () => new Response('')),
    ).rejects.toThrow('Logout response');
    await expect(
      completeLogout(false, async () => {
        throw new DOMException('timeout', 'TimeoutError');
      }),
    ).rejects.toThrow('timeout');
  });
});
