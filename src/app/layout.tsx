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
        <header className="sticky top-0 left-0 w-full backdrop-blur-md">
          <NavigationBar />
          <ThemeButton theme={theme} />
        </header>
        {children}
      </body>
    </html>
  );
}
