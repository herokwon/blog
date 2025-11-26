'use client';

import { usePathname, useRouter } from 'next/navigation';

import { logout } from '../api';

export const LogoutButton = () => {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    const { success, error } = await logout();
    if (!success) {
      console.error(error);
      return;
    }

    router.push(pathname);
    router.refresh();
  };

  return (
    <button className="cursor-pointer" onClick={handleLogout}>
      로그아웃
    </button>
  );
};
