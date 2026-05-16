import { describe, expect, it } from "vitest";

import type { FlashCardRecallNote, RecallQuestion } from "./recall";
import {
  projectSessionReview,
  resolveSessionResultQuestion,
} from "./recall-session-review";

const testTimestamp = "2026-04-01T09:00:00.000Z";

function createNote(
  id: string,
  title: string,
  body: string,
): FlashCardRecallNote {
  return {
    acronyms: [],
    body,
    createdAt: testTimestamp,
    id,
    labelIds: [],
    metaphors: [],
    title,
    updatedAt: testTimestamp,
  };
}

function createQuestion(
  note: FlashCardRecallNote,
  selfRating: RecallQuestion["selfRating"],
  overrides: Partial<RecallQuestion> = {},
): RecallQuestion {
  return {
    isAnswerRevealed: selfRating !== null,
    noteId: note.id,
    noteSnapshot: note,
    selfRating,
    typedAnswer: "",
    ...overrides,
  };
}

describe("recall session review", () => {
  it("projects early-ended coverage and not reached notes from the targeted note set", () => {
    const firstNote = createNote("note-1", "First note", "First body");
    const secondNote = createNote("note-2", "Second note", "Second body");
    const thirdNote = createNote("note-3", "Third note", "Third body");

    const review = projectSessionReview({
      attempts: [
        {
          noteId: firstNote.id,
          rating: "good",
        },
      ],
      completedAt: "2026-04-01T09:02:00.000Z",
      createdAt: "2026-04-01T09:00:00.000Z",
      notes: [firstNote, secondNote, thirdNote],
      questions: [createQuestion(firstNote, "good")],
    });

    expect(review.attemptedQuestions).toHaveLength(1);
    expect(review.notReachedNotes.map((note) => note.id)).toEqual([
      secondNote.id,
      thirdNote.id,
    ]);
    expect(review.summary.noteCountLabel).toBe("3 targeted Study Notes");
    expect(review.summary.questionCoverageLabel).toBe(
      "1 of 3 questions attempted",
    );
    expect(review.summary.durationLabel).toBe("completed in 2 min");
    expect(review.selfRatingDistribution).toEqual({
      label: "Easy 0 · Good 1 · Hard 0 · Forgot 0",
      totals: {
        easy: 0,
        forgot: 0,
        good: 1,
        hard: 0,
      },
    });
  });

  it("resolves a stored question by questionResultId before legacy index fallback", () => {
    const firstNote = createNote("study-note-1", "First note", "First body");
    const secondNote = createNote("study-note-2", "Second note", "Second body");

    const result = {
      id: "result-1",
      questions: [
        createQuestion(firstNote, "good", {
          questionResultId: "result-1-question-0",
        }),
        createQuestion(secondNote, "hard", {
          questionResultId: "result-1-question-1",
        }),
      ],
    };

    expect(
      resolveSessionResultQuestion({
        reference: {
          questionIndex: 0,
          questionResultId: "result-1-question-1",
          sessionResultId: "result-1",
          studyNoteId: secondNote.id,
        },
        result,
      }),
    ).toMatchObject({
      noteId: secondNote.id,
      questionResultId: "result-1-question-1",
      selfRating: "hard",
    });
  });

  it("falls back to legacy question index and Study Note id when questionResultId is missing", () => {
    const firstNote = createNote("study-note-1", "First note", "First body");
    const secondNote = createNote("study-note-2", "Second note", "Second body");

    const result = {
      id: "legacy-result",
      questions: [
        createQuestion(firstNote, "good"),
        createQuestion(secondNote, "forgot"),
      ],
    };

    expect(
      resolveSessionResultQuestion({
        reference: {
          questionIndex: 1,
          sessionResultId: "legacy-result",
          studyNoteId: secondNote.id,
        },
        result,
      }),
    ).toMatchObject({
      noteId: secondNote.id,
      selfRating: "forgot",
    });
    expect(
      resolveSessionResultQuestion({
        reference: {
          questionIndex: 1,
          sessionResultId: "legacy-result",
          studyNoteId: firstNote.id,
        },
        result,
      }),
    ).toBeNull();
  });
});
