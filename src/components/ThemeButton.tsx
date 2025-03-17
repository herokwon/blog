'use client';

import { Icon } from '@herokwon/ui';
import { useEffect, useState } from 'react';
import { LuMoon, LuSun } from 'react-icons/lu';

import { getTheme, setTheme } from '@lib';

type ThemeButtonProps = {
  theme: Awaited<ReturnType<typeof getTheme>>;
};

export default function ThemeButton({ theme }: ThemeButtonProps) {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(theme === 'dark');

  useEffect(() => {
    if (!theme) setTheme('light');
  }, [theme]);

  useEffect(() => {
    setTheme(isDarkMode ? 'dark' : 'light');

    document.documentElement.classList.remove(isDarkMode ? 'light' : 'dark');
    document.documentElement.classList.add(isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  return (
    <button
      data-testid="theme-button"
      type="button"
      className="hover:bg-secondary-light dark:hover:bg-secondary-dark relative size-8 rounded-full p-1.5 transition-colors *:absolute *:top-1/2 *:left-1/2 *:-translate-1/2 *:transition-transform"
      onClick={() => setIsDarkMode(prev => !prev)}
    >
      <Icon
        type={LuSun}
        size="lg"
        className={isDarkMode ? 'z-1 scale-100' : '-z-1 scale-0'}
      />
      <Icon
        type={LuMoon}
        size="lg"
        className={isDarkMode ? '-z-1 scale-0' : 'z-1 scale-100'}
      />
    </button>
  );
}
