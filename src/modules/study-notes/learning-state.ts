import type {
  FlashCardRecallAttemptsByNote,
  RecallSelfRating,
} from "../recall/recall";
import {
  isRecallScheduleDue,
  type RecallSchedule,
} from "../recall/recall-schedule";
import { getStudyNoteReadiness } from "./study-note-readiness";
import type { AppStudyNote } from "./study-notes";

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
  if (learningState.latestScore === null && !learningState.dueForRecall) {
    return "Add expected answer";
  }

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

function isNeedsPractice(rating: RecallSelfRating | null): boolean {
  return rating === "forgot" || rating === "hard";
}

function isDueForRecall(schedule: RecallSchedule | null, now: string): boolean {
  if (schedule === null) {
    return true;
  }

  return isRecallScheduleDue(schedule, now);
}

function getLatestStudyNoteRecallAttempt(
  history: StudyNoteRecallHistory | null,
): StudyNoteRecallHistoryAttempt | null {
  if (history === null) {
    return null;
  }

  return history.attempts[history.attempts.length - 1] ?? null;
}

function getValidAttemptCompletedAt(
  attempt: StudyNoteRecallHistoryAttempt | null,
): string | null {
  if (attempt === null) {
    return null;
  }

  const completedAt = new Date(attempt.completedAt);

  return Number.isNaN(completedAt.getTime()) ? null : attempt.completedAt;
}

function deriveStudyNoteLearningState(input: {
  history: StudyNoteRecallHistory | null;
  now: string;
  recallSchedule: RecallSchedule | null;
  studyNote: AppStudyNote;
}): StudyNoteLearningState {
  const readiness = getStudyNoteReadiness(input.studyNote);

  if (!readiness.learningStateEligible) {
    return {
      dueForRecall: false,
      lastRecalledAt: null,
      latestScore: null,
      needsPractice: false,
      studyNoteId: input.studyNote.id,
    };
  }

  const latestAttempt = getLatestStudyNoteRecallAttempt(input.history);
  const lastRecalledAt = getValidAttemptCompletedAt(latestAttempt);
  const latestScore = latestAttempt?.rating ?? null;

  return {
    dueForRecall: isDueForRecall(input.recallSchedule, input.now),
    lastRecalledAt,
    latestScore,
    needsPractice: isNeedsPractice(latestScore),
    studyNoteId: input.studyNote.id,
  };
}

export function deriveStudyNoteLearningStates(input: {
  histories: readonly StudyNoteRecallHistory[];
  now: string;
  recallSchedules?: readonly RecallSchedule[];
  studyNotes: readonly AppStudyNote[];
}): StudyNoteLearningState[] {
  const historyByStudyNoteId = new Map(
    input.histories.map((history) => [history.studyNoteId, history]),
  );
  const recallScheduleByStudyNoteId = new Map(
    (input.recallSchedules ?? []).map((schedule) => [
      schedule.studyNoteId,
      schedule,
    ]),
  );

  return input.studyNotes.map((studyNote) =>
    deriveStudyNoteLearningState({
      history: historyByStudyNoteId.get(studyNote.id) ?? null,
      now: input.now,
      recallSchedule: recallScheduleByStudyNoteId.get(studyNote.id) ?? null,
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
      getStudyNoteReadiness(studyNote).dueForRecallEligible &&
      learningStateByStudyNoteId.get(studyNote.id)?.dueForRecall === true,
  );
}
