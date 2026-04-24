import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const require = createRequire(import.meta.url);
require('ts-node/register/transpile-only');

const { SkillsService, buildSkillLeaderboardQueryPlan, buildSkillListQueryPlan } = require('../src/skills/skills.service.ts');
const { PackageDownloadService } = require('../src/skills/package-download.service.ts');
const { SkillAuthorizationService } = require('../src/skills/skill-authorization.service.ts');
const { SkillQueryService } = require('../src/skills/skill-query.service.ts');

function skillRow(overrides = {}) {
  return {
    id: 'skill-row-1',
    skill_id: 'codex-review-helper',
    display_name: 'Codex Review Helper',
    description: '为 Codex 项目提供代码审查提示和提交前检查清单。',
    status: 'published',
    visibility_level: 'public_installable',
    category: '开发',
    updated_at: new Date('2026-04-11T02:30:00Z'),
    version: '1.2.0',
    risk_level: 'low',
    risk_description: '低风险：不含可执行二进制。',
    review_summary: 'P1 审核通过：仅包含提示词和 README。',
    published_at: new Date('2026-04-11T02:30:00Z'),
    author_name: '李四',
    author_department: '前端组',
    tags: ['代码', '审查', '清单'],
    compatible_tools: ['codex'],
    compatible_systems: ['macos', 'windows'],
    scope_type: null,
    scope_department_ids: null,
    scope_department_paths: null,
    star_count: '12',
    starred: false,
    download_count: '33',
    total_count: '1',
    ...overrides,
  };
}

function skillsServiceForRepository(repository, packageStorage) {
  const authorization = new SkillAuthorizationService(repository);
  const queryService = new SkillQueryService(repository, authorization, packageStorage);
  const packageDownloads = new PackageDownloadService(repository, authorization);
  return new SkillsService(queryService, packageDownloads, repository);
}

