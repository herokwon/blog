import { vi } from 'vitest';

import { logout } from './logout';

const signOutMock = vi.fn();
vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      signOut: async () => await signOutMock(),
    },
  }),
}));

describe('[Features/Auth] logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('로그아웃 성공 시, { success: true, error: null } 를 반환해야 합니다.', async () => {
    signOutMock.mockResolvedValue({ error: null });

    const result = await logout();

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true, error: null });
  });

  it('로그아웃 실패 시, { success: false, error: message } 를 반환해야 합니다.', async () => {
    signOutMock.mockResolvedValue({ error: { message: 'Failed to sign out' } });

    const result = await logout();

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: false, error: 'Failed to sign out' });
  });
});
