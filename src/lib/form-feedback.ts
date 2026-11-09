export function requestFailure(status: number | undefined) {
  return status === 401 || status === 403
    ? 'Your administrator session is unavailable. Sign in again in another tab, then retry. Your input has been kept.'
    : 'The request could not be completed. Your input has been kept. Please retry.';
}
