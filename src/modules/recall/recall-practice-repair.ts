export const practiceRepairIntents = [
  "tighten-expected-answer",
  "split-study-note",
  "create-sibling-study-note",
  "add-memory-aid",
] as const;

export type PracticeRepairIntent = (typeof practiceRepairIntents)[number];
export const practiceRepairMemoryAidKinds = ["Metaphor", "Acronym"] as const;
export type PracticeRepairMemoryAidKind =
  (typeof practiceRepairMemoryAidKinds)[number];

export type PracticeRepairQuestionReference = {
  questionIndex: number;
  questionResultId?: string;
  sessionResultId: string;
  studyNoteId: string;
};

export type PracticeFollowUpSatisfaction = {
  questionReference: PracticeRepairQuestionReference;
  rating: "easy" | "forgot" | "good" | "hard";
  satisfiedAt: string;
};

export type TightenExpectedAnswerPracticeRepairMetadata = {
  updatedExpectedAnswer: string | null;
};

export type SplitStudyNotePracticeRepairMetadata = {
  createdStudyNoteIds: string[];
  narrowedOriginalStudyNoteAt: string | null;
};

export type CreateSiblingStudyNotePracticeRepairMetadata = {
  createdStudyNoteId: string | null;
};

export type AddMemoryAidPracticeRepairMetadata = {
  memoryAidId: string | null;
  memoryAidKind: PracticeRepairMemoryAidKind | null;
};

export type PracticeRepairIntentMetadataByIntent = {
  "add-memory-aid": AddMemoryAidPracticeRepairMetadata;
  "create-sibling-study-note": CreateSiblingStudyNotePracticeRepairMetadata;
  "split-study-note": SplitStudyNotePracticeRepairMetadata;
  "tighten-expected-answer": TightenExpectedAnswerPracticeRepairMetadata;
};

export type PracticeRepairLinkedCompletionIntent =
  | "tighten-expected-answer"
  | "split-study-note"
  | "create-sibling-study-note"
  | "add-memory-aid";

export type PracticeRepairLinkedCompletionInput = {
  [Intent in PracticeRepairLinkedCompletionIntent]: {
    intent: Intent;
    intentMetadata: PracticeRepairIntentMetadataByIntent[Intent];
    reference: PracticeRepairQuestionReference;
  };
}[PracticeRepairLinkedCompletionIntent];

export type PracticeRepairIntentMetadata =
  PracticeRepairIntentMetadataByIntent[PracticeRepairIntent];

export type PracticeRepairEntryLifecycle = {
  completedAt?: string | null;
  dismissedAt?: string | null;
  followUpSatisfiedAt?: string | null;
  studyNoteDeletedAt?: string | null;
  supersededAt?: string | null;
};

export type PracticeRepairEntryLifecycleState = "active" | "historical";
export type PracticeFollowUpState =
  | "actionable"
  | "dismissed"
  | "pending"
  | "satisfied"
  | "study-note-deleted"
  | "superseded";
export type PracticeRepairEntryLifecycleKind =
  | "active"
  | "completed"
  | "dismissed"
  | "follow-up-satisfied"
  | "study-note-deleted"
  | "superseded";

type PracticeRepairEntryLifecycleOutcome = {
  followUpState: PracticeFollowUpState;
  kind: PracticeRepairEntryLifecycleKind;
  label: string;
  state: PracticeRepairEntryLifecycleState;
  summary: string;
};

type TerminalPracticeRepairEntryLifecycleOutcome =
  PracticeRepairEntryLifecycleOutcome & {
    factKey: keyof PracticeRepairEntryLifecycle;
    state: "historical";
  };

export type PracticeRepairEntry = {
  confirmedAt: string;
  correction: string;
  followUpSatisfaction?: PracticeFollowUpSatisfaction;
  intent: PracticeRepairIntent;
  intentMetadata: PracticeRepairIntentMetadata;
  lifecycle?: PracticeRepairEntryLifecycle;
  nextPracticeIdea?: string;
  practiceRepairEntryId?: string;
  reference: PracticeRepairQuestionReference;
};

export type PracticeRepairEntryForIntent<Intent extends PracticeRepairIntent> =
  Omit<PracticeRepairEntry, "intent" | "intentMetadata"> & {
    intent: Intent;
    intentMetadata: PracticeRepairIntentMetadataByIntent[Intent];
  };

