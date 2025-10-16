'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/utils/supabase/server';
import type { AuthError } from '@supabase/supabase-js';

const isValidRedirectPath = (path: string): boolean =>
  path.startsWith('/') && !path.startsWith('//');

export async function login(formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get('email')?.toString() ?? '',
    password: formData.get('password')?.toString() ?? '',
  } satisfies { email: string; password: string };

  if (data.email.length === 0 || data.password.length === 0) {
    throw new Error('Email and password are required');
  }

  const { error } = await supabase.auth.signInWithPassword(data);
  if (error) redirect('/login?error=' + encodeURIComponent(error.message));

  const redirectTo: string = formData.get('redirect')?.toString() ?? '/';
  const redirectPath = isValidRedirectPath(redirectTo) ? redirectTo : '/';

  revalidatePath('/', 'layout');
  redirect(redirectPath);
}

export async function logout(): Promise<
  { success: true; error: null } | { success: false; error: AuthError }
> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return {
      success: false,
      error,
    };
  }

  return {
    success: true,
    error: null,
  };
}
