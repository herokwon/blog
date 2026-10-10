import { describe, expect, it } from 'vitest';
import { clearRecovery, readRecovery, writeRecovery } from './recovery';

// A Storage implementation with durable contents shared by independent callers.
class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  writes = 0;
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
    this.writes++;
  }
}

const copy = {
  title: '  Unsaved title  ',
  body: '\r\n**Raw** Markdown\n',
  editedAt: 1_000_000,
};
const expiresAt = 605_800_000; // editedAt + 168 hours, independently calculated.

function stored(raw: string) {
  const storage = new MemoryStorage();
  writeRecovery(storage, copy);
  storage.setItem(storage.key(0)!, raw);
  return storage;
}

describe('new-post browser recovery', () => {
  it('returns null when there is no recovery copy', () => {
    expect(readRecovery(new MemoryStorage(), copy.editedAt)).toBeNull();
  });

  it('preserves exact title and Markdown for a reopened caller', () => {
    const storage = new MemoryStorage();
    writeRecovery(storage, copy);
    expect(readRecovery(storage, copy.editedAt + 1)).toEqual(copy);
    expect(storage.length).toBe(1);
  });

  it('retains the copy until the millisecond before expiry', () => {
    const storage = new MemoryStorage();
    writeRecovery(storage, copy);
    expect(readRecovery(storage, expiresAt - 1)).toEqual(copy);
  });

  it.each([expiresAt, expiresAt + 1])('removes an expired copy at %i', now => {
    const storage = new MemoryStorage();
    writeRecovery(storage, copy);
    expect(readRecovery(storage, now)).toBeNull();
    expect(storage.length).toBe(0);
  });

  it('does not renew retention when read and restored unchanged', () => {
    const storage = new MemoryStorage();
    writeRecovery(storage, copy);
    const recovered = readRecovery(storage, expiresAt - 1)!;
    writeRecovery(storage, { ...recovered, editedAt: expiresAt - 1 });
    expect(readRecovery(storage, expiresAt)).toBeNull();
    expect(storage.writes).toBe(1);
  });

  it.each(['title', 'body'] as const)(
    'new %s input replaces the single copy and renews retention',
    field => {
      const storage = new MemoryStorage();
      writeRecovery(storage, copy);
      const changed = { ...copy, [field]: 'Changed', editedAt: expiresAt - 1 };
      writeRecovery(storage, changed);
      expect(readRecovery(storage, expiresAt)).toEqual(changed);
      expect(storage.length).toBe(1);
    },
  );

  it('accepts empty authoring input without treating it as missing', () => {
    const storage = new MemoryStorage();
    const empty = { title: '', body: '', editedAt: 0 };
    writeRecovery(storage, empty);
    expect(readRecovery(storage, 1)).toEqual(empty);
  });

  it.each([
    '{',
    'null',
    '[]',
    '{}',
    JSON.stringify({ ...copy, title: 42 }),
    JSON.stringify({ ...copy, body: null }),
    JSON.stringify({ title: copy.title, body: copy.body }),
    JSON.stringify({ ...copy, editedAt: '1000000' }),
    JSON.stringify({ ...copy, editedAt: -1 }),
    JSON.stringify({ ...copy, editedAt: 1.5 }),
    '{"title":"t","body":"b","editedAt":1e309}',
  ])('removes malformed persisted data: %s', raw => {
    const storage = stored(raw);
    expect(readRecovery(storage, copy.editedAt)).toBeNull();
    expect(storage.length).toBe(0);
  });

  it('ignores extra persisted properties when exposing recovered input', () => {
    const storage = stored(JSON.stringify({ ...copy, requestKey: 'legacy' }));
    expect(readRecovery(storage, copy.editedAt)).toEqual(copy);
  });

  it('persists only input fields even if a caller has extra metadata', () => {
    const storage = new MemoryStorage();
    const inputWithMetadata = { ...copy, requestKey: 'do not persist' };
    writeRecovery(storage, inputWithMetadata);
    expect(JSON.parse(storage.getItem(storage.key(0)!)!)).toEqual(copy);
  });

  it('explicitly clears the recovery copy while preserving unrelated site storage', () => {
    const storage = new MemoryStorage();
    storage.setItem('unrelated', 'keep');
    writeRecovery(storage, copy);
    clearRecovery(storage);
    expect(readRecovery(storage, copy.editedAt)).toBeNull();
    expect(storage.getItem('unrelated')).toBe('keep');
  });

  it('replaces malformed data on the next write', () => {
    const storage = stored('{');
    writeRecovery(storage, copy);
    expect(readRecovery(storage, copy.editedAt)).toEqual(copy);
  });

  it.each(['read', 'write', 'clear'] as const)(
    'propagates denied %s access to the caller',
    action => {
      const error = new DOMException('Denied', 'SecurityError');
      class DeniedStorage extends MemoryStorage {
        override getItem(): string | null {
          throw error;
        }
        override removeItem(): void {
          throw error;
        }
      }
      const storage = new DeniedStorage();
      expect(() =>
        action === 'read'
          ? readRecovery(storage, 0)
          : action === 'write'
            ? writeRecovery(storage, copy)
            : clearRecovery(storage),
      ).toThrow(error);
    },
  );

  it('propagates quota failure and leaves the earlier recovery copy available', () => {
    class QuotaStorage extends MemoryStorage {
      full = false;
      override setItem(key: string, value: string) {
        if (this.full) throw new DOMException('Full', 'QuotaExceededError');
        super.setItem(key, value);
      }
    }
    const storage = new QuotaStorage();
    writeRecovery(storage, copy);
    storage.full = true;
    expect(() =>
      writeRecovery(storage, {
        ...copy,
        body: 'New body',
        editedAt: expiresAt,
      }),
    ).toThrow('Full');
    expect(readRecovery(storage, copy.editedAt + 1)).toEqual(copy);
  });
});
