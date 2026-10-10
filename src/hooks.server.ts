import type { Handle } from '@sveltejs/kit/hooks';
import { authenticateAdmin } from '#lib/server/admin/access.ts';
import {
  assertAdminMutationAllowed,
  isAdminPath,
} from '#lib/server/admin/environment.ts';
import {
  applyAdminHeaders,
  applyDocumentStyleNonce,
  createStyleNonce,
} from '#lib/server/admin/headers.ts';
import { adminErrorResponse } from '#lib/server/admin/http.ts';
import { dev } from '$app/env';

export const handle: Handle = async ({ event, resolve }) => {
  const styleNonce = createStyleNonce();
  const resolveDocument = async () => {
    const response = await resolve(event, {
      transformPageChunk: ({ html }) =>
        html.replace('%admin.styleNonce%', styleNonce),
    });
    return response.headers.get('content-type')?.startsWith('text/html')
      ? applyDocumentStyleNonce(response, styleNonce)
      : response;
  };
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
        ? Response.json({ message }, { status: 403 })
        : new Response(message, { status: 403 });
    }
    return resolveDocument();
  }

  let response: Response;
  try {
    event.locals.admin = await authenticateAdmin(event);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(event.request.method)) {
      assertAdminMutationAllowed(event);
    }
    // Admin routes opt out of Kit's pre-hook redirect. Authenticate and protect
    // writes first, then canonicalize without losing query strings or methods.
    response = event.url.pathname.endsWith('/')
      ? new Response(null, {
          status: 308,
          headers: {
            Location: event.url.pathname.replace(/\/+$/, '') + event.url.search,
          },
        })
      : await resolveDocument();
  } catch (error) {
    response = adminErrorResponse(error);
  }

  // Redirect/fetch responses can have immutable headers. Copy the response
  // without buffering its body so every Admin result is uncached.
  return applyAdminHeaders(response, styleNonce);
};
