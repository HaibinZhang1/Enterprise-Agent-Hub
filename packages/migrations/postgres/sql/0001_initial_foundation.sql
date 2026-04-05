create schema if not exists infra;
create schema if not exists auth;
create schema if not exists org;
create schema if not exists skill;
create schema if not exists package;
create schema if not exists review;
create schema if not exists install;
create schema if not exists search;
create schema if not exists notify;
create schema if not exists audit;

create table if not exists infra.outbox_events (
  id uuid primary key,
  topic text not null,
  payload jsonb not null,
  occurred_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  dispatched_at timestamptz,
  retry_count integer not null default 0
);

create table if not exists auth.users (
  id uuid primary key,
  username varchar(64) not null unique,
  display_name varchar(128) not null,
  department_id uuid,
  role_code varchar(32) not null,
  status varchar(16) not null check (status in ('active', 'frozen')),
  provider varchar(16) not null default 'local',
  must_change_password boolean not null default false,
  authz_version bigint not null default 1,
  authz_recalc_pending boolean not null default false,
  authz_target_version bigint,
  authz_pending_reason varchar(64),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auth_users_target_not_behind check (authz_target_version is null or authz_target_version >= authz_version)
);

create table if not exists auth.sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  session_family_id uuid not null,
  parent_session_id uuid,
  client_type varchar(16) not null,
  device_label varchar(128) not null,
  refresh_token_hash text not null,
  issued_authz_version bigint not null,
  issued_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  idle_expires_at timestamptz not null,
  revoked_at timestamptz,
  revoke_reason varchar(32)
);

create index if not exists auth_sessions_user_revoked_idx on auth.sessions(user_id, revoked_at);
create index if not exists auth_sessions_family_revoked_idx on auth.sessions(session_family_id, revoked_at);

create table if not exists audit.actor_snapshots (
  id uuid primary key,
  actor_user_id uuid not null,
  actor_username varchar(64) not null,
  actor_role_code varchar(32) not null,
  actor_department_id uuid,
  actor_department_path text,
  captured_at timestamptz not null default now(),
  capture_reason varchar(32) not null
);
