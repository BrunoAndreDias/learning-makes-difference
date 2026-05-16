import { describe, expect, it } from "vitest";

import type { AppStudyNote } from "../study-notes";
import type { SessionResult } from "./recall";
import { buildRecallTodayQueue } from "./recall-today";

const timestamp = "2026-05-01T09:00:00.000Z";

function buildStudyNote(
  overrides: Partial<AppStudyNote> & Pick<AppStudyNote, "id" | "prompt">,
): AppStudyNote {
  const { id, prompt, ...rest } = overrides;

  return {
    acronyms: [],
    createdAt: timestamp,
    expectedAnswer: "Expected answer",
    id,
    labelIds: [],
    metaphors: [],
    prompt,
    source: {
      body: "Source body",
      id: `source-${id}`,
      title: "Source title",
      updatedAt: timestamp,
    },
    sourceNoteId: `source-${id}`,
    updatedAt: timestamp,
    ...rest,
  };
}

function buildSessionResultWithPracticeRepair(input: {
  correction: string;
  lifecycle?: {
    completedAt?: string | null;
    dismissedAt?: string | null;
    followUpSatisfiedAt?: string | null;
    studyNoteDeletedAt?: string | null;
    supersededAt?: string | null;
  };
  prompt: string;
  questionResultId: string;
  resultId: string;
  studyNote: AppStudyNote;
}): SessionResult {
  return {
    attempts: [
      {
        noteId: input.studyNote.id,
        rating: "hard",
      },
    ],
    completedAt: "2026-05-14T09:00:00.000Z",
    createdAt: "2026-05-14T08:55:00.000Z",
    id: input.resultId,
    mode: "FlashCard",
    notes: [
      {
        acronyms: [],
        body: input.studyNote.expectedAnswer,
        createdAt: input.studyNote.createdAt,
        expectedAnswer: input.studyNote.expectedAnswer,
        id: input.studyNote.id,
        labelIds: [],
        metaphors: [],
        prompt: input.prompt,
        source: { ...input.studyNote.source },
        sourceNoteId: input.studyNote.sourceNoteId,
        title: input.prompt,
        updatedAt: input.studyNote.updatedAt,
      },
    ],
    questions: [
      {
        isAnswerRevealed: true,
        noteId: input.studyNote.id,
        noteSnapshot: {
          acronyms: [],
          body: input.studyNote.expectedAnswer,
          createdAt: input.studyNote.createdAt,
          expectedAnswer: input.studyNote.expectedAnswer,
          id: input.studyNote.id,
          labelIds: [],
          metaphors: [],
          prompt: input.prompt,
          source: { ...input.studyNote.source },
          sourceNoteId: input.studyNote.sourceNoteId,
          title: input.prompt,
          updatedAt: input.studyNote.updatedAt,
        },
        practiceRepairEntry: {
          confirmedAt: "2026-05-14T09:02:00.000Z",
          correction: input.correction,
          intent: "tighten-expected-answer",
          intentMetadata: {
            updatedExpectedAnswer: "Updated expected answer",
          },
          lifecycle: input.lifecycle,
          reference: {
            questionIndex: 0,
            questionResultId: input.questionResultId,
            sessionResultId: input.resultId,
            studyNoteId: input.studyNote.id,
          },
        },
        questionResultId: input.questionResultId,
        score: 50,
        selfRating: "hard",
        typedAnswer: "",
      },
    ],
    score: 50,
  };
}

