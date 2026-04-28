import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
require('ts-node/register/transpile-only');

const { parseArgs } = require('../src/scripts/client-update-cli-lib.ts');
const publishScript = readFileSync(new URL('../src/scripts/client-update-publish.ts', import.meta.url), 'utf8');
const cliLib = readFileSync(new URL('../src/scripts/client-update-cli-lib.ts', import.meta.url), 'utf8');

test('client update CLI parses long flags and uses auth/login for admin auth reuse', () => {
  const args = parseArgs([
    '--server-url', 'http://127.0.0.1:3000',
    '--admin-phone', '13800000002',
    '--version', '1.6.0',
    '--publish-now', 'false',
  ]);

  assert.equal(args['server-url'], 'http://127.0.0.1:3000');
  assert.equal(args['publish-now'], 'false');
  assert.match(cliLib, /requestJSON<\{ status\?: string; accessToken\?: string \}>\('\/auth\/login'/);
  assert.match(cliLib, /password_change_required/);
  assert.match(publishScript, /\/admin\/client-updates\/releases/);
  assert.match(publishScript, /uploadArtifact\(/);
});