test('buildSkillListQueryPlan pushes search, filters, sort, and pagination into SQL', () => {
  const plan = buildSkillListQueryPlan({
    q: 'review helper',
    departmentID: '前端组',
    compatibleTool: 'codex',
    category: '开发',
    riskLevel: 'low',
    publishedSince: '2026-04-01T00:00:00.000Z',
    updatedSince: '2026-04-10T00:00:00.000Z',
    accessScope: 'authorized_only',
    sort: 'download_count',
    page: '2',
    pageSize: '10',
    installed: 'true',
    enabled: 'true',
  }, { requirePublished: true });

  assert.match(plan.text, /skill_search_documents/);
  assert.match(plan.text, /websearch_to_tsquery/);
  assert.match(plan.text, /POSITION\(LOWER\(\$1\) IN LOWER\(doc\.document\)\) > 0/);
  assert.match(plan.text, /s\.status = 'published'/);
  assert.match(plan.text, /EXISTS \(\s*SELECT 1\s*FROM skill_tool_compatibilities tc_filter/s);
  assert.match(plan.text, /d\.name = \$2/);
  assert.match(plan.text, /s\.category = \$4/);
  assert.match(plan.text, /v\.risk_level = \$5/);
  assert.match(plan.text, /v\.published_at >= \$6/);
  assert.match(plan.text, /s\.updated_at >= \$7/);
  assert.match(plan.text, /count\(DISTINCT user_id\)::bigint AS download_count/);
  assert.match(plan.text, /WHERE purpose = 'install'/);
  assert.match(plan.text, /base\.download_count::bigint DESC/);
  assert.doesNotMatch(plan.text, /installed/i);
  assert.doesNotMatch(plan.text, /enabled/i);
  assert.equal(plan.page, 2);
  assert.equal(plan.pageSize, 10);
  assert.deepEqual(plan.values, [
    'review helper',
    '前端组',
    'codex',
    '开发',
    'low',
    '2026-04-01T00:00:00.000Z',
    '2026-04-10T00:00:00.000Z',
    10,
    10,
  ]);
});

test('buildSkillListQueryPlan pushes authenticated visibility rules into SQL', () => {
  const plan = buildSkillListQueryPlan(
    {
      accessScope: 'authorized_only',
      page: '3',
      pageSize: '25',
    },
    {
      requirePublished: true,
      requester: {
        user_id: 'user-1',
        department_id: 'dept-child',
        department_path: 'company/product/frontend',
      },
    },
  );

  assert.match(plan.text, /s\.status = 'published'/);
  assert.match(plan.text, /auth\.scope_type = 'all_employees'/);
  assert.match(plan.text, /auth\.scope_type IN \('current_department', 'selected_departments'\)/);
  assert.match(plan.text, /unnest\(auth\.scope_department_paths\)/);
  assert.match(plan.text, /auth\.scope_type IS NULL AND s\.visibility_level = 'public_installable'/);
  assert.match(plan.text, /s\.visibility_level <> 'private'/);
  assert.match(plan.text, /LEFT JOIN skill_stars requester_star/);
  assert.match(plan.text, /requester_star\.user_id = \$6/);
  assert.match(plan.text, /requester_star\.user_id IS NOT NULL/);
  assert.doesNotMatch(plan.text, /s\.visibility_level IN \('public_installable', 'detail_visible', 'summary_visible'\)/);
  assert.deepEqual(plan.values, ['dept-child', 'company/product/frontend', 'company/product/frontend', 25, 50, 'user-1']);
});

test('buildSkillListQueryPlan filters by any selected Chinese tag', () => {
  const plan = buildSkillListQueryPlan({
    tags: '代码, 审查,代码',
    page: '1',
    pageSize: '20',
  }, { requirePublished: true });

  assert.match(plan.text, /FROM skill_tags st_filter/);
  assert.match(plan.text, /st_filter\.tag = ANY\(\$1::text\[\]\)/);
  assert.deepEqual(plan.values, [['代码', '审查'], 20, 0]);
});

test('buildSkillLeaderboardQueryPlan aggregates seven-day heat inputs and excludes private skills', () => {
  const plan = buildSkillLeaderboardQueryPlan(7);

  assert.match(plan.text, /recent_star_counts/);
  assert.match(plan.text, /recent_download_counts/);
  assert.match(plan.text, /created_at >= now\(\) - \(\$1::int \* INTERVAL '1 day'\)/);
  assert.match(plan.text, /count\(DISTINCT user_id\)::bigint AS recent_download_count/);
  assert.match(plan.text, /COALESCE\(recent_downloads\.recent_download_count, 0\) \* 6/);
  assert.match(plan.text, /COALESCE\(recent_stars\.recent_star_count, 0\) \* 3/);
  assert.match(plan.text, /WHEN COALESCE\(v\.risk_level, 'unknown'\) = 'high' THEN 0\.5/);
  assert.match(plan.text, /s\.visibility_level <> 'private'/);
  assert.deepEqual(plan.values, [7]);
});

test('skills leaderboards map hot, star, and download rankings with tie-breakers', async () => {
  const rows = [
    skillRow({ skill_id: 'fresh-downloads', display_name: '近下载', star_count: '20', download_count: '100', recent_star_count: '1', recent_download_count: '3', hot_score: '21' }),
    skillRow({ skill_id: 'fresh-stars', display_name: '近 Star', star_count: '80', download_count: '40', recent_star_count: '8', recent_download_count: '0', hot_score: '24' }),
    skillRow({ skill_id: 'quiet-giant', display_name: '累计高', star_count: '200', download_count: '900', recent_star_count: '0', recent_download_count: '0', hot_score: '0' }),
  ];
  const repository = {
    async listSkillLeaderboards(plan) {
      assert.deepEqual(plan.values, [7]);
      return rows;
    },
    async loadRequesterScope() {
      return null;
    },
  };

  const service = skillsServiceForRepository(repository);
  const result = await service.leaderboards();

  assert.equal(result.windowDays, 7);
  assert.deepEqual(result.hot.map((skill) => skill.skillID), ['fresh-stars', 'fresh-downloads']);
  assert.deepEqual(result.stars.map((skill) => skill.skillID), ['quiet-giant', 'fresh-stars', 'fresh-downloads']);
  assert.deepEqual(result.downloads.map((skill) => skill.skillID), ['quiet-giant', 'fresh-downloads', 'fresh-stars']);
  assert.equal(result.hot[0].recentStarCount, 8);
  assert.equal(result.hot[0].hotScore, 24);
});

test('skills leaderboards route is declared before skill detail route', () => {
  const controllerPath = fileURLToPath(new URL('../src/skills/skills.controller.ts', import.meta.url));
  const source = readFileSync(controllerPath, 'utf8');

  assert.ok(source.indexOf("@Get('leaderboards')") > -1);
  assert.ok(source.indexOf("@Get('leaderboards')") < source.indexOf("@Get(':skillID')"));
});

test('SkillsService.list executes a paged SQL plan and maps rows to summaries', async () => {
  const calls = [];
  const repository = {
    async listSkills(plan) {
      calls.push(plan);
      return [skillRow()];
    },
    async loadRequesterScope() {
      throw new Error('anonymous list should not load requester scope');
    },
  };

  const service = skillsServiceForRepository(repository);
  const page = await service.list({ q: 'codex', sort: 'relevance', page: '1', pageSize: '5' });

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /LIMIT \$2\s+OFFSET \$3/);
  assert.match(calls[0].text, /s\.status = 'published'/);
  assert.deepEqual(calls[0].values, ['codex', 5, 0]);
  assert.equal(page.page, 1);
  assert.equal(page.pageSize, 5);
  assert.equal(page.total, 1);
  assert.equal(page.hasMore, false);
  assert.equal(page.items[0].skillID, 'codex-review-helper');
  assert.equal(page.items[0].canInstall, true);
  assert.equal(page.items[0].installState, 'not_installed');
  assert.equal(page.items[0].starCount, 12);
  assert.equal(page.items[0].starred, false);
  assert.equal(page.items[0].downloadCount, 33);
});

