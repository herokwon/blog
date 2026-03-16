import { type Handle, redirect } from '@sveltejs/kit';

import { COOKIE_NAME } from '$lib/constants';
import type { UserSession } from '$lib/types/auth';

export const handle: Handle = async ({ event, resolve }) => {
  const sessionId = event.cookies.get(COOKIE_NAME);

  event.locals.user = null;
  event.locals.session = null;

  if (sessionId) {
    const database = event.platform?.env.BLOG_DB;
    if (database) {
      const query = `
        SELECT sessions.id AS sessionId, sessions.expires_at AS expiresAt, users.id AS userId, users.username, users.role
        FROM sessions
        INNER JOIN users ON sessions.user_id = users.id
        WHERE sessions.id = ?
      `;
      const result = await database
        .prepare(query)
        .bind(sessionId)
        .first<UserSession>();
      if (result) {
        const expiresAt = result.expiresAt;

        if (expiresAt > Date.now()) {
          event.locals.user = {
            id: result.userId,
            username: result.username,
            role: result.role,
          };
          event.locals.session = {
            id: result.sessionId,
            expiresAt,
          };
        } else {
          await database
            .prepare('DELETE FROM sessions WHERE id = ?')
            .bind(sessionId)
            .run();
          event.cookies.delete(COOKIE_NAME, { path: '/' });
        }
      } else {
        event.cookies.delete(COOKIE_NAME, { path: '/' });
      }
    }
  }

  if (event.url.pathname.startsWith('/admin')) {
    if (!event.locals.user) throw redirect(303, '/login');
    if (event.locals.user.role !== 'admin') throw redirect(303, '/');
  }

  return resolve(event);
};
