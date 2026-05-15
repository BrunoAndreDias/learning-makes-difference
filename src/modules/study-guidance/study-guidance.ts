import type { UserTimeZonePreference } from "../access/session/session-contract";
import type { AppLabel } from "../labels/label-management/labels";
import type { FlashCardRecallAttemptsByNote, RecallSchedule } from "../recall";
import { getInterleavedRecallRecommendation } from "../recall/interleaved-recall";
import { formatNextRecallTiming } from "../recall/recall-schedule";
import { buildRecallTodayQueue } from "../recall/recall-today";
import {
  type AppStudyNote,
  deriveStudyNoteLearningStates,
  getStudyNoteReadiness,
  type StudyNoteLearningState,
  type StudyNoteRecallHistory,
  toStudyNoteRecallHistories,
} from "../study-notes";
import { formatStudyNoteLearningStateScoreLabel } from "../study-notes/learning-state";

export type StudyGuidanceStat = {
  count: number;
  detail: string;
  id:
    | "interleaving-ready"
    | "needs-practice"
    | "not-recalled-yet"
    | "recall-today";
  label: string;
};

export type StudyGuidanceTopicRecommendation = {
  nextRecall: string;
  summary: string;
};

export type StudyGuidanceTopic = {
  id: string;
  interleavingReadyCount: number;
  needsPracticeCount: number;
  notRecalledYetCount: number;
  recommendation: StudyGuidanceTopicRecommendation | null;
  recallTodayCount: number;
  studyNoteCount: number;
  title: string;
};

export type StudyGuidance = {
  stats: readonly StudyGuidanceStat[];
  topics: readonly StudyGuidanceTopic[];
};

type StudyGuidanceInput = {
  attemptsByNote: readonly FlashCardRecallAttemptsByNote[];
  labels: readonly AppLabel[];
  now: string;
  recallSchedules: readonly RecallSchedule[];
  studyNotes: readonly AppStudyNote[];
  userTimeZone: UserTimeZonePreference;
};

type StudyGuidanceTopicDraft = {
  id: string;
  studyNotes: readonly AppStudyNote[];
  title: string;
};

const recallTodayStat: Omit<StudyGuidanceStat, "count"> = {
  detail: "Recommended recall work exists today.",
  id: "recall-today",
  label: "Recall today",
};
const needsPracticeStat: Omit<StudyGuidanceStat, "count"> = {
  detail: "Latest recall was Hard or Forgot.",
  id: "needs-practice",
  label: "Needs practice",
};
const notRecalledYetStat: Omit<StudyGuidanceStat, "count"> = {
  detail: "No recall attempts yet.",
  id: "not-recalled-yet",
  label: "Not recalled yet",
};
const interleavingReadyStat: Omit<StudyGuidanceStat, "count"> = {
  detail: "Two recent Good or Easy recalls plus a related pool.",
  id: "interleaving-ready",
  label: "Interleaving ready",
};

function listInterleavingReadyStudyNoteIds(input: {
  histories: readonly StudyNoteRecallHistory[];
  studyNotes: readonly AppStudyNote[];
}) {
  return input.studyNotes.flatMap((studyNote) =>
    getInterleavedRecallRecommendation({
      histories: input.histories,
      studyNote,
      studyNotes: input.studyNotes,
    }) === null
      ? []
      : [studyNote.id],
  );
}

function selectRecommendedStudyNote(input: {
  interleavingReadyStudyNoteIds: ReadonlySet<string>;
  recallTodayStudyNoteIds: ReadonlySet<string>;
  studyNotes: readonly AppStudyNote[];
}) {
  const recallTodayStudyNote = input.studyNotes.find((studyNote) =>
    input.recallTodayStudyNoteIds.has(studyNote.id),
  );

  if (recallTodayStudyNote !== undefined) {
    return recallTodayStudyNote;
  }

  const interleavingReadyStudyNote = input.studyNotes.find((studyNote) =>
    input.interleavingReadyStudyNoteIds.has(studyNote.id),
  );

  return interleavingReadyStudyNote ?? input.studyNotes[0] ?? null;
}

function formatTopicRecommendation(input: {
  interleavingReadyStudyNoteIds: ReadonlySet<string>;
  learningState: StudyNoteLearningState | null;
  now: string;
  recallSchedule: RecallSchedule | null;
  recommendedStudyNote: AppStudyNote | null;
  recallTodayStudyNoteIds: ReadonlySet<string>;
  userTimeZone: UserTimeZonePreference;
}) {
  if (input.recommendedStudyNote === null) {
    return null;
  }

  const prompt = input.recommendedStudyNote.prompt;
  const scoreLabel = formatStudyNoteLearningStateScoreLabel(
    input.learningState?.latestScore ?? null,
  );
  const nextRecall =
    formatNextRecallTiming({
      now: input.now,
      schedule: input.recallSchedule,
      userTimeZone: input.userTimeZone,
    }) ?? "Recall today";

  if (input.learningState?.needsPractice) {
    return {
      nextRecall,
      summary:
        scoreLabel === null
          ? `${prompt} needs practice. Next recall: ${nextRecall}.`
          : `${prompt} needs practice. Last score: ${scoreLabel}. Next recall: ${nextRecall}.`,
    };
  }

  if (input.recallTodayStudyNoteIds.has(input.recommendedStudyNote.id)) {
    return {
      nextRecall,
      summary:
        scoreLabel === null
          ? `${prompt} is ready for Recall Today. Next recall: ${nextRecall}.`
          : `${prompt} is ready for Recall Today. Last score: ${scoreLabel}. Next recall: ${nextRecall}.`,
    };
  }

  if (input.interleavingReadyStudyNoteIds.has(input.recommendedStudyNote.id)) {
    return {
      nextRecall,
      summary: `${prompt} is interleaving ready after repeated Good or Easy recalls. Next recall: ${nextRecall}.`,
    };
  }

  return {
    nextRecall,
    summary: `${prompt} is the next Study Note to reinforce. Next recall: ${nextRecall}.`,
  };
}

