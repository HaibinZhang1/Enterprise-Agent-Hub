BEGIN;

ALTER TABLE review_items
  ADD COLUMN IF NOT EXISTS workflow_state TEXT
    CHECK (
      workflow_state IN (
        'system_prechecking',
        'manual_precheck',
        'pending_review',
        'in_review',
        'returned_for_changes',
        'review_rejected',
        'withdrawn',
        'published'
      )
    );

ALTER TABLE review_items
  ADD COLUMN IF NOT EXISTS lock_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS requested_version TEXT,
  ADD COLUMN IF NOT EXISTS requested_visibility_level TEXT
    CHECK (
      requested_visibility_level IS NULL
      OR requested_visibility_level IN ('private', 'summary_visible', 'detail_visible', 'public_installable')
    ),
  ADD COLUMN IF NOT EXISTS requested_scope_type TEXT
    CHECK (
      requested_scope_type IS NULL
      OR requested_scope_type IN ('current_department', 'department_tree', 'selected_departments', 'all_employees')
    ),
  ADD COLUMN IF NOT EXISTS staged_package_bucket TEXT,
  ADD COLUMN IF NOT EXISTS staged_package_object_key TEXT,
  ADD COLUMN IF NOT EXISTS staged_package_sha256 TEXT
    CHECK (
      staged_package_sha256 IS NULL
      OR staged_package_sha256 ~ '^sha256:[a-f0-9]{64}$'
    ),
  ADD COLUMN IF NOT EXISTS staged_package_size_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS staged_package_file_count INTEGER,
  ADD COLUMN IF NOT EXISTS staged_package_content_type TEXT,
  ADD COLUMN IF NOT EXISTS submission_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS precheck_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS decision TEXT
    CHECK (
      decision IS NULL
      OR decision IN ('approve', 'return_for_changes', 'reject', 'withdraw')
    ),
  ADD COLUMN IF NOT EXISTS published_version_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'review_items_published_version_fk'
  ) THEN
    ALTER TABLE review_items
      ADD CONSTRAINT review_items_published_version_fk
      FOREIGN KEY (published_version_id) REFERENCES skill_versions(id) ON DELETE SET NULL;
  END IF;
END $$;

UPDATE review_items
SET workflow_state = CASE review_status
  WHEN 'pending' THEN 'pending_review'
  WHEN 'in_review' THEN 'in_review'
  ELSE 'published'
END
WHERE workflow_state IS NULL;

ALTER TABLE review_items
  ALTER COLUMN workflow_state SET NOT NULL,
  ALTER COLUMN workflow_state SET DEFAULT 'pending_review';

CREATE TABLE IF NOT EXISTS review_item_scope_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_item_id TEXT NOT NULL REFERENCES review_items(id) ON DELETE CASCADE,
  department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(review_item_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_review_items_workflow_state
  ON review_items(workflow_state, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_review_items_lock_expiry
  ON review_items(lock_owner_id, lock_expires_at);

COMMIT;
