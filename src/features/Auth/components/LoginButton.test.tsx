import { vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LoginButton } from './LoginButton';

let mockPathname = '/';
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname,
}));

const mockLogin = vi.fn();
vi.mock('../api', () => ({
  login: async () => await mockLogin(),
}));

describe('[Features/Auth] LoginButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/';
  });

  it('Props 기본값으로 렌더링해야 합니다.', () => {
    render(<LoginButton />);
    const button = screen.getByRole('button', { name: '로그인' });

    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('cursor-pointer');
    expect(button).toHaveClass('bg-slate-200');
  });

  it('현재 위치가 로그인 페이지가 아닐 때, 버튼의 타입이 "button"이고 클릭하면 "/login" 으로 이동해야 합니다.', async () => {
    mockPathname = '/posts';
    render(<LoginButton />);

    const loginButton = screen.getByRole('button', { name: '로그인' });
    expect(loginButton).toHaveAttribute('type', 'button');

    await userEvent.click(loginButton);
    expect(mockPush).toHaveBeenCalledWith('/login');
  });
});
