export const practiceRepairIntents = [
  "tighten-expected-answer",
  "split-study-note",
  "create-sibling-study-note",
  "add-memory-aid",
] as const;

export type PracticeRepairIntent = (typeof practiceRepairIntents)[number];
const practiceRepairMemoryAidKinds = ["Metaphor", "Acronym"] as const;
type PracticeRepairMemoryAidKind =
  (typeof practiceRepairMemoryAidKinds)[number];

export type PracticeRepairQuestionReference = {
  questionIndex: number;
  questionResultId?: string;
  sessionResultId: string;
  studyNoteId: string;
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

export type PracticeRepairEntry = {
  confirmedAt: string;
  correction: string;
  intent: PracticeRepairIntent;
  intentMetadata: PracticeRepairIntentMetadata;
  lifecycle?: PracticeRepairEntryLifecycle;
  nextPracticeIdea?: string;
  reference: PracticeRepairQuestionReference;
};

export type PracticeRepairEntryConfirmation = {
  correction: string;
  intent: PracticeRepairIntent;
  nextPracticeIdea?: string;
  reference: PracticeRepairQuestionReference;
};

type PracticeRepairQuestionLike = {
  noteId: string;
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

const practiceRepairSuggestions = [
  "Tighten the expected answer so the next recall target is specific.",
  "Split a broad Study Note or create a sibling from the same source explanation.",
  "Add a Metaphor or Acronym only if it solves this recall problem.",
] as const;

const terminalPracticeRepairLifecycleFactKeys = [
  "completedAt",
  "dismissedAt",
  "followUpSatisfiedAt",
  "studyNoteDeletedAt",
  "supersededAt",
] as const;

export function isPracticeRepairIntent(
  value: unknown,
): value is PracticeRepairIntent {
  return (
    typeof value === "string" &&
    practiceRepairIntents.includes(value as PracticeRepairIntent)
  );
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

export function isPracticeRepairEntryLifecycle(
  value: unknown,
): value is PracticeRepairEntryLifecycle {
  const candidate = asPracticeRepairMetadataRecord(value);

  if (candidate === null) {
    return false;
  }

  return terminalPracticeRepairLifecycleFactKeys.every((key) => {
    return !(key in candidate) || isNullableString(candidate[key]);
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
    intentMetadata: clonePracticeRepairIntentMetadata(
      entry.intent,
      entry.intentMetadata,
    ),
    lifecycle: clonePracticeRepairEntryLifecycle(entry.lifecycle),
    reference: {
      ...entry.reference,
    },
  };
}

export function isPracticeRepairIntentMetadata(
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

function hasTerminalPracticeRepairLifecycleFact(
  lifecycle: PracticeRepairEntryLifecycle | undefined,
): boolean {
  if (lifecycle === undefined) {
    return false;
  }

  return terminalPracticeRepairLifecycleFactKeys.some((key) => {
    const fact = lifecycle[key];

    return typeof fact === "string" && fact.length > 0;
  });
}

export function getPracticeRepairEntryLifecycleState(
  entry: Pick<PracticeRepairEntry, "lifecycle">,
): PracticeRepairEntryLifecycleState {
  return hasTerminalPracticeRepairLifecycleFact(entry.lifecycle)
    ? "historical"
    : "active";
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
  if (
    input.candidate.sessionResultId !== input.reference.sessionResultId ||
    input.candidate.studyNoteId !== input.reference.studyNoteId
  ) {
    return false;
  }

  if (
    input.candidate.questionResultId !== undefined &&
    input.reference.questionResultId !== undefined &&
    input.candidate.questionResultId === input.reference.questionResultId
  ) {
    return true;
  }

  return input.candidate.questionIndex === input.reference.questionIndex;
}

export function listActivePracticeRepairEntriesForStudyNote(input: {
  results: readonly PracticeRepairResultLike[];
  studyNoteId: string;
}): PracticeRepairEntry[] {
  const entries: PracticeRepairEntry[] = [];

  for (const result of input.results) {
    for (const question of result.questions) {
      const entry = question.practiceRepairEntry;

      if (
        entry !== undefined &&
        entry.reference.studyNoteId === input.studyNoteId &&
        getPracticeRepairEntryLifecycleState(entry) === "active"
      ) {
        entries.push(clonePracticeRepairEntry(entry));
      }
    }
  }

  return entries.sort(comparePracticeRepairEntries);
}

export function listPracticeRepairEntriesForQuestion(input: {
  reference: PracticeRepairQuestionReference;
  results: readonly PracticeRepairResultLike[];
}): PracticeRepairEntry[] {
  const entries: PracticeRepairEntry[] = [];

  for (const result of input.results) {
    for (const question of result.questions) {
      const entry = question.practiceRepairEntry;

      if (
        entry !== undefined &&
        isMatchingPracticeRepairQuestionReference({
          candidate: entry.reference,
          reference: input.reference,
        })
      ) {
        entries.push(clonePracticeRepairEntry(entry));
      }
    }
  }

  return entries.sort(comparePracticeRepairEntries);
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
