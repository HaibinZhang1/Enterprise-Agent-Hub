BEGIN;

UPDATE skills
SET category = CASE category
  WHEN 'engineering' THEN '开发'
  WHEN 'design' THEN '设计'
  WHEN 'operations' THEN '运维'
  WHEN '开发效率' THEN '开发'
  WHEN '治理' THEN '安全'
  WHEN '工具集成' THEN '集成'
  WHEN '设计规范' THEN '设计'
  WHEN 'uncategorized' THEN '其他'
  ELSE COALESCE(NULLIF(category, ''), '其他')
END;

ALTER TABLE skills
  ALTER COLUMN category SET DEFAULT '其他',
  ALTER COLUMN category SET NOT NULL;

DELETE FROM skill_tags
WHERE tag NOT IN (
  '代码', '审查', '重构', '提示', '规范', '清单', '文档', '写作', '测试', '验收',
  '前端', '可访问', '设计', '运维', '值班', '事故', '安全', '权限', '集成', '适配',
  '自动化', '发布', '数据', '分析', '入门', '培训'
);

CREATE OR REPLACE FUNCTION refresh_skill_search_document(target_skill_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO skill_search_documents (skill_id, document, search_vector)
  SELECT
    s.id,
    concat_ws(' ', s.skill_id, s.display_name, s.description, coalesce(s.category, ''), coalesce(u.username, ''), coalesce(d.name, ''), string_agg(coalesce(st.tag, ''), ' ')),
    to_tsvector('simple', concat_ws(' ', s.skill_id, s.display_name, s.description, coalesce(s.category, ''), coalesce(u.username, ''), coalesce(d.name, ''), string_agg(coalesce(st.tag, ''), ' ')))
  FROM skills s
  LEFT JOIN users u ON u.id = s.author_id
  LEFT JOIN departments d ON d.id = s.department_id
  LEFT JOIN skill_tags st ON st.skill_id = s.id
  WHERE s.id = target_skill_id
  GROUP BY s.id, u.username, d.name
  ON CONFLICT (skill_id) DO UPDATE
    SET document = EXCLUDED.document,
        search_vector = EXCLUDED.search_vector;
END;
$$ LANGUAGE plpgsql;

SELECT refresh_skill_search_document(id)
FROM skills;

COMMIT;
