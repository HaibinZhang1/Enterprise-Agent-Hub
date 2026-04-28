ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_must_change BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS auth_password_change_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_password_change_challenges_user
  ON auth_password_change_challenges(user_id);

UPDATE users
SET password_must_change = true
WHERE status <> 'deleted'
  AND password_hash = 'scrypt:eagenthub20260422fixedsalt000001:ce4aff5d54fc609824b9fedf7a1a5019f69f13c280c1e1216c628715d6a119f7a2f73c80e400f8003b08bfe296f0a4a86c6c1c5baf5e5611524685e7ba848f82';
