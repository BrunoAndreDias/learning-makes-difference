import { formatCount } from "../../lib/format-count";
import type {
  FlashCardRecallNote,
  FlashCardSessionResult,
  RecallQuestion,
} from "./recall";

export type SessionReviewProjection = {
  attemptedQuestions: RecallQuestion[];
  notReachedNotes: FlashCardRecallNote[];
  summary: {
    durationLabel: string;
    noteCountLabel: string;
    questionCoverageLabel: string;
  };
};

function getAttemptedQuestions(
  questions: readonly RecallQuestion[],
): RecallQuestion[] {
  return questions.filter((question) => question.selfRating !== null);
}

function getNotReachedNotes(input: {
  attemptedQuestions: readonly RecallQuestion[];
  notes: readonly FlashCardRecallNote[];
}): FlashCardRecallNote[] {
  const attemptedNoteIds = new Set(
    input.attemptedQuestions.map((question) => question.noteId),
  );

  return input.notes.filter((note) => !attemptedNoteIds.has(note.id));
}

function getDurationLabel(
  result: Pick<FlashCardSessionResult, "completedAt" | "createdAt">,
) {
  const completedAt = new Date(result.completedAt);
  const createdAt = new Date(result.createdAt);

  if (
    Number.isNaN(completedAt.getTime()) ||
    Number.isNaN(createdAt.getTime()) ||
    completedAt.getTime() < createdAt.getTime()
  ) {
    return "completed time unavailable";
  }

  const elapsedMinutes = Math.max(
    1,
    Math.round((completedAt.getTime() - createdAt.getTime()) / 60_000),
  );
  return `completed in ${elapsedMinutes} min`;
}

function getNoteCountLabel(input: { endedEarly: boolean; noteCount: number }) {
  if (input.endedEarly) {
    return formatCount(input.noteCount, "targeted note");
  }

  return formatCount(input.noteCount, "note");
}

function getQuestionCoverageLabel(input: {
  attemptedQuestionCount: number;
  endedEarly: boolean;
  noteCount: number;
}) {
  if (input.endedEarly) {
    return `${input.attemptedQuestionCount} of ${input.noteCount} questions attempted`;
  }

  return formatCount(input.attemptedQuestionCount, "question");
}

export function projectSessionReview(
  result: Pick<
    FlashCardSessionResult,
    "completedAt" | "createdAt" | "notes" | "questions"
  >,
): SessionReviewProjection {
  const attemptedQuestions = getAttemptedQuestions(result.questions);
  const notReachedNotes = getNotReachedNotes({
    attemptedQuestions,
    notes: result.notes,
  });
  const noteCount = result.notes.length;
  const attemptedQuestionCount = attemptedQuestions.length;
  const endedEarly = notReachedNotes.length > 0;

  return {
    attemptedQuestions,
    notReachedNotes,
    summary: {
      durationLabel: getDurationLabel(result),
      noteCountLabel: getNoteCountLabel({ endedEarly, noteCount }),
      questionCoverageLabel: getQuestionCoverageLabel({
        attemptedQuestionCount,
        endedEarly,
        noteCount,
      }),
    },
  };
}
