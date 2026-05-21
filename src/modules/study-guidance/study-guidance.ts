import type { UserTimeZonePreference } from "../access/session/session-contract";
import type { AppLabel } from "../labels/label-management/labels";
import type {
  FlashCardRecallAttemptsByNote,
  RecallSchedule,
  SessionResult,
} from "../recall";
import { getInterleavedRecallRecommendation } from "../recall/interleaved-recall";
import { getLocalDateKey } from "../recall/local-date";
import { buildDueTodayQueue } from "../recall/recall-due-today";
import {
  formatPracticeRepairIntentLabel,
  getPracticeRepairEntryId,
  listActionablePracticeFollowUps,
  listPracticeRepairQueueItems,
  type PracticeRepairEntry,
  type PracticeRepairQueueListItem,
} from "../recall/recall-practice-repair";
import {
  type AppStudyNote,
  getStudyNoteReadiness,
  type StudyNoteRecallHistory,
  toStudyNoteRecallHistories,
} from "../study-notes";

export type StudyGuidanceBucketId =
  | "practice-repair"
  | "practice-follow-up"
  | "due-today"
  | "completion-blocker"
  | "first-recall"
  | "interleaving-ready";

export type StudyGuidanceSummaryCard = {
  count: number;
  detail: string;
  id: StudyGuidanceBucketId;
  label: string;
};

export type StudyGuidanceRowAction =
  | {
      kind: "practice-repair-draft";
      label: "Open Practice Repair";
      questionResultId: string;
      sessionResultId: string;
    }
  | {
      kind: "practice-repair-entry";
      label: "Open Practice Repair";
      practiceRepairEntryId: string;
    }
  | {
      kind: "recall-due-today";
      label: "Open Scheduled recall";
    }
  | {
      kind: "recall-selection";
      label: "Open Recall Selection";
      studyNoteIds: readonly string[];
    }
  | {
      focus: "expected-answer";
      kind: "study-note-completion";
      label: "Add expected answer";
      studyNoteId: string;
    }
  | {
      kind: "study-notes";
      label: "Open Study Notes";
    };

export type StudyGuidanceRow = {
  action: StudyGuidanceRowAction;
  bucketId: StudyGuidanceBucketId;
  bucketLabel: string;
  evidence: string;
  id: string;
  metadata: readonly string[];
  title: string;
};

export type StudyGuidanceEmptyState = {
  action: {
    kind: "study-notes";
    label: "Create first Study Note";
  };
  description: string;
  title: string;
};

