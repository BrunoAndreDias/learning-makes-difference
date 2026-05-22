import type { UserTimeZonePreference } from "../access/session/session-contract";
import type {
  AppStudyNote,
  StudyNoteLearningState,
  StudyNoteRecallHistory,
} from "../study-notes";
import {
  deriveStudyNoteLearningStates,
  formatStudyNoteLearningStateScoreLabel,
  getStudyNoteReadiness,
  toStudyNoteRecallHistories,
} from "../study-notes";
import { getInterleavedRecallRecommendation } from "./interleaved-recall";
import type { FlashCardRecallAttemptsByNote, SessionResult } from "./recall";
import { formatNextRecallTiming, type RecallSchedule } from "./recall-schedule";
import {
  type PlannedRecallWorkItem,
  planRecallWork,
  type RecallWorkReason,
} from "./recall-work-planning";

export type RecallGuidanceRecommendationKind =
  | "interleaving-ready"
  | "needs-practice"
  | "recall-today"
  | "reinforce";

export type RecallGuidanceRecommendation = {
  kind: RecallGuidanceRecommendationKind;
  nextRecall: string;
  summary: string;
};

export type RecallGuidanceEntry = {
  dueForRecall: boolean;
  interleavingReady: boolean;
  lastScore: StudyNoteLearningState["latestScore"];
  needsPractice: boolean;
  nextRecall: string;
  notRecalledYet: boolean;
  recallToday: boolean;
  recallTodayReasons: readonly RecallWorkReason[];
  recommendation: RecallGuidanceRecommendation;
  studyNote: AppStudyNote;
};

export type RecallGuidanceInput = {
  attemptsByNote: readonly FlashCardRecallAttemptsByNote[];
  now: string;
  recallSchedules: readonly RecallSchedule[];
  sessionResults: readonly SessionResult[];
  studyNotes: readonly AppStudyNote[];
  userTimeZone: UserTimeZonePreference;
};

function getInterleavingReadyStudyNoteIds(input: {
  histories: readonly StudyNoteRecallHistory[];
  studyNotes: readonly AppStudyNote[];
}): ReadonlySet<string> {
  const studyNoteIds = new Set<string>();

  for (const studyNote of input.studyNotes) {
    const recommendation = getInterleavedRecallRecommendation({
      histories: input.histories,
      studyNote,
      studyNotes: input.studyNotes,
    });

    if (recommendation !== null) {
      studyNoteIds.add(studyNote.id);
    }
  }

  return studyNoteIds;
}

function formatRecommendationSummary(input: {
  action: string;
  nextRecall: string;
  prompt: string;
  scoreLabel: string | null;
}) {
  const scoreCopy =
    input.scoreLabel === null ? "" : ` Last score: ${input.scoreLabel}.`;

  return `${input.prompt} ${input.action}.${scoreCopy} Next recall: ${input.nextRecall}.`;
}

function createRecommendation(input: {
  action: string;
  kind: RecallGuidanceRecommendationKind;
  nextRecall: string;
  prompt: string;
  scoreLabel: string | null;
}): RecallGuidanceRecommendation {
  return {
    kind: input.kind,
    nextRecall: input.nextRecall,
    summary: formatRecommendationSummary(input),
  };
}

function createRecallGuidanceRecommendation(input: {
  interleavingReady: boolean;
  learningState: StudyNoteLearningState | null;
  nextRecall: string;
  recallToday: boolean;
  studyNote: AppStudyNote;
}): RecallGuidanceRecommendation {
  const prompt = input.studyNote.prompt;
  const scoreLabel = formatStudyNoteLearningStateScoreLabel(
    input.learningState?.latestScore ?? null,
  );

  if (input.learningState?.needsPractice) {
    return createRecommendation({
      action: "needs practice",
      kind: "needs-practice",
      nextRecall: input.nextRecall,
      prompt,
      scoreLabel,
    });
  }

  if (input.recallToday) {
    return createRecommendation({
      action: "is ready for Recall Today",
      kind: "recall-today",
      nextRecall: input.nextRecall,
      prompt,
      scoreLabel,
    });
  }

  if (input.interleavingReady) {
    return createRecommendation({
      action:
        "is ready for Interleaved Recall after repeated Good or Easy recalls",
      kind: "interleaving-ready",
      nextRecall: input.nextRecall,
      prompt,
      scoreLabel: null,
    });
  }

  return createRecommendation({
    action: "is the next Study Note to reinforce",
    kind: "reinforce",
    nextRecall: input.nextRecall,
    prompt,
    scoreLabel: null,
  });
}

