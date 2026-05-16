import { describe, expect, it } from "vitest";

import { getQuestionPracticeRepairDraft } from "./recall-practice-repair";

describe("recall Practice Repair drafts", () => {
  it("only returns drafts for weak Study Note questions without a confirmed entry", () => {
    expect(
      getQuestionPracticeRepairDraft({
        noteId: "study-note-forgot",
        noteSnapshot: {
          expectedAnswer: "ATP stores transferable energy.",
          sourceNoteId: "source-note-1",
        },
        selfRating: "forgot",
      }),
    ).toMatchObject({
      summary:
        "Forgot this Study Note. Confirm one concrete repair before the next attempt.",
    });
    expect(
      getQuestionPracticeRepairDraft({
        noteId: "study-note-hard",
        noteSnapshot: {
          expectedAnswer: "ATP stores transferable energy.",
          sourceNoteId: "source-note-1",
        },
        selfRating: "hard",
      }),
    ).toMatchObject({
      summary:
        "Hard recall suggests this Study Note needs one concrete repair before the next attempt.",
    });

    expect(
      getQuestionPracticeRepairDraft({
        noteId: "study-note-good",
        noteSnapshot: {
          expectedAnswer: "ATP stores transferable energy.",
          sourceNoteId: "source-note-1",
        },
        selfRating: "good",
      }),
    ).toBeNull();
    expect(
      getQuestionPracticeRepairDraft({
        noteId: "study-note-easy",
        noteSnapshot: {
          expectedAnswer: "ATP stores transferable energy.",
          sourceNoteId: "source-note-1",
        },
        selfRating: "easy",
      }),
    ).toBeNull();
    expect(
      getQuestionPracticeRepairDraft({
        noteId: "study-note-unanswered",
        noteSnapshot: {
          expectedAnswer: "ATP stores transferable energy.",
          sourceNoteId: "source-note-1",
        },
        selfRating: null,
      }),
    ).toBeNull();
    expect(
      getQuestionPracticeRepairDraft({
        noteId: "note-1",
        noteSnapshot: {},
        selfRating: "hard",
      }),
    ).toBeNull();
    expect(
      getQuestionPracticeRepairDraft({
        noteId: "study-note-confirmed",
        noteSnapshot: {
          expectedAnswer: "ATP stores transferable energy.",
          sourceNoteId: "source-note-1",
        },
        practiceRepairEntry: {
          confirmedAt: "2026-05-16T11:15:00.000Z",
          correction: "State ATP explicitly.",
          intent: "tighten-expected-answer",
          reference: {
            questionIndex: 0,
            questionResultId: "session-1-question-0",
            sessionResultId: "session-1",
            studyNoteId: "study-note-confirmed",
          },
        },
        selfRating: "hard",
      }),
    ).toBeNull();
  });
});
