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

export type PracticeRepairEntry = {
  confirmedAt: string;
  correction: string;
  intent: PracticeRepairIntent;
  intentMetadata: PracticeRepairIntentMetadata;
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

const practiceRepairSuggestions = [
  "Tighten the expected answer so the next recall target is specific.",
  "Split a broad Study Note or create a sibling from the same source explanation.",
  "Add a Metaphor or Acronym only if it solves this recall problem.",
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

export function clonePracticeRepairIntentMetadata(
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

export function isPracticeRepairIntentMetadata(
  intent: PracticeRepairIntent,
  value: unknown,
): value is PracticeRepairIntentMetadata {
  const candidate =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : null;

  if (candidate === null) {
    return false;
  }

  switch (intent) {
    case "tighten-expected-answer":
      return (
        "updatedExpectedAnswer" in candidate &&
        (candidate.updatedExpectedAnswer === null ||
          typeof candidate.updatedExpectedAnswer === "string")
      );
    case "split-study-note":
      return (
        Array.isArray(candidate.createdStudyNoteIds) &&
        candidate.createdStudyNoteIds.every(
          (value) => typeof value === "string",
        ) &&
        "narrowedOriginalStudyNoteAt" in candidate &&
        (candidate.narrowedOriginalStudyNoteAt === null ||
          typeof candidate.narrowedOriginalStudyNoteAt === "string")
      );
    case "create-sibling-study-note":
      return (
        "createdStudyNoteId" in candidate &&
        (candidate.createdStudyNoteId === null ||
          typeof candidate.createdStudyNoteId === "string")
      );
    case "add-memory-aid":
      return (
        "memoryAidId" in candidate &&
        (candidate.memoryAidId === null ||
          typeof candidate.memoryAidId === "string") &&
        "memoryAidKind" in candidate &&
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
