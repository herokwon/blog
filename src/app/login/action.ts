'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/utils/supabase/server';

export async function login(formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get('email')?.toString() ?? '',
    password: formData.get('password')?.toString() ?? '',
  };

  if (data.email.length === 0 || data.password.length === 0) {
    throw new Error('Email and password are required');
  }

  const { error } = await supabase.auth.signInWithPassword(data);
  if (error) redirect('/login?error=' + encodeURIComponent(error.message));

  revalidatePath('/', 'layout');
  redirect('/');
}
