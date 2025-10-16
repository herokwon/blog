import Link from 'next/link';

import { LogoutButton } from '@/components';
import { createClient } from '@/utils/supabase/server';

import './globals.css';

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html>
      <body>
        <div className="fixed top-0 left-0 z-99 flex w-full justify-end px-4 py-3">
          {!user ? <Link href="/login">Login</Link> : <LogoutButton />}
        </div>
        {children}
      </body>
    </html>
  );
}
