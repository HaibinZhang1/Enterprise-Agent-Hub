BEGIN;

INSERT INTO departments (id, parent_id, name, path, level, status)
VALUES
  ('dept_company', NULL, '集团', '/集团', 0, 'active'),
  ('dept_engineering', 'dept_company', '技术部', '/集团/技术部', 1, 'active'),
  ('dept_frontend', 'dept_engineering', '前端组', '/集团/技术部/前端组', 2, 'active'),
  ('dept_backend', 'dept_engineering', '后端组', '/集团/技术部/后端组', 2, 'active'),
  ('dept_design', 'dept_company', '设计平台组', '/集团/设计平台组', 1, 'active'),
  ('dept_ops', 'dept_company', '运维组', '/集团/运维组', 1, 'active')
ON CONFLICT (id) DO UPDATE
SET
  parent_id = EXCLUDED.parent_id,
  name = EXCLUDED.name,
  path = EXCLUDED.path,
  level = EXCLUDED.level,
  status = EXCLUDED.status;

INSERT INTO users (id, username, password_hash, display_name, department_id, role, admin_level, status)
VALUES
  (
    'u_001',
    'demo',
    'scrypt:0123456789abcdef0123456789abcdef:56c7e535798d6be9224ce9fa07725311fff0d48a6648015e48cbc7227480d75236e0d5c5a429107908b31aba707741dee997c05bea3ff713c52adcd567f37204',
    '张三',
    'dept_frontend',
    'normal_user',
    NULL,
    'active'
  ),
  (
    'u_admin_l1',
    'superadmin',
    'scrypt:0123456789abcdef0123456789abcdef:56c7e535798d6be9224ce9fa07725311fff0d48a6648015e48cbc7227480d75236e0d5c5a429107908b31aba707741dee997c05bea3ff713c52adcd567f37204',
    '系统管理员',
    'dept_company',
    'admin',
    1,
    'active'
  ),
  (
    'u_admin_l2_eng',
    'engadmin',
    'scrypt:0123456789abcdef0123456789abcdef:56c7e535798d6be9224ce9fa07725311fff0d48a6648015e48cbc7227480d75236e0d5c5a429107908b31aba707741dee997c05bea3ff713c52adcd567f37204',
    '技术部管理员',
    'dept_engineering',
    'admin',
    2,
    'active'
  ),
  (
    'u_admin_l3_front',
    'frontadmin',
    'scrypt:0123456789abcdef0123456789abcdef:56c7e535798d6be9224ce9fa07725311fff0d48a6648015e48cbc7227480d75236e0d5c5a429107908b31aba707741dee997c05bea3ff713c52adcd567f37204',
    '前端组管理员',
    'dept_frontend',
    'admin',
    3,
    'active'
  ),
  (
    'u_author_frontend',
    'author_frontend',
    'scrypt:0123456789abcdef0123456789abcdef:56c7e535798d6be9224ce9fa07725311fff0d48a6648015e48cbc7227480d75236e0d5c5a429107908b31aba707741dee997c05bea3ff713c52adcd567f37204',
    '李四',
    'dept_frontend',
    'normal_user',
    NULL,
    'active'
  ),
  (
    'u_author_design',
    'author_design',
    'scrypt:0123456789abcdef0123456789abcdef:56c7e535798d6be9224ce9fa07725311fff0d48a6648015e48cbc7227480d75236e0d5c5a429107908b31aba707741dee997c05bea3ff713c52adcd567f37204',
    '王五',
    'dept_design',
    'normal_user',
    NULL,
    'active'
  ),
  (
    'u_author_ops',
    'author_ops',
    'scrypt:0123456789abcdef0123456789abcdef:56c7e535798d6be9224ce9fa07725311fff0d48a6648015e48cbc7227480d75236e0d5c5a429107908b31aba707741dee997c05bea3ff713c52adcd567f37204',
    '赵六',
    'dept_ops',
    'normal_user',
    NULL,
    'active'
  )
ON CONFLICT (id) DO UPDATE
SET
  username = EXCLUDED.username,
  password_hash = EXCLUDED.password_hash,
  display_name = EXCLUDED.display_name,
  department_id = EXCLUDED.department_id,
  role = EXCLUDED.role,
  admin_level = EXCLUDED.admin_level,
  status = EXCLUDED.status;

