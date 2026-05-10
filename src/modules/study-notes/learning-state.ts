import type {
  FlashCardRecallAttemptsByNote,
  RecallSelfRating,
} from "../recall";
import type { AppStudyNote } from "./study-notes";

const DUE_RECALL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type StudyNoteRecallHistoryAttempt = {
  completedAt: string;
  rating: RecallSelfRating;
};

export type StudyNoteRecallHistory = {
  attempts: readonly StudyNoteRecallHistoryAttempt[];
  studyNoteId: string;
};

export type StudyNoteLearningState = {
  dueForRecall: boolean;
  lastRecalledAt: string | null;
  latestScore: RecallSelfRating | null;
  needsPractice: boolean;
  studyNoteId: string;
};

function formatStudyNoteLearningStateScoreLabel(
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

export function formatStudyNoteLearningStateCompactLabel(
  learningState: StudyNoteLearningState,
): string {
  const scoreLabel = formatStudyNoteLearningStateScoreLabel(
    learningState.latestScore,
  );

  return scoreLabel === null ? "Not recalled yet" : `Last score: ${scoreLabel}`;
}

export function formatStudyNotePracticeSignalLabel(
  learningState: StudyNoteLearningState,
): string | null {
  return learningState.needsPractice ? "Needs practice" : null;
}

export function formatStudyNoteDueLabel(
  learningState: StudyNoteLearningState,
): string | null {
  return learningState.dueForRecall ? "Due for Recall" : null;
}

function isNeedsPractice(rating: RecallSelfRating | null) {
  return rating === "forgot" || rating === "hard";
}

function isDueForRecall(input: {
  lastRecalledAt: string | null;
  latestScore: RecallSelfRating | null;
  now: string;
}) {
  if (input.lastRecalledAt === null) {
    return true;
  }

  if (isNeedsPractice(input.latestScore)) {
    return true;
  }

  const recalledAt = new Date(input.lastRecalledAt).getTime();
  const now = new Date(input.now).getTime();

  if (Number.isNaN(recalledAt) || Number.isNaN(now)) {
    return false;
  }

  return now - recalledAt >= DUE_RECALL_WINDOW_MS;
}

function deriveStudyNoteLearningState(input: {
  history: StudyNoteRecallHistory | null;
  now: string;
  studyNote: AppStudyNote;
}): StudyNoteLearningState {
  const latestAttempt =
    input.history === null
      ? null
      : (input.history.attempts[input.history.attempts.length - 1] ?? null);
  const recalledAt =
    latestAttempt === null ? null : new Date(latestAttempt.completedAt);
  const lastRecalledAt =
    latestAttempt === null || Number.isNaN(recalledAt?.getTime())
      ? null
      : latestAttempt.completedAt;
  const latestScore = latestAttempt?.rating ?? null;

  return {
    dueForRecall: isDueForRecall({
      lastRecalledAt,
      latestScore,
      now: input.now,
    }),
    lastRecalledAt,
    latestScore,
    needsPractice: isNeedsPractice(latestScore),
    studyNoteId: input.studyNote.id,
  };
}

export function deriveStudyNoteLearningStates(input: {
  histories: readonly StudyNoteRecallHistory[];
  now: string;
  studyNotes: readonly AppStudyNote[];
}): StudyNoteLearningState[] {
  const historyByStudyNoteId = new Map(
    input.histories.map((history) => [history.studyNoteId, history]),
  );

  return input.studyNotes.map((studyNote) =>
    deriveStudyNoteLearningState({
      history: historyByStudyNoteId.get(studyNote.id) ?? null,
      now: input.now,
      studyNote,
    }),
  );
}

export function toStudyNoteRecallHistories(
  attemptsByNote: readonly FlashCardRecallAttemptsByNote[],
): StudyNoteRecallHistory[] {
  return attemptsByNote.map((history) => ({
    attempts: history.attempts.map((attempt) => ({
      completedAt: attempt.completedAt,
      rating: attempt.rating,
    })),
    studyNoteId: history.noteId,
  }));
}

// fallow-ignore-next-line unused-exports
export function listDueStudyNotesForRecall(input: {
  learningStates: readonly StudyNoteLearningState[];
  studyNotes: readonly AppStudyNote[];
}): AppStudyNote[] {
  const learningStateByStudyNoteId = new Map(
    input.learningStates.map((learningState) => [
      learningState.studyNoteId,
      learningState,
    ]),
  );

  return input.studyNotes.filter(
    (studyNote) =>
      learningStateByStudyNoteId.get(studyNote.id)?.dueForRecall === true,
  );
}