export type PracticeRepairEntryConfirmation = {
  correction: string;
  intent: PracticeRepairIntent;
  nextPracticeIdea?: string;
  reference: PracticeRepairQuestionReference;
};

type PracticeRepairQuestionLike = {
  noteId?: string;
  noteSnapshot: {
    expectedAnswer?: string;
    sourceNoteId?: string;
  };
  practiceRepairEntry?: PracticeRepairEntry;
  selfRating: "easy" | "forgot" | "good" | "hard" | null;
};

export type PracticeRepairDraft = {
  summary: string;
  suggestions: readonly string[];
};

type PracticeRepairResultQuestionLike = {
  practiceRepairEntry?: PracticeRepairEntry;
};

type PracticeRepairResultLike = {
  questions: readonly PracticeRepairResultQuestionLike[];
};

export type PracticeRepairDisplayQuestionLike = {
  noteId?: string;
  noteSnapshot: {
    body: string;
    expectedAnswer?: string;
    prompt?: string;
    source?: {
      body: string;
      title: string;
    };
    sourceNoteId?: string;
    title: string;
  };
  questionResultId?: string;
  typedAnswer?: string;
};

export type PracticeRepairQueueQuestionLike =
  PracticeRepairDisplayQuestionLike & {
    practiceRepairEntry?: PracticeRepairEntry;
    selfRating: "easy" | "forgot" | "good" | "hard" | null;
  };

export type PracticeRepairActiveQueueResultLike = {
  questions: readonly PracticeRepairQueueQuestionLike[];
};

export type PracticeRepairQueueResultLike =
  PracticeRepairActiveQueueResultLike & {
    completedAt: string;
    id: string;
  };

export type PracticeRepairQueueItem<
  Result extends
    PracticeRepairActiveQueueResultLike = PracticeRepairActiveQueueResultLike,
> = {
  entry: PracticeRepairEntry;
  question: Result["questions"][number];
  result: Result;
};

type PracticeRepairQueueCandidateQuestion<
  Result extends PracticeRepairQueueResultLike,
> = Result["questions"][number] & {
  noteId: string;
  questionResultId: string;
};

export type PracticeRepairQueueCandidateItem<
  Result extends PracticeRepairQueueResultLike = PracticeRepairQueueResultLike,
> = {
  draft: PracticeRepairDraft;
  kind: "candidate";
  question: PracticeRepairQueueCandidateQuestion<Result>;
  recentWeakAttemptsSummary: string | null;
  result: Result;
};

export type PracticeRepairQueueListItem<
  Result extends PracticeRepairQueueResultLike = PracticeRepairQueueResultLike,
> =
  | ({
      kind: "active";
    } & PracticeRepairQueueItem<Result>)
  | PracticeRepairQueueCandidateItem<Result>;

type PracticeRepairEntryPredicate = (entry: PracticeRepairEntry) => boolean;
type PracticeRepairQueueCandidateProjectionItem<
  Result extends PracticeRepairQueueResultLike,
> = Omit<PracticeRepairQueueCandidateItem<Result>, "recentWeakAttemptsSummary">;
type PracticeRepairQueueCandidateProjectionState<
  Result extends PracticeRepairQueueResultLike,
> =
  | {
      kind: "collecting-recent-weak-attempts";
      item: PracticeRepairQueueCandidateProjectionItem<Result>;
      recentWeakAttemptCount: number;
    }
  | {
      kind: "ready";
      item: PracticeRepairQueueCandidateProjectionItem<Result>;
      recentWeakAttemptCount: number;
    }
  | {
      kind: "suppressed";
    };

const practiceRepairSuggestions = [
  "Tighten the expected answer so the next recall target is specific.",
  "Split a broad Study Note or create a sibling from the same source explanation.",
  "Add a Metaphor or Acronym only if it solves this recall problem.",
] as const;
const practiceRepairEntryIdPrefix = "practice-repair-entry";

const activePracticeRepairLifecycleOutcome: PracticeRepairEntryLifecycleOutcome =
  {
    followUpState: "pending",
    kind: "active",
    label: "Active",
    state: "active",
    summary:
      "This is the active Practice Repair workspace for the original Needs practice evidence.",
  };

