let initialNonce: string | undefined;

export function documentStyleNonce(): string {
  // Client navigation does not replace the initial document's CSP.
  return (initialNonce ??=
    document.querySelector<HTMLMetaElement>('meta[name="admin-style-nonce"]')
      ?.content ?? '');
}
