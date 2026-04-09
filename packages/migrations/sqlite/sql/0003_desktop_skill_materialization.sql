create table if not exists tool_project_associations (
  association_id text primary key,
  tool_id text not null,
  project_id text not null,
  search_roots text not null,
  enabled integer not null default 1,
  conflict_state text not null default 'resolved',
  manual_version_summary text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  unique (tool_id, project_id),
  check (enabled in (0, 1)),
  check (conflict_state in ('resolved', 'unresolved', 'blocked', 'degraded'))
);

create index if not exists idx_tool_project_associations_tool_id
  on tool_project_associations (tool_id);

create index if not exists idx_tool_project_associations_project_id
  on tool_project_associations (project_id);

create table if not exists skill_target_bindings (
  binding_id text primary key,
  target_type text not null,
  target_id text not null,
  skill_id text not null,
  package_id text not null,
  version text not null,
  enabled integer not null default 1,
  desired_version_intent text not null default 'selected',
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  unique (target_type, target_id, skill_id),
  check (target_type in ('tool', 'project')),
  check (enabled in (0, 1)),
  check (desired_version_intent in ('selected', 'latest', 'pinned', 'manual'))
);

create index if not exists idx_skill_target_bindings_target
  on skill_target_bindings (target_type, target_id);

create index if not exists idx_skill_target_bindings_skill_id
  on skill_target_bindings (skill_id);

create table if not exists skill_target_version_overrides (
  override_id text primary key,
  association_id text not null,
  skill_id text not null,
  selected_version text not null,
  selected_package_id text not null,
  decision_source text not null default 'manual',
  reason text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  unique (association_id, skill_id),
  check (decision_source in ('manual', 'replay'))
);

create index if not exists idx_skill_target_version_overrides_association
  on skill_target_version_overrides (association_id);

create table if not exists skill_materialization_status (
  status_id text primary key,
  target_type text not null,
  target_id text not null,
  skill_id text not null,
  package_id text,
  version text,
  mode text not null default 'none',
  status text not null,
  report_status text not null default 'unknown',
  target_path text,
  source_path text,
  drift_details text,
  last_error text,
  last_reconciled_at text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  unique (target_type, target_id, skill_id),
  check (target_type in ('tool', 'project')),
  check (mode in ('none', 'symlink', 'copy')),
  check (status in ('pending', 'materialized', 'removed', 'degraded', 'offline_blocked', 'access_denied', 'drifted', 'error')),
  check (report_status in ('unknown', 'available', 'offline', 'access_denied', 'not_found', 'error'))
);

create index if not exists idx_skill_materialization_status_target
  on skill_materialization_status (target_type, target_id);

create index if not exists idx_skill_materialization_status_skill_id
  on skill_materialization_status (skill_id);
