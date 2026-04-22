import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const controller = readFileSync(new URL('../src/admin/admin.controller.ts', import.meta.url), 'utf8');
const service = readFileSync(new URL('../src/admin/admin.service.ts', import.meta.url), 'utf8');
const writeService = readFileSync(new URL('../src/admin/admin-write.service.ts', import.meta.url), 'utf8');
const repository = readFileSync(new URL('../src/admin/admin.repository.ts', import.meta.url), 'utf8');

test('admin user password management uses a dedicated route and revokes active sessions', () => {
  assert.match(controller, /@Post\('users\/:phoneNumber\/password'\)/);
  assert.match(controller, /changeUserPassword\(/);
  assert.match(service, /async changeUserPassword\(/);
  assert.match(writeService, /async changeUserPassword\(/);
  assert.match(writeService, /validatePasswordStrength\(password\)/);
  assert.match(writeService, /loadManagedUserByPhoneNumber\(normalizePhoneNumber\(targetUserID\)\)/);
  assert.match(writeService, /updateUserPassword\(\{/);
  assert.match(writeService, /revokeAllSessionsForUser\(target\.user_id\)/);
  assert.match(repository, /updateUserPassword\(input: \{ targetUserID: string; passwordHash: string \}\)/);
});
