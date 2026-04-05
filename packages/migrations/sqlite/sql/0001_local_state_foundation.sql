create table if not exists schema_version (
  version integer not null primary key,
  applied_at text not null default current_timestamp
);

create table if not exists tool_cache (
  tool_id text primary key,
  display_name text not null,
  install_path text not null,
  health_state text not null,
  updated_at text not null default current_timestamp
);

create table if not exists projects (
  project_id text primary key,
  display_name text not null,
  project_path text not null,
  health_state text not null,
  updated_at text not null default current_timestamp
);

create table if not exists installed_skill_cache (
  install_id text primary key,
  skill_id text not null,
  version text not null,
  local_state text not null,
  reconcile_state text not null,
  updated_at text not null default current_timestamp
);

create table if not exists sync_jobs (
  job_id text primary key,
  install_id text not null,
  operation text not null,
  state text not null,
  failure_reason text,
  updated_at text not null default current_timestamp
);

create table if not exists conflict_resolutions (
  conflict_id text primary key,
  install_id text not null,
  decision text not null,
  decided_at text not null default current_timestamp
);
