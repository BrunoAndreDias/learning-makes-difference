create table if not exists users (
  id text primary key,
  display_name text not null,
  email text not null unique,
  password_hash text not null,
  interface_language text not null,
  study_language text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists auth_sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  created_at timestamptz not null,
  expires_at timestamptz not null
);

create index if not exists auth_sessions_user_id_idx
  on auth_sessions (user_id);

create index if not exists auth_sessions_expires_at_idx
  on auth_sessions (expires_at);