const terminalPracticeRepairLifecycleOutcomes = [
  {
    factKey: "studyNoteDeletedAt",
    followUpState: "study-note-deleted",
    kind: "study-note-deleted",
    label: "Study Note deleted",
    state: "historical",
    summary:
      "This Practice Repair is historical because its Study Note is no longer available.",
  },
  {
    factKey: "supersededAt",
    followUpState: "superseded",
    kind: "superseded",
    label: "Superseded",
    state: "historical",
    summary:
      "A newer Practice Repair replaced this entry for the same Study Note.",
  },
  {
    factKey: "dismissedAt",
    followUpState: "dismissed",
    kind: "dismissed",
    label: "Dismissed",
    state: "historical",
    summary:
      "This repair was dismissed and remains here as historical evidence.",
  },
  {
    factKey: "followUpSatisfiedAt",
    followUpState: "satisfied",
    kind: "follow-up-satisfied",
    label: "Follow-up satisfied",
    state: "historical",
    summary:
      "A later recall attempt satisfied the follow-up and closed this repair loop.",
  },
  {
    factKey: "completedAt",
    followUpState: "actionable",
    kind: "completed",
    label: "Completed",
    state: "historical",
    summary:
      "The repair is complete. Recall again soon is the next step from here.",
  },
] as const satisfies readonly TerminalPracticeRepairEntryLifecycleOutcome[];

const terminalPracticeRepairLifecycleFactKeys: readonly (keyof PracticeRepairEntryLifecycle)[] =
  terminalPracticeRepairLifecycleOutcomes.map((outcome) => outcome.factKey);

const practiceFollowUpSatisfactionRatings = [
  "easy",
  "forgot",
  "good",
  "hard",
] as const satisfies readonly PracticeFollowUpSatisfaction["rating"][];

export function isPracticeRepairIntent(
  value: unknown,
): value is PracticeRepairIntent {
  return (
    typeof value === "string" &&
    practiceRepairIntents.includes(value as PracticeRepairIntent)
  );
}

export function isPracticeRepairEntryForIntent<
  Intent extends PracticeRepairIntent,
>(
  entry: PracticeRepairEntry,
  intent: Intent,
): entry is PracticeRepairEntryForIntent<Intent> {
  return entry.intent === intent;
}

function isPracticeRepairMemoryAidKind(
  value: unknown,
): value is PracticeRepairMemoryAidKind {
  return (
    typeof value === "string" &&
    practiceRepairMemoryAidKinds.includes(value as PracticeRepairMemoryAidKind)
  );
}

function asPracticeRepairMetadataRecord(
  value: unknown,
): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function hasOptionalStringProperty(
  candidate: Record<string, unknown>,
  key: string,
): boolean {
  return candidate[key] === undefined || typeof candidate[key] === "string";
}

export function createPracticeRepairEntryId(
  reference: PracticeRepairQuestionReference,
): string {
  const { questionIndex, questionResultId, sessionResultId, studyNoteId } =
    reference;

  if (questionResultId !== undefined) {
    return `${practiceRepairEntryIdPrefix}-${questionResultId}`;
  }

  return `${practiceRepairEntryIdPrefix}-${sessionResultId}-question-${questionIndex}-${studyNoteId}`;
}

export function getPracticeRepairEntryId(
  entry: Pick<PracticeRepairEntry, "practiceRepairEntryId" | "reference">,
): string {
  return (
    entry.practiceRepairEntryId ?? createPracticeRepairEntryId(entry.reference)
  );
}

function isPracticeRepairQuestionReference(
  value: unknown,
): value is PracticeRepairQuestionReference {
  const candidate = asPracticeRepairMetadataRecord(value);

  return (
    candidate !== null &&
    typeof candidate.questionIndex === "number" &&
    typeof candidate.sessionResultId === "string" &&
    typeof candidate.studyNoteId === "string" &&
    hasOptionalStringProperty(candidate, "questionResultId")
  );
}

function isPracticeFollowUpSatisfactionRating(
  value: unknown,
): value is PracticeFollowUpSatisfaction["rating"] {
  return (
    typeof value === "string" &&
    practiceFollowUpSatisfactionRatings.includes(
      value as PracticeFollowUpSatisfaction["rating"],
    )
  );
}

