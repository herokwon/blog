import Link from 'next/link';

import '../styles/globals.css';

import { getTheme } from '@lib';

import { NavigationBar } from '@layouts';

import { Logo, ThemeButton } from '@components';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await getTheme();

  return (
    <html lang="ko" className={theme ?? 'light'}>
      <body>
        <header className="sticky top-0 left-0 flex h-12 w-full px-4 backdrop-blur-md">
          <div className="flex h-full flex-1 items-center justify-start">
            <Link
              href="/"
              className="relative h-full w-40 *:absolute *:top-1/2 *:left-1/2 *:-translate-1/2 *:transition-opacity *:last:-z-1 not-hover:*:last:pointer-events-none not-hover:*:last:opacity-0"
            >
              <Logo onlyText />
              <Logo />
            </Link>
          </div>
          <NavigationBar />
          <div className="flex h-full flex-1 items-center justify-end">
            <ThemeButton theme={theme} />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
