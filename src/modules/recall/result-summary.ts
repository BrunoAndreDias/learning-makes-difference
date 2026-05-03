import { formatCount } from "../../lib/format-count";
import {
  type FlashCardRecallAttemptSummary,
  type FlashCardRecallNote,
  type FlashCardSessionResult,
  summarizeAttempts,
} from "./recall";

type WeakRating = "forgot" | "hard";

export type ResultSummaryWeakNote = {
  noteId: string;
  rating: WeakRating;
  title: string;
};

export type ResultSummaryNextAction =
  | "finish-session"
  | "practice-weak-notes"
  | "start-next-recall";

export type RecallResultSummary = {
  completionCount: number;
  completionRate: number;
  nextAction: ResultSummaryNextAction;
  questionCount: number;
  ratingTotals: FlashCardRecallAttemptSummary;
  weakNotes: ResultSummaryWeakNote[];
};

const weakRatingOrder: Record<WeakRating, number> = {
  forgot: 0,
  hard: 1,
};

function isWeakRating(value: unknown): value is WeakRating {
  return value === "forgot" || value === "hard";
}

function compareWeakNotes(
  left: ResultSummaryWeakNote,
  right: ResultSummaryWeakNote,
) {
  if (left.rating === right.rating) {
    return left.title.localeCompare(right.title);
  }

  return weakRatingOrder[left.rating] - weakRatingOrder[right.rating];
}

function toWeakNote(question: FlashCardSessionResult["questions"][number]) {
  if (!isWeakRating(question.selfRating)) {
    return null;
  }

  return {
    noteId: question.noteId,
    rating: question.selfRating,
    title: question.noteSnapshot.title,
  };
}

function getWeakNotes(
  sessionResult: Pick<FlashCardSessionResult, "questions">,
) {
  return sessionResult.questions
    .map(toWeakNote)
    .filter((note): note is ResultSummaryWeakNote => note !== null)
    .sort(compareWeakNotes);
}

function getQuestionCount(
  sessionResult: Pick<FlashCardSessionResult, "notes" | "questions">,
) {
  return sessionResult.questions.length > 0
    ? sessionResult.questions.length
    : sessionResult.notes.length;
}

function getCompletionRate(completionCount: number, questionCount: number) {
  return questionCount === 0 ? 0 : completionCount / questionCount;
}

function getNextAction(input: {
  completionCount: number;
  questionCount: number;
  weakNotes: readonly ResultSummaryWeakNote[];
}): ResultSummaryNextAction {
  if (input.weakNotes.length > 0) {
    return "practice-weak-notes";
  }

  if (input.completionCount < input.questionCount) {
    return "finish-session";
  }

  return "start-next-recall";
}

export function summarizeSessionResult(
  sessionResult: Pick<
    FlashCardSessionResult,
    "attempts" | "notes" | "questions"
  >,
): RecallResultSummary {
  const ratingTotals = summarizeAttempts(sessionResult.attempts);
  const completionCount = sessionResult.attempts.length;
  const questionCount = getQuestionCount(sessionResult);
  const weakNotes = getWeakNotes(sessionResult);

  return {
    completionCount,
    completionRate: getCompletionRate(completionCount, questionCount),
    nextAction: getNextAction({
      completionCount,
      questionCount,
      weakNotes,
    }),
    questionCount,
    ratingTotals,
    weakNotes,
  };
}

export function getResultSummaryNoteCountLabel(
  notes: readonly FlashCardRecallNote[],
) {
  return `${formatCount(notes.length, "note")} practiced`;
}

export function formatResultSummaryScoreLabel(
  ratingTotals: FlashCardRecallAttemptSummary,
) {
  return `Easy ${ratingTotals.easy} · Good ${ratingTotals.good} · Hard ${ratingTotals.hard} · Forgot ${ratingTotals.forgot}`;
}
