import '../styles/globals.css';

import { getTheme } from '@lib';

import { NavigationBar } from '@layouts';

import { ThemeButton } from '@components';

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
          <div className="flex h-full flex-1 items-center justify-start"></div>
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
