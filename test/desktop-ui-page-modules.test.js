import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '..');

const pageContracts = [
  ['home', 'Home'],
  ['market', 'Market'],
  ['my-skill', 'My Skill'],
  ['review', 'Review'],
  ['management', 'Management'],
  ['tools', 'Tools'],
  ['projects', 'Projects'],
  ['notifications', 'Notifications'],
  ['settings', 'Settings'],
];

async function read(relativePath) {
  return readFile(resolve(repoRoot, relativePath), 'utf8');
}

test('desktop page modules keep explicit route ownership and guest-safe page-boundary copy', async () => {
  for (const [pageId, title] of pageContracts) {
    const source = await read(`apps/desktop/ui/pages/${pageId}.js`);

    assert.match(source, /createPageModule\(\{/);
    assert.match(source, new RegExp(`id:\\s*'${pageId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`), pageId);
    assert.match(source, new RegExp(`title:\\s*'${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`), pageId);
    assert.match(source, /page module owns the .* surface inside the desktop shell/i, pageId);
    assert.match(source, /Guest-safe shell rendering stays inside the page boundary until sign-in\./, pageId);
    assert.doesNotMatch(source, /\/api\//, pageId);
  }
});