export type StudyGuidance = {
  emptyState: StudyGuidanceEmptyState | null;
  rows: readonly StudyGuidanceRow[];
  summaryCards: readonly StudyGuidanceSummaryCard[];
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

type StudyGuidanceRowDraft = StudyGuidanceRow & {
  studyNoteIds: readonly string[];
};

type BucketDefinition = Omit<StudyGuidanceSummaryCard, "count">;
type PracticeRepairQueueItem = PracticeRepairQueueListItem<SessionResult>;

const bucketDefinitions = [
  {
    detail: "Resolve weak recall evidence in Practice Repair first.",
    id: "practice-repair",
    label: "Practice Repair",
  },
  {
    detail: "Completed repairs still waiting for recall again soon.",
    id: "practice-follow-up",
    label: "Practice Follow-up",
  },
  {
    detail: "Study Notes scheduled for recall today or already overdue.",
    id: "due-today",
    label: "Scheduled",
  },
  {
    detail: "Saved Study Notes that still need an expected answer.",
    id: "completion-blocker",
    label: "Completion blocker",
  },
  {
    detail: "Recallable Study Notes with no recall attempts yet.",
    id: "first-recall",
    label: "First recall",
  },
  {
    detail: "Related Study Notes ready for mixed practice.",
    id: "interleaving-ready",
    label: "Interleaving ready",
  },
] as const satisfies readonly BucketDefinition[];

function getBucketDefinition(id: StudyGuidanceBucketId): BucketDefinition {
  const definition = bucketDefinitions.find((bucket) => bucket.id === id);

  if (definition === undefined) {
    throw new Error(`Unknown Study Guidance bucket: ${id}`);
  }

  return definition;
}

function createEmptyState(): StudyGuidanceEmptyState {
  return {
    action: {
      kind: "study-notes",
      label: "Create first Study Note",
    },
    description:
      "Start the Learning Loop with one clear Study Note, then use recall and Practice Repair to strengthen it over time.",
    title: "Create your first Study Note",
  };
}

function getStudyNoteTitle(studyNote: AppStudyNote): string {
  const prompt = studyNote.prompt.trim();

  if (prompt.length > 0) {
    return prompt;
  }

  const sourceTitle = studyNote.source.title.trim();

  if (sourceTitle.length > 0) {
    return sourceTitle;
  }

  const sourceBody = studyNote.source.body.trim();

  return sourceBody.length > 0 ? sourceBody : "Untitled Study Note";
}

function getStudyNoteSourceTitle(studyNote: AppStudyNote): string {
  const sourceTitle = studyNote.source.title.trim();

  if (sourceTitle.length > 0) {
    return sourceTitle;
  }

  return "Untitled source";
}

function getStudyNoteLabelNames(input: {
  labelsById: ReadonlyMap<string, AppLabel>;
  studyNote: AppStudyNote;
}): string[] {
  return input.studyNote.labelIds
    .map((labelId) => input.labelsById.get(labelId)?.name)
    .filter((labelName): labelName is string => labelName !== undefined);
}

function createStudyNoteMetadata(input: {
  labelsById: ReadonlyMap<string, AppLabel>;
  studyNote: AppStudyNote;
}): string[] {
  const labelNames = getStudyNoteLabelNames(input);
  const labelMetadata =
    labelNames.length === 0
      ? "Label: None"
      : `Label${labelNames.length === 1 ? "" : "s"}: ${labelNames.join(", ")}`;

  return [labelMetadata, `Source: ${getStudyNoteSourceTitle(input.studyNote)}`];
}

function createStudyNoteRowDraft(input: {
  action: StudyGuidanceRowAction;
  bucketId: StudyGuidanceBucketId;
  evidence: string;
  id: string;
  labelsById: ReadonlyMap<string, AppLabel>;
  studyNote: AppStudyNote;
}): StudyGuidanceRowDraft {
  const bucket = getBucketDefinition(input.bucketId);

  return {
    action: input.action,
    bucketId: bucket.id,
    bucketLabel: bucket.label,
    evidence: input.evidence,
    id: input.id,
    metadata: createStudyNoteMetadata({
      labelsById: input.labelsById,
      studyNote: input.studyNote,
    }),
    studyNoteIds: [input.studyNote.id],
    title: getStudyNoteTitle(input.studyNote),
  };
}

function getLatestHistoryAttempt(
  history: StudyNoteRecallHistory | null,
): StudyNoteRecallHistory["attempts"][number] | null {
  return history?.attempts.at(-1) ?? null;
}

function getDueState(input: {
  now: string;
  schedule: RecallSchedule;
  userTimeZone: UserTimeZonePreference;
}): "due-today" | "overdue" | null {
  const nextRecallDateKey = getLocalDateKey({
    timestamp: input.schedule.nextRecallAt,
    userTimeZone: input.userTimeZone,
  });
  const todayDateKey = getLocalDateKey({
    timestamp: input.now,
    userTimeZone: input.userTimeZone,
  });

  if (nextRecallDateKey === null || todayDateKey === null) {
    return null;
  }

  if (nextRecallDateKey < todayDateKey) {
    return "overdue";
  }

  return nextRecallDateKey === todayDateKey ? "due-today" : null;
}

function compareDueSchedules(input: {
  left: RecallSchedule;
  now: string;
  right: RecallSchedule;
  userTimeZone: UserTimeZonePreference;
}) {
  const leftDueState = getDueState({
    now: input.now,
    schedule: input.left,
    userTimeZone: input.userTimeZone,
  });
  const rightDueState = getDueState({
    now: input.now,
    schedule: input.right,
    userTimeZone: input.userTimeZone,
  });

  if (leftDueState === "overdue" && rightDueState !== "overdue") {
    return -1;
  }

  if (leftDueState !== "overdue" && rightDueState === "overdue") {
    return 1;
  }

  return (
    input.left.nextRecallAt.localeCompare(input.right.nextRecallAt) ||
    input.left.studyNoteId.localeCompare(input.right.studyNoteId)
  );
}

function createSummaryCards(
  rows: readonly StudyGuidanceRow[],
  countOverrides: Partial<Record<StudyGuidanceBucketId, number>> = {},
) {
  return bucketDefinitions.map((bucket) => ({
    ...bucket,
    count:
      countOverrides[bucket.id] ??
      rows.filter((row) => row.bucketId === bucket.id).length,
  }));
}

function createPracticeRepairEvidence(item: PracticeRepairQueueItem): string {
  if (item.kind === "active") {
    return `${formatPracticeRepairIntentLabel(item.entry.intent)} is still unresolved.`;
  }

  return [item.draft.summary, item.recentWeakAttemptsSummary]
    .filter((part): part is string => part !== null && part !== undefined)
    .join(" ");
}

function createPracticeRepairRows(input: {
  labelsById: ReadonlyMap<string, AppLabel>;
  queueItems: readonly PracticeRepairQueueItem[];
  studyNotesById: ReadonlyMap<string, AppStudyNote>;
}): StudyGuidanceRowDraft[] {
  const { labelsById, queueItems, studyNotesById } = input;

  return queueItems.flatMap((item) => {
    const studyNoteId =
      item.kind === "active"
        ? item.entry.reference.studyNoteId
        : item.question.noteId;
    const studyNote = studyNotesById.get(studyNoteId);

    if (studyNote === undefined) {
      return [];
    }

    const rowId =
      item.kind === "active"
        ? getPracticeRepairEntryId(item.entry)
        : item.question.questionResultId;
    const action =
      item.kind === "active"
        ? ({
            kind: "practice-repair-entry",
            label: "Open Practice Repair",
            practiceRepairEntryId: rowId,
          } satisfies StudyGuidanceRowAction)
        : ({
            kind: "practice-repair-draft",
            label: "Open Practice Repair",
            questionResultId: item.question.questionResultId,
            sessionResultId: item.result.id,
          } satisfies StudyGuidanceRowAction);

    return [
      createStudyNoteRowDraft({
        action,
        bucketId: "practice-repair",
        evidence: createPracticeRepairEvidence(item),
        id: rowId,
        labelsById,
        studyNote,
      }),
    ];
  });
}

function createPracticeFollowUpEvidence(
  entry: Pick<PracticeRepairEntry, "intent">,
): string {
  return `${formatPracticeRepairIntentLabel(entry.intent)} is complete. Recall again soon is still pending.`;
}

function createPracticeFollowUpRows(input: {
  blockedStudyNoteIds: ReadonlySet<string>;
  labelsById: ReadonlyMap<string, AppLabel>;
  sessionResults: readonly SessionResult[];
  studyNotesById: ReadonlyMap<string, AppStudyNote>;
}): StudyGuidanceRowDraft[] {
  return listActionablePracticeFollowUps({
    results: input.sessionResults,
  }).flatMap((entry) => {
    const studyNoteId = entry.reference.studyNoteId;

    if (input.blockedStudyNoteIds.has(studyNoteId)) {
      return [];
    }

    const studyNote = input.studyNotesById.get(studyNoteId);

    if (studyNote === undefined) {
      return [];
    }

    return [
      createStudyNoteRowDraft({
        action: {
          kind: "practice-repair-entry",
          label: "Open Practice Repair",
          practiceRepairEntryId: getPracticeRepairEntryId(entry),
        },
        bucketId: "practice-follow-up",
        evidence: createPracticeFollowUpEvidence(entry),
        id: `follow-up:${getPracticeRepairEntryId(entry)}`,
        labelsById: input.labelsById,
        studyNote,
      }),
    ];
  });
}

function createDueTodayEvidence(input: {
  now: string;
  schedule: RecallSchedule;
  userTimeZone: UserTimeZonePreference;
}): string {
  return getDueState({
    now: input.now,
    schedule: input.schedule,
    userTimeZone: input.userTimeZone,
  }) === "overdue"
    ? "Scheduled recall is overdue."
    : "Scheduled for recall today.";
}

function createDueTodayRows(input: {
  blockedStudyNoteIds: ReadonlySet<string>;
  histories: readonly StudyNoteRecallHistory[];
  labelsById: ReadonlyMap<string, AppLabel>;
  now: string;
  recallSchedules: readonly RecallSchedule[];
  sessionResults: readonly SessionResult[];
  studyNotes: readonly AppStudyNote[];
  userTimeZone: UserTimeZonePreference;
}): StudyGuidanceRowDraft[] {
  return buildDueTodayQueue({
    histories: input.histories,
    now: input.now,
    recallSchedules: input.recallSchedules,
    sessionResults: input.sessionResults,
    studyNotes: input.studyNotes,
    userTimeZone: input.userTimeZone,
  })
    .filter((item) => !input.blockedStudyNoteIds.has(item.studyNote.id))
    .sort((left, right) =>
      compareDueSchedules({
        left: left.schedule,
        now: input.now,
        right: right.schedule,
        userTimeZone: input.userTimeZone,
      }),
    )
    .map((item) =>
      createStudyNoteRowDraft({
        action: {
          kind: "recall-due-today",
          label: "Open Scheduled recall",
        },
        bucketId: "due-today",
        evidence: createDueTodayEvidence({
          now: input.now,
          schedule: item.schedule,
          userTimeZone: input.userTimeZone,
        }),
        id: `due:${item.studyNote.id}`,
        labelsById: input.labelsById,
        studyNote: item.studyNote,
      }),
    );
}

function createCompletionBlockerRows(input: {
  blockedStudyNoteIds: ReadonlySet<string>;
  labelsById: ReadonlyMap<string, AppLabel>;
  studyNotes: readonly AppStudyNote[];
}): StudyGuidanceRowDraft[] {
  return input.studyNotes
    .filter((studyNote) => !input.blockedStudyNoteIds.has(studyNote.id))
    .filter((studyNote) => getStudyNoteReadiness(studyNote).incomplete)
    .map((studyNote) =>
      createStudyNoteRowDraft({
        action: {
          focus: "expected-answer",
          kind: "study-note-completion",
          label: "Add expected answer",
          studyNoteId: studyNote.id,
        },
        bucketId: "completion-blocker",
        evidence:
          "Add the expected answer before this Study Note can enter recall.",
        id: `completion-blocker:${studyNote.id}`,
        labelsById: input.labelsById,
        studyNote,
      }),
    );
}

function createFirstRecallRows(input: {
  blockedStudyNoteIds: ReadonlySet<string>;
  historiesByStudyNoteId: ReadonlyMap<string, StudyNoteRecallHistory>;
  labelsById: ReadonlyMap<string, AppLabel>;
  studyNotes: readonly AppStudyNote[];
}): StudyGuidanceRowDraft[] {
  return input.studyNotes
    .filter((studyNote) => !input.blockedStudyNoteIds.has(studyNote.id))
    .filter((studyNote) => getStudyNoteReadiness(studyNote).recallable)
    .filter((studyNote) => {
      const history = input.historiesByStudyNoteId.get(studyNote.id) ?? null;

      return getLatestHistoryAttempt(history) === null;
    })
    .map((studyNote) =>
      createStudyNoteRowDraft({
        action: {
          kind: "recall-selection",
          label: "Open Recall Selection",
          studyNoteIds: [studyNote.id],
        },
        bucketId: "first-recall",
        evidence: "No recall attempts yet.",
        id: `first-recall:${studyNote.id}`,
        labelsById: input.labelsById,
        studyNote,
      }),
    );
}

function getSharedLabelNames(input: {
  labelsById: ReadonlyMap<string, AppLabel>;
  studyNotes: readonly AppStudyNote[];
}) {
  const [firstStudyNote, ...rest] = input.studyNotes;

  if (firstStudyNote === undefined) {
    return [];
  }

  return firstStudyNote.labelIds
    .filter((labelId) =>
      rest.every((studyNote) => studyNote.labelIds.includes(labelId)),
    )
    .map((labelId) => input.labelsById.get(labelId)?.name)
    .filter((labelName): labelName is string => labelName !== undefined);
}

function getInterleavingRowTitle(input: {
  labelsById: ReadonlyMap<string, AppLabel>;
  studyNotes: readonly AppStudyNote[];
}) {
  const sharedLabelNames = getSharedLabelNames(input);

  if (sharedLabelNames.length > 0) {
    return sharedLabelNames[0];
  }

  const [firstStudyNote, ...rest] = input.studyNotes;

  if (firstStudyNote === undefined) {
    return "Interleaving Recall";
  }

  if (
    rest.every(
      (studyNote) => studyNote.sourceNoteId === firstStudyNote.sourceNoteId,
    )
  ) {
    return getStudyNoteSourceTitle(firstStudyNote);
  }

  return getStudyNoteTitle(firstStudyNote);
}

function createInterleavingMetadata(input: {
  labelsById: ReadonlyMap<string, AppLabel>;
  studyNotes: readonly AppStudyNote[];
}) {
  const labelNames = new Set<string>();

  for (const studyNote of input.studyNotes) {
    for (const labelName of getStudyNoteLabelNames({
      labelsById: input.labelsById,
      studyNote,
    })) {
      labelNames.add(labelName);
    }
  }

  const labelsMetadata =
    labelNames.size === 0
      ? "Label: None"
      : `Label${labelNames.size === 1 ? "" : "s"}: ${[...labelNames].join(", ")}`;

  return [`${input.studyNotes.length} related Study Notes`, labelsMetadata];
}

function compareInterleavingRows(
  left: Pick<StudyGuidanceRow, "title" | "id">,
  right: Pick<StudyGuidanceRow, "title" | "id">,
) {
  return (
    left.title.localeCompare(right.title) || left.id.localeCompare(right.id)
  );
}

function createInterleavingRows(input: {
  blockedStudyNoteIds: ReadonlySet<string>;
  histories: readonly StudyNoteRecallHistory[];
  labelsById: ReadonlyMap<string, AppLabel>;
  studyNotes: readonly AppStudyNote[];
}): StudyGuidanceRowDraft[] {
  const groups = new Map<string, StudyGuidanceRowDraft>();
  const visibleStudyNotes = input.studyNotes.filter(
    (studyNote) =>
      !input.blockedStudyNoteIds.has(studyNote.id) &&
      getStudyNoteReadiness(studyNote).recallable,
  );
  const visibleStudyNotesById = new Map(
    visibleStudyNotes.map((studyNote) => [studyNote.id, studyNote] as const),
  );

  for (const studyNote of visibleStudyNotes) {
    const recommendation = getInterleavedRecallRecommendation({
      histories: input.histories,
      studyNote,
      studyNotes: visibleStudyNotes,
    });

    if (recommendation === null) {
      continue;
    }

    if (
      recommendation.studyNoteIds.some((studyNoteId) =>
        input.blockedStudyNoteIds.has(studyNoteId),
      )
    ) {
      continue;
    }

    const groupStudyNotes = recommendation.studyNoteIds
      .map((studyNoteId) => visibleStudyNotesById.get(studyNoteId))
      .filter(
        (candidate): candidate is AppStudyNote => candidate !== undefined,
      );

    if (groupStudyNotes.length === 0) {
      continue;
    }

    const stableStudyNoteIds = visibleStudyNotes
      .filter((candidate) => recommendation.studyNoteIds.includes(candidate.id))
      .map((candidate) => candidate.id);
    const groupKey = [...stableStudyNoteIds].sort().join("|");

    if (groups.has(groupKey)) {
      continue;
    }

    groups.set(groupKey, {
      action: {
        kind: "recall-selection",
        label: "Open Recall Selection",
        studyNoteIds: stableStudyNoteIds,
      },
      bucketId: "interleaving-ready",
      bucketLabel: getBucketDefinition("interleaving-ready").label,
      evidence: recommendation.summary,
      id: `interleaving:${groupKey}`,
      metadata: createInterleavingMetadata({
        labelsById: input.labelsById,
        studyNotes: groupStudyNotes,
      }),
      studyNoteIds: stableStudyNoteIds,
      title: getInterleavingRowTitle({
        labelsById: input.labelsById,
        studyNotes: groupStudyNotes,
      }),
    });
  }

  return [...groups.values()].sort(compareInterleavingRows);
}

function addStudyNoteIdsToBlockedSet(
  blockedStudyNoteIds: Set<string>,
  rows: readonly StudyGuidanceRowDraft[],
) {
  for (const row of rows) {
    for (const studyNoteId of row.studyNoteIds) {
      blockedStudyNoteIds.add(studyNoteId);
    }
  }
}

function toPublicRows(
  rows: readonly StudyGuidanceRowDraft[],
): StudyGuidanceRow[] {
  return rows.map(({ studyNoteIds: _studyNoteIds, ...row }) => row);
}

export function deriveStudyGuidance(input: StudyGuidanceInput): StudyGuidance {
  const emptyState = input.studyNotes.length === 0 ? createEmptyState() : null;

  if (emptyState !== null) {
    return {
      emptyState,
      rows: [],
      summaryCards: createSummaryCards([]),
    };
  }

  const histories = toStudyNoteRecallHistories(input.attemptsByNote);
  const historiesByStudyNoteId = new Map(
    histories.map((history) => [history.studyNoteId, history] as const),
  );
  const labelsById = new Map(
    input.labels.map((label) => [label.id, label] as const),
  );
  const studyNotesById = new Map(
    input.studyNotes.map((studyNote) => [studyNote.id, studyNote] as const),
  );
  const blockedStudyNoteIds = new Set<string>();

  const practiceRepairRows = createPracticeRepairRows({
    labelsById,
    queueItems: listPracticeRepairQueueItems({
      results: input.sessionResults,
    }),
    studyNotesById,
  });
  addStudyNoteIdsToBlockedSet(blockedStudyNoteIds, practiceRepairRows);

  const practiceFollowUpRows = createPracticeFollowUpRows({
    blockedStudyNoteIds,
    labelsById,
    sessionResults: input.sessionResults,
    studyNotesById,
  });
  addStudyNoteIdsToBlockedSet(blockedStudyNoteIds, practiceFollowUpRows);

  const scheduledStudyNoteCount = buildDueTodayQueue({
    histories,
    now: input.now,
    recallSchedules: input.recallSchedules,
    sessionResults: input.sessionResults,
    studyNotes: input.studyNotes,
    userTimeZone: input.userTimeZone,
  }).length;

  const dueTodayRows = createDueTodayRows({
    blockedStudyNoteIds,
    histories,
    labelsById,
    now: input.now,
    recallSchedules: input.recallSchedules,
    sessionResults: input.sessionResults,
    studyNotes: input.studyNotes,
    userTimeZone: input.userTimeZone,
  });
  addStudyNoteIdsToBlockedSet(blockedStudyNoteIds, dueTodayRows);

  const completionBlockerRows = createCompletionBlockerRows({
    blockedStudyNoteIds,
    labelsById,
    studyNotes: input.studyNotes,
  });
  addStudyNoteIdsToBlockedSet(blockedStudyNoteIds, completionBlockerRows);

  const firstRecallRows = createFirstRecallRows({
    blockedStudyNoteIds,
    historiesByStudyNoteId,
    labelsById,
    studyNotes: input.studyNotes,
  });
  addStudyNoteIdsToBlockedSet(blockedStudyNoteIds, firstRecallRows);

  const interleavingRows = createInterleavingRows({
    blockedStudyNoteIds,
    histories,
    labelsById,
    studyNotes: input.studyNotes,
  });

  const rows = toPublicRows([
    ...practiceRepairRows,
    ...practiceFollowUpRows,
    ...dueTodayRows,
    ...completionBlockerRows,
    ...firstRecallRows,
    ...interleavingRows,
  ]);

  return {
    emptyState: null,
    rows,
    summaryCards: createSummaryCards(rows, {
      "due-today": scheduledStudyNoteCount,
    }),
  };
}
