create table study_note_metaphors (
  study_note_id text primary key references study_notes(id) on delete cascade,
  description text not null
);

create table study_note_acronyms (
  study_note_id text primary key references study_notes(id) on delete cascade,
  description text not null
);
