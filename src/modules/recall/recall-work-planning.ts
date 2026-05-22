import type { UserTimeZonePreference } from "../access/session/session-contract";
import { type AppStudyNote, getStudyNoteReadiness } from "../study-notes";
import type { StudyNoteRecallHistory } from "../study-notes/learning-state";
import { getLocalDateKey } from "./local-date";
import type { RecallSelfRating, SessionResult } from "./recall";
import {
  listActionablePracticeFollowUps,
  listActivePracticeRepairQueueItems,
  type PracticeRepairEntry,
} from "./recall-practice-repair";
import type { RecallSchedule } from "./recall-schedule";

export type RecallWorkReason =
  | "practice-follow-up"
  | "due-for-recall"
  | "needs-practice"
  | "not-recalled";

export type PlannedRecallWorkItem = {
  lastRating: RecallSelfRating | null;
  practiceFollowUpEntry: PracticeRepairEntry | null;
  primaryReason: RecallWorkReason;
  reasons: readonly RecallWorkReason[];
  studyNote: AppStudyNote;
};

export type DueForRecallQueueItem = {
  lastRating: RecallSelfRating | null;
  schedule: RecallSchedule;
  studyNote: AppStudyNote;
};

export type RecallWorkPlan = {
  dueForRecallQueue: readonly DueForRecallQueueItem[];
  plannedItems: readonly PlannedRecallWorkItem[];
  recallTodayQueue: readonly PlannedRecallWorkItem[];
};

export type RecallWorkPlanningInput = {
  histories: readonly StudyNoteRecallHistory[];
  now: string;
  recallSchedules: readonly RecallSchedule[];
  sessionResults: readonly SessionResult[];
  studyNotes: readonly AppStudyNote[];
  userTimeZone: UserTimeZonePreference;
};

type RankedPlannedRecallWorkItem = PlannedRecallWorkItem & {
  originalIndex: number;
  priority: number;
};

const recallWorkReasonPriority: Record<RecallWorkReason, number> = {
  "practice-follow-up": 0,
  "needs-practice": 1,
  "not-recalled": 2,
  "due-for-recall": 3,
};

function getRecallWorkReasonPriority(reason: RecallWorkReason) {
  return recallWorkReasonPriority[reason];
}

export function getPrimaryRecallWorkReason(
  reasons: readonly RecallWorkReason[],
): RecallWorkReason {
  let primaryReason: RecallWorkReason | null = null;

  for (const reason of reasons) {
    if (
      primaryReason === null ||
      getRecallWorkReasonPriority(reason) <
        getRecallWorkReasonPriority(primaryReason)
    ) {
      primaryReason = reason;
    }
  }

  return primaryReason ?? "due-for-recall";
}

function isScheduleDueOnOrBeforeToday(input: {
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

function getActionablePracticeFollowUpByStudyNoteId(
  sessionResults: readonly SessionResult[],
) {
  const practiceFollowUpByStudyNoteId = new Map<string, PracticeRepairEntry>();

  for (const practiceFollowUpEntry of listActionablePracticeFollowUps({
    results: sessionResults,
  })) {
    const studyNoteId = practiceFollowUpEntry.reference.studyNoteId;

    if (!practiceFollowUpByStudyNoteId.has(studyNoteId)) {
      practiceFollowUpByStudyNoteId.set(studyNoteId, practiceFollowUpEntry);
    }
  }

  return practiceFollowUpByStudyNoteId;
}

function getActivePracticeRepairStudyNoteIds(
  sessionResults: readonly SessionResult[],
) {
  return new Set(
    listActivePracticeRepairQueueItems({
      results: sessionResults,
    }).map((item) => item.entry.reference.studyNoteId),
  );
}

function getLatestRating(
  history: StudyNoteRecallHistory | null,
): RecallSelfRating | null {
  return history?.attempts.at(-1)?.rating ?? null;
}

function isNeedsPractice(rating: RecallSelfRating | null) {
  return rating === "forgot" || rating === "hard";
}

function getRecallWorkReasons(input: {
  history: StudyNoteRecallHistory | null;
  now: string;
  practiceFollowUpEntry: PracticeRepairEntry | null;
  schedule: RecallSchedule | null;
  userTimeZone: UserTimeZonePreference;
}): RecallWorkReason[] {
  const latestRating = getLatestRating(input.history);
  const reasons: RecallWorkReason[] = [];

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
    isScheduleDueOnOrBeforeToday({
      now: input.now,
      schedule: input.schedule,
      userTimeZone: input.userTimeZone,
    })
  ) {
    reasons.push("due-for-recall");
  }

  return reasons;
}

export function planRecallWork(input: RecallWorkPlanningInput): RecallWorkPlan {
  const historyByStudyNoteId = new Map(
    input.histories.map((history) => [history.studyNoteId, history]),
  );
  const activePracticeRepairStudyNoteIds = getActivePracticeRepairStudyNoteIds(
    input.sessionResults,
  );
  const practiceFollowUpByStudyNoteId =
    getActionablePracticeFollowUpByStudyNoteId(input.sessionResults);
  const scheduleByStudyNoteId = new Map(
    input.recallSchedules.map((schedule) => [schedule.studyNoteId, schedule]),
  );
  const dueForRecallQueue: DueForRecallQueueItem[] = [];
  const rankedItems: RankedPlannedRecallWorkItem[] = [];

  for (const [originalIndex, studyNote] of input.studyNotes.entries()) {
    if (!getStudyNoteReadiness(studyNote).recallable) {
      continue;
    }

    const history = historyByStudyNoteId.get(studyNote.id) ?? null;
    const lastRating = getLatestRating(history);
    const practiceFollowUpEntry =
      practiceFollowUpByStudyNoteId.get(studyNote.id) ?? null;
    const schedule = scheduleByStudyNoteId.get(studyNote.id) ?? null;
    const scheduleDue =
      schedule !== null &&
      isScheduleDueOnOrBeforeToday({
        now: input.now,
        schedule,
        userTimeZone: input.userTimeZone,
      });
    const unresolvedPracticeRepair = activePracticeRepairStudyNoteIds.has(
      studyNote.id,
    );
    const reasons = getRecallWorkReasons({
      history,
      now: input.now,
      practiceFollowUpEntry,
      schedule,
      userTimeZone: input.userTimeZone,
    });

    if (
      schedule !== null &&
      scheduleDue &&
      !isNeedsPractice(lastRating) &&
      practiceFollowUpEntry === null &&
      !unresolvedPracticeRepair
    ) {
      dueForRecallQueue.push({
        lastRating,
        schedule,
        studyNote,
      });
    }

    if (reasons.length === 0) {
      continue;
    }

    const primaryReason = getPrimaryRecallWorkReason(reasons);

    rankedItems.push({
      lastRating,
      originalIndex,
      practiceFollowUpEntry,
      primaryReason,
      priority: getRecallWorkReasonPriority(primaryReason),
      reasons,
      studyNote,
    });
  }

  const plannedItems = rankedItems
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        left.originalIndex - right.originalIndex,
    )
    .map(
      ({
        lastRating,
        practiceFollowUpEntry,
        primaryReason,
        reasons,
        studyNote,
      }) => ({
        lastRating,
        practiceFollowUpEntry,
        primaryReason,
        reasons,
        studyNote,
      }),
    );

  return {
    dueForRecallQueue,
    plannedItems,
    recallTodayQueue: plannedItems,
  };
}
