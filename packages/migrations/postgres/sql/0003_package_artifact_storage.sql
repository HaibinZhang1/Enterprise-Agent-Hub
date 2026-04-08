create table if not exists package.uploads (
  package_id text primary key,
  skill_id text not null,
  version text not null,
  title text not null,
  summary text not null default '',
  uploaded_by uuid references auth.users(id),
  storage_kind text not null default 'report-only',
  package_root text not null,
  manifest_path text,
  artifact_hash text not null,
  valid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists package_uploads_skill_version_idx on package.uploads(skill_id, version);
create index if not exists package_uploads_uploaded_by_idx on package.uploads(uploaded_by, created_at desc);

create table if not exists package.artifact_files (
  package_id text not null references package.uploads(package_id) on delete cascade,
  path text not null,
  size_bytes bigint not null,
  sha256 text not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  primary key (package_id, path)
);

create index if not exists package_artifact_files_sha_idx on package.artifact_files(sha256);

create table if not exists package.validation_reports (
  package_id text primary key references package.uploads(package_id) on delete cascade,
  uploaded_by uuid references auth.users(id),
  valid boolean not null default false,
  report_hash text not null,
  findings jsonb not null default '[]'::jsonb,
  manifest jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table review.tickets
  add column if not exists claimed_by uuid references auth.users(id),
  add column if not exists claimed_at timestamptz,
  add column if not exists claim_expires_at timestamptz,
  add column if not exists decision jsonb;
