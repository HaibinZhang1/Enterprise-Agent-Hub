ALTER TABLE local_notifications ADD COLUMN related_skill_id TEXT;
ALTER TABLE local_notifications ADD COLUMN target_page TEXT NOT NULL DEFAULT 'notifications';
ALTER TABLE local_notifications ADD COLUMN source TEXT NOT NULL DEFAULT 'local' CHECK (source IN ('server', 'local', 'sync'));
