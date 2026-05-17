import type { UserTimeZonePreference } from "../access/session/session-contract";
import type { AppLabel } from "../labels/label-management/labels";
import type {
  FlashCardRecallAttemptsByNote,
  RecallGuidanceEntry,
  RecallGuidanceRecommendation,
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

export type StudyGuidanceTopicRecommendation = RecallGuidanceRecommendation;

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

type RecallGuidanceSignalCounts = {
  interleavingReadyCount: number;
  needsPracticeCount: number;
  notRecalledYetCount: number;
  recallTodayCount: number;
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

function countRecallGuidanceSignals(
  guidanceEntries: readonly RecallGuidanceEntry[],
): RecallGuidanceSignalCounts {
  const counts: RecallGuidanceSignalCounts = {
    interleavingReadyCount: 0,
    needsPracticeCount: 0,
    notRecalledYetCount: 0,
    recallTodayCount: 0,
  };

  for (const entry of guidanceEntries) {
    if (entry.interleavingReady) {
      counts.interleavingReadyCount += 1;
    }

    if (entry.needsPractice) {
      counts.needsPracticeCount += 1;
    }

    if (entry.notRecalledYet) {
      counts.notRecalledYetCount += 1;
    }

    if (entry.recallToday) {
      counts.recallTodayCount += 1;
    }
  }

  return counts;
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
      const signalCounts = countRecallGuidanceSignals(
        topicDraft.guidanceEntries,
      );
      const recommendation = getRecallGuidanceRecommendation({
        entries: topicDraft.guidanceEntries,
      });

      return {
        id: topicDraft.id,
        ...signalCounts,
        recommendation,
        studyNoteCount: topicDraft.guidanceEntries.length,
        title: topicDraft.title,
      } satisfies StudyGuidanceTopic;
    })
    .sort(compareTopics);
  const signalCounts = countRecallGuidanceSignals(recallGuidance);

  return {
    stats: [
      {
        ...recallTodayStat,
        count: signalCounts.recallTodayCount,
      },
      {
        ...needsPracticeStat,
        count: signalCounts.needsPracticeCount,
      },
      {
        ...notRecalledYetStat,
        count: signalCounts.notRecalledYetCount,
      },
      {
        ...interleavingReadyStat,
        count: signalCounts.interleavingReadyCount,
      },
    ],
    topics,
  };
}
