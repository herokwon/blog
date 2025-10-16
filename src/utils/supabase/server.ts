import { cookies } from 'next/headers';

import { createServerClient } from '@supabase/ssr';

import { supabaseConfig } from './config';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseConfig.url, supabaseConfig.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch (error) {
          console.error('Failed to set cookies on server side: ', error);
        }
      },
    },
  });
}
