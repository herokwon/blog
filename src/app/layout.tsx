import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import Link from 'next/link';

import '../styles/globals.css';

import { getTheme } from '@lib';

import { NAV_ITEMS } from '@data';

import { NavigationBox } from '@layouts';

import { Logo, MenuButton, ThemeButton } from '@components';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await getTheme();

  return (
    <html lang="ko" className={theme ?? 'light'}>
      <body>
        <header className="sticky top-0 left-0 z-99 grid h-12 w-full grid-cols-[1fr_2fr_1fr] grid-rows-[3rem] items-center gap-y-8 px-4 backdrop-blur-md">
          <div className="flex h-full items-center justify-start max-md:order-2 max-md:justify-center">
            <Link
              href="/"
              className="relative h-full w-40 *:absolute *:top-1/2 *:left-1/2 *:-translate-1/2 *:transition-opacity *:last:-z-1 not-hover:*:last:pointer-events-none not-hover:*:last:opacity-0"
            >
              <Logo onlyText />
              <Logo />
            </Link>
          </div>
          <div className="max-md:*:first:order-1 max-md:*:last:absolute max-md:*:last:top-[calc(100%+(50vh-3rem))] max-md:*:last:left-1/2 max-md:*:last:-translate-1/2 md:*:first:hidden">
            <MenuButton />
            <NavigationBox items={NAV_ITEMS} />
          </div>
          <div className="order-3 flex h-full items-center justify-end">
            <ThemeButton theme={theme} />
          </div>
        </header>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
