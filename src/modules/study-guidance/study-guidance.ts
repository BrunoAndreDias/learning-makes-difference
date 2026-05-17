import type { UserTimeZonePreference } from "../access/session/session-contract";
import type { AppLabel } from "../labels/label-management/labels";
import type {
  FlashCardRecallAttemptsByNote,
  RecallGuidanceEntry,
  RecallSchedule,
  SessionResult,
} from "../recall";
import {
  deriveRecallGuidance,
  getRecallGuidanceRecommendation,
} from "../recall";
import type { AppStudyNote } from "../study-notes";

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
  sessionResults: readonly SessionResult[];
  studyNotes: readonly AppStudyNote[];
  userTimeZone: UserTimeZonePreference;
};

type StudyGuidanceTopicDraft = {
  guidanceEntries: readonly RecallGuidanceEntry[];
  id: string;
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

function createTopicDrafts(input: {
  guidanceEntries: readonly RecallGuidanceEntry[];
  labels: readonly AppLabel[];
}) {
  const topicDrafts = input.labels.flatMap((label) => {
    const labelGuidanceEntries = input.guidanceEntries.filter((entry) =>
      entry.studyNote.labelIds.includes(label.id),
    );

    return labelGuidanceEntries.length === 0
      ? []
      : [
          {
            guidanceEntries: labelGuidanceEntries,
            id: label.id,
            title: label.name,
          } satisfies StudyGuidanceTopicDraft,
        ];
  });
  const unlabeledGuidanceEntries = input.guidanceEntries.filter(
    (entry) => entry.studyNote.labelIds.length === 0,
  );

  if (unlabeledGuidanceEntries.length > 0) {
    topicDrafts.push({
      guidanceEntries: unlabeledGuidanceEntries,
      id: "__unlabeled__",
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
  const recallGuidance = deriveRecallGuidance({
    attemptsByNote: input.attemptsByNote,
    now: input.now,
    recallSchedules: input.recallSchedules,
    sessionResults: input.sessionResults,
    studyNotes: input.studyNotes,
    userTimeZone: input.userTimeZone,
  });
  const topicDrafts = createTopicDrafts({
    guidanceEntries: recallGuidance,
    labels: input.labels,
  });
  const topics = topicDrafts
    .map((topicDraft) => {
      const needsPracticeCount = topicDraft.guidanceEntries.filter(
        (entry) => entry.needsPractice,
      ).length;
      const recallTodayCount = topicDraft.guidanceEntries.filter(
        (entry) => entry.recallToday,
      ).length;
      const notRecalledYetCount = topicDraft.guidanceEntries.filter(
        (entry) => entry.notRecalledYet,
      ).length;
      const interleavingReadyCount = topicDraft.guidanceEntries.filter(
        (entry) => entry.interleavingReady,
      ).length;
      const recommendation = getRecallGuidanceRecommendation({
        entries: topicDraft.guidanceEntries,
      });

      return {
        id: topicDraft.id,
        interleavingReadyCount,
        needsPracticeCount,
        notRecalledYetCount,
        recommendation,
        recallTodayCount,
        studyNoteCount: topicDraft.guidanceEntries.length,
        title: topicDraft.title,
      } satisfies StudyGuidanceTopic;
    })
    .sort(compareTopics);

  return {
    stats: [
      {
        ...recallTodayStat,
        count: recallGuidance.filter((entry) => entry.recallToday).length,
      },
      {
        ...needsPracticeStat,
        count: recallGuidance.filter((entry) => entry.needsPractice).length,
      },
      {
        ...notRecalledYetStat,
        count: recallGuidance.filter((entry) => entry.notRecalledYet).length,
      },
      {
        ...interleavingReadyStat,
        count: recallGuidance.filter((entry) => entry.interleavingReady).length,
      },
    ],
    topics,
  };
}
