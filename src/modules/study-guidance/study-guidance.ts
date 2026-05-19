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
import {
  listPracticeRepairQueueItems,
  type PracticeRepairQueueListItem,
} from "../recall/recall-practice-repair";
import type { AppStudyNote } from "../study-notes";

export type StudyGuidanceSignalId =
  | "interleaving-ready"
  | "needs-practice"
  | "not-recalled-yet"
  | "recall-today";

export type StudyGuidanceStat = {
  count: number;
  detail: string;
  id: StudyGuidanceSignalId;
  label: string;
};

export type StudyGuidancePracticeRepair = {
  activeEntryCount: number;
  candidateCount: number;
  hasActiveEntries: boolean;
  hasCandidates: boolean;
  summary: string;
};

export type StudyGuidanceTopicRecommendation =
  | RecallGuidanceRecommendation
  | {
      kind: "practice-repair";
      summary: string;
    };

export type StudyGuidanceTopic = {
  id: string;
  interleavingReadyCount: number;
  needsPracticeCount: number;
  notRecalledYetCount: number;
  practiceRepairActiveCount: number;
  practiceRepairCandidateCount: number;
  recommendation: StudyGuidanceTopicRecommendation | null;
  recallTodayCount: number;
  studyNoteCount: number;
  title: string;
};

export type StudyGuidanceTopicStat = Pick<
  StudyGuidanceStat,
  "count" | "id" | "label"
>;

