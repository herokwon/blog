import { type Actions, fail, redirect } from '@sveltejs/kit';

import { COOKIE_NAME, EXPIRES_IN_SECONDS } from '$lib/constants';
import { verifyPassword } from '$lib/server';
import type { DBUser } from '$lib/types/auth';

export const actions: Actions = {
  default: async ({ request, cookies, platform }) => {
    const data = await request.formData();
    const username = data.get('username') as string;
    const password = data.get('password') as string;

    const database = platform?.env?.BLOG_DB;
    if (!database)
      return fail(500, { message: 'Database connection not available' });

    const user = await database
      .prepare('SELECT * FROM users WHERE username = ?')
      .bind(username)
      .first<DBUser>();

    if (!user || !(await verifyPassword(password, user.password_hash)))
      return fail(401, { message: 'Invalid username or password' });

    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + EXPIRES_IN_SECONDS * 1000;

    try {
      await database
        .prepare(
          'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
        )
        .bind(sessionId, user.id, expiresAt)
        .run();
    } catch {
      return fail(500, { message: 'Failed to create session' });
    }

    cookies.set(COOKIE_NAME, sessionId, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: EXPIRES_IN_SECONDS,
    });

    throw redirect(303, '/admin');
  },
};
