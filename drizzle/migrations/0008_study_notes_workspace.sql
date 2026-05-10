create table study_notes (
  id text primary key,
  source_note_id text not null references notes(id) on delete cascade,
  prompt text not null,
  expected_answer text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index study_notes_source_note_id_updated_at_idx
  on study_notes(source_note_id, updated_at);
