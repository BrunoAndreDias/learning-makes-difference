import { describe, expect, it } from "vitest";

import {
  getQuestionPracticeRepairDraft,
  listActivePracticeRepairQueueItems,
} from "./recall-practice-repair";

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
          intentMetadata: {
            updatedExpectedAnswer: null,
          },
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

describe("recall Practice Repair queue", () => {
  it("lists only active entries and orders them newest first", () => {
    const activeItems = listActivePracticeRepairQueueItems({
      results: [
        {
          completedAt: "2026-05-16T10:10:00.000Z",
          id: "result-older-active",
          questions: [
            {
              noteSnapshot: {
                body: "ATP body",
                expectedAnswer: "ATP stores transferable energy.",
                prompt: "What stores transferable energy?",
                title: "ATP prompt",
              },
              practiceRepairEntry: {
                confirmedAt: "2026-05-16T10:15:00.000Z",
                correction: "State ATP directly.",
                intent: "tighten-expected-answer",
                intentMetadata: {
                  updatedExpectedAnswer: null,
                },
                reference: {
                  questionIndex: 0,
                  questionResultId: "result-older-active-question-0",
                  sessionResultId: "result-older-active",
                  studyNoteId: "study-note-1",
                },
              },
              selfRating: "hard",
            },
          ],
        },
        {
          completedAt: "2026-05-17T08:45:00.000Z",
          id: "result-newest-active",
          questions: [
            {
              noteSnapshot: {
                body: "Cycle body",
                expectedAnswer: "Krebs cycle regenerates oxaloacetate.",
                prompt: "What does the Krebs cycle regenerate?",
                title: "Krebs prompt",
              },
              practiceRepairEntry: {
                confirmedAt: "2026-05-17T08:50:00.000Z",
                correction: "Call out oxaloacetate at the end of the cycle.",
                intent: "tighten-expected-answer",
                intentMetadata: {
                  updatedExpectedAnswer: null,
                },
                reference: {
                  questionIndex: 0,
                  questionResultId: "result-newest-active-question-0",
                  sessionResultId: "result-newest-active",
                  studyNoteId: "study-note-2",
                },
              },
              selfRating: "forgot",
            },
            {
              noteSnapshot: {
                body: "Historical body",
                expectedAnswer: "Historical answer",
                prompt: "Historical prompt",
                title: "Historical title",
              },
              practiceRepairEntry: {
                confirmedAt: "2026-05-17T08:00:00.000Z",
                correction: "This one is already completed.",
                intent: "tighten-expected-answer",
                intentMetadata: {
                  updatedExpectedAnswer: null,
                },
                lifecycle: {
                  completedAt: "2026-05-17T08:30:00.000Z",
                },
                reference: {
                  questionIndex: 1,
                  questionResultId: "result-newest-active-question-1",
                  sessionResultId: "result-newest-active",
                  studyNoteId: "study-note-3",
                },
              },
              selfRating: "hard",
            },
          ],
        },
      ],
    });

    expect(activeItems).toHaveLength(2);
    expect(
      activeItems.map((item) => ({
        correction: item.entry.correction,
        resultId: item.result.id,
        studyNotePrompt: item.question.noteSnapshot.prompt,
      })),
    ).toEqual([
      {
        correction: "Call out oxaloacetate at the end of the cycle.",
        resultId: "result-newest-active",
        studyNotePrompt: "What does the Krebs cycle regenerate?",
      },
      {
        correction: "State ATP directly.",
        resultId: "result-older-active",
        studyNotePrompt: "What stores transferable energy?",
      },
    ]);
  });

  it("omits dismissed, superseded, and deleted-note entries from the active queue", () => {
    expect(
      listActivePracticeRepairQueueItems({
        results: [
          {
            completedAt: "2026-05-17T09:00:00.000Z",
            id: "result-historical",
            questions: [
              {
                noteSnapshot: {
                  body: "Dismissed body",
                  expectedAnswer: "Dismissed answer",
                  prompt: "Dismissed prompt",
                  title: "Dismissed title",
                },
                practiceRepairEntry: {
                  confirmedAt: "2026-05-17T08:10:00.000Z",
                  correction: "Dismissed correction",
                  intent: "tighten-expected-answer",
                  intentMetadata: {
                    updatedExpectedAnswer: null,
                  },
                  lifecycle: {
                    dismissedAt: "2026-05-17T08:30:00.000Z",
                  },
                  reference: {
                    questionIndex: 0,
                    sessionResultId: "result-historical",
                    studyNoteId: "study-note-dismissed",
                  },
                },
                selfRating: "hard",
              },
              {
                noteSnapshot: {
                  body: "Superseded body",
                  expectedAnswer: "Superseded answer",
                  prompt: "Superseded prompt",
                  title: "Superseded title",
                },
                practiceRepairEntry: {
                  confirmedAt: "2026-05-17T08:20:00.000Z",
                  correction: "Superseded correction",
                  intent: "tighten-expected-answer",
                  intentMetadata: {
                    updatedExpectedAnswer: null,
                  },
                  lifecycle: {
                    supersededAt: "2026-05-17T08:40:00.000Z",
                  },
                  reference: {
                    questionIndex: 1,
                    sessionResultId: "result-historical",
                    studyNoteId: "study-note-superseded",
                  },
                },
                selfRating: "forgot",
              },
              {
                noteSnapshot: {
                  body: "Deleted body",
                  expectedAnswer: "Deleted answer",
                  prompt: "Deleted prompt",
                  title: "Deleted title",
                },
                practiceRepairEntry: {
                  confirmedAt: "2026-05-17T08:25:00.000Z",
                  correction: "Deleted correction",
                  intent: "tighten-expected-answer",
                  intentMetadata: {
                    updatedExpectedAnswer: null,
                  },
                  lifecycle: {
                    studyNoteDeletedAt: "2026-05-17T08:45:00.000Z",
                  },
                  reference: {
                    questionIndex: 2,
                    sessionResultId: "result-historical",
                    studyNoteId: "study-note-deleted",
                  },
                },
                selfRating: "hard",
              },
            ],
          },
        ],
      }),
    ).toEqual([]);
  });
});