function selectRecommendedRecallGuidanceEntry(
  entries: readonly RecallGuidanceEntry[],
) {
  return (
    entries.find((entry) => entry.recallToday) ??
    entries.find((entry) => entry.interleavingReady) ??
    entries[0] ??
    null
  );
}

export function deriveRecallGuidance(
  input: RecallGuidanceInput,
): RecallGuidanceEntry[] {
  const histories = toStudyNoteRecallHistories(input.attemptsByNote);
  const recallableStudyNotes = input.studyNotes.filter(
    (studyNote) => getStudyNoteReadiness(studyNote).recallable,
  );
  const learningStates = deriveStudyNoteLearningStates({
    histories,
    now: input.now,
    recallSchedules: input.recallSchedules,
    studyNotes: recallableStudyNotes,
  });
  const learningStateByStudyNoteId = new Map(
    learningStates.map((learningState) => [
      learningState.studyNoteId,
      learningState,
    ]),
  );
  const recallTodayQueue = planRecallWork({
    histories,
    now: input.now,
    recallSchedules: input.recallSchedules,
    sessionResults: input.sessionResults,
    studyNotes: recallableStudyNotes,
    userTimeZone: input.userTimeZone,
  }).recallTodayQueue;
  const recallScheduleByStudyNoteId = new Map(
    input.recallSchedules.map((schedule) => [schedule.studyNoteId, schedule]),
  );
  const recallTodayQueueItemByStudyNoteId = new Map<
    string,
    PlannedRecallWorkItem
  >(recallTodayQueue.map((queueItem) => [queueItem.studyNote.id, queueItem]));
  const interleavingReadyStudyNoteIds = getInterleavingReadyStudyNoteIds({
    histories,
    studyNotes: recallableStudyNotes,
  });

  return recallableStudyNotes.map((studyNote) => {
    const learningState = learningStateByStudyNoteId.get(studyNote.id) ?? null;
    const recallTodayQueueItem =
      recallTodayQueueItemByStudyNoteId.get(studyNote.id) ?? null;
    const nextRecall =
      formatNextRecallTiming({
        now: input.now,
        schedule: recallScheduleByStudyNoteId.get(studyNote.id) ?? null,
        userTimeZone: input.userTimeZone,
      }) ?? "Recall today";
    const interleavingReady = interleavingReadyStudyNoteIds.has(studyNote.id);
    const recallToday = recallTodayQueueItem !== null;
    const lastScore = learningState?.latestScore ?? null;
    const needsPractice = learningState?.needsPractice === true;
    const dueForRecall = learningState?.dueForRecall === true;
    const notRecalledYet = lastScore === null;

    return {
      dueForRecall,
      interleavingReady,
      lastScore,
      needsPractice,
      nextRecall,
      notRecalledYet,
      recallToday,
      recallTodayReasons: recallTodayQueueItem?.reasons ?? [],
      recommendation: createRecallGuidanceRecommendation({
        interleavingReady,
        learningState,
        nextRecall,
        recallToday,
        studyNote,
      }),
      studyNote,
    } satisfies RecallGuidanceEntry;
  });
}

export function getRecallGuidanceRecommendation(input: {
  entries: readonly RecallGuidanceEntry[];
}): RecallGuidanceRecommendation | null {
  return (
    selectRecommendedRecallGuidanceEntry(input.entries)?.recommendation ?? null
  );
}
