import { describe, expect, it } from "vitest";

import type { FlashCardRecallNote, RecallQuestion } from "./recall";
import { projectSessionReview } from "./recall-session-review";

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
): RecallQuestion {
  return {
    isAnswerRevealed: selfRating !== null,
    noteId: note.id,
    noteSnapshot: note,
    selfRating,
    typedAnswer: "",
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
    expect(review.summary.noteCountLabel).toBe("3 targeted notes");
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
});
