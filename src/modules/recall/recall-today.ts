import type { UserTimeZonePreference } from "../access/session/session-contract";
import { type AppStudyNote, getStudyNoteReadiness } from "../study-notes";
import type { StudyNoteRecallHistory } from "../study-notes/learning-state";
import { getLocalDateKey } from "./local-date";
import type { RecallSelfRating, SessionResult } from "./recall";
import {
  listActionablePracticeFollowUps,
  type PracticeRepairEntry,
} from "./recall-practice-repair";
import type { RecallSchedule } from "./recall-schedule";

export type RecallTodayReason =
  | "practice-follow-up"
  | "due-for-recall"
  | "needs-practice"
  | "not-recalled";

export type RecallTodayQueueItem = {
  lastRating: RecallSelfRating | null;
  practiceFollowUpEntry: PracticeRepairEntry | null;
  reasons: readonly RecallTodayReason[];
  studyNote: AppStudyNote;
};

type RankedRecallTodayQueueItem = RecallTodayQueueItem & {
  originalIndex: number;
  priority: number;
};

const recallTodayReasonPriority: Record<RecallTodayReason, number> = {
  "practice-follow-up": 0,
  "needs-practice": 1,
  "not-recalled": 2,
  "due-for-recall": 3,
};

function getRecallTodayReasonPriority(reason: RecallTodayReason) {
  return recallTodayReasonPriority[reason];
}

export function getPrimaryRecallTodayReason(item: {
  reasons: readonly RecallTodayReason[];
}): RecallTodayReason {
  let primaryReason: RecallTodayReason | null = null;

  for (const reason of item.reasons) {
    if (
      primaryReason === null ||
      getRecallTodayReasonPriority(reason) <
        getRecallTodayReasonPriority(primaryReason)
    ) {
      primaryReason = reason;
    }
  }

  return primaryReason ?? "due-for-recall";
}

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
  practiceFollowUpEntry: PracticeRepairEntry | null;
  schedule: RecallSchedule | null;
  userTimeZone: UserTimeZonePreference;
}): RecallTodayReason[] {
  const latestRating = getLatestRating(input.history);
  const reasons: RecallTodayReason[] = [];

  if (input.practiceFollowUpEntry !== null) {
    reasons.push("practice-follow-up");
  }

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
  return getRecallTodayReasonPriority(getPrimaryRecallTodayReason({ reasons }));
}

export function buildRecallTodayQueue(input: {
  histories: readonly StudyNoteRecallHistory[];
  now: string;
  recallSchedules: readonly RecallSchedule[];
  sessionResults: readonly SessionResult[];
  studyNotes: readonly AppStudyNote[];
  userTimeZone: UserTimeZonePreference;
}): RecallTodayQueueItem[] {
  const historyByStudyNoteId = new Map(
    input.histories.map((history) => [history.studyNoteId, history]),
  );
  const practiceFollowUpByStudyNoteId = new Map<string, PracticeRepairEntry>();
  const scheduleByStudyNoteId = new Map(
    input.recallSchedules.map((schedule) => [schedule.studyNoteId, schedule]),
  );
  const rankedQueue: RankedRecallTodayQueueItem[] = [];

  for (const practiceFollowUpEntry of listActionablePracticeFollowUps({
    results: input.sessionResults,
  })) {
    const studyNoteId = practiceFollowUpEntry.reference.studyNoteId;

    if (!practiceFollowUpByStudyNoteId.has(studyNoteId)) {
      practiceFollowUpByStudyNoteId.set(studyNoteId, practiceFollowUpEntry);
    }
  }

  input.studyNotes.forEach((studyNote, originalIndex) => {
    if (!getStudyNoteReadiness(studyNote).recallable) {
      return;
    }

    const history = historyByStudyNoteId.get(studyNote.id) ?? null;
    const latestRating = getLatestRating(history);
    const practiceFollowUpEntry =
      practiceFollowUpByStudyNoteId.get(studyNote.id) ?? null;
    const reasons = getRecallTodayReasons({
      history,
      now: input.now,
      practiceFollowUpEntry,
      schedule: scheduleByStudyNoteId.get(studyNote.id) ?? null,
      userTimeZone: input.userTimeZone,
    });

    if (reasons.length === 0) {
      return;
    }

    rankedQueue.push({
      lastRating: latestRating,
      originalIndex,
      priority: getQueuePriority(reasons),
      practiceFollowUpEntry,
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
    .map(({ lastRating, practiceFollowUpEntry, reasons, studyNote }) => ({
      lastRating,
      practiceFollowUpEntry,
      reasons,
      studyNote,
    }));
}
