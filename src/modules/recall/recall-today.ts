import type { UserTimeZonePreference } from "../access/session/session-contract";
import { type AppStudyNote, getStudyNoteReadiness } from "../study-notes";
import type { StudyNoteRecallHistory } from "../study-notes/learning-state";
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

const recallTodayReasonPriority: Record<RecallTodayReason, number> = {
  "needs-practice": 0,
  "not-recalled": 1,
  "due-for-recall": 2,
};

function getLocalDateKey(timestamp: string, userTimeZone: string) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    const parts = new Intl.DateTimeFormat("en", {
      day: "2-digit",
      month: "2-digit",
      timeZone: userTimeZone,
      year: "numeric",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (year === undefined || month === undefined || day === undefined) {
      return null;
    }

    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}

function isScheduleDueToday(input: {
  now: string;
  schedule: RecallSchedule | null;
  userTimeZone: UserTimeZonePreference;
}) {
  if (input.schedule === null) {
    return false;
  }

  const nextRecallDateKey = getLocalDateKey(
    input.schedule.nextRecallAt,
    input.userTimeZone,
  );
  const todayDateKey = getLocalDateKey(input.now, input.userTimeZone);

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

  return input.studyNotes
    .map((studyNote, originalIndex) => {
      if (!getStudyNoteReadiness(studyNote).recallable) {
        return null;
      }

      const reasons = getRecallTodayReasons({
        history: historyByStudyNoteId.get(studyNote.id) ?? null,
        now: input.now,
        schedule: scheduleByStudyNoteId.get(studyNote.id) ?? null,
        userTimeZone: input.userTimeZone,
      });

      if (reasons.length === 0) {
        return null;
      }

      return {
        item: {
          reasons,
          studyNote,
        },
        originalIndex,
        priority: getQueuePriority(reasons),
      };
    })
    .filter(
      (
        item,
      ): item is {
        item: RecallTodayQueueItem;
        originalIndex: number;
        priority: number;
      } => item !== null,
    )
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        left.originalIndex - right.originalIndex,
    )
    .map((entry) => entry.item);
}
