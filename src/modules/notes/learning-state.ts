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

export type NoteLearningState = {
  lastRecalledAt: string | null;
  latestScore: RecallSelfRating | null;
  noteId: string;
};

export function formatLearningStateScoreLabel(
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

export function formatLearningStateCompactLabel(
  learningState: NoteLearningState,
): string {
  const scoreLabel = formatLearningStateScoreLabel(learningState.latestScore);

  return scoreLabel === null ? "Not recalled yet" : `Last score: ${scoreLabel}`;
}

export function deriveLearningState(input: {
  history: NoteRecallHistory | null;
  note: AppNote;
}): NoteLearningState {
  const latestAttempt =
    input.history === null
      ? null
      : (input.history.attempts[input.history.attempts.length - 1] ?? null);

  if (latestAttempt === null) {
    return {
      lastRecalledAt: null,
      latestScore: null,
      noteId: input.note.id,
    };
  }

  const recalledAt = new Date(latestAttempt.completedAt);

  return {
    lastRecalledAt: Number.isNaN(recalledAt.getTime())
      ? null
      : latestAttempt.completedAt,
    latestScore: latestAttempt.rating,
    noteId: input.note.id,
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
}): NoteLearningState[] {
  const historyByNoteId = new Map(
    input.histories.map((history) => [history.noteId, history]),
  );

  return input.notes.map((note) =>
    deriveLearningState({
      history: historyByNoteId.get(note.id) ?? null,
      note,
    }),
  );
}
