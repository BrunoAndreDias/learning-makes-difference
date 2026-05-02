create table if not exists notes (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  title text not null,
  body text not null,
  label_ids text[] not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists notes_user_id_updated_at_idx
  on notes (user_id, updated_at desc);

create table if not exists note_metaphors (
  note_id text primary key references notes(id) on delete cascade,
  description text not null
);

create table if not exists note_acronyms (
  note_id text primary key references notes(id) on delete cascade,
  description text not null
);
