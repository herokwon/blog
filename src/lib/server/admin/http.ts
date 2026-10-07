import { json, type RequestEvent } from '@sveltejs/kit';
import {
  adminPostSchema,
  apiErrorResponseSchema,
  postIdSchema,
  revisionSchema,
  validationDetails,
  type PostCommand,
} from '$lib/admin/contracts';
import { getDb, type BlogDb } from '$lib/server/db';
import { commandPost } from '$lib/server/posts/mutate';
import type { z } from 'zod';
import { AdminApiError } from './errors';

export function adminJson<T>(value: T, status = 200): Response {
  return json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function adminErrorResponse(error: unknown): Response {
  const failure =
    error instanceof AdminApiError && error.status < 500
      ? error
      : new AdminApiError(
          500,
          'INTERNAL_ERROR',
          'The Admin request could not be completed.',
        );
  return adminJson(
    apiErrorResponseSchema.parse({
      error: {
        code: failure.code,
        message: failure.message,
        ...(failure.details ? { details: failure.details } : {}),
      },
    }),
    failure.status,
  );
}

export function parseAdminInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AdminApiError(
      400,
      'VALIDATION_ERROR',
      'Request validation failed.',
      validationDetails(result.error),
    );
  return result.data;
}

export async function readAdminJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AdminApiError(
      400,
      'VALIDATION_ERROR',
      'A valid JSON request body is required.',
    );
  }
}

export function adminQuery(url: URL): Record<string, string> {
  const query: Record<string, string> = Object.create(null);
  for (const [key, value] of url.searchParams) {
    if (key in query)
      throw new AdminApiError(
        400,
        'VALIDATION_ERROR',
        'Query parameters must not be repeated.',
      );
    query[key] = value;
  }
  return query;
}

export async function adminRequest(
  event: RequestEvent,
  operation: (db: BlogDb) => Promise<Response>,
): Promise<Response> {
  try {
    if (!event.locals.admin)
      throw new AdminApiError(
        401,
        'UNAUTHORIZED',
        'Admin authentication is required.',
      );
    if (!event.platform?.env.DB) throw new Error('Missing database binding');
    return await operation(getDb(event.platform.env.DB));
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export function postCommandHandler(command: PostCommand) {
  return (event: RequestEvent) =>
    adminRequest(event, async db => {
      const id = parseAdminInput(postIdSchema, event.params.id);
      const input = parseAdminInput(
        revisionSchema,
        await readAdminJson(event.request),
      );
      const post = await commandPost(db, id, command, input);
      return command === 'delete'
        ? new Response(null, {
            status: 204,
            headers: { 'Cache-Control': 'no-store' },
          })
        : adminJson(adminPostSchema.parse(post));
    });
}
