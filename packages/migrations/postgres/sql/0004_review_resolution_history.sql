alter table review.tickets
  add column if not exists resolution jsonb;

create table if not exists review.ticket_history (
  ticket_id text not null references review.tickets(ticket_id) on delete cascade,
  sequence_no integer not null,
  action text not null,
  from_status text,
  to_status text not null,
  actor_id uuid references auth.users(id),
  comment text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (ticket_id, sequence_no)
);

create index if not exists review_ticket_history_ticket_created_idx
  on review.ticket_history(ticket_id, created_at asc, sequence_no asc);
