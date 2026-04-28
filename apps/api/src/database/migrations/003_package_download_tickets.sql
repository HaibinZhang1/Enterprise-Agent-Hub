BEGIN;

CREATE TABLE IF NOT EXISTS package_download_tickets (
  ticket TEXT PRIMARY KEY,
  package_ref TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('published', 'staged')),
  requires_auth BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_package_download_tickets_expiry
  ON package_download_tickets(expires_at);

COMMIT;
