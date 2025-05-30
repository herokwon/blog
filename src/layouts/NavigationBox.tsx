'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { NavItem } from '@types';

type NavigationBoxProps = {
  items: NavItem[];
};

export default function NavigationBox({ items }: NavigationBoxProps) {
  const pathname = usePathname();

  return (
    <nav
      data-testid="navigation-box"
      className="max-md:bg-secondary-light dark:max-md:bg-secondary-dark max-md:shadow-secondary-light dark:max-md:shadow-secondary-dark flex size-full items-center justify-center gap-x-2 gap-y-4 max-md:h-max max-md:max-w-75 max-md:flex-col max-md:rounded-md max-md:p-4 max-md:shadow"
    >
      {items.map(({ path, title }) => (
        <Link
          key={`${title}${path}`}
          href={path}
          className={`from-foreground-light to-foreground-light bg-underline-0.5 dark:from-foreground-dark dark:to-foreground-dark flex items-center bg-linear-to-r p-2 transition-all duration-200 ${
            pathname === path ? 'active font-bold' : ''
          }`}
        >
          {title.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}