test('SkillsService.list restores requester starred state from rows', async () => {
  const repository = {
    async listSkills() {
      return [skillRow({ starred: true })];
    },
    async loadRequesterScope(userID) {
      assert.equal(userID, 'user-1');
      return {
        user_id: 'user-1',
        department_id: 'dept-frontend',
        department_path: 'company/product/frontend',
      };
    },
  };

  const service = skillsServiceForRepository(repository);
  const page = await service.list({ page: '1', pageSize: '5' }, 'user-1');

  assert.equal(page.items[0].starred, true);
});

test('SkillsService.detail returns README content and published version history for full access', async () => {
  const repository = {
    async findSkill(skillID) {
      assert.equal(skillID, 'codex-review-helper');
      return skillRow();
    },
    async listSkillVersions(skillRowID) {
      assert.equal(skillRowID, 'skill-row-1');
      return [
        { version: '1.2.0', published_at: new Date('2026-04-11T02:30:00Z'), changelog: '当前版本', risk_level: 'low' },
        { version: '1.1.0', published_at: new Date('2026-03-11T02:30:00Z'), changelog: '上一版本', risk_level: 'medium' },
      ];
    },
    async loadPublishedPackageForVersion(skillID, version) {
      assert.equal(skillID, 'codex-review-helper');
      assert.equal(version, '1.2.0');
      return {
        id: 'package-1',
        skill_id: skillID,
        version,
        bucket: 'skill-packages',
        sha256: 'sha256:abc',
        size_bytes: 2048,
        file_count: 3,
        object_key: 'skills/codex-review-helper/1.2.0/package.zip',
        content_type: 'application/zip',
      };
    },
  };
  const packageStorage = {
    async readPackageMarkdownFile(bucket, objectKey, fileName) {
      assert.equal(bucket, 'skill-packages');
      assert.equal(objectKey, 'skills/codex-review-helper/1.2.0/package.zip');
      assert.equal(fileName, 'README.md');
      return '# Codex Review Helper\n\nREADME body';
    },
  };

  const service = skillsServiceForRepository(repository, packageStorage);
  const detail = await service.detail('codex-review-helper');

  assert.equal(detail.detailAccess, 'full');
  assert.equal(detail.readme, '# Codex Review Helper\n\nREADME body');
  assert.deepEqual(detail.versions, [
    { version: '1.2.0', publishedAt: '2026-04-11T02:30:00.000Z', changelog: '当前版本', riskLevel: 'low' },
    { version: '1.1.0', publishedAt: '2026-03-11T02:30:00.000Z', changelog: '上一版本', riskLevel: 'medium' },
  ]);
});

test('SkillsService.detail keeps README and versions out of summary-only details', async () => {
  const repository = {
    async findSkill() {
      return skillRow({
        visibility_level: 'summary_visible',
        scope_type: 'selected_departments',
        scope_department_ids: ['dept-other'],
      });
    },
    async listSkillVersions() {
      throw new Error('summary-only detail must not load versions');
    },
    async loadPublishedPackageForVersion() {
      throw new Error('summary-only detail must not read package content');
    },
  };
  const packageStorage = {
    async readPackageMarkdownFile() {
      throw new Error('summary-only detail must not read README');
    },
  };

  const service = skillsServiceForRepository(repository, packageStorage);
  const detail = await service.detail('codex-review-helper');

  assert.equal(detail.detailAccess, 'summary');
  assert.equal('readme' in detail, false);
  assert.equal('versions' in detail, false);
});