function isPracticeFollowUpSatisfaction(
  value: unknown,
): value is PracticeFollowUpSatisfaction {
  const candidate = asPracticeRepairMetadataRecord(value);

  return (
    candidate !== null &&
    isPracticeRepairQuestionReference(candidate.questionReference) &&
    isPracticeFollowUpSatisfactionRating(candidate.rating) &&
    typeof candidate.satisfiedAt === "string"
  );
}

function isPracticeRepairEntryLifecycle(
  value: unknown,
): value is PracticeRepairEntryLifecycle {
  const candidate = asPracticeRepairMetadataRecord(value);

  if (candidate === null) {
    return false;
  }

  return terminalPracticeRepairLifecycleFactKeys.every((key) => {
    return candidate[key] === undefined || isNullableString(candidate[key]);
  });
}

export function createPracticeRepairIntentMetadata(
  intent: PracticeRepairIntent,
): PracticeRepairIntentMetadata {
  switch (intent) {
    case "tighten-expected-answer":
      return {
        updatedExpectedAnswer: null,
      };
    case "split-study-note":
      return {
        createdStudyNoteIds: [],
        narrowedOriginalStudyNoteAt: null,
      };
    case "create-sibling-study-note":
      return {
        createdStudyNoteId: null,
      };
    case "add-memory-aid":
      return {
        memoryAidId: null,
        memoryAidKind: null,
      };
  }
}

function clonePracticeRepairEntryLifecycle(
  lifecycle: PracticeRepairEntryLifecycle | undefined,
): PracticeRepairEntryLifecycle | undefined {
  if (lifecycle === undefined) {
    return undefined;
  }

  return {
    completedAt: lifecycle.completedAt,
    dismissedAt: lifecycle.dismissedAt,
    followUpSatisfiedAt: lifecycle.followUpSatisfiedAt,
    studyNoteDeletedAt: lifecycle.studyNoteDeletedAt,
    supersededAt: lifecycle.supersededAt,
  };
}

function clonePracticeFollowUpSatisfaction(
  satisfaction: PracticeFollowUpSatisfaction | undefined,
): PracticeFollowUpSatisfaction | undefined {
  if (satisfaction === undefined) {
    return undefined;
  }

  return {
    questionReference: {
      ...satisfaction.questionReference,
    },
    rating: satisfaction.rating,
    satisfiedAt: satisfaction.satisfiedAt,
  };
}

function clonePracticeRepairIntentMetadata(
  intent: PracticeRepairIntent,
  metadata: PracticeRepairIntentMetadata,
): PracticeRepairIntentMetadata {
  switch (intent) {
    case "tighten-expected-answer":
      return {
        updatedExpectedAnswer: (
          metadata as TightenExpectedAnswerPracticeRepairMetadata
        ).updatedExpectedAnswer,
      };
    case "split-study-note":
      return {
        createdStudyNoteIds: [
          ...(metadata as SplitStudyNotePracticeRepairMetadata)
            .createdStudyNoteIds,
        ],
        narrowedOriginalStudyNoteAt: (
          metadata as SplitStudyNotePracticeRepairMetadata
        ).narrowedOriginalStudyNoteAt,
      };
    case "create-sibling-study-note":
      return {
        createdStudyNoteId: (
          metadata as CreateSiblingStudyNotePracticeRepairMetadata
        ).createdStudyNoteId,
      };
    case "add-memory-aid":
      return {
        memoryAidId: (metadata as AddMemoryAidPracticeRepairMetadata)
          .memoryAidId,
        memoryAidKind: (metadata as AddMemoryAidPracticeRepairMetadata)
          .memoryAidKind,
      };
  }
}

export function clonePracticeRepairEntry(
  entry: PracticeRepairEntry,
): PracticeRepairEntry {
  return {
    ...entry,
    followUpSatisfaction: clonePracticeFollowUpSatisfaction(
      entry.followUpSatisfaction,
    ),
    intentMetadata: clonePracticeRepairIntentMetadata(
      entry.intent,
      entry.intentMetadata,
    ),
    lifecycle: clonePracticeRepairEntryLifecycle(entry.lifecycle),
    practiceRepairEntryId: getPracticeRepairEntryId(entry),
    reference: {
      ...entry.reference,
    },
  };
}

