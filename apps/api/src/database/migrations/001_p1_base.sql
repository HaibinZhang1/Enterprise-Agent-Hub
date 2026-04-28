BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES departments(id),
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  phone_number TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  department_id TEXT REFERENCES departments(id),
  role TEXT NOT NULL DEFAULT 'normal_user',
  admin_level INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS admin_level INTEGER;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_number TEXT;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_username_key;

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

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  author_id TEXT REFERENCES users(id),
  department_id TEXT REFERENCES departments(id),
  status TEXT NOT NULL CHECK (status IN ('published', 'delisted', 'archived')),
  visibility_level TEXT NOT NULL CHECK (visibility_level IN ('private', 'summary_visible', 'detail_visible', 'public_installable')),
  current_version_id UUID,
  category TEXT NOT NULL DEFAULT '其他',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS skill_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  readme_object_key TEXT,
  changelog TEXT,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'unknown')),
  risk_description TEXT,
  review_summary TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(skill_id, version)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'skills_current_version_fk'
  ) THEN
    ALTER TABLE skills
      ADD CONSTRAINT skills_current_version_fk
      FOREIGN KEY (current_version_id) REFERENCES skill_versions(id) DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS skill_packages (
  id TEXT PRIMARY KEY,
  skill_version_id UUID NOT NULL REFERENCES skill_versions(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL,
  object_key TEXT NOT NULL,
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^sha256:[a-f0-9]{64}$'),
  size_bytes INTEGER NOT NULL CHECK (size_bytes <= 5242880),
  file_count INTEGER NOT NULL CHECK (file_count <= 100),
  content_type TEXT NOT NULL DEFAULT 'application/zip',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS skill_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_version_id UUID NOT NULL REFERENCES skill_versions(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  bucket TEXT NOT NULL,
  object_key TEXT NOT NULL,
  sha256 TEXT,
  size_bytes INTEGER
);

CREATE TABLE IF NOT EXISTS skill_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL,
  department_id TEXT REFERENCES departments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(skill_id, scope_type, department_id)
);

CREATE TABLE IF NOT EXISTS skill_tool_compatibilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL,
  system TEXT NOT NULL,
  UNIQUE(skill_id, tool_id, system)
);

CREATE TABLE IF NOT EXISTS skill_tags (
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (skill_id, tag)
);

CREATE TABLE IF NOT EXISTS skill_stars (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS download_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id),
  skill_id UUID NOT NULL REFERENCES skills(id),
  version TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('install', 'update')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  object_type TEXT,
  object_id TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_items (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  skill_display_name TEXT NOT NULL,
  submitter_id TEXT NOT NULL REFERENCES users(id),
  submitter_name TEXT NOT NULL,
  submitter_department_id TEXT NOT NULL REFERENCES departments(id),
  submitter_department_name TEXT NOT NULL,
  review_type TEXT NOT NULL CHECK (review_type IN ('publish', 'update', 'permission_change')),
  review_status TEXT NOT NULL CHECK (review_status IN ('pending', 'in_review', 'reviewed')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'unknown')),
  summary TEXT NOT NULL,
  description TEXT NOT NULL,
  review_summary TEXT,
  lock_owner_id TEXT REFERENCES users(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_item_history (
  id TEXT PRIMARY KEY,
  review_item_id TEXT NOT NULL REFERENCES review_items(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS desktop_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  device_name TEXT,
  platform TEXT,
  app_version TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS desktop_local_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  skill_id TEXT,
  version TEXT,
  target_type TEXT CHECK (target_type IS NULL OR target_type IN ('tool', 'project')),
  target_id TEXT,
  target_path TEXT,
  requested_mode TEXT CHECK (requested_mode IS NULL OR requested_mode IN ('symlink', 'copy')),
  resolved_mode TEXT CHECK (resolved_mode IS NULL OR resolved_mode IN ('symlink', 'copy')),
  fallback_reason TEXT,
  result TEXT NOT NULL CHECK (result IN ('success', 'failed')),
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(device_id, event_id)
);

CREATE TABLE IF NOT EXISTS job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  job_id TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_ref TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS skill_search_documents (
  skill_id UUID PRIMARY KEY REFERENCES skills(id) ON DELETE CASCADE,
  document TEXT NOT NULL,
  search_vector TSVECTOR NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_skill_search_documents_vector
  ON skill_search_documents USING GIN(search_vector);

CREATE INDEX IF NOT EXISTS idx_skills_status_visibility
  ON skills(status, visibility_level);

CREATE INDEX IF NOT EXISTS idx_desktop_local_events_device_event
  ON desktop_local_events(device_id, event_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_status
  ON auth_sessions(user_id, revoked_at, expires_at);

CREATE INDEX IF NOT EXISTS idx_review_items_department_status
  ON review_items(submitter_department_id, review_status, updated_at DESC);

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

COMMIT;
