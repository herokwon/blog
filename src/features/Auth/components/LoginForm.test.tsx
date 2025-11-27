import { vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LoginForm } from './LoginForm';

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

describe('[Features/Auth] LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/';
  });

  it('Props 기본값으로 렌더링해야 합니다.', () => {
    const { container } = render(<LoginForm />);
    const form = screen.getByRole('form');
    const redirect = container.querySelector(
      'input[type="hidden"][name="redirect"]',
    );
    const email = screen.getByLabelText('Email');
    const password = screen.getByLabelText('Password');
    const loginButton = screen.getByRole('button', { name: '로그인' });

    expect(form).toBeInTheDocument();
    expect(form).toHaveClass('w-full');
    expect(form).toHaveClass('max-w-3xl');

    expect(redirect).toBeInTheDocument();
    expect(redirect).not.toBeNull();
    expect(redirect).toHaveValue('/');

    expect(email).toBeInTheDocument();
    expect(email).toBeRequired();

    expect(password).toBeInTheDocument();
    expect(password).toBeRequired();

    expect(loginButton).toBeInTheDocument();
  });

  it('redirect prop를 전달하면 hidden input의 값으로 설정되어야 합니다.', () => {
    const { container } = render(<LoginForm redirect="/dashboard" />);
    const redirect = container.querySelector(
      'input[type="hidden"][name="redirect"]',
    );

    expect(redirect).not.toBeNull();
    expect(redirect).toHaveValue('/dashboard');
  });

  it('현재 위치가 로그인 페이지일 때, 버튼의 타입이 "submit"이고 필수 입력값이 채워져있다면 Form이 제출되어야 합니다.', async () => {
    mockPathname = '/login';
    render(<LoginForm />);

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const loginButton = screen.getByRole('button', { name: '로그인' });

    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'password123');

    expect(loginButton).toHaveAttribute('type', 'submit');

    await userEvent.click(loginButton);
    expect(mockLogin).toHaveBeenCalled();
  });
});
