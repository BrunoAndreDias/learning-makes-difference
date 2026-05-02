import { describe, expect, it } from "vitest";

import type { FlashCardRecallNote, RecallQuestion } from "./recall";
import { summarizeSessionResult } from "./result-summary";

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
  };
}

describe("result summary", () => {
  it("derives memory totals, weak notes, completion, and next action", () => {
    const alphaNote = createNote("note-1", "Alpha note", "Alpha body");
    const betaNote = createNote("note-2", "Beta note", "Beta body");
    const gammaNote = createNote("note-3", "Gamma note", "Gamma body");
    const deltaNote = createNote("note-4", "Delta note", "Delta body");

    const summary = summarizeSessionResult({
      attempts: [
        { noteId: "note-1", rating: "nailed" },
        { noteId: "note-2", rating: "partial" },
        { noteId: "note-3", rating: "missed" },
      ],
      notes: [alphaNote, betaNote, gammaNote, deltaNote],
      questions: [
        createQuestion(alphaNote, "nailed"),
        createQuestion(betaNote, "partial"),
        createQuestion(gammaNote, "missed"),
        createQuestion(deltaNote, null),
      ],
    });

    expect(summary.ratingTotals).toEqual({
      missed: 1,
      nailed: 1,
      partial: 1,
    });
    expect(summary.completionCount).toBe(3);
    expect(summary.questionCount).toBe(4);
    expect(summary.completionRate).toBe(0.75);
    expect(summary.weakNotes).toEqual([
      { noteId: "note-3", rating: "missed", title: "Gamma note" },
      { noteId: "note-2", rating: "partial", title: "Beta note" },
    ]);
    expect(summary.nextAction).toBe("practice-weak-notes");
  });

  it("falls back to a finish-session action when there are still unattempted notes", () => {
    const alphaNote = createNote("note-1", "Alpha note", "Alpha body");

    const summary = summarizeSessionResult({
      attempts: [],
      notes: [],
      questions: [createQuestion(alphaNote, null)],
    });

    expect(summary.weakNotes).toEqual([]);
    expect(summary.nextAction).toBe("finish-session");
  });
});
