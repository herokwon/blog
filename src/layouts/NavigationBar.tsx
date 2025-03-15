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
    <nav className="flex size-full flex-3 items-center justify-center gap-x-2">
      {NAV_ITEMS.map(({ path, title }) => (
        <Link
          key={`${title}${path}`}
          href={path}
          className={`from-foreground-light to-foreground-light bg-underline-0.5 dark:from-foreground-dark dark:to-foreground-dark flex h-full items-center bg-linear-to-r px-2 transition-all duration-200 ${
            pathname === path ? 'active font-bold' : ''
          }`}
        >
          {title}
        </Link>
      ))}
    </nav>
  );
}