test('SkillAuthorizationService evaluates department tree and detail fallback rules', () => {
  const authorization = new SkillAuthorizationService({});
  const requester = {
    user_id: 'user-1',
    department_id: 'dept-child',
    department_path: 'company/product/frontend',
  };

  assert.deepEqual(
    authorization.authorizationFor(
      skillRow({
        visibility_level: 'private',
        scope_type: 'department_tree',
        scope_department_ids: ['dept-parent'],
        scope_department_paths: ['company/product'],
      }),
      requester,
    ),
    { isAuthorized: true, detailAccess: 'full' },
  );

  assert.deepEqual(
    authorization.authorizationFor(
      skillRow({
        visibility_level: 'summary_visible',
        scope_type: 'selected_departments',
        scope_department_ids: ['dept-other'],
        scope_department_paths: null,
      }),
      requester,
    ),
    { isAuthorized: false, detailAccess: 'summary' },
  );

  assert.deepEqual(
    authorization.authorizationFor(
      skillRow({
        visibility_level: 'private',
        scope_type: 'selected_departments',
        scope_department_ids: ['dept-other'],
        scope_department_paths: null,
      }),
      requester,
    ),
    { isAuthorized: false, detailAccess: 'none' },
  );
});

test('PackageDownloadService denies unauthorized download tickets before loading packages', async () => {
  let packageLoaded = false;
  const repository = {
    async findSkill() {
      return skillRow({
        visibility_level: 'private',
        scope_type: 'selected_departments',
        scope_department_ids: ['dept-a'],
      });
    },
    async loadRequesterScope() {
      return {
        user_id: 'user-1',
        department_id: 'dept-b',
        department_path: 'company/product/backend',
      };
    },
    async loadPublishedPackageForVersion() {
      packageLoaded = true;
      return null;
    },
  };

  const service = new PackageDownloadService(repository, new SkillAuthorizationService(repository));
  await assert.rejects(() => service.downloadTicket('codex-review-helper', {}, 'user-1'), /permission_denied/);
  assert.equal(packageLoaded, false);
});

test('PackageDownloadService issues tickets for authorized published packages', async () => {
  const insertedTickets = [];
  const downloadEvents = [];
  const repository = {
    async findSkill() {
      return skillRow();
    },
    async loadRequesterScope() {
      return {
        user_id: 'user-1',
        department_id: 'dept-frontend',
        department_path: 'company/product/frontend',
      };
    },
    async loadPublishedPackageForVersion(skillID, version) {
      assert.equal(skillID, 'codex-review-helper');
      assert.equal(version, '1.2.0');
      return {
        id: 'package-1',
        skill_id: 'codex-review-helper',
        version: '1.2.0',
        bucket: 'skills',
        sha256: 'sha256:abc',
        size_bytes: 2048,
        file_count: 3,
        object_key: 'skills/codex-review-helper/1.2.0/package.zip',
        content_type: 'application/zip',
      };
    },
    async insertPackageDownloadTicket(input) {
      insertedTickets.push(input);
    },
    async recordDownloadEvent(input) {
      downloadEvents.push(input);
    },
  };

  const service = new PackageDownloadService(repository, new SkillAuthorizationService(repository));
  const ticket = await service.downloadTicket('codex-review-helper', { purpose: 'install' }, 'user-1');

  assert.equal(insertedTickets.length, 1);
  assert.equal(insertedTickets[0].packageRef, 'package-1');
  assert.equal(insertedTickets[0].purpose, 'published');
  assert.equal(insertedTickets[0].requiresAuth, false);
  assert.deepEqual(downloadEvents, [
    {
      userID: 'user-1',
      skillRowID: 'skill-row-1',
      version: '1.2.0',
      purpose: 'install',
    },
  ]);
  assert.equal(ticket.skillID, 'codex-review-helper');
  assert.equal(ticket.packageHash, 'sha256:abc');
  assert.match(ticket.packageURL, /^\/skill-packages\/package-1\/download\?ticket=/);
});