WITH upsert_skill AS (
  INSERT INTO skills (skill_id, display_name, description, author_id, department_id, status, visibility_level, category)
  VALUES
    ('codex-review-helper', 'Codex Review Helper', '为 Codex 项目提供代码审查提示和提交前检查清单。', 'u_author_frontend', 'dept_frontend', 'published', 'public_installable', 'engineering'),
    ('design-guideline-lite', 'Design Guideline Lite', '企业 UI 规范摘要，详情仅对授权部门开放。', 'u_author_design', 'dept_design', 'published', 'summary_visible', 'design'),
    ('legacy-dept-runbook', 'Legacy Department Runbook', '已下架的部门运行手册，验证不可安装场景。', 'u_author_ops', 'dept_ops', 'delisted', 'detail_visible', 'operations')
  ON CONFLICT (skill_id) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    author_id = EXCLUDED.author_id,
    department_id = EXCLUDED.department_id,
    status = EXCLUDED.status,
    visibility_level = EXCLUDED.visibility_level,
    category = EXCLUDED.category,
    updated_at = now()
  RETURNING id, skill_id
), version_rows AS (
  INSERT INTO skill_versions (skill_id, version, readme_object_key, changelog, risk_level, risk_description, review_summary, published_at)
  SELECT id, '1.2.0', 'skills/codex-review-helper/1.2.0/readme.md', 'P1 seed', 'low', '低风险：不含可执行二进制。', 'P1 审核通过：仅包含提示词和 README。', now() FROM upsert_skill WHERE skill_id = 'codex-review-helper'
  UNION ALL
  SELECT id, '0.9.0', 'skills/design-guideline-lite/0.9.0/readme.md', 'P1 seed', 'unknown', NULL, NULL, now() FROM upsert_skill WHERE skill_id = 'design-guideline-lite'
  UNION ALL
  SELECT id, '2.0.1', 'skills/legacy-dept-runbook/2.0.1/readme.md', 'P1 seed', 'medium', NULL, '下架验证数据', now() FROM upsert_skill WHERE skill_id = 'legacy-dept-runbook'
  ON CONFLICT (skill_id, version) DO UPDATE
  SET changelog = EXCLUDED.changelog
  RETURNING id, skill_id, version
), packages AS (
  INSERT INTO skill_packages (id, skill_version_id, bucket, object_key, sha256, size_bytes, file_count)
  SELECT 'pkg_' || s.skill_id || '_' || replace(v.version, '.', '_'), v.id, 'skill-packages', 'skills/' || s.skill_id || '/' || v.version || '/package.zip', 'sha256:9650d3afdfb7b401ff9c52015f277ec075e768a64aefcc8872257dd51b4cdef5', 591, 2
  FROM version_rows v
  JOIN skills s ON s.id = v.skill_id
  ON CONFLICT (id) DO UPDATE
  SET sha256 = EXCLUDED.sha256, size_bytes = EXCLUDED.size_bytes, file_count = EXCLUDED.file_count
  RETURNING skill_version_id
)
UPDATE skills s
SET current_version_id = v.id
FROM version_rows v
WHERE s.id = v.skill_id;

INSERT INTO skill_tags (skill_id, tag)
SELECT s.id, tag
FROM skills s
CROSS JOIN LATERAL unnest(
  CASE s.skill_id
    WHEN 'codex-review-helper' THEN ARRAY['codex', 'review', 'quality']
    WHEN 'design-guideline-lite' THEN ARRAY['design', 'restricted']
    ELSE ARRAY['ops', 'delisted']
  END
) AS tag
ON CONFLICT DO NOTHING;

INSERT INTO skill_tool_compatibilities (skill_id, tool_id, system)
SELECT s.id, tool_id, system
FROM skills s
CROSS JOIN LATERAL (
  VALUES
    ('codex', 'macos'),
    ('codex', 'windows'),
    ('codex', 'linux'),
    ('custom_directory', 'macos'),
    ('custom_directory', 'windows'),
    ('custom_directory', 'linux')
) AS compatibility(tool_id, system)
WHERE s.skill_id = 'codex-review-helper'
ON CONFLICT DO NOTHING;

