create table if not exists schema_version (
  version integer not null primary key,
  applied_at text not null default current_timestamp
);

create table if not exists tool_cache (
  tool_id text primary key,
  display_name text not null,
  install_path text not null,
  skills_directory text,
  skills_directory_source text not null default 'derived_pending',
  materialization_enabled integer not null default 1,
  health_state text not null,
  skills_directory text,
  materialization_enabled integer not null default 1,
  updated_at text not null default current_timestamp
);

create table if not exists projects (
  project_id text primary key,
  display_name text not null,
  project_path text not null,
  skills_directory text,
  skills_directory_source text not null default 'derived_pending',
  materialization_enabled integer not null default 1,
  health_state text not null,
  skills_directory text,
  updated_at text not null default current_timestamp
);

create table if not exists tool_project_associations (
  association_id text primary key,
  tool_id text not null,
  project_id text not null,
  enabled integer not null default 1,
  search_roots text not null default '[]',
  conflict_state text not null default 'clear',
  updated_at text not null default current_timestamp
);

create unique index if not exists tool_project_associations_pair_idx
  on tool_project_associations(tool_id, project_id);

create table if not exists skill_target_bindings (
  target_type text not null,
  target_id text not null,
  skill_id text not null,
  package_id text not null,
  version text not null,
  enabled integer not null default 1,
  updated_at text not null default current_timestamp,
  primary key (target_type, target_id, skill_id)
);

create index if not exists skill_target_bindings_skill_idx
  on skill_target_bindings(skill_id);

create table if not exists skill_target_version_overrides (
  association_id text not null,
  skill_id text not null,
  selected_version text not null,
  selected_package_id text not null,
  reason text not null,
  updated_at text not null default current_timestamp,
  primary key (association_id, skill_id)
);

create table if not exists skill_materialization_status (
  target_type text not null,
  target_id text not null,
  skill_id text not null,
  package_id text not null,
  version text not null,
  mode text not null,
  status text not null,
  target_path text not null,
  source_path text,
  last_error text,
  updated_at text not null default current_timestamp,
  primary key (target_type, target_id, skill_id)
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
