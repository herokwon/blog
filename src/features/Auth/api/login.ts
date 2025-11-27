'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/utils/supabase/server';

const isValidRedirectPath = (path: string): boolean =>
  path.startsWith('/') && !path.startsWith('//');

export async function login(formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get('email')?.toString() ?? '',
    password: formData.get('password')?.toString() ?? '',
  } satisfies { email: string; password: string };

  if (data.email.length === 0 || data.password.length === 0) {
    throw new Error('이메일과 비밀번호는 필수로 입력해야 합니다.');
  }

  const { error } = await supabase.auth.signInWithPassword(data);
  if (error) redirect('/login?error=' + encodeURIComponent(error.message));

  const redirectTo: string = formData.get('redirect')?.toString() ?? '/';
  const redirectPath = isValidRedirectPath(redirectTo) ? redirectTo : '/';

  revalidatePath('/', 'layout');
  redirect(redirectPath);
}
