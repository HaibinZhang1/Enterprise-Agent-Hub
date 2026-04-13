import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
require('ts-node/register/transpile-only');

const { SkillsService, buildSkillListQueryPlan } = require('../src/skills/skills.service.ts');

test('buildSkillListQueryPlan pushes search, filters, sort, and pagination into SQL', () => {
  const plan = buildSkillListQueryPlan({
    q: 'review helper',
    departmentID: '前端组',
    compatibleTool: 'codex',
    category: 'engineering',
    riskLevel: 'low',
    publishedSince: '2026-04-01T00:00:00.000Z',
    updatedSince: '2026-04-10T00:00:00.000Z',
    accessScope: 'authorized_only',
    sort: 'download_count',
    page: '2',
    pageSize: '10',
    installed: 'true',
    enabled: 'true',
  });

  assert.match(plan.text, /skill_search_documents/);
  assert.match(plan.text, /websearch_to_tsquery/);
  assert.match(plan.text, /POSITION\(LOWER\(\$1\) IN LOWER\(doc\.document\)\) > 0/);
  assert.match(plan.text, /EXISTS \(\s*SELECT 1\s*FROM skill_tool_compatibilities tc_filter/s);
  assert.match(plan.text, /d\.name = \$2/);
  assert.match(plan.text, /s\.category = \$4/);
  assert.match(plan.text, /v\.risk_level = \$5/);
  assert.match(plan.text, /v\.published_at >= \$6/);
  assert.match(plan.text, /s\.updated_at >= \$7/);
  assert.match(plan.text, /base\.download_count::bigint DESC/);
  assert.doesNotMatch(plan.text, /installed/i);
  assert.doesNotMatch(plan.text, /enabled/i);
  assert.equal(plan.page, 2);
  assert.equal(plan.pageSize, 10);
  assert.deepEqual(plan.values, [
    'review helper',
    '前端组',
    'codex',
    'engineering',
    'low',
    '2026-04-01T00:00:00.000Z',
    '2026-04-10T00:00:00.000Z',
    10,
    10,
  ]);
});

test('SkillsService.list executes the database plan and maps paged rows to summaries', async () => {
  const calls = [];
  const database = {
    async query(text, values) {
      calls.push({ text, values });
      return {
        rows: [
          {
            id: 'skill-row-1',
            skill_id: 'codex-review-helper',
            display_name: 'Codex Review Helper',
            description: '为 Codex 项目提供代码审查提示和提交前检查清单。',
            status: 'published',
            visibility_level: 'public_installable',
            category: 'engineering',
            updated_at: new Date('2026-04-11T02:30:00Z'),
            version: '1.2.0',
            risk_level: 'low',
            risk_description: '低风险：不含可执行二进制。',
            review_summary: 'P1 审核通过：仅包含提示词和 README。',
            published_at: new Date('2026-04-11T02:30:00Z'),
            author_name: '李四',
            author_department: '前端组',
            tags: ['codex', 'review', 'quality'],
            compatible_tools: ['codex'],
            compatible_systems: ['macos', 'windows'],
            star_count: '12',
            download_count: '33',
            total_count: '1',
          },
        ],
      };
    },
  };

  const service = new SkillsService(database);
  const page = await service.list({ q: 'codex', sort: 'relevance', page: '1', pageSize: '5' });

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /LIMIT \$2\s+OFFSET \$3/);
  assert.deepEqual(calls[0].values, ['codex', 5, 0]);
  assert.equal(page.page, 1);
  assert.equal(page.pageSize, 5);
  assert.equal(page.total, 1);
  assert.equal(page.hasMore, false);
  assert.equal(page.items[0].skillID, 'codex-review-helper');
  assert.equal(page.items[0].canInstall, true);
  assert.equal(page.items[0].installState, 'not_installed');
  assert.equal(page.items[0].starCount, 12);
  assert.equal(page.items[0].downloadCount, 33);
});
