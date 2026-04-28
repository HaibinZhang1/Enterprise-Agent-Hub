BEGIN;

CREATE TABLE IF NOT EXISTS client_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  build_number TEXT,
  platform TEXT NOT NULL CHECK (platform IN ('windows')),
  arch TEXT NOT NULL CHECK (arch IN ('x64')),
  channel TEXT NOT NULL CHECK (channel IN ('stable', 'internal', 'beta')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'paused', 'yanked')) DEFAULT 'draft',
  mandatory BOOLEAN NOT NULL DEFAULT false,
  min_supported_version TEXT,
  rollout_percent INTEGER NOT NULL DEFAULT 100 CHECK (rollout_percent >= 0 AND rollout_percent <= 100),
  release_notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id),
  published_by TEXT REFERENCES users(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(platform, arch, channel, version)
);

CREATE TABLE IF NOT EXISTS client_release_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL UNIQUE REFERENCES client_releases(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL,
  object_key TEXT NOT NULL,
  package_name TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^sha256:[a-f0-9]{64}$'),
  signature_status TEXT NOT NULL CHECK (signature_status IN ('signed', 'unsigned', 'unknown')) DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_update_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID REFERENCES client_releases(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  device_id TEXT NOT NULL,
  from_version TEXT NOT NULL,
  to_version TEXT,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'prompted',
      'dismissed',
      'download_started',
      'download_failed',
      'downloaded',
      'hash_failed',
      'signature_failed',
      'installer_started',
      'install_cancelled',
      'installed'
    )
  ),
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_update_download_tickets (
  ticket TEXT PRIMARY KEY,
  release_id UUID NOT NULL REFERENCES client_releases(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_releases_lookup
  ON client_releases(platform, arch, channel, status, published_at DESC NULLS LAST, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_update_events_release_time
  ON client_update_events(release_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_update_events_user_time
  ON client_update_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_update_download_tickets_expiry
  ON client_update_download_tickets(expires_at);

COMMIT;
