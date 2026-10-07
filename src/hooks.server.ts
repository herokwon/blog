import { json, text, type Handle } from '@sveltejs/kit';
import { authenticateAdmin } from '$lib/server/admin/access';
import {
  assertAdminMutationAllowed,
  isAdminPath,
} from '$lib/server/admin/environment';
import { AdminApiError } from '$lib/server/admin/errors';
import { dev } from '$app/environment';

export const handle: Handle = async ({ event, resolve }) => {
  if (!isAdminPath(event.url.pathname)) {
    // Retain Kit's production form CSRF policy after moving enforcement here.
    const contentType = event.request.headers
      .get('content-type')
      ?.split(';', 1)[0]
      .trim()
      .toLowerCase();
    if (
      !dev &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.request.method) &&
      [
        'application/x-www-form-urlencoded',
        'multipart/form-data',
        'text/plain',
        'application/x-sveltekit-formdata',
      ].includes(contentType ?? '') &&
      event.request.headers.get('origin') !== event.url.origin
    ) {
      const message = `Cross-site ${event.request.method} form submissions are forbidden`;
      return event.request.headers.get('accept') === 'application/json'
        ? json({ message }, { status: 403 })
        : text(message, { status: 403 });
    }
    return resolve(event);
  }

  let response: Response;
  try {
    event.locals.admin = await authenticateAdmin(event);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(event.request.method)) {
      assertAdminMutationAllowed(event);
    }
    response = await resolve(event);
  } catch (error) {
    const failure =
      error instanceof AdminApiError
        ? error
        : new AdminApiError(
            500,
            'INTERNAL_ERROR',
            'The Admin request could not be completed.',
          );
    response = json(
      {
        error: {
          code: failure.code,
          message: failure.message,
          ...(failure.details ? { details: failure.details } : {}),
        },
      },
      { status: failure.status },
    );
  }

  // Redirect/fetch responses can have immutable headers. Copy the response
  // without buffering its body so every Admin result is uncached.
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
