export function createStyleNonce(): string {
  return btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))),
  );
}

export function applyDocumentStyleNonce(
  response: Response,
  nonce: string,
): Response {
  const headers = new Headers(response.headers);
  const policy =
    headers.get('Content-Security-Policy') ??
    "script-src 'self'; style-src 'self'";
  headers.set(
    'Content-Security-Policy',
    policy.replace(
      /(^|;)\s*style-src\s+([^;]*)/,
      (_match, separator: string, values: string) =>
        `${separator} style-src ${values.trim()} 'nonce-${nonce}'`,
    ),
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function applyAdminHeaders(response: Response, nonce: string): Response {
  const headers = new Headers(response.headers);
  const directives = new Map(
    (
      headers.get('Content-Security-Policy') ??
      "default-src 'self'; script-src 'self'"
    )
      .split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const [name, ...values] = part.split(/\s+/);
        return [name, values.join(' ')] as const;
      }),
  );
  const styles = (directives.get('style-src') ?? "'self'")
    .split(/\s+/)
    .filter(value => !["'unsafe-inline'", "'none'"].includes(value));
  directives.set(
    'style-src',
    [...new Set([...styles, "'self'", `'nonce-${nonce}'`])].join(' '),
  );
  directives.set('style-src-attr', "'none'");
  directives.set('font-src', "'self'");
  directives.set('img-src', "'none'");
  directives.set('object-src', "'none'");
  directives.set('frame-src', "'none'");
  directives.set('frame-ancestors', "'none'");
  directives.set('base-uri', "'none'");
  headers.set(
    'Content-Security-Policy',
    [...directives].map(([name, value]) => `${name} ${value}`).join('; '),
  );
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