export function satisfyPracticeRepairEntryFollowUp(input: {
  entry: PracticeRepairEntry;
  satisfaction: PracticeFollowUpSatisfaction;
}): PracticeRepairEntry {
  const entry = clonePracticeRepairEntry(input.entry);

  return {
    ...entry,
    followUpSatisfaction: clonePracticeFollowUpSatisfaction(input.satisfaction),
    lifecycle: {
      ...entry.lifecycle,
      followUpSatisfiedAt: input.satisfaction.satisfiedAt,
    },
  };
}

function isPracticeRepairIntentMetadata(
  intent: PracticeRepairIntent,
  value: unknown,
): value is PracticeRepairIntentMetadata {
  const candidate = asPracticeRepairMetadataRecord(value);

  if (candidate === null) {
    return false;
  }

  switch (intent) {
    case "tighten-expected-answer":
      return isNullableString(candidate.updatedExpectedAnswer);
    case "split-study-note":
      return (
        Array.isArray(candidate.createdStudyNoteIds) &&
        candidate.createdStudyNoteIds.every(
          (value) => typeof value === "string",
        ) &&
        isNullableString(candidate.narrowedOriginalStudyNoteAt)
      );
    case "create-sibling-study-note":
      return isNullableString(candidate.createdStudyNoteId);
    case "add-memory-aid":
      return (
        isNullableString(candidate.memoryAidId) &&
        (candidate.memoryAidKind === null ||
          isPracticeRepairMemoryAidKind(candidate.memoryAidKind))
      );
  }
}

export function isPracticeRepairEntry(
  value: unknown,
): value is PracticeRepairEntry {
  const candidate = asPracticeRepairMetadataRecord(value);

  return (
    candidate !== null &&
    typeof candidate.confirmedAt === "string" &&
    typeof candidate.correction === "string" &&
    (candidate.followUpSatisfaction === undefined ||
      isPracticeFollowUpSatisfaction(candidate.followUpSatisfaction)) &&
    isPracticeRepairIntent(candidate.intent) &&
    isPracticeRepairIntentMetadata(
      candidate.intent,
      candidate.intentMetadata,
    ) &&
    (candidate.lifecycle === undefined ||
      isPracticeRepairEntryLifecycle(candidate.lifecycle)) &&
    hasOptionalStringProperty(candidate, "nextPracticeIdea") &&
    hasOptionalStringProperty(candidate, "practiceRepairEntryId") &&
    isPracticeRepairQuestionReference(candidate.reference)
  );
}

function isWeakPracticeRepairRating(
  rating: PracticeRepairQuestionLike["selfRating"],
): rating is "forgot" | "hard" {
  return rating === "forgot" || rating === "hard";
}

export function isPracticeRepairEligibleQuestion(
  question: PracticeRepairQuestionLike,
): boolean {
  return (
    isWeakPracticeRepairRating(question.selfRating) &&
    question.noteSnapshot.sourceNoteId !== undefined &&
    question.noteSnapshot.expectedAnswer?.trim().length !== 0
  );
}

export function getQuestionPracticeRepairDraft(
  question: PracticeRepairQuestionLike,
): PracticeRepairDraft | null {
  if (
    !isPracticeRepairEligibleQuestion(question) ||
    question.practiceRepairEntry !== undefined
  ) {
    return null;
  }

  return {
    summary:
      question.selfRating === "forgot"
        ? "Forgot this Study Note. Confirm one concrete repair before the next attempt."
        : "Hard recall suggests this Study Note needs one concrete repair before the next attempt.",
    suggestions: practiceRepairSuggestions,
  };
}

function isTerminalPracticeRepairLifecycleFact(
  fact: string | null | undefined,
): fact is string {
  return typeof fact === "string" && fact.length > 0;
}

function getLifecycleFact(
  lifecycle: PracticeRepairEntryLifecycle | undefined,
  key: keyof PracticeRepairEntryLifecycle,
): string | null {
  const value: string | null | undefined = lifecycle?.[key];

  return isTerminalPracticeRepairLifecycleFact(value) ? value : null;
}

function getPracticeRepairEntryLifecycleOutcome(
  entry: Pick<PracticeRepairEntry, "lifecycle">,
): PracticeRepairEntryLifecycleOutcome {
  for (const outcome of terminalPracticeRepairLifecycleOutcomes) {
    if (getLifecycleFact(entry.lifecycle, outcome.factKey) !== null) {
      return outcome;
    }
  }

  return activePracticeRepairLifecycleOutcome;
}

