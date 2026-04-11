import assert from 'node:assert/strict';
import test from 'node:test';

import { createDesktopShellState } from '../apps/desktop/ui/core/store.js';
import { createMySkillPage } from '../apps/desktop/ui/pages/my-skill.js';

function createState(overrides = {}) {
  return {
    ...createDesktopShellState(),
    ...overrides,
    local: {
      ...createDesktopShellState().local,
      ...(overrides.local ?? {}),
    },
    remote: {
      ...createDesktopShellState().remote,
      ...(overrides.remote ?? {}),
    },
  };
}

async function renderPage(state) {
  const host = { innerHTML: '' };
  const page = createMySkillPage({
    store: {
      getState() {
        return state;
      },
    },
  });
  page.mount(host);
  await page.enter({ state, reason: 'test-render' });
  return host.innerHTML;
}

test('my skill page renders installed tab from the desktop-local aggregate source', async () => {
  const markup = await renderPage(
    createState({
      mySkillTab: 'installed',
      local: {
        installedSkills: {
          status: 'loaded',
          message: 'ok',
          items: [
            {
              skillId: 'skill-shared',
              versions: [{ version: '1.0.0', packageId: 'pkg-shared-1' }],
              enabledTools: [{ toolId: 'codex', displayName: 'Codex' }],
              enabledProjects: [{ projectId: 'project-alpha', displayName: 'Project Alpha' }],
              materialization: [{ targetType: 'project', targetId: 'project-alpha', status: 'pending', mode: 'symlink', lastError: null }],
              effectiveState: 'enabled',
              restrictionNote: null,
              updatedAt: '2026-04-11T00:00:00.000Z',
            },
          ],
        },
      },
      remote: {
        mySkills: {
          status: 'loaded',
          message: 'ok',
          items: [
            { skillId: 'skill-owned', title: 'Owned Skill', status: 'published', versions: [{ version: '2.0.0' }] },
          ],
        },
      },
    }),
  );

  assert.match(markup, /data-my-skill-tab="installed"/);
  assert.match(markup, /skill-shared/);
  assert.match(markup, /Codex/);
  assert.match(markup, /Project Alpha/);
  assert.match(markup, /pending/);
  assert.doesNotMatch(markup, /Owned Skill/);
});

test('my skill page renders published tab from the owner feed without conflating installed data', async () => {
  const markup = await renderPage(
    createState({
      mySkillTab: 'published',
      local: {
        installedSkills: {
          status: 'loaded',
          message: 'ok',
          items: [{ skillId: 'skill-local-only', versions: [{ version: '1.0.0', packageId: 'pkg-local-1' }] }],
        },
      },
      remote: {
        mySkills: {
          status: 'loaded',
          message: 'ok',
          items: [
            {
              skillId: 'skill-owned',
              title: 'Owned Skill',
              summary: 'Published summary',
              status: 'changes_requested',
              visibility: 'department',
              versions: [{ version: '2.1.0', packageId: 'pkg-owned-2' }],
            },
          ],
        },
      },
    }),
  );

  assert.match(markup, /data-my-skill-tab="published"/);
  assert.match(markup, /Owned Skill/);
  assert.match(markup, /changes_requested/);
  assert.match(markup, /department/);
  assert.doesNotMatch(markup, /skill-local-only/);
});

test('my skill page keeps the publish workbench behind its own tab', async () => {
  const markup = await renderPage(createState({ mySkillTab: 'publish' }));

  assert.match(markup, /data-my-skill-tab="publish"/);
  assert.match(markup, /Publish Workbench/);
  assert.match(markup, /data-publish-form=/);
  assert.doesNotMatch(markup, /Installed skill/);
});
