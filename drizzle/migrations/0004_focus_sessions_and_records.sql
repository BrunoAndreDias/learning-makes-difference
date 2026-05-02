create table focus_sessions (
  user_id text primary key references users(id) on delete cascade,
  session_id text not null unique,
  payload jsonb not null
);

create index focus_sessions_session_id_idx
  on focus_sessions (session_id);

create table focus_records (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  ended_at timestamptz not null,
  payload jsonb not null
);

create index focus_records_user_id_ended_at_idx
  on focus_records (user_id, ended_at desc);
