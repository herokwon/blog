import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminEnvironment } from './environment';
import {
  assertAdminMutationAllowed,
  isAdminPath,
  isLocalAdminEnabled,
} from './environment';

const runtime = vi.hoisted(() => ({ dev: false }));
const worker = vi.hoisted(() => ({ env: {} as AdminEnvironment }));
vi.mock('cloudflare:workers', () => worker);
vi.mock('$app/env', () => runtime);

function event(url = 'https://blog.example/api/admin/posts', origin?: string) {
  for (const key of Object.keys(worker.env))
    delete worker.env[key as keyof AdminEnvironment];
  Object.assign(worker.env, {
    ADMIN_ORIGIN: 'https://blog.example',
    ADMIN_LOCAL_AUTH: 'true',
  });
  return {
    url: new URL(url),
    request: new Request(url, {
      method: 'POST',
      headers: origin ? { Origin: origin } : {},
    }),
    locals: {},
  } as unknown as RequestEvent;
}

describe('Admin request boundaries', () => {
  beforeEach(() => {
    runtime.dev = false;
  });

  it.each([
    ['/admin', true],
    ['/admin/posts', true],
    ['/api/admin', true],
    ['/api/admin/posts/1', true],
    ['/administrator', false],
    ['/api/admin-tools', false],
    ['/posts/admin', false],
    ['/%61dmin/posts', true],
    ['/api/%61dmin/posts', true],
    ['/admin%2Fposts', false],
  ])('matches only exact Admin prefixes: %s', (path, expected) => {
    expect(isAdminPath(path)).toBe(expected);
  });

  it('permits an exact production origin', () => {
    expect(() =>
      assertAdminMutationAllowed(event(undefined, 'https://blog.example')),
    ).not.toThrow();
  });

  it.each([
    undefined,
    'null',
    'https://other.example',
    'http://blog.example',
    'https://blog.example:444',
    'https://blog.example/path',
    'https://user@blog.example',
    'https://blog.example, https://other.example',
  ])('rejects unusable or different Origin: %s', origin => {
    expect(() => assertAdminMutationAllowed(event(undefined, origin))).toThrow(
      expect.objectContaining({ status: 403, code: 'FORBIDDEN' }),
    );
  });

  it('denies a candidate even when Origin matches its own URL', () => {
    expect(() =>
      assertAdminMutationAllowed(
        event(
          'https://candidate.blog.workers.dev/api/admin/posts',
          'https://candidate.blog.workers.dev',
        ),
      ),
    ).toThrow(expect.objectContaining({ status: 403 }));
  });

  it('fails closed when write origin is missing', () => {
    const request = event(undefined, 'https://blog.example');
    delete worker.env.ADMIN_ORIGIN;
    expect(() => assertAdminMutationAllowed(request)).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });

  it('cannot enable local identity in a production bundle, even on localhost', () => {
    expect(
      isLocalAdminEnabled(event('http://localhost:5173/api/admin/posts')),
    ).toBe(false);
  });

  it('requires both development runtime and explicit flag on loopback', () => {
    runtime.dev = true;
    const request = event(
      'http://localhost:5173/api/admin/posts',
      'http://localhost:5173',
    );
    expect(isLocalAdminEnabled(request)).toBe(true);
    expect(() => assertAdminMutationAllowed(request)).not.toThrow();
    worker.env.ADMIN_LOCAL_AUTH = 'false';
    expect(isLocalAdminEnabled(request)).toBe(false);
  });

  it('rejects local bypass for a remote hostname', () => {
    runtime.dev = true;
    expect(isLocalAdminEnabled(event())).toBe(false);
  });

  it('enforces Origin even during local development', () => {
    runtime.dev = true;
    expect(() =>
      assertAdminMutationAllowed(
        event('http://127.0.0.1:5173/api/admin/posts'),
      ),
    ).toThrow(expect.objectContaining({ status: 403 }));
  });
});
