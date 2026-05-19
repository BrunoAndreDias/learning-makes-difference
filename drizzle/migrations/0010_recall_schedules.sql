create table recall_schedules (
  study_note_id text primary key references study_notes(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  next_recall_at timestamptz not null,
  interval_days integer not null,
  ease double precision not null,
  repetition_count integer not null,
  last_recalled_at timestamptz
);

create index recall_schedules_user_id_next_recall_at_idx
  on recall_schedules(user_id, next_recall_at);

insert into recall_schedules (
  study_note_id,
  user_id,
  next_recall_at,
  interval_days,
  ease,
  repetition_count,
  last_recalled_at
)
select
  study_notes.id,
  notes.user_id,
  now(),
  0,
  2.5,
  0,
  null
from study_notes
inner join notes on notes.id = study_notes.source_note_id
where length(btrim(study_notes.expected_answer)) > 0
on conflict (study_note_id) do nothing;
