import type { UserTimeZonePreference } from "../access/session/session-contract";
import { type AppStudyNote, getStudyNoteReadiness } from "../study-notes";
import type { StudyNoteRecallHistory } from "../study-notes/learning-state";
import { getLocalDateKey } from "./local-date";
import type { RecallSelfRating, SessionResult } from "./recall";
import { listActivePracticeRepairQueueItems } from "./recall-practice-repair";
import type { RecallSchedule } from "./recall-schedule";

export type DueTodayQueueItem = {
  lastRating: RecallSelfRating | null;
  schedule: RecallSchedule;
  studyNote: AppStudyNote;
};

function getLatestRating(
  history: StudyNoteRecallHistory | null,
): RecallSelfRating | null {
  return history?.attempts.at(-1)?.rating ?? null;
}

function isScheduleDueOnOrBeforeToday(input: {
  now: string;
  schedule: RecallSchedule;
  userTimeZone: UserTimeZonePreference;
}) {
  const nextRecallDateKey = getLocalDateKey({
    timestamp: input.schedule.nextRecallAt,
    userTimeZone: input.userTimeZone,
  });
  const todayDateKey = getLocalDateKey({
    timestamp: input.now,
    userTimeZone: input.userTimeZone,
  });

  if (nextRecallDateKey === null || todayDateKey === null) {
    return false;
  }

  return nextRecallDateKey <= todayDateKey;
}

export function buildDueTodayQueue(input: {
  histories: readonly StudyNoteRecallHistory[];
  now: string;
  recallSchedules: readonly RecallSchedule[];
  sessionResults: readonly SessionResult[];
  studyNotes: readonly AppStudyNote[];
  userTimeZone: UserTimeZonePreference;
}): DueTodayQueueItem[] {
  const historyByStudyNoteId = new Map(
    input.histories.map((history) => [history.studyNoteId, history]),
  );
  const scheduleByStudyNoteId = new Map(
    input.recallSchedules.map((schedule) => [schedule.studyNoteId, schedule]),
  );
  const activePracticeRepairStudyNoteIds = new Set(
    listActivePracticeRepairQueueItems({
      results: input.sessionResults,
    }).map((item) => item.entry.reference.studyNoteId),
  );
  const queue: DueTodayQueueItem[] = [];

  for (const studyNote of input.studyNotes) {
    if (!getStudyNoteReadiness(studyNote).recallable) {
      continue;
    }

    if (activePracticeRepairStudyNoteIds.has(studyNote.id)) {
      continue;
    }

    const schedule = scheduleByStudyNoteId.get(studyNote.id);

    if (schedule === undefined) {
      continue;
    }

    if (
      !isScheduleDueOnOrBeforeToday({
        now: input.now,
        schedule,
        userTimeZone: input.userTimeZone,
      })
    ) {
      continue;
    }

    queue.push({
      lastRating: getLatestRating(
        historyByStudyNoteId.get(studyNote.id) ?? null,
      ),
      schedule,
      studyNote,
    });
  }

  return queue;
}
