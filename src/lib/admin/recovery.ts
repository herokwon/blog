export type RecoveryCopy = { title: string; body: string; editedAt: number };

const key = 'blog:admin:new-post-recovery:v1';
const retentionMs = 168 * 60 * 60 * 1000;

function parseCopy(raw: string): RecoveryCopy | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const { title, body, editedAt } = value as Record<string, unknown>;
  if (
    typeof title !== 'string' ||
    typeof body !== 'string' ||
    typeof editedAt !== 'number' ||
    !Number.isSafeInteger(editedAt) ||
    editedAt < 0
  )
    return null;
  return { title, body, editedAt };
}

// Storage errors deliberately reach the authoring caller, which owns the
// one-time notice and must keep editing and explicit server saves available.
export function readRecovery(
  storage: Storage,
  now: number,
): RecoveryCopy | null {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  const copy = parseCopy(raw);
  if (!copy || now - copy.editedAt >= retentionMs) {
    clearRecovery(storage);
    return null;
  }
  return copy;
}

// Call only when a debounced write is due. A restore/unchanged input must not
// serialize again, write again, or renew the last actual input edit timestamp.
export function writeRecovery(storage: Storage, copy: RecoveryCopy): void {
  const raw = storage.getItem(key);
  const previous = raw === null ? null : parseCopy(raw);
  if (previous?.title === copy.title && previous.body === copy.body) return;
  const { title, body, editedAt } = copy;
  storage.setItem(key, JSON.stringify({ title, body, editedAt }));
}

export function clearRecovery(storage: Storage): void {
  storage.removeItem(key);
}
