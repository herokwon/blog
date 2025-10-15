import { vi } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import LogoutButton from './LogoutButton';

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockPathname = '/test-page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => mockPathname,
}));

const mockLogout = vi.fn();
vi.mock('@/app/actions/auth', () => ({
  logout: async () => await mockLogout(),
}));

describe('[Components] LogoutButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('로그아웃 버튼을 렌더링해야 합니다.', () => {
    render(<LogoutButton />);
    const button = screen.getByRole('button', { name: '로그아웃' });

    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('cursor-pointer');
  });

  it('로그아웃 성공 시 현재 페이지로 이동하고 새로고침해야 합니다.', async () => {
    mockLogout.mockResolvedValue({
      success: true,
      error: null,
    });

    render(<LogoutButton />);
    const button = screen.getByRole('button', { name: '로그아웃' });

    await userEvent.click(button);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith(mockPathname);
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('로그아웃 실패 시 에러 메시지를 alert으로 표시해야 합니다.', async () => {
    const errorMessage = '로그아웃에 실패했습니다.';
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    mockLogout.mockResolvedValue({
      success: false,
      error: {
        message: errorMessage,
      },
    });

    render(<LogoutButton />);
    const button = screen.getByRole('button', { name: '로그아웃' });

    await userEvent.click(button);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(alertSpy).toHaveBeenCalledWith(errorMessage);
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockRefresh).not.toHaveBeenCalled();
    });

    alertSpy.mockRestore();
  });

  it('로그아웃 실패 시 페이지 이동이나 새로고침을 하지 않아야 합니다.', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    mockLogout.mockResolvedValue({
      success: false,
      error: {
        message: 'Auth session missing',
      },
    });

    render(<LogoutButton />);
    const button = screen.getByRole('button', { name: '로그아웃' });

    await userEvent.click(button);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('버튼을 여러 번 클릭해도 각각 logout 함수가 호출되어야 합니다.', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    mockLogout.mockResolvedValue({
      success: true,
      error: null,
    });

    render(<LogoutButton />);
    const button = screen.getByRole('button', { name: '로그아웃' });

    await userEvent.click(button);
    await userEvent.click(button);
    await userEvent.click(button);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(3);
      expect(mockPush).toHaveBeenCalledTimes(3);
      expect(mockRefresh).toHaveBeenCalledTimes(3);
    });

    alertSpy.mockRestore();
  });
});
