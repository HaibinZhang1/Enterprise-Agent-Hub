BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_number TEXT;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_username_key;

WITH numbered_users AS (
  SELECT
    id,
    username,
    display_name,
    row_number() OVER (ORDER BY id) AS row_index
  FROM users
)
UPDATE users u
SET
  phone_number = COALESCE(
    NULLIF(u.phone_number, ''),
    CASE numbered_users.id
      WHEN 'u_001' THEN '13800000001'
      WHEN 'u_admin_l1' THEN '13800000002'
      WHEN 'u_admin_l2_eng' THEN '13800000003'
      WHEN 'u_admin_l3_front' THEN '13800000004'
      WHEN 'u_author_frontend' THEN '13800000005'
      WHEN 'u_author_design' THEN '13800000006'
      WHEN 'u_author_ops' THEN '13800000007'
      ELSE '139' || lpad((10000000 + numbered_users.row_index)::text, 8, '0')
    END
  ),
  username = COALESCE(NULLIF(u.display_name, ''), u.username),
  display_name = COALESCE(NULLIF(u.display_name, ''), u.username)
FROM numbered_users
WHERE u.id = numbered_users.id;

ALTER TABLE users
  ALTER COLUMN phone_number SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_phone_number_format'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_phone_number_format
      CHECK (phone_number ~ '^1[0-9]{10}$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_number_unique
  ON users(phone_number);

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
