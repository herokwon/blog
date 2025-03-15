import '../styles/globals.css';

import { NavigationBar } from '@layouts';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <header className="sticky top-0 left-0 w-full backdrop-blur-md">
          <NavigationBar />
        </header>
        {children}
      </body>
    </html>
  );
}
