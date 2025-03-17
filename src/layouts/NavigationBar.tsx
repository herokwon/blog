'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  path: string;
  title: string;
};

const NAV_ITEMS: NavItem[] = [{ path: '/', title: 'Home' }];

export default function NavigationBar() {
  const pathname = usePathname();

  return (
    <nav className="max-md:bg-secondary-light dark:max-md:bg-secondary-dark max-md:shadow-secondary-light dark:max-md:shadow-secondary-dark flex size-full items-center justify-center gap-x-2 gap-y-4 max-md:h-max max-md:max-w-75 max-md:flex-col max-md:rounded-md max-md:p-4 max-md:shadow">
      {NAV_ITEMS.map(({ path, title }) => (
        <Link
          key={`${title}${path}`}
          href={path}
          className={`from-foreground-light to-foreground-light bg-underline-0.5 dark:from-foreground-dark dark:to-foreground-dark flex items-center bg-linear-to-r p-2 transition-all duration-200 ${
            pathname === path ? 'active font-bold' : ''
          }`}
        >
          {title}
        </Link>
      ))}
    </nav>
  );
}
