create table if not exists auth.credentials (
  user_id uuid primary key references auth.users(id),
  password text not null,
  password_history jsonb not null default '[]'::jsonb,
  temporary_credential_mode varchar(32) not null default 'permanent',
  failed_attempt_count integer not null default 0,
  locked_until timestamptz,
  password_changed_at timestamptz not null default now()
);

create table if not exists audit.log_entries (
  id uuid primary key,
  request_id text not null,
  actor_user_id uuid not null,
  actor_username varchar(64) not null,
  actor_role_code varchar(32) not null,
  actor_department_id uuid,
  target_type text not null,
  target_id text not null,
  action text not null,
  result text not null default 'success',
  reason text,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists audit_log_entries_occurred_idx on audit.log_entries(occurred_at desc);
create index if not exists audit_log_entries_target_idx on audit.log_entries(target_type, target_id);

create table if not exists notify.notifications (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  category text not null,
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notify_notifications_user_created_idx on notify.notifications(user_id, created_at desc);

create table if not exists skill.catalog (
  skill_id text primary key,
  owner_user_id uuid not null references auth.users(id),
  title text not null,
  summary text not null default '',
  visibility text not null,
  allowed_department_ids jsonb not null default '[]'::jsonb,
  current_version text,
  history jsonb not null default '[]'::jsonb,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists review.tickets (
  ticket_id text primary key,
  skill_id text not null references skill.catalog(skill_id),
  package_id text,
  requested_by uuid references auth.users(id),
  reviewer_id uuid not null references auth.users(id),
  status text not null,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists review_tickets_reviewer_status_idx on review.tickets(reviewer_id, status);

create table if not exists search.documents (
  skill_id text primary key references skill.catalog(skill_id),
  title text not null,
  summary text not null default '',
  owner_user_id uuid not null references auth.users(id),
  published_version text,
  visibility text not null,
  allowed_department_ids jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
