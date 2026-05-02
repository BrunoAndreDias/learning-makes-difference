create table labels (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index labels_user_id_updated_at_idx
  on labels (user_id, updated_at);

create table label_edges (
  child_label_id text not null references labels(id) on delete cascade,
  parent_label_id text not null references labels(id) on delete cascade,
  constraint label_edges_pk primary key (child_label_id, parent_label_id),
  constraint label_edges_no_self_parent_check
    check (child_label_id <> parent_label_id)
);

create index label_edges_parent_label_id_idx
  on label_edges (parent_label_id);

create table note_labels (
  note_id text not null references notes(id) on delete cascade,
  label_id text not null references labels(id) on delete cascade,
  constraint note_labels_pk primary key (note_id, label_id)
);

create index note_labels_label_id_idx
  on note_labels (label_id);