export function getPracticeRepairEntryLifecycleKind(
  entry: Pick<PracticeRepairEntry, "lifecycle">,
): PracticeRepairEntryLifecycleKind {
  return getPracticeRepairEntryLifecycleOutcome(entry).kind;
}

export function getPracticeRepairEntryLifecycleState(
  entry: Pick<PracticeRepairEntry, "lifecycle">,
): PracticeRepairEntryLifecycleState {
  return getPracticeRepairEntryLifecycleOutcome(entry).state;
}

export function getPracticeRepairEntryLifecycleLabel(
  entry: Pick<PracticeRepairEntry, "lifecycle">,
): string {
  return getPracticeRepairEntryLifecycleOutcome(entry).label;
}

export function getPracticeRepairEntryLifecycleSummary(
  entry: Pick<PracticeRepairEntry, "lifecycle">,
): string {
  return getPracticeRepairEntryLifecycleOutcome(entry).summary;
}

function getPracticeFollowUpState(
  entry: Pick<PracticeRepairEntry, "lifecycle">,
): PracticeFollowUpState {
  return getPracticeRepairEntryLifecycleOutcome(entry).followUpState;
}

export function isActionablePracticeFollowUp(
  entry: Pick<PracticeRepairEntry, "lifecycle">,
): boolean {
  return getPracticeFollowUpState(entry) === "actionable";
}

function getActionablePracticeFollowUpCompletedAt(
  entry: Pick<PracticeRepairEntry, "lifecycle">,
): string {
  const completedAt = getLifecycleFact(entry.lifecycle, "completedAt");

  if (completedAt === null) {
    throw new Error(
      "Expected actionable Practice Follow-up to have a completion timestamp.",
    );
  }

  return completedAt;
}

function comparePracticeRepairEntries(
  left: PracticeRepairEntry,
  right: PracticeRepairEntry,
): number {
  return (
    right.confirmedAt.localeCompare(left.confirmedAt) ||
    right.reference.sessionResultId.localeCompare(
      left.reference.sessionResultId,
    ) ||
    right.reference.questionIndex - left.reference.questionIndex
  );
}

function isMatchingPracticeRepairQuestionReference(input: {
  candidate: PracticeRepairQuestionReference;
  reference: PracticeRepairQuestionReference;
}): boolean {
  const { candidate, reference } = input;

  if (
    candidate.sessionResultId !== reference.sessionResultId ||
    candidate.studyNoteId !== reference.studyNoteId
  ) {
    return false;
  }

  const matchesQuestionResultId =
    candidate.questionResultId !== undefined &&
    reference.questionResultId !== undefined &&
    candidate.questionResultId === reference.questionResultId;

  return (
    matchesQuestionResultId ||
    candidate.questionIndex === reference.questionIndex
  );
}

function listPracticeRepairEntries(input: {
  matchesEntry: PracticeRepairEntryPredicate;
  results: readonly PracticeRepairResultLike[];
}): PracticeRepairEntry[] {
  const entries: PracticeRepairEntry[] = [];

  for (const result of input.results) {
    for (const question of result.questions) {
      const entry = question.practiceRepairEntry;

      if (entry !== undefined && input.matchesEntry(entry)) {
        entries.push(clonePracticeRepairEntry(entry));
      }
    }
  }

  return entries.sort(comparePracticeRepairEntries);
}

function compareActionablePracticeFollowUps(
  left: PracticeRepairEntry,
  right: PracticeRepairEntry,
): number {
  return (
    getActionablePracticeFollowUpCompletedAt(right).localeCompare(
      getActionablePracticeFollowUpCompletedAt(left),
    ) || comparePracticeRepairEntries(left, right)
  );
}

function comparePracticeRepairQueueItems(
  left: PracticeRepairQueueItem,
  right: PracticeRepairQueueItem,
): number {
  return comparePracticeRepairEntries(left.entry, right.entry);
}

function comparePracticeRepairQueueCandidateItems(
  left: PracticeRepairQueueCandidateItem,
  right: PracticeRepairQueueCandidateItem,
): number {
  return (
    right.result.completedAt.localeCompare(left.result.completedAt) ||
    right.result.id.localeCompare(left.result.id) ||
    right.question.questionResultId.localeCompare(
      left.question.questionResultId,
    ) ||
    right.question.noteId.localeCompare(left.question.noteId)
  );
}

