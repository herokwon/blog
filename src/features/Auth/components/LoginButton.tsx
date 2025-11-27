'use client';

import { usePathname, useRouter } from 'next/navigation';

import { login } from '../api';

export const LoginButton = () => {
  const pathname = usePathname();
  const { push } = useRouter();

  const isLoginPage = pathname.endsWith('login');

  return (
    <button
      type={isLoginPage ? 'submit' : 'button'}
      formAction={isLoginPage ? login : undefined}
      onClick={() => {
        if (!isLoginPage) push('/login');
      }}
      className="cursor-pointer bg-slate-200"
    >
      로그인
    </button>
  );
};
