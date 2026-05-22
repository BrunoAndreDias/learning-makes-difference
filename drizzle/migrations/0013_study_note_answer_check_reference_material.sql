create table study_note_key_ideas (
  id text primary key,
  study_note_id text not null references study_notes(id) on delete cascade,
  position integer not null,
  text text not null,
  importance text not null check (importance in ('required', 'supporting')),
  accepted_phrases text[] not null,
  prohibited_phrases text[] not null
);

create index study_note_key_ideas_study_note_id_position_idx
  on study_note_key_ideas(study_note_id, position);

create table study_note_accepted_variants (
  id text primary key,
  study_note_id text not null references study_notes(id) on delete cascade,
  position integer not null,
  text text not null
);

create index study_note_accepted_variants_study_note_id_position_idx
  on study_note_accepted_variants(study_note_id, position);

create table study_note_prohibited_phrases (
  id text primary key,
  study_note_id text not null references study_notes(id) on delete cascade,
  position integer not null,
  text text not null
);

create index study_note_prohibited_phrases_study_note_id_position_idx
  on study_note_prohibited_phrases(study_note_id, position);