function comparePracticeRepairQueueResults(
  left: PracticeRepairQueueResultLike,
  right: PracticeRepairQueueResultLike,
): number {
  return (
    right.completedAt.localeCompare(left.completedAt) ||
    right.id.localeCompare(left.id)
  );
}

function formatPracticeRepairQueueRecentWeakAttemptsSummary(
  recentWeakAttemptCount: number,
): string | null {
  const earlierRecentWeakAttemptCount = recentWeakAttemptCount - 1;

  if (earlierRecentWeakAttemptCount <= 0) {
    return null;
  }

  return earlierRecentWeakAttemptCount === 1
    ? "Also showed Needs practice in 1 earlier recent Recall result."
    : `Also showed Needs practice in ${earlierRecentWeakAttemptCount} earlier recent Recall results.`;
}

function stopPracticeRepairQueueCandidateProjectionScan<
  Result extends PracticeRepairQueueResultLike,
>(
  projectionStates: Map<
    string,
    PracticeRepairQueueCandidateProjectionState<Result>
  >,
  studyNoteId: string,
) {
  const existingState = projectionStates.get(studyNoteId);

  if (existingState === undefined) {
    projectionStates.set(studyNoteId, {
      kind: "suppressed",
    });
    return;
  }

  if (existingState.kind === "collecting-recent-weak-attempts") {
    projectionStates.set(studyNoteId, {
      ...existingState,
      kind: "ready",
    });
  }
}

function hasPracticeRepairQueueStudyNoteId<
  Question extends PracticeRepairQueueQuestionLike,
>(
  question: Question,
): question is Question & {
  noteId: string;
} {
  return question.noteId !== undefined;
}

function hasPracticeRepairQueueCandidateIdentity<
  Question extends PracticeRepairQueueQuestionLike,
>(
  question: Question,
): question is Question & {
  noteId: string;
  questionResultId: string;
} {
  return (
    question.noteId !== undefined && question.questionResultId !== undefined
  );
}

export function getPracticeRepairQuestionPrompt(
  question: PracticeRepairDisplayQuestionLike,
): string {
  const prompt =
    question.noteSnapshot.prompt?.trim() ?? question.noteSnapshot.title;

  return prompt.length > 0 ? prompt : question.noteSnapshot.body;
}

export function getPracticeRepairQuestionExpectedAnswer(
  question: PracticeRepairDisplayQuestionLike,
): string {
  return question.noteSnapshot.expectedAnswer ?? question.noteSnapshot.body;
}

export function getPracticeRepairQuestionReferenceText(
  question: PracticeRepairDisplayQuestionLike,
): string {
  return question.noteSnapshot.source?.body ?? question.noteSnapshot.body;
}

export function getPracticeRepairQuestionReferenceTitle(
  question: PracticeRepairDisplayQuestionLike,
): string {
  const sourceTitle = question.noteSnapshot.source?.title?.trim();

  if (sourceTitle !== undefined && sourceTitle.length > 0) {
    return sourceTitle;
  }

  return question.noteSnapshot.title;
}

export function getPracticeRepairRecordedAnswer(
  question: PracticeRepairDisplayQuestionLike,
): string {
  const typedAnswer = question.typedAnswer?.trim() ?? "";

  return typedAnswer.length > 0 ? typedAnswer : "No answer recorded.";
}

export function listActivePracticeRepairQueueItems<
  Result extends PracticeRepairActiveQueueResultLike,
>(input: { results: readonly Result[] }): PracticeRepairQueueItem<Result>[] {
  const queueItems: PracticeRepairQueueItem<Result>[] = [];

  for (const result of input.results) {
    for (const question of result.questions) {
      const entry = question.practiceRepairEntry;

      if (
        entry === undefined ||
        getPracticeRepairEntryLifecycleState(entry) !== "active"
      ) {
        continue;
      }

      queueItems.push({
        entry: clonePracticeRepairEntry(entry),
        question,
        result,
      });
    }
  }

  return queueItems.sort(comparePracticeRepairQueueItems);
}

export function listPracticeRepairQueueItems<
  Result extends PracticeRepairQueueResultLike,
