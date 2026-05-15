import type { UserTimeZonePreference } from "../access/session/session-contract";
import { type AppStudyNote, getStudyNoteReadiness } from "../study-notes";
import type { StudyNoteRecallHistory } from "../study-notes/learning-state";
import { getLocalDateKey } from "./local-date";
import type { RecallSelfRating } from "./recall";
import type { RecallSchedule } from "./recall-schedule";

export type RecallTodayReason =
  | "due-for-recall"
  | "needs-practice"
  | "not-recalled";

export type RecallTodayQueueItem = {
  reasons: RecallTodayReason[];
  studyNote: AppStudyNote;
};

type RankedRecallTodayQueueItem = RecallTodayQueueItem & {
  originalIndex: number;
  priority: number;
};

const recallTodayReasonPriority: Record<RecallTodayReason, number> = {
  "needs-practice": 0,
  "not-recalled": 1,
  "due-for-recall": 2,
};

function isScheduleDueToday(input: {
  now: string;
  schedule: RecallSchedule | null;
  userTimeZone: UserTimeZonePreference;
}) {
  if (input.schedule === null) {
    return false;
  }

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

function getLatestRating(
  history: StudyNoteRecallHistory | null,
): RecallSelfRating | null {
  return history?.attempts.at(-1)?.rating ?? null;
}

function isNeedsPractice(rating: RecallSelfRating | null) {
  return rating === "forgot" || rating === "hard";
}

function getRecallTodayReasons(input: {
  history: StudyNoteRecallHistory | null;
  now: string;
  schedule: RecallSchedule | null;
  userTimeZone: UserTimeZonePreference;
}): RecallTodayReason[] {
  const latestRating = getLatestRating(input.history);
  const reasons: RecallTodayReason[] = [];

  if (isNeedsPractice(latestRating)) {
    reasons.push("needs-practice");
  }

  if (latestRating === null) {
    reasons.push("not-recalled");
  }

  if (
    isScheduleDueToday({
      now: input.now,
      schedule: input.schedule,
      userTimeZone: input.userTimeZone,
    })
  ) {
    reasons.push("due-for-recall");
  }

  return reasons;
}

function getQueuePriority(reasons: readonly RecallTodayReason[]) {
  return Math.min(
    ...reasons.map((reason) => recallTodayReasonPriority[reason]),
  );
}

export function buildRecallTodayQueue(input: {
  histories: readonly StudyNoteRecallHistory[];
  now: string;
  recallSchedules: readonly RecallSchedule[];
  studyNotes: readonly AppStudyNote[];
  userTimeZone: UserTimeZonePreference;
}): RecallTodayQueueItem[] {
  const historyByStudyNoteId = new Map(
    input.histories.map((history) => [history.studyNoteId, history]),
  );
  const scheduleByStudyNoteId = new Map(
    input.recallSchedules.map((schedule) => [schedule.studyNoteId, schedule]),
  );
  const rankedQueue: RankedRecallTodayQueueItem[] = [];

  input.studyNotes.forEach((studyNote, originalIndex) => {
    if (!getStudyNoteReadiness(studyNote).recallable) {
      return;
    }

    const reasons = getRecallTodayReasons({
      history: historyByStudyNoteId.get(studyNote.id) ?? null,
      now: input.now,
      schedule: scheduleByStudyNoteId.get(studyNote.id) ?? null,
      userTimeZone: input.userTimeZone,
    });

    if (reasons.length === 0) {
      return;
    }

    rankedQueue.push({
      originalIndex,
      priority: getQueuePriority(reasons),
      reasons,
      studyNote,
    });
  });

  return rankedQueue
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        left.originalIndex - right.originalIndex,
    )
    .map(({ reasons, studyNote }) => ({ reasons, studyNote }));
}
