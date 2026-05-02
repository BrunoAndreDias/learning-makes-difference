import type { AppNote } from "../notes-workspace/notes";
import type { RecallSelfRating } from "../recall/recall";

export type NoteRecallHistoryAttempt = {
  completedAt: string;
  rating: RecallSelfRating;
};

export type NoteRecallHistory = {
  attempts: readonly NoteRecallHistoryAttempt[];
  noteId: string;
};

type NoteRecallHistorySource = {
  attempts: readonly NoteRecallHistoryAttempt[];
  noteId: string;
};

export type LearningStateStatus =
  | "recently_nailed"
  | "ready_for_review"
  | "unpracticed"
  | "weak";

export type LearningStateRecommendedAction =
  | "practice_now"
  | "review_later"
  | "review_now";

export type NoteLearningState = {
  hookCount: number;
  isWeak: boolean;
  lastPracticedAt: string | null;
  latestRating: RecallSelfRating | null;
  nextReviewAt: string | null;
  noteId: string;
  practiced: boolean;
  recommendedAction: LearningStateRecommendedAction;
  status: LearningStateStatus;
};

export function formatLearningStateStatusLabel(
  status: LearningStateStatus,
): string {
  switch (status) {
    case "unpracticed":
      return "Unpracticed";
    case "weak":
      return "Weak";
    case "ready_for_review":
      return "Ready for review";
    case "recently_nailed":
      return "Recently nailed";
  }
}

export function formatLearningStateRatingLabel(
  rating: RecallSelfRating | null,
): string | null {
  if (rating === null) {
    return null;
  }

  switch (rating) {
    case "missed":
      return "Missed";
    case "partial":
      return "Partial";
    case "nailed":
      return "Nailed";
  }
}

function addDays(timestamp: string, days: number): string {
  const date = new Date(timestamp);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function getReviewOffsetDays(rating: RecallSelfRating): number {
  switch (rating) {
    case "missed":
      return 1;
    case "partial":
      return 3;
    case "nailed":
      return 7;
  }
}

export function deriveLearningState(input: {
  history: NoteRecallHistory | null;
  note: AppNote;
  now?: string;
}): NoteLearningState {
  const hookCount = input.note.metaphors.length + input.note.acronyms.length;
  const latestAttempt =
    input.history === null
      ? null
      : (input.history.attempts[input.history.attempts.length - 1] ?? null);

  if (latestAttempt === null) {
    return {
      hookCount,
      isWeak: false,
      lastPracticedAt: null,
      latestRating: null,
      nextReviewAt: null,
      noteId: input.note.id,
      practiced: false,
      recommendedAction: "practice_now",
      status: "unpracticed",
    };
  }

  const nextReviewAt = addDays(
    latestAttempt.completedAt,
    getReviewOffsetDays(latestAttempt.rating),
  );
  const isWeak =
    latestAttempt.rating === "missed" || latestAttempt.rating === "partial";

  if (isWeak) {
    return {
      hookCount,
      isWeak: true,
      lastPracticedAt: latestAttempt.completedAt,
      latestRating: latestAttempt.rating,
      nextReviewAt,
      noteId: input.note.id,
      practiced: true,
      recommendedAction: "review_now",
      status: "weak",
    };
  }

  const now = input.now ?? new Date().toISOString();
  const isReadyForReview = nextReviewAt <= now;

  return {
    hookCount,
    isWeak: false,
    lastPracticedAt: latestAttempt.completedAt,
    latestRating: latestAttempt.rating,
    nextReviewAt,
    noteId: input.note.id,
    practiced: true,
    recommendedAction: isReadyForReview ? "review_now" : "review_later",
    status: isReadyForReview ? "ready_for_review" : "recently_nailed",
  };
}

export function toNoteRecallHistories(
  histories: readonly NoteRecallHistorySource[],
): NoteRecallHistory[] {
  return histories.map((history) => ({
    attempts: history.attempts.map((attempt) => ({
      completedAt: attempt.completedAt,
      rating: attempt.rating,
    })),
    noteId: history.noteId,
  }));
}

export function deriveLearningStates(input: {
  histories: readonly NoteRecallHistory[];
  notes: readonly AppNote[];
  now?: string;
}): NoteLearningState[] {
  const historyByNoteId = new Map(
    input.histories.map((history) => [history.noteId, history]),
  );

  return input.notes.map((note) =>
    deriveLearningState({
      history: historyByNoteId.get(note.id) ?? null,
      note,
      now: input.now,
    }),
  );
}
