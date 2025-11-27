import { LoginButton, LogoutButton } from '@/features/Auth';
import { createClient } from '@/utils/supabase/server';

import './globals.css';

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const AuthButton = !user ? LoginButton : LogoutButton;

  return (
    <html>
      <body>
        <div className="fixed top-0 left-0 z-99 flex w-full justify-end px-4 py-3">
          {<AuthButton />}
        </div>
        <main>{children}</main>
      </body>
    </html>
  );
}
