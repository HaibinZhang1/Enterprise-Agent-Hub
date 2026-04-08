create table if not exists client_state (
  state_key text primary key,
  payload text not null,
  updated_at text not null default current_timestamp
);

create table if not exists client_cache (
  cache_key text primary key,
  payload text not null,
  updated_at text not null default current_timestamp
);
