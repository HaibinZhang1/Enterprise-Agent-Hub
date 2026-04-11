import assert from 'node:assert/strict';
import test from 'node:test';

import { createDesktopShellState } from '../apps/desktop/ui/core/store.js';
import { createMarketPage } from '../apps/desktop/ui/pages/market.js';
import { createProjectsPage } from '../apps/desktop/ui/pages/projects.js';
import { createToolsPage } from '../apps/desktop/ui/pages/tools.js';

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

async function renderPage(factory, state) {
  const host = { innerHTML: '' };
  const page = factory({
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

test('projects page renders a project skill-management panel with single-skill actions', async () => {
  const markup = await renderPage(
    createProjectsPage,
    createState({
      local: {
        projects: {
          status: 'loaded',
          currentProjectId: 'project-alpha',
          message: 'ok',
          items: [
            {
              projectId: 'project-alpha',
              displayName: 'Project Alpha',
              projectPath: '/workspace/project-alpha',
              skillsDirectory: '/workspace/project-alpha/skills',
              effectiveSummary: '1 skill binding ready for Project Alpha.',
              issues: [],
              skillBindings: [
                {
                  skillId: 'skill-shared',
                  packageId: 'pkg-shared-1',
                  version: '1.0.0',
                  enabled: true,
                  materializationStatus: { status: 'pending', mode: 'symlink' },
                },
              ],
            },
          ],
        },
      },
    }),
  );

  assert.match(markup, /Skill management/i);
  assert.match(markup, /skill-shared/);
  assert.match(markup, /1\.0\.0/);
  assert.match(markup, /pending/i);
  assert.match(markup, /data-project-skill-bind-form=/);
  assert.match(markup, /data-project-skill-toggle=/);
  assert.match(markup, /1 skill binding ready for Project Alpha/i);
});

test('tools page renders health, skills directory, and single-skill tool actions', async () => {
  const markup = await renderPage(
    createToolsPage,
    createState({
      local: {
        tools: {
          status: 'loaded',
          message: 'ok',
          items: [
            {
              toolId: 'codex',
              displayName: 'Codex',
              healthState: 'ready',
              healthLabel: 'Ready',
              skillsDirectory: '/tools/codex/skills',
              skillsDirectorySummary: '/tools/codex/skills · materialization enabled',
              issues: [],
              skillBindings: [
                {
                  skillId: 'skill-tool-only',
                  packageId: 'pkg-tool-1',
                  version: '2.0.0',
                  enabled: true,
                  materializationStatus: { status: 'pending', mode: 'symlink' },
                },
              ],
            },
          ],
        },
      },
    }),
  );

  assert.match(markup, /skills directory/i);
  assert.match(markup, /materialization enabled/i);
  assert.match(markup, /skill-tool-only/);
  assert.match(markup, /2\.0\.0/);
  assert.match(markup, /data-tool-skill-bind-form=/);
  assert.match(markup, /data-tool-skill-toggle=/);
});

test('tools page keeps repair available for non-ready tools instead of showing a false healthy state', async () => {
  const markup = await renderPage(
    createToolsPage,
    createState({
      local: {
        tools: {
          status: 'loaded',
          message: 'ok',
          items: [
            {
              toolId: 'git',
              displayName: 'Git',
              healthState: 'read_only',
              healthLabel: 'Read-only',
              skillsDirectory: '/tools/git/skills',
              skillsDirectorySummary: '/tools/git/skills · derived',
              issues: ['Discovered binary is not writable by the desktop shell.'],
              skillBindings: [],
              actions: { canRepair: true, canRescan: true, canMaterialize: false },
            },
          ],
        },
      },
    }),
  );

  assert.match(markup, /Read-only/);
  assert.match(markup, /data-tools-repair="git"/);
  assert.doesNotMatch(markup, />Healthy</);
});

test('market page renders single-target install forms for authenticated users', async () => {
  const markup = await renderPage(
    createMarketPage,
    createState({
      session: {
        user: {
          username: 'publisher',
          roleCode: 'employee_lv6',
        },
      },
      local: {
        projects: {
          status: 'loaded',
          currentProjectId: 'project-alpha',
          message: 'ok',
          items: [{ projectId: 'project-alpha', displayName: 'Project Alpha', skillsDirectory: '/workspace/project-alpha/skills' }],
        },
        tools: {
          status: 'loaded',
          message: 'ok',
          items: [{ toolId: 'codex', displayName: 'Codex', installPath: '/usr/local/bin/codex' }],
        },
      },
      remote: {
        market: {
          status: 'loaded',
          message: 'ok',
          results: [
            {
              skillId: 'skill-market-1',
              title: 'Enterprise Search Assistant',
              summary: 'Published search helper available from the connected MVP market.',
              publishedVersion: '1.0.0',
              canInstall: true,
            },
          ],
        },
      },
    }),
  );

  assert.match(markup, /data-market-install-form=/);
  assert.match(markup, /data-market-target-type=/);
  assert.match(markup, /data-market-target-id=/);
  assert.match(markup, /Preview install to project/);
  assert.match(markup, /Preview install to tool/);
  assert.doesNotMatch(markup, /当前可继续对 .* 接入真实安装流程/i);
});

test('market page keeps the protected install intent for guests', async () => {
  const markup = await renderPage(
    createMarketPage,
    createState({
      remote: {
        market: {
          status: 'loaded',
          message: 'ok',
          results: [
            {
              skillId: 'skill-market-1',
              title: 'Enterprise Search Assistant',
              summary: 'Published search helper available from the connected MVP market.',
              publishedVersion: '1.0.0',
              canInstall: true,
            },
          ],
        },
      },
    }),
  );

  assert.match(markup, /data-protected-action="market-install"/);
});
