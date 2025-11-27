'use server';

import { createClient } from '@/utils/supabase/server';

export async function logout(): Promise<
  { success: true; error: null } | { success: false; error: string }
> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return {
    success: true,
    error: null,
  };
}
