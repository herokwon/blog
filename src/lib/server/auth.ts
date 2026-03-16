/**
 * Hashes a password using PBKDF2 with a random salt.
 * @param password
 * @returns A base64-encoded string containing the salt and hash.
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  );
  const key = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );

  const hashArray = new Uint8Array(key);
  const combined = new Uint8Array(salt.length + hashArray.length);
  combined.set(salt);
  combined.set(hashArray, salt.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Verifies a plaintext password against a stored hash.
 * @param password The plaintext password to verify.
 * @param storedHash The base64-encoded string containing the salt and hash to compare against.
 * @returns A boolean indicating whether the password is correct.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const combined = Uint8Array.from(atob(storedHash), c => c.charCodeAt(0));
  const salt = combined.slice(0, 16);
  const originalHash = combined.slice(16);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  );
  const key = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );

  const hashArray = new Uint8Array(key);
  return hashArray.every((byte, index) => byte === originalHash[index]);
}