describe("Recall Today queue", () => {
  it("routes only actionable Practice Follow-ups into Recall Today and keeps the combined note in one high-priority row", () => {
    const practiceFollowUp = buildStudyNote({
      id: "practice-follow-up",
      prompt: "Practice Follow-up prompt",
    });
    const needsPracticeOnly = buildStudyNote({
      id: "needs-practice-only",
      prompt: "Needs Practice only prompt",
    });
    const pendingFollowUp = buildStudyNote({
      id: "pending-follow-up",
      prompt: "Pending follow-up prompt",
    });
    const dismissedFollowUp = buildStudyNote({
      id: "dismissed-follow-up",
      prompt: "Dismissed follow-up prompt",
    });
    const dueForRecall = buildStudyNote({
      id: "due-for-recall",
      prompt: "Due for Recall prompt",
    });

    const queue = buildRecallTodayQueue({
      histories: [
        {
          attempts: [
            {
              completedAt: "2026-05-14T09:00:00.000Z",
              rating: "hard",
            },
          ],
          studyNoteId: practiceFollowUp.id,
        },
        {
          attempts: [
            {
              completedAt: "2026-05-14T11:00:00.000Z",
              rating: "hard",
            },
          ],
          studyNoteId: needsPracticeOnly.id,
        },
        {
          attempts: [
            {
              completedAt: "2026-05-15T09:00:00.000Z",
              rating: "good",
            },
          ],
          studyNoteId: pendingFollowUp.id,
        },
        {
          attempts: [
            {
              completedAt: "2026-05-15T10:00:00.000Z",
              rating: "good",
            },
          ],
          studyNoteId: dismissedFollowUp.id,
        },
        {
          attempts: [
            {
              completedAt: "2026-05-10T09:00:00.000Z",
              rating: "good",
            },
          ],
          studyNoteId: dueForRecall.id,
        },
      ],
      now: "2026-05-15T10:00:00.000Z",
      recallSchedules: [
        {
          ease: 2.35,
          intervalDays: 1,
          lastRecalledAt: "2026-05-14T09:00:00.000Z",
          nextRecallAt: "2026-05-15T23:30:00.000Z",
          repetitionCount: 1,
          studyNoteId: practiceFollowUp.id,
        },
        {
          ease: 2.5,
          intervalDays: 3,
          lastRecalledAt: "2026-05-10T09:00:00.000Z",
          nextRecallAt: "2026-05-15T08:00:00.000Z",
          repetitionCount: 1,
          studyNoteId: dueForRecall.id,
        },
      ],
      sessionResults: [
        buildSessionResultWithPracticeRepair({
          correction:
            "State ATP and explain that it stores transferable energy.",
          lifecycle: {
            completedAt: "2026-05-14T09:10:00.000Z",
          },
          prompt: "Practice Follow-up prompt",
          questionResultId: "question-practice-follow-up",
          resultId: "result-practice-follow-up",
          studyNote: practiceFollowUp,
        }),
        buildSessionResultWithPracticeRepair({
          correction: "Finish the content repair first.",
          prompt: "Pending follow-up prompt",
          questionResultId: "question-pending-follow-up",
          resultId: "result-pending-follow-up",
          studyNote: pendingFollowUp,
        }),
        buildSessionResultWithPracticeRepair({
          correction: "This follow-up was dismissed later.",
          lifecycle: {
            dismissedAt: "2026-05-14T09:20:00.000Z",
          },
          prompt: "Dismissed follow-up prompt",
          questionResultId: "question-dismissed-follow-up",
          resultId: "result-dismissed-follow-up",
          studyNote: dismissedFollowUp,
        }),
      ],
      studyNotes: [
        dueForRecall,
        pendingFollowUp,
        dismissedFollowUp,
        needsPracticeOnly,
        practiceFollowUp,
      ],
      userTimeZone: "America/New_York",
    });

    expect(
      queue.map((item) => ({
        correction: item.practiceFollowUpEntry?.correction ?? null,
        id: item.studyNote.id,
        reasons: item.reasons,
      })),
    ).toEqual([
      {
        correction: "State ATP and explain that it stores transferable energy.",
        id: practiceFollowUp.id,
        reasons: ["practice-follow-up", "needs-practice", "due-for-recall"],
      },
      {
        correction: null,
        id: needsPracticeOnly.id,
        reasons: ["needs-practice"],
      },
      {
        correction: null,
        id: dueForRecall.id,
        reasons: ["due-for-recall"],
      },
    ]);
  });

  it("prioritizes recallable Study Notes by recommendation reason", () => {
    const needsPracticeAndDue = buildStudyNote({
      id: "needs-practice-and-due",
      prompt: "Needs practice and due",
    });
    const notRecalled = buildStudyNote({
      id: "not-recalled",
      prompt: "Not recalled",
    });
    const dueForRecall = buildStudyNote({
      id: "due-for-recall",
      prompt: "Due for Recall",
    });
    const incomplete = buildStudyNote({
      expectedAnswer: " ",
      id: "incomplete",
      prompt: "Incomplete",
    });
    const future = buildStudyNote({
      id: "future",
      prompt: "Future",
    });

    const queue = buildRecallTodayQueue({
      histories: [
        {
          attempts: [
            {
              completedAt: "2026-05-14T09:00:00.000Z",
              rating: "hard",
            },
          ],
          studyNoteId: needsPracticeAndDue.id,
        },
        {
          attempts: [
            {
              completedAt: "2026-05-08T09:00:00.000Z",
              rating: "good",
            },
          ],
          studyNoteId: dueForRecall.id,
        },
        {
          attempts: [
            {
              completedAt: "2026-05-14T09:00:00.000Z",
              rating: "easy",
            },
          ],
          studyNoteId: future.id,
        },
      ],
      now: "2026-05-15T10:00:00.000Z",
      recallSchedules: [
        {
          ease: 2.35,
          intervalDays: 1,
          lastRecalledAt: "2026-05-14T09:00:00.000Z",
          nextRecallAt: "2026-05-15T23:30:00.000Z",
          repetitionCount: 1,
          studyNoteId: needsPracticeAndDue.id,
        },
        {
          ease: 2.5,
          intervalDays: 3,
          lastRecalledAt: "2026-05-08T09:00:00.000Z",
          nextRecallAt: "2026-05-15T08:00:00.000Z",
          repetitionCount: 1,
          studyNoteId: dueForRecall.id,
        },
        {
          ease: 2.65,
          intervalDays: 7,
          lastRecalledAt: "2026-05-14T09:00:00.000Z",
          nextRecallAt: "2026-05-21T09:00:00.000Z",
          repetitionCount: 1,
          studyNoteId: future.id,
        },
      ],
      sessionResults: [],
      studyNotes: [
        dueForRecall,
        future,
        incomplete,
        notRecalled,
        needsPracticeAndDue,
      ],
      userTimeZone: "America/New_York",
    });

    expect(
      queue.map((item) => ({
        id: item.studyNote.id,
        reasons: item.reasons,
      })),
    ).toEqual([
      {
        id: needsPracticeAndDue.id,
        reasons: ["needs-practice", "due-for-recall"],
      },
      {
        id: notRecalled.id,
        reasons: ["not-recalled"],
      },
      {
        id: dueForRecall.id,
        reasons: ["due-for-recall"],
      },
    ]);
  });
});
