import { vi } from 'vitest';

import { login } from './login';

const { REDIRECT, redirectMock, revalidatePathMock, signInWithPasswordMock } =
  vi.hoisted(() => {
    const REDIRECT = Symbol('__NEXT_REDIRECT__');
    return {
      REDIRECT,
      redirectMock: vi.fn(() => {
        throw REDIRECT;
      }),
      revalidatePathMock: vi.fn(),
      signInWithPasswordMock: vi.fn(),
    };
  });

const isRedirect = (e: unknown): e is symbol => e === REDIRECT;

const captureRedirect = async <T>(p: Promise<T>): Promise<void> => {
  try {
    await p;
  } catch (e) {
    if (!isRedirect(e)) throw e;
  }
};

vi.mock('@/utils/supabase/server', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: async (...args: unknown[]) =>
        await signInWithPasswordMock(...args),
    },
  }),
}));

vi.mock('next/navigation', () => ({
  __esModule: true,
  redirect: redirectMock,
}));

vi.mock('next/cache', () => ({
  __esModule: true,
  revalidatePath: revalidatePathMock,
}));

describe('[Features/Auth][Server Action] login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('이메일 / 비밀번호가 비어있으면 오류 메시지를 던져야 합니다.', async () => {
    const formData = new FormData();

    await expect(login(formData)).rejects.toThrow(
      '이메일과 비밀번호는 필수로 입력해야 합니다.',
    );

    expect(signInWithPasswordMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('로그인 과정에서 에러가 발생하면 에러메시지를 URL에 포함하여 리디렉션해야 합니다.', async () => {
    const formData = new FormData();
    formData.set('email', 'user@example.com');
    formData.set('password', 'pw');
    signInWithPasswordMock.mockResolvedValue({ error: { message: 'Invalid' } });

    await expect(login(formData)).rejects.toBe(REDIRECT);

    const expected = '/login?error=' + encodeURIComponent('Invalid');

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'pw',
    });
    expect(redirectMock).toHaveBeenCalledWith(expected);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('로그인 성공 시, 최상위 페이지("/")로 이동하고 레이아웃을 갱신해야 합니다.', async () => {
    const formData = new FormData();
    formData.set('email', 'user@example.com');
    formData.set('password', 'pw');
    signInWithPasswordMock.mockResolvedValue({ error: null });

    await captureRedirect(login(formData));

    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout');
    expect(redirectMock).toHaveBeenCalledWith('/');
  });

  it('로그인 성공 시, redirect 필드가 유효하면 해당 경로로 리디렉션해야 합니다.', async () => {
    const formData = new FormData();
    formData.set('email', 'user@example.com');
    formData.set('password', 'pw');
    formData.set('redirect', '/dashboard');
    signInWithPasswordMock.mockResolvedValue({ error: null });

    await captureRedirect(login(formData));

    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout');
    expect(redirectMock).toHaveBeenCalledWith('/dashboard');
  });

  it('로그인 성공 시, redirect 필드가 "//" 로 시작하면 보안상 "/" 로 보정해야 합니다.', async () => {
    const formData = new FormData();
    formData.set('email', 'user@example.com');
    formData.set('password', 'pw');
    formData.set('redirect', '//evil');
    signInWithPasswordMock.mockResolvedValue({ error: null });

    await captureRedirect(login(formData));

    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout');
    expect(redirectMock).toHaveBeenCalledWith('/');
  });

  it('로그인 성공 시, redirect 필드가 "/"로 시작하지 않으면 "/" 로 보정해야 합니다.', async () => {
    const formData = new FormData();
    formData.set('email', 'user@example.com');
    formData.set('password', 'pw');
    formData.set('redirect', 'http://example.com');
    signInWithPasswordMock.mockResolvedValue({ error: null });

    await captureRedirect(login(formData));

    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout');
    expect(redirectMock).toHaveBeenCalledWith('/');
  });
});
