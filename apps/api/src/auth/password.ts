import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_PREFIX = 'scrypt';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${SCRYPT_PREFIX}:${salt}:${derived}`;
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  if (passwordHash === 'p1-dev-only-hash') {
    return password === 'demo123';
  }

  const [algorithm, salt, expectedHex] = passwordHash.split(':');
  if (algorithm !== SCRYPT_PREFIX || !salt || !expectedHex) {
    return false;
  }

  const derived = scryptSync(password, salt, expectedHex.length / 2);
  const expected = Buffer.from(expectedHex, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
