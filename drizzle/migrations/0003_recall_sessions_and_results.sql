create table recall_sessions (
  user_id text primary key references users(id) on delete cascade,
  session_id text not null unique,
  payload jsonb not null
);

create index active_recall_sessions_session_id_idx
  on recall_sessions (session_id);

create table session_results (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  completed_at timestamptz not null,
  payload jsonb not null
);

create index session_results_user_id_completed_at_idx
  on session_results (user_id, completed_at desc);
