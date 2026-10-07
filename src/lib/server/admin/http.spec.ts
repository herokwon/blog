import type { ApiErrorResponse } from '$lib/admin/contracts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AdminApiError } from './errors';
import {
  adminErrorResponse,
  adminJson,
  parseAdminInput,
  readAdminJson,
} from './http';

describe('Admin HTTP boundary', () => {
  it('preserves direct JSON status and no-store', async () => {
    const response = adminJson({ title: 'Raw' }, 201);
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ title: 'Raw' });
  });
  it('returns a field-level safe validation contract', async () => {
    let failure: unknown;
    try {
      parseAdminInput(z.strictObject({ title: z.string() }), {
        title: 1,
        secret: 'private',
      });
    } catch (error) {
      failure = error;
    }
    const response = adminErrorResponse(failure);
    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiErrorResponse;
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toContainEqual({
      path: ['secret'],
      message: 'This field is not allowed.',
    });
    expect(JSON.stringify(body)).not.toContain('private');
  });
  it('converts malformed JSON to validation rather than internal failure', async () => {
    let failure: unknown;
    try {
      await readAdminJson(
        new Request('https://example.test', { method: 'POST', body: '{' }),
      );
    } catch (error) {
      failure = error;
    }
    expect(adminErrorResponse(failure).status).toBe(400);
  });
  it('preserves application errors and hides unexpected database details', async () => {
    const conflict = adminErrorResponse(
      new AdminApiError(409, 'POST_VERSION_CONFLICT', 'Post changed.'),
    );
    expect(await conflict.json()).toEqual({
      error: { code: 'POST_VERSION_CONFLICT', message: 'Post changed.' },
    });
    const internal = adminErrorResponse(new Error('SQL secret stack'));
    expect(internal.status).toBe(500);
    expect(await internal.json()).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'The Admin request could not be completed.',
      },
    });
    expect(internal.headers.get('cache-control')).toBe('no-store');
  });
});