export type StudyGuidance = {
  practiceRepair: StudyGuidancePracticeRepair | null;
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

type StudyGuidancePracticeRepairCounts = Pick<
  StudyGuidancePracticeRepair,
  "activeEntryCount" | "candidateCount"
>;
type StudyGuidancePracticeRepairQueueItem =
  PracticeRepairQueueListItem<SessionResult>;

type StudyGuidanceSignalDefinition = Omit<StudyGuidanceStat, "count"> & {
  countKey: keyof RecallGuidanceSignalCounts;
};

const studyGuidanceSignalDefinitions = [
  {
    countKey: "recallTodayCount",
    detail: "Recommended recall work exists today.",
    id: "recall-today",
    label: "Recall Today",
  },
  {
    countKey: "needsPracticeCount",
    detail: "Latest recall was Hard or Forgot.",
    id: "needs-practice",
    label: "Needs practice",
  },
  {
    countKey: "notRecalledYetCount",
    detail: "No recall attempts yet.",
    id: "not-recalled-yet",
    label: "Not recalled yet",
  },
  {
    countKey: "interleavingReadyCount",
    detail: "Ready for Interleaved Recall after repeated Good or Easy recalls.",
    id: "interleaving-ready",
    label: "Interleaved Recall",
  },
] as const satisfies readonly StudyGuidanceSignalDefinition[];

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

function createStudyGuidanceStats(
  signalCounts: RecallGuidanceSignalCounts,
): StudyGuidanceStat[] {
  return studyGuidanceSignalDefinitions.map(({ countKey, ...stat }) => ({
    ...stat,
    count: signalCounts[countKey],
  }));
}

export function getStudyGuidanceTopicStats(
  topic: StudyGuidanceTopic,
): StudyGuidanceTopicStat[] {
  return studyGuidanceSignalDefinitions.map(({ countKey, id, label }) => ({
    count: topic[countKey],
    id,
    label,
  }));
}

function compareTopics(left: StudyGuidanceTopic, right: StudyGuidanceTopic) {
  return (
    right.practiceRepairActiveCount - left.practiceRepairActiveCount ||
    right.practiceRepairCandidateCount - left.practiceRepairCandidateCount ||
    right.needsPracticeCount - left.needsPracticeCount ||
    right.recallTodayCount - left.recallTodayCount ||
    right.interleavingReadyCount - left.interleavingReadyCount ||
    right.notRecalledYetCount - left.notRecalledYetCount ||
    left.title.localeCompare(right.title)
  );
}

function createPracticeRepairCounts(): StudyGuidancePracticeRepairCounts {
  return {
    activeEntryCount: 0,
    candidateCount: 0,
  };
}

function getPracticeRepairQueueItemStudyNoteId(
  item: StudyGuidancePracticeRepairQueueItem,
) {
  if (item.kind === "active") {
    return item.entry.reference.studyNoteId;
  }

  return item.question.noteId;
}

function createStudyNoteIdSet(
  entries: readonly RecallGuidanceEntry[],
): ReadonlySet<string> {
  return new Set(entries.map((entry) => entry.studyNote.id));
}

function countPracticeRepairQueueItems(input: {
  queueItems: readonly StudyGuidancePracticeRepairQueueItem[];
  studyNoteIds: ReadonlySet<string> | null;
}): StudyGuidancePracticeRepairCounts {
  const counts = createPracticeRepairCounts();

  for (const item of input.queueItems) {
    const studyNoteId = getPracticeRepairQueueItemStudyNoteId(item);

    if (input.studyNoteIds !== null && !input.studyNoteIds.has(studyNoteId)) {
      continue;
    }

    if (item.kind === "active") {
      counts.activeEntryCount += 1;
      continue;
    }

    counts.candidateCount += 1;
  }

  return counts;
}

function formatPracticeRepairCountLabel(
  count: number,
  singular: string,
  plural: string,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatPracticeRepairWorkSummary(input: {
  counts: StudyGuidancePracticeRepairCounts;
  location: string;
}) {
  const parts: string[] = [];

  if (input.counts.activeEntryCount > 0) {
    parts.push(
      formatPracticeRepairCountLabel(
        input.counts.activeEntryCount,
        "active Practice Repair entry",
        "active Practice Repair entries",
      ),
    );
  }

  if (input.counts.candidateCount > 0) {
    parts.push(
      formatPracticeRepairCountLabel(
        input.counts.candidateCount,
        "new repair candidate",
        "new repair candidates",
      ),
    );
  }

  if (parts.length === 0) {
    return null;
  }

  const totalCount =
    input.counts.activeEntryCount + input.counts.candidateCount;
  const workSummary =
    parts.length === 1 ? parts[0] : `${parts[0]} and ${parts[1]}`;

  return `${workSummary} ${totalCount === 1 ? "is" : "are"} waiting ${input.location}.`;
}

function createStudyGuidancePracticeRepair(
  queueItems: readonly StudyGuidancePracticeRepairQueueItem[],
): StudyGuidancePracticeRepair | null {
  const counts = countPracticeRepairQueueItems({
    queueItems,
    studyNoteIds: null,
  });
  const summary = formatPracticeRepairWorkSummary({
    counts,
    location: "in Recall",
  });

  if (summary === null) {
    return null;
  }

  return {
    ...counts,
    hasActiveEntries: counts.activeEntryCount > 0,
    hasCandidates: counts.candidateCount > 0,
    summary,
  };
}

function createPracticeRepairTopicRecommendation(input: {
  counts: StudyGuidancePracticeRepairCounts;
  title: string;
}): StudyGuidanceTopicRecommendation | null {
  const summary = formatPracticeRepairWorkSummary({
    counts: input.counts,
    location: `for ${input.title}`,
  });

  if (summary === null) {
    return null;
  }

  return {
    kind: "practice-repair",
    summary: `${summary} Open Practice Repair before repeating generic Needs practice work.`,
  };
}

function getStudyGuidanceTopicRecommendation(input: {
  counts: StudyGuidancePracticeRepairCounts;
  entries: readonly RecallGuidanceEntry[];
  title: string;
}): StudyGuidanceTopicRecommendation | null {
  return (
    createPracticeRepairTopicRecommendation({
      counts: input.counts,
      title: input.title,
    }) ??
    getRecallGuidanceRecommendation({
      entries: input.entries,
    })
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
  const practiceRepairQueueItems = listPracticeRepairQueueItems({
    results: input.sessionResults,
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
      const practiceRepairCounts = countPracticeRepairQueueItems({
        queueItems: practiceRepairQueueItems,
        studyNoteIds: createStudyNoteIdSet(topicDraft.guidanceEntries),
      });

      return {
        id: topicDraft.id,
        ...signalCounts,
        practiceRepairActiveCount: practiceRepairCounts.activeEntryCount,
        practiceRepairCandidateCount: practiceRepairCounts.candidateCount,
        recommendation: getStudyGuidanceTopicRecommendation({
          counts: practiceRepairCounts,
          entries: topicDraft.guidanceEntries,
          title: topicDraft.title,
        }),
        studyNoteCount: topicDraft.guidanceEntries.length,
        title: topicDraft.title,
      } satisfies StudyGuidanceTopic;
    })
    .sort(compareTopics);
  const signalCounts = countRecallGuidanceSignals(recallGuidance);

  return {
    practiceRepair: createStudyGuidancePracticeRepair(practiceRepairQueueItems),
    stats: createStudyGuidanceStats(signalCounts),
    topics,
  };
}
