import { describe, expect, it } from "vitest";

import {
  getQuestionPracticeRepairDraft,
  listActivePracticeRepairQueueItems,
  listPracticeRepairQueueItems,
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

  it("lists active entries first and adds only the newest unconfirmed candidate per Study Note without active-entry duplicates", () => {
    const queueItems = listPracticeRepairQueueItems({
      results: [
        {
          completedAt: "2026-05-16T09:00:00.000Z",
          id: "result-active",
          questions: [
            {
              noteId: "study-note-active",
              noteSnapshot: {
                body: "Active body",
                expectedAnswer: "Active expected answer",
                prompt: "What is already being repaired?",
                sourceNoteId: "source-note-active",
                title: "Active title",
              },
              practiceRepairEntry: {
                confirmedAt: "2026-05-16T09:15:00.000Z",
                correction: "Tighten the active note before anything else.",
                intent: "tighten-expected-answer",
                intentMetadata: {
                  updatedExpectedAnswer: null,
                },
                reference: {
                  questionIndex: 0,
                  questionResultId: "result-active-question-0",
                  sessionResultId: "result-active",
                  studyNoteId: "study-note-active",
                },
              },
              questionResultId: "result-active-question-0",
              selfRating: "hard",
            },
          ],
        },
        {
          completedAt: "2026-05-16T08:30:00.000Z",
          id: "result-older-candidate",
          questions: [
            {
              noteId: "study-note-candidate",
              noteSnapshot: {
                body: "Older candidate body",
                expectedAnswer: "Older candidate expected answer",
                prompt: "What stores transferable energy?",
                sourceNoteId: "source-note-candidate",
                title: "Older candidate title",
              },
              questionResultId: "result-older-candidate-question-0",
              selfRating: "hard",
            },
          ],
        },
        {
          completedAt: "2026-05-17T11:00:00.000Z",
          id: "result-newest-candidate",
          questions: [
            {
              noteId: "study-note-candidate",
              noteSnapshot: {
                body: "Newest candidate body",
                expectedAnswer: "Newest candidate expected answer",
                prompt: "What stores transferable energy now?",
                sourceNoteId: "source-note-candidate",
                title: "Newest candidate title",
              },
              questionResultId: "result-newest-candidate-question-0",
              selfRating: "forgot",
            },
          ],
        },
        {
          completedAt: "2026-05-16T10:00:00.000Z",
          id: "result-suppressed-active",
          questions: [
            {
              noteId: "study-note-suppressed",
              noteSnapshot: {
                body: "Suppressed active body",
                expectedAnswer: "Suppressed active answer",
                prompt: "What is already suppressed?",
                sourceNoteId: "source-note-suppressed",
                title: "Suppressed active title",
              },
              practiceRepairEntry: {
                confirmedAt: "2026-05-16T10:05:00.000Z",
                correction: "There is already active Practice Repair here.",
                intent: "tighten-expected-answer",
                intentMetadata: {
                  updatedExpectedAnswer: null,
                },
                reference: {
                  questionIndex: 0,
                  questionResultId: "result-suppressed-active-question-0",
                  sessionResultId: "result-suppressed-active",
                  studyNoteId: "study-note-suppressed",
                },
              },
              questionResultId: "result-suppressed-active-question-0",
              selfRating: "hard",
            },
          ],
        },
        {
          completedAt: "2026-05-17T12:00:00.000Z",
          id: "result-suppressed-candidate",
          questions: [
            {
              noteId: "study-note-suppressed",
              noteSnapshot: {
                body: "Suppressed candidate body",
                expectedAnswer: "Suppressed candidate answer",
                prompt: "What should stay out of the queue?",
                sourceNoteId: "source-note-suppressed",
                title: "Suppressed candidate title",
              },
              questionResultId: "result-suppressed-candidate-question-0",
              selfRating: "forgot",
            },
          ],
        },
      ],
    });

    expect(queueItems).toHaveLength(3);
    expect(queueItems[0]).toMatchObject({
      entry: {
        correction: "There is already active Practice Repair here.",
      },
      kind: "active",
      result: {
        id: "result-suppressed-active",
      },
    });
    expect(queueItems[1]).toMatchObject({
      entry: {
        correction: "Tighten the active note before anything else.",
      },
      kind: "active",
      result: {
        id: "result-active",
      },
    });
    expect(queueItems[2]).toMatchObject({
      draft: {
        summary:
          "Forgot this Study Note. Confirm one concrete repair before the next attempt.",
      },
      kind: "candidate",
      question: {
        questionResultId: "result-newest-candidate-question-0",
      },
      recentWeakAttemptsSummary:
        "Also showed Needs practice in 1 earlier recent Recall result.",
      result: {
        id: "result-newest-candidate",
      },
    });
  });

  it("keeps the queue empty for empty, stale, and noisy candidate histories", () => {
    expect(
      listPracticeRepairQueueItems({
        results: [],
      }),
    ).toEqual([]);

    expect(
      listPracticeRepairQueueItems({
        results: [
          {
            completedAt: "2026-05-17T12:00:00.000Z",
            id: "result-newest-good",
            questions: [
              {
                noteId: "study-note-resolved",
                noteSnapshot: {
                  body: "Resolved body",
                  expectedAnswer: "Resolved answer",
                  prompt: "What was resolved?",
                  sourceNoteId: "source-note-resolved",
                  title: "Resolved title",
                },
                questionResultId: "result-newest-good-question-0",
                selfRating: "good",
              },
            ],
          },
          {
            completedAt: "2026-05-16T12:00:00.000Z",
            id: "result-older-weak",
            questions: [
              {
                noteId: "study-note-resolved",
                noteSnapshot: {
                  body: "Older weak body",
                  expectedAnswer: "Older weak answer",
                  prompt: "What used to be weak?",
                  sourceNoteId: "source-note-resolved",
                  title: "Older weak title",
                },
                questionResultId: "result-older-weak-question-0",
                selfRating: "forgot",
              },
            ],
          },
          {
            completedAt: "2026-05-17T11:00:00.000Z",
            id: "result-missing-question-id",
            questions: [
              {
                noteId: "study-note-missing-question-id",
                noteSnapshot: {
                  body: "Missing id body",
                  expectedAnswer: "Missing id answer",
                  prompt: "What is missing its question id?",
                  sourceNoteId: "source-note-missing-id",
                  title: "Missing id title",
                },
                selfRating: "forgot",
              },
            ],
          },
          {
            completedAt: "2026-05-16T11:00:00.000Z",
            id: "result-older-missing-question-id-candidate",
            questions: [
              {
                noteId: "study-note-missing-question-id",
                noteSnapshot: {
                  body: "Older missing id body",
                  expectedAnswer: "Older missing id answer",
                  prompt: "What is missing its question id now?",
                  sourceNoteId: "source-note-missing-id",
                  title: "Older missing id title",
                },
                questionResultId:
                  "result-older-missing-question-id-candidate-question-0",
                selfRating: "hard",
              },
            ],
          },
          {
            completedAt: "2026-05-17T10:00:00.000Z",
            id: "result-newest-ineligible",
            questions: [
              {
                noteId: "study-note-ineligible",
                noteSnapshot: {
                  body: "Newest ineligible body",
                  expectedAnswer: "Newest ineligible answer",
                  prompt: "What no longer has source context?",
                  title: "Newest ineligible title",
                },
                questionResultId: "result-newest-ineligible-question-0",
                selfRating: "hard",
              },
            ],
          },
          {
            completedAt: "2026-05-16T10:00:00.000Z",
            id: "result-older-ineligible-candidate",
            questions: [
              {
                noteId: "study-note-ineligible",
                noteSnapshot: {
                  body: "Older ineligible body",
                  expectedAnswer: "Older ineligible answer",
                  prompt: "What used to have source context?",
                  sourceNoteId: "source-note-ineligible",
                  title: "Older ineligible title",
                },
                questionResultId:
                  "result-older-ineligible-candidate-question-0",
                selfRating: "forgot",
              },
            ],
          },
          {
            completedAt: "2026-05-17T09:00:00.000Z",
            id: "result-missing-note-id",
            questions: [
              {
                noteSnapshot: {
                  body: "No note id body",
                  expectedAnswer: "No note id answer",
                  prompt: "What has no note id?",
                  sourceNoteId: "source-note-no-id",
                  title: "No note id title",
                },
                questionResultId: "result-missing-note-id-question-0",
                selfRating: "forgot",
              },
            ],
          },
        ],
      }),
    ).toEqual([]);
  });
});
