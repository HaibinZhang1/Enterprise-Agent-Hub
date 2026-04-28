BEGIN;

ALTER TABLE review_items
  ADD COLUMN IF NOT EXISTS claimed_from_workflow_state TEXT
    CHECK (
      claimed_from_workflow_state IS NULL
      OR claimed_from_workflow_state IN ('manual_precheck', 'pending_review')
    );

UPDATE review_items
SET claimed_from_workflow_state = workflow_state,
    workflow_state = 'in_review'
WHERE review_status = 'in_review'
  AND workflow_state IN ('manual_precheck', 'pending_review')
  AND lock_expires_at IS NOT NULL
  AND lock_expires_at > now();

UPDATE review_items
SET workflow_state = claimed_from_workflow_state,
    review_status = 'pending',
    lock_owner_id = NULL,
    lock_expires_at = NULL,
    claimed_from_workflow_state = NULL
WHERE workflow_state = 'in_review'
  AND claimed_from_workflow_state IN ('manual_precheck', 'pending_review')
  AND (lock_expires_at IS NULL OR lock_expires_at <= now());

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS action TEXT;

CREATE INDEX IF NOT EXISTS idx_review_items_claimed_from_workflow_state
  ON review_items(claimed_from_workflow_state);

COMMIT;