>(input: {
  results: readonly Result[];
}): PracticeRepairQueueListItem<Result>[] {
  const activeItems = listActivePracticeRepairQueueItems(input);
  const activeStudyNoteIds = new Set(
    activeItems.map((item) => item.entry.reference.studyNoteId),
  );
  const candidateProjectionStatesByStudyNoteId = new Map<
    string,
    PracticeRepairQueueCandidateProjectionState<Result>
  >();
  const sortedResults = [...input.results].sort(
    comparePracticeRepairQueueResults,
  );

  for (const result of sortedResults) {
    for (const question of result.questions) {
      if (!hasPracticeRepairQueueStudyNoteId(question)) {
        continue;
      }

      const studyNoteId = question.noteId;
      const existingState =
        candidateProjectionStatesByStudyNoteId.get(studyNoteId);

      if (activeStudyNoteIds.has(studyNoteId)) {
        stopPracticeRepairQueueCandidateProjectionScan(
          candidateProjectionStatesByStudyNoteId,
          studyNoteId,
        );
        continue;
      }

      if (
        existingState !== undefined &&
        existingState.kind !== "collecting-recent-weak-attempts"
      ) {
        continue;
      }

      const draft = getQuestionPracticeRepairDraft(question);

      if (
        draft === null ||
        !hasPracticeRepairQueueCandidateIdentity(question)
      ) {
        stopPracticeRepairQueueCandidateProjectionScan(
          candidateProjectionStatesByStudyNoteId,
          studyNoteId,
        );
        continue;
      }

      if (existingState?.kind === "collecting-recent-weak-attempts") {
        candidateProjectionStatesByStudyNoteId.set(studyNoteId, {
          ...existingState,
          recentWeakAttemptCount: existingState.recentWeakAttemptCount + 1,
        });
        continue;
      }

      candidateProjectionStatesByStudyNoteId.set(studyNoteId, {
        kind: "collecting-recent-weak-attempts",
        item: {
          draft,
          kind: "candidate",
          question,
          result,
        },
        recentWeakAttemptCount: 1,
      });
    }
  }

  const candidateItems = [...candidateProjectionStatesByStudyNoteId.values()]
    .flatMap((state) => {
      if (state.kind === "suppressed") {
        return [];
      }

      return [
        {
          ...state.item,
          recentWeakAttemptsSummary:
            formatPracticeRepairQueueRecentWeakAttemptsSummary(
              state.recentWeakAttemptCount,
            ),
        },
      ];
    })
    .sort(comparePracticeRepairQueueCandidateItems);

  return [
    ...activeItems.map((item) => ({
      ...item,
      kind: "active" as const,
    })),
    ...candidateItems,
  ];
}

export function listActivePracticeRepairEntriesForStudyNote(input: {
  results: readonly PracticeRepairResultLike[];
  studyNoteId: string;
}): PracticeRepairEntry[] {
  return listPracticeRepairEntries({
    matchesEntry: (entry) =>
      entry.reference.studyNoteId === input.studyNoteId &&
      getPracticeRepairEntryLifecycleState(entry) === "active",
    results: input.results,
  });
}

export function listPracticeRepairEntriesForQuestion(input: {
  reference: PracticeRepairQuestionReference;
  results: readonly PracticeRepairResultLike[];
}): PracticeRepairEntry[] {
  return listPracticeRepairEntries({
    matchesEntry: (entry) =>
      isMatchingPracticeRepairQuestionReference({
        candidate: entry.reference,
        reference: input.reference,
      }),
    results: input.results,
  });
}

export function listActionablePracticeFollowUps(input: {
  results: readonly PracticeRepairResultLike[];
}): PracticeRepairEntry[] {
  return listPracticeRepairEntries({
    matchesEntry: (entry) => isActionablePracticeFollowUp(entry),
    results: input.results,
  }).sort(compareActionablePracticeFollowUps);
}

export function listActionablePracticeFollowUpsForStudyNote(input: {
  results: readonly PracticeRepairResultLike[];
  studyNoteId: string;
}): PracticeRepairEntry[] {
  return listActionablePracticeFollowUps({
    results: input.results,
  }).filter((entry) => entry.reference.studyNoteId === input.studyNoteId);
}

export function formatPracticeRepairIntentLabel(
  intent: PracticeRepairIntent,
): string {
  switch (intent) {
    case "tighten-expected-answer":
      return "Tighten expected answer";
    case "split-study-note":
      return "Split Study Note";
    case "create-sibling-study-note":
      return "Create sibling Study Note";
    case "add-memory-aid":
      return "Add memory aid";
  }
}
