import { describe, expect, it } from 'vitest';
import {
  applyAdminHeaders,
  applyDocumentStyleNonce,
  createStyleNonce,
} from './headers';

describe('Admin headers', () => {
  it('authorizes the initial document nonce on Public HTML for later client navigation', () => {
    const response = applyDocumentStyleNonce(
      new Response('HTML', {
        headers: {
          'Content-Type': 'text/html',
          'Content-Security-Policy':
            "script-src 'self' 'sha256-framework'; style-src 'self' 'sha256-css'",
        },
      }),
      'documentNonce',
    );
    expect(response.headers.get('Content-Security-Policy')).toContain(
      "style-src 'self' 'sha256-css' 'nonce-documentNonce'",
    );
    expect(response.headers.get('Content-Security-Policy')).toContain(
      "script-src 'self' 'sha256-framework'",
    );
    expect(response.headers.get('Cache-Control')).toBeNull();
  });
  it('generates fresh 128-bit nonces', () => {
    const first = createStyleNonce();
    expect(first).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(createStyleNonce()).not.toBe(first);
  });
  it('preserves framework script policy and authorizes exactly the supplied style nonce', () => {
    const original = new Response('HTML', {
      headers: {
        'Content-Type': 'text/html',
        'Content-Security-Policy':
          "script-src 'self' 'sha256-framework'; style-src 'self' 'sha256-framework-css'",
      },
    });
    const response = applyAdminHeaders(original, 'freshNonce');
    expect(response.headers.get('Content-Security-Policy')).toContain(
      "script-src 'self' 'sha256-framework'",
    );
    expect(response.headers.get('Content-Security-Policy')).toContain(
      "style-src 'self' 'sha256-framework-css' 'nonce-freshNonce'",
    );
    expect(response.headers.get('Content-Security-Policy')).toContain(
      "style-src-attr 'none'",
    );
    expect(response.headers.get('Content-Security-Policy')).not.toMatch(
      /unsafe-inline|unsafe-eval/,
    );
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(original.headers.get('Cache-Control')).toBeNull();
  });
  it('protects API errors and redirects without consuming their body or Location', async () => {
    const response = applyAdminHeaders(
      new Response('error', { status: 401, headers: { Location: '/admin' } }),
      createStyleNonce(),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('Location')).toBe('/admin');
    expect(await response.text()).toBe('error');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