function createTopicDrafts(input: {
  labels: readonly AppLabel[];
  studyNotes: readonly AppStudyNote[];
}) {
  const topicDrafts = input.labels.flatMap((label) => {
    const labelStudyNotes = input.studyNotes.filter((studyNote) =>
      studyNote.labelIds.includes(label.id),
    );

    return labelStudyNotes.length === 0
      ? []
      : [
          {
            id: label.id,
            studyNotes: labelStudyNotes,
            title: label.name,
          } satisfies StudyGuidanceTopicDraft,
        ];
  });
  const unlabeledStudyNotes = input.studyNotes.filter(
    (studyNote) => studyNote.labelIds.length === 0,
  );

  if (unlabeledStudyNotes.length > 0) {
    topicDrafts.push({
      id: "__unlabeled__",
      studyNotes: unlabeledStudyNotes,
      title: "Unlabeled Study Notes",
    });
  }

  return topicDrafts;
}

function compareTopics(left: StudyGuidanceTopic, right: StudyGuidanceTopic) {
  return (
    right.needsPracticeCount - left.needsPracticeCount ||
    right.recallTodayCount - left.recallTodayCount ||
    right.interleavingReadyCount - left.interleavingReadyCount ||
    right.notRecalledYetCount - left.notRecalledYetCount ||
    left.title.localeCompare(right.title)
  );
}

export function deriveStudyGuidance(input: StudyGuidanceInput): StudyGuidance {
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
  const recallScheduleByStudyNoteId = new Map(
    input.recallSchedules.map((schedule) => [schedule.studyNoteId, schedule]),
  );
  const recallTodayQueue = buildRecallTodayQueue({
    histories,
    now: input.now,
    recallSchedules: input.recallSchedules,
    studyNotes: recallableStudyNotes,
    userTimeZone: input.userTimeZone,
  });
  const recallTodayStudyNoteIds = new Set(
    recallTodayQueue.map((queueItem) => queueItem.studyNote.id),
  );
  const interleavingReadyStudyNoteIds = new Set(
    listInterleavingReadyStudyNoteIds({
      histories,
      studyNotes: recallableStudyNotes,
    }),
  );
  const topicDrafts = createTopicDrafts({
    labels: input.labels,
    studyNotes: recallableStudyNotes,
  });
  const topics = topicDrafts
    .map((topicDraft) => {
      const needsPracticeCount = topicDraft.studyNotes.filter(
        (studyNote) =>
          learningStateByStudyNoteId.get(studyNote.id)?.needsPractice === true,
      ).length;
      const recallTodayCount = topicDraft.studyNotes.filter((studyNote) =>
        recallTodayStudyNoteIds.has(studyNote.id),
      ).length;
      const notRecalledYetCount = topicDraft.studyNotes.filter(
        (studyNote) =>
          learningStateByStudyNoteId.get(studyNote.id)?.latestScore === null,
      ).length;
      const interleavingReadyCount = topicDraft.studyNotes.filter((studyNote) =>
        interleavingReadyStudyNoteIds.has(studyNote.id),
      ).length;
      const recommendedStudyNote = selectRecommendedStudyNote({
        interleavingReadyStudyNoteIds,
        recallTodayStudyNoteIds,
        studyNotes: topicDraft.studyNotes,
      });

      return {
        id: topicDraft.id,
        interleavingReadyCount,
        needsPracticeCount,
        notRecalledYetCount,
        recommendation: formatTopicRecommendation({
          interleavingReadyStudyNoteIds,
          learningState:
            recommendedStudyNote === null
              ? null
              : (learningStateByStudyNoteId.get(recommendedStudyNote.id) ??
                null),
          now: input.now,
          recallSchedule:
            recommendedStudyNote === null
              ? null
              : (recallScheduleByStudyNoteId.get(recommendedStudyNote.id) ??
                null),
          recommendedStudyNote,
          recallTodayStudyNoteIds,
          userTimeZone: input.userTimeZone,
        }),
        recallTodayCount,
        studyNoteCount: topicDraft.studyNotes.length,
        title: topicDraft.title,
      } satisfies StudyGuidanceTopic;
    })
    .sort(compareTopics);

  return {
    stats: [
      {
        ...recallTodayStat,
        count: recallTodayQueue.length,
      },
      {
        ...needsPracticeStat,
        count: learningStates.filter(
          (learningState) => learningState.needsPractice,
        ).length,
      },
      {
        ...notRecalledYetStat,
        count: learningStates.filter(
          (learningState) => learningState.latestScore === null,
        ).length,
      },
      {
        ...interleavingReadyStat,
        count: interleavingReadyStudyNoteIds.size,
      },
    ],
    topics,
  };
}
