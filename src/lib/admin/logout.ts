export async function completeLogout(
  local: boolean,
  transport: typeof fetch = fetch,
) {
  if (local) return;
  const options: RequestInit = {
    credentials: 'same-origin',
    redirect: 'manual',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  };
  const logout = await transport('/cdn-cgi/access/logout', options);
  await logout.body?.cancel();
  if (logout.type !== 'opaqueredirect' || logout.status !== 0)
    throw new Error('Logout response is unconfirmed');
  const probe = await transport('/api/admin/posts', {
    ...options,
    signal: AbortSignal.timeout(10000),
  });
  await probe.body?.cancel();
  if (probe.type !== 'opaqueredirect' || probe.status !== 0)
    throw new Error('Access session termination is unconfirmed');
}
