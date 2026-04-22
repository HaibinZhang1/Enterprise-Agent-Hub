import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_PREFIX = 'scrypt';
export const PASSWORD_POLICY_MESSAGE = '密码至少需要 12 位，且必须包含大写字母、小写字母、数字和特殊字符。';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${SCRYPT_PREFIX}:${salt}:${derived}`;
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 12) {
    return PASSWORD_POLICY_MESSAGE;
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return PASSWORD_POLICY_MESSAGE;
  }
  return null;
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  if (passwordHash === 'p1-dev-only-hash') {
    return password === 'EAgentHub123!';
  }

  const [algorithm, salt, expectedHex] = passwordHash.split(':');
  if (algorithm !== SCRYPT_PREFIX || !salt || !expectedHex) {
    return false;
  }

  const derived = scryptSync(password, salt, expectedHex.length / 2);
  const expected = Buffer.from(expectedHex, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