INSERT INTO notifications (id, user_id, type, title, summary, object_type, object_id, read_at)
VALUES
  ('n_001', 'u_001', 'connection_restored', '服务连接已恢复', 'Desktop 已重新连接到企业内网 API。', 'connection', NULL, NULL),
  ('n_002', 'u_001', 'skill_update_available', 'Skill 有可用更新', 'Codex Review Helper 有新版本可安装。', 'skill', 'codex-review-helper', now()),
  ('n_003', 'u_admin_l1', 'skill_scope_restricted', '设计规范权限范围更新', 'Design Guideline Lite 当前只保留摘要公开。', 'skill', 'design-guideline-lite', NULL)
ON CONFLICT (id) DO UPDATE
SET summary = EXCLUDED.summary, read_at = EXCLUDED.read_at;

INSERT INTO review_items (
  id,
  skill_id,
  skill_display_name,
  submitter_id,
  submitter_name,
  submitter_department_id,
  submitter_department_name,
  review_type,
  review_status,
  risk_level,
  summary,
  description,
  review_summary,
  lock_owner_id,
  submitted_at,
  updated_at
)
VALUES
  (
    'rv_001',
    'codex-review-helper',
    'Codex Review Helper',
    'u_author_frontend',
    '李四',
    'dept_frontend',
    '前端组',
    'publish',
    'pending',
    'low',
    '等待审核：代码审查辅助 Skill 首次发布。',
    '包含 README、检查清单和少量文档资源，不含可执行脚本。',
    NULL,
    NULL,
    now() - interval '2 days',
    now() - interval '2 days'
  ),
  (
    'rv_002',
    'design-guideline-lite',
    'Design Guideline Lite',
    'u_author_design',
    '王五',
    'dept_design',
    '设计平台组',
    'permission_change',
    'in_review',
    'unknown',
    '正在复核：公开范围由摘要公开调整为详情公开。',
    '涉及设计规范细则的详情可见范围调整，需确认部门授权策略。',
    '当前由系统管理员查看授权范围变更影响。',
    'u_admin_l1',
    now() - interval '1 day',
    now() - interval '12 hours'
  ),
  (
    'rv_003',
    'legacy-dept-runbook',
    'Legacy Department Runbook',
    'u_author_ops',
    '赵六',
    'dept_ops',
    '运维组',
    'update',
    'reviewed',
    'medium',
    '已审核：旧版运维手册更新已完成。',
    '更新说明聚焦历史运行手册内容整理和下架说明补充。',
    '审核结论：允许保留详情公开，不允许重新上架。',
    'u_admin_l1',
    now() - interval '5 days',
    now() - interval '4 days'
  )
ON CONFLICT (id) DO UPDATE
SET
  summary = EXCLUDED.summary,
  description = EXCLUDED.description,
  review_summary = EXCLUDED.review_summary,
  lock_owner_id = EXCLUDED.lock_owner_id,
  updated_at = EXCLUDED.updated_at;

INSERT INTO review_item_history (id, review_item_id, actor_id, action, comment, created_at)
VALUES
  ('rvh_001', 'rv_001', 'u_author_frontend', 'submitted', '首次提交发布请求。', now() - interval '2 days'),
  ('rvh_002', 'rv_002', 'u_author_design', 'submitted', '提交权限变更申请。', now() - interval '1 day'),
  ('rvh_003', 'rv_002', 'u_admin_l1', 'claimed', '系统管理员已领取复核。', now() - interval '12 hours'),
  ('rvh_004', 'rv_003', 'u_author_ops', 'submitted', '提交旧版运维手册更新。', now() - interval '5 days'),
  ('rvh_005', 'rv_003', 'u_admin_l1', 'approved', '允许保留历史手册，但维持下架状态。', now() - interval '4 days')
ON CONFLICT (id) DO UPDATE
SET
  action = EXCLUDED.action,
  comment = EXCLUDED.comment,
  created_at = EXCLUDED.created_at;

SELECT refresh_skill_search_document(id) FROM skills;

COMMIT;
