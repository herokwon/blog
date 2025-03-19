'use server';

import { cookies } from 'next/headers';

type Theme = 'light' | 'dark';

// 30 days
const EXPIRED_TIME_IN_SECONDS = 60 * 60 * 24 * 30;

export const getCookieValue = async <T = string>(
  key: string,
): Promise<T | null> => {
  if (key.length === 0) return null;

  const savedCookieValue = (await cookies()).get(key)?.value;
  return !savedCookieValue ? null : (savedCookieValue as T);
};

export const getTheme = async (): Promise<Theme | null> =>
  await getCookieValue<Theme>('theme');

export const setTheme = async (theme: Theme): Promise<void> => {
  (await cookies()).set('theme', theme, {
    maxAge: EXPIRED_TIME_IN_SECONDS,
    expires: EXPIRED_TIME_IN_SECONDS * 1000,
  });
};
