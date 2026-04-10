import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '..');

const pageContracts = [
  ['home', 'Home', /摘要工作台|Desktop summary workspace/],
  ['market', 'Market', /安装 \/ 启用|Browse and use/],
  ['my-skill', 'My Skill', /Publish Workbench|统一登录拦截/],
  ['review', 'Review', /claim \/ approve|Reviewer queue/i],
  ['management', 'Management', /部门管理|用户管理|Skill 管理/],
  ['tools', 'Tools', /Repair|Local authority/],
  ['projects', 'Projects', /Register project|Multi-project control/],
  ['notifications', 'Notifications', /Live Events|全部已读/],
  ['settings', 'Settings', /Save settings|Desktop policy/],
];

async function read(relativePath) {
  return readFile(resolve(repoRoot, relativePath), 'utf8');
}

test('desktop page modules keep explicit route ownership and continuation-pass surface contracts', async () => {
  for (const [pageId, title, contract] of pageContracts) {
    const source = await read(`apps/desktop/ui/pages/${pageId}.js`);

    assert.match(source, /createPageModule\(\{/);
    assert.match(source, new RegExp(`id:\\s*'${pageId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`), pageId);
    assert.match(source, new RegExp(`title:\\s*'${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`), pageId);
    assert.match(source, contract, pageId);
    assert.doesNotMatch(source, /\/api\//, pageId);
  }
});
