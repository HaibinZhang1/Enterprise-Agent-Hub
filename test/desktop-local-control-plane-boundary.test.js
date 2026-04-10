import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '..');

async function read(path) {
  return readFile(resolve(repoRoot, path), 'utf8');
}

test('desktop local-control-plane docs keep the slice aligned with the approved boundary', async () => {
  const readme = await read('README.md');
  const runbook = await read('docs/desktop-release-runbook.md');
  const combined = `${readme}\n${runbook}`;

  assert.match(readme, /Tools page/i);
  assert.match(readme, /Projects page/i);
  assert.match(readme, /Settings page/i);
  assert.match(readme, /publish workbench/i);
  assert.match(readme, /review workbench/i);
  assert.match(readme, /\/health/i);
  assert.match(readme, /DESKTOP_SQLITE_PATH/i);
  assert.match(readme, /hidden from normal product UI|not editable in the product UI|kept internal to the desktop shell/i);
  assert.doesNotMatch(combined, /apps\/web/i);
  assert.match(combined, /apps\/desktop[\s\S]{0,120}(maintained|only maintained|maintained product\/demo surface)/i);
});
