import type { RecallSelfRating } from "../recall";
import type { AppNote } from "./notes-workspace/notes";

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
  | "recently_easy"
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
    case "recently_easy":
      return "Recently easy";
  }
}

export function formatLearningStateRatingLabel(
  rating: RecallSelfRating | null,
): string | null {
  if (rating === null) {
    return null;
  }

  switch (rating) {
    case "forgot":
      return "Forgot";
    case "hard":
      return "Hard";
    case "good":
      return "Good";
    case "easy":
      return "Easy";
  }
}

function addDays(timestamp: string, days: number): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setUTCDate(date.getUTCDate() + days);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString();
}

function getReviewOffsetDays(rating: RecallSelfRating): number {
  switch (rating) {
    case "forgot":
      return 1;
    case "hard":
      return 3;
    case "good":
      return 5;
    case "easy":
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
  const hasValidPracticeTimestamp = nextReviewAt.length > 0;
  const isWeak =
    latestAttempt.rating === "forgot" || latestAttempt.rating === "hard";

  if (isWeak) {
    return {
      hookCount,
      isWeak: true,
      lastPracticedAt: hasValidPracticeTimestamp
        ? latestAttempt.completedAt
        : null,
      latestRating: latestAttempt.rating,
      nextReviewAt: hasValidPracticeTimestamp ? nextReviewAt : null,
      noteId: input.note.id,
      practiced: true,
      recommendedAction: "review_now",
      status: "weak",
    };
  }

  const now = input.now ?? new Date().toISOString();
  if (!hasValidPracticeTimestamp) {
    return {
      hookCount,
      isWeak: false,
      lastPracticedAt: null,
      latestRating: latestAttempt.rating,
      nextReviewAt: null,
      noteId: input.note.id,
      practiced: true,
      recommendedAction: "review_now",
      status: "ready_for_review",
    };
  }
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
    status: isReadyForReview ? "ready_for_review" : "recently_easy",
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
