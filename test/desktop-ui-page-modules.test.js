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

test('desktop Phase A pages expose real single-target skill-management contracts in source', async () => {
  const [projectsPage, toolsPage, marketPage] = await Promise.all([
    read('apps/desktop/ui/pages/projects.js'),
    read('apps/desktop/ui/pages/tools.js'),
    read('apps/desktop/ui/pages/market.js'),
  ]);

  assert.match(projectsPage, /Skill management/i);
  assert.match(projectsPage, /data-project-skill-form=/);
  assert.match(projectsPage, /effective local summary/i);

  assert.match(toolsPage, /Skill management|Bound Skill/i);
  assert.match(toolsPage, /data-tool-skill-form=/);
  assert.match(toolsPage, /skillsDirectorySummary/);

  assert.match(marketPage, /Single target selection|One target type · one target/i);
  assert.match(marketPage, /Project target/i);
  assert.match(marketPage, /Tool target/i);
  assert.match(marketPage, /data-market-install-form=/);
});

test('desktop Phase A pages expose concrete skill-management and market install selectors instead of placeholder stubs', async () => {
  const [projectsPage, toolsPage, marketPage, marketFeature, boot] = await Promise.all([
    read('apps/desktop/ui/pages/projects.js'),
    read('apps/desktop/ui/pages/tools.js'),
    read('apps/desktop/ui/pages/market.js'),
    read('apps/desktop/ui/features/market.js'),
    read('apps/desktop/ui/core/boot.js'),
  ]);

  assert.match(projectsPage, /data-project-skill-form=/);
  assert.match(projectsPage, /data-project-skill-form="toggle"/);
  assert.match(projectsPage, /Materialization|生效/);

  assert.match(toolsPage, /data-tool-skill-form=/);
  assert.match(toolsPage, /data-tool-skill-form="toggle"/);
  assert.match(toolsPage, /skills directory|技能目录/i);

  assert.match(marketPage, /data-market-install-form=/);
  assert.match(marketPage, /name="targetType"/);
  assert.match(marketPage, /name="targetId"/);
  assert.match(marketFeature, /\/api\/market\/install-candidate/);

  assert.doesNotMatch(boot, /已连接统一登录拦截；当前可继续对 .* 接入真实安装流程。/);
});
