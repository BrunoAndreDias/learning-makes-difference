create table study_note_labels (
  study_note_id text not null references study_notes(id) on delete cascade,
  label_id text not null references labels(id) on delete cascade,
  constraint study_note_labels_pk primary key (study_note_id, label_id)
);

create index study_note_labels_label_id_idx
  on study_note_labels (label_id);

insert into study_note_labels (study_note_id, label_id)
select study_notes.id, note_labels.label_id
from study_notes
inner join note_labels
  on note_labels.note_id = study_notes.source_note_id
on conflict do nothing;
