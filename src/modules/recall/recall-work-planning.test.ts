import { afterEach, describe, expect, it, vi } from "vitest";

import { createAppNotesContext } from "../notes";
import type { AppStudyNote } from "../study-notes";
import {
  createAppStudyNotesContext,
  toStudyNoteRecallHistories,
} from "../study-notes";
import type { RecallSelfRating, SessionResult } from "./recall";
import { type AppRecallContext, createAppRecallContext } from "./recall";
import type { RecallSchedule } from "./recall-schedule";
import { planRecallWork } from "./recall-work-planning";

const timestamp = "2026-05-01T09:00:00.000Z";

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

function createRecallWorkPlanningTestContexts(keyPrefix: string) {
  const storage = createMemoryStorage();
  const notes = createAppNotesContext({
    keyPrefix: `${keyPrefix}-notes`,
    storage,
  });
  const studyNotes = createAppStudyNotesContext({
    keyPrefix: `${keyPrefix}-study-notes`,
    storage,
  });
  let sessionCounter = 0;
  const recall = createAppRecallContext({
    crypto: {
      randomUUID: () =>
        `${keyPrefix}-session-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
    },
    keyPrefix: `${keyPrefix}-recall`,
    notes,
    shuffleNotes: (sessionNotes) => [...sessionNotes],
    storage,
    studyNotes,
  });

  return {
    recall,
    studyNotes,
  };
}

function buildStudyNote(
  overrides: Partial<AppStudyNote> & Pick<AppStudyNote, "id" | "prompt">,
): AppStudyNote {
  const { id, prompt, ...rest } = overrides;

  return {
    acceptedVariants: [],
    acronyms: [],
    createdAt: timestamp,
    expectedAnswer: "Expected answer",
    id,
    keyIdeas: [],
    labelIds: [],
    metaphors: [],
    prompt,
    prohibitedPhrases: [],
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

function buildSchedule(
  studyNoteId: string,
  nextRecallAt: string,
): RecallSchedule {
  return {
    ease: 2.35,
    intervalDays: 1,
    lastRecalledAt: "2026-05-14T09:00:00.000Z",
    nextRecallAt,
    repetitionCount: 1,
    studyNoteId,
  };
}

function completeStudyNoteRecall(input: {
  rating: RecallSelfRating;
  recall: AppRecallContext;
  studyNoteId: string;
  userId: string;
}) {
  const session = input.recall.startFlashCardSession({
    studyNoteIds: [input.studyNoteId],
    userId: input.userId,
  });

  input.recall.revealFlashCardAnswer({
    sessionId: session.id,
    userId: input.userId,
  });
  input.recall.rateFlashCardAnswer({
    rating: input.rating,
    sessionId: session.id,
    userId: input.userId,
  });

  return getMostRecentSessionResult({
    recall: input.recall,
    userId: input.userId,
  });
}

function getMostRecentSessionResult(input: {
  recall: AppRecallContext;
  userId: string;
}) {
  const result = input.recall.listSessionResults({
    userId: input.userId,
  })[0];

  if (result === undefined) {
    throw new Error("Expected a stored Recall result.");
  }

  return result;
}

function createPracticeRepairReference(input: {
  result: SessionResult;
  studyNoteId: string;
}) {
  const questionResultId = input.result.questions[0]?.questionResultId;

  if (questionResultId === undefined) {
    throw new Error(
      "Expected the weak Study Note result to have a question id.",
    );
  }

  return {
    questionIndex: 0,
    questionResultId,
    sessionResultId: input.result.id,
    studyNoteId: input.studyNoteId,
  };
}

function getConfirmedPracticeRepairReference(result: SessionResult) {
  const reference = result.questions[0]?.practiceRepairEntry?.reference;

  if (reference === undefined) {
    throw new Error("Expected a confirmed Practice Repair reference.");
  }

  return reference;
}

function buildRecallWorkPlanFromRecallContext(input: {
  now: string;
  recall: AppRecallContext;
  studyNotes: ReturnType<typeof createAppStudyNotesContext>;
  userId: string;
}) {
  return planRecallWork({
    histories: toStudyNoteRecallHistories(
      input.recall.listAttemptsByNote({
        userId: input.userId,
      }),
    ),
    now: input.now,
    recallSchedules: input.recall.getRecallSchedulesSnapshot(),
    sessionResults: input.recall.listSessionResults({
      userId: input.userId,
    }),
    studyNotes: input.studyNotes
      .getSnapshot()
      .filter((studyNote) => studyNote.userId === input.userId),
    userTimeZone: "America/New_York",
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("recall work planning", () => {
  it("keeps a completed Practice Follow-up in Recall Today until the targeted question is attempted", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T16:00:00.000Z"));

    const userId = "user-recall-work-follow-up-timing";
    const { recall, studyNotes } = createRecallWorkPlanningTestContexts(
      "recall-work-follow-up-timing",
    );
    const studyNote = studyNotes.createStudyNote(userId, {
      expectedAnswer: "ATP stores transferable energy.",
      prompt: "What stores transferable energy?",
      sourceBody: "Cell respiration source context.",
      sourceTitle: "Cell respiration source",
    });
    const weakResult = completeStudyNoteRecall({
      rating: "hard",
      recall,
      studyNoteId: studyNote.id,
      userId,
    });

    const confirmedResult = recall.confirmPracticeRepairEntry({
      correction: "State ATP directly.",
      intent: "tighten-expected-answer",
      reference: createPracticeRepairReference({
        result: weakResult,
        studyNoteId: studyNote.id,
      }),
      userId,
    });
    const originalReference =
      getConfirmedPracticeRepairReference(confirmedResult);

    vi.setSystemTime(new Date("2026-05-16T16:05:00.000Z"));

    recall.completePracticeRepairEntry({
      reference: originalReference,
      userId,
    });

    vi.setSystemTime(new Date("2026-05-16T16:10:00.000Z"));

    const followUpSession = recall.startFlashCardSession({
      studyNoteIds: [studyNote.id],
      userId,
    });
    const planBeforeAttempt = buildRecallWorkPlanFromRecallContext({
      now: "2026-05-16T16:10:00.000Z",
      recall,
      studyNotes,
      userId,
    });

    expect(planBeforeAttempt.recallTodayQueue).toMatchObject([
      {
        primaryReason: "practice-follow-up",
        reasons: ["practice-follow-up", "needs-practice"],
        studyNote: {
          id: studyNote.id,
        },
      },
    ]);

    recall.revealFlashCardAnswer({
      sessionId: followUpSession.id,
      userId,
    });
    recall.rateFlashCardAnswer({
      rating: "hard",
      sessionId: followUpSession.id,
      userId,
    });

    const planAfterAttempt = buildRecallWorkPlanFromRecallContext({
      now: "2026-05-16T16:10:00.000Z",
      recall,
      studyNotes,
      userId,
    });

    expect(planAfterAttempt.recallTodayQueue).toMatchObject([
      {
        primaryReason: "needs-practice",
        reasons: ["needs-practice"],
        studyNote: {
          id: studyNote.id,
        },
      },
    ]);
  });

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

    const plan = planRecallWork({
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
      plan.recallTodayQueue.map((item) => ({
        correction: item.practiceFollowUpEntry?.correction ?? null,
        id: item.studyNote.id,
        primaryReason: item.primaryReason,
        reasons: item.reasons,
      })),
    ).toEqual([
      {
        correction: "State ATP and explain that it stores transferable energy.",
        id: practiceFollowUp.id,
        primaryReason: "practice-follow-up",
        reasons: ["practice-follow-up", "needs-practice", "due-for-recall"],
      },
      {
        correction: null,
        id: needsPracticeOnly.id,
        primaryReason: "needs-practice",
        reasons: ["needs-practice"],
      },
      {
        correction: null,
        id: dueForRecall.id,
        primaryReason: "due-for-recall",
        reasons: ["due-for-recall"],
      },
    ]);
  });

  it("builds Due for Recall from recall work planning with timezone-aware schedule rules and suppression", () => {
    const dueNeedsPractice = buildStudyNote({
      id: "due-needs-practice",
      prompt: "Due and needs practice",
    });
    const dueFollowUp = buildStudyNote({
      id: "due-follow-up",
      prompt: "Due with follow-up",
    });
    const overdue = buildStudyNote({
      id: "overdue",
      prompt: "Overdue note",
    });
    const dueInUserTimeZone = buildStudyNote({
      id: "due-in-user-time-zone",
      prompt: "Due in user time zone",
    });
    const future = buildStudyNote({
      id: "future",
      prompt: "Future note",
    });
    const incomplete = buildStudyNote({
      expectedAnswer: " ",
      id: "incomplete",
      prompt: "Incomplete note",
    });
    const unresolvedRepair = buildStudyNote({
      id: "unresolved-repair",
      prompt: "Unresolved repair note",
    });

    const plan = planRecallWork({
      histories: [
        {
          attempts: [
            {
              completedAt: "2026-05-14T09:00:00.000Z",
              rating: "hard",
            },
          ],
          studyNoteId: dueNeedsPractice.id,
        },
        {
          attempts: [
            {
              completedAt: "2026-05-14T10:00:00.000Z",
              rating: "good",
            },
          ],
          studyNoteId: dueFollowUp.id,
        },
        {
          attempts: [
            {
              completedAt: "2026-05-10T09:00:00.000Z",
              rating: "good",
            },
          ],
          studyNoteId: overdue.id,
        },
        {
          attempts: [
            {
              completedAt: "2026-05-14T11:00:00.000Z",
              rating: "good",
            },
          ],
          studyNoteId: dueInUserTimeZone.id,
        },
        {
          attempts: [
            {
              completedAt: "2026-05-14T12:00:00.000Z",
              rating: "easy",
            },
          ],
          studyNoteId: future.id,
        },
        {
          attempts: [
            {
              completedAt: "2026-05-14T13:00:00.000Z",
              rating: "good",
            },
          ],
          studyNoteId: unresolvedRepair.id,
        },
      ],
      now: "2026-05-15T10:00:00.000Z",
      recallSchedules: [
        buildSchedule(dueNeedsPractice.id, "2026-05-15T23:30:00.000Z"),
        buildSchedule(dueFollowUp.id, "2026-05-15T08:00:00.000Z"),
        buildSchedule(overdue.id, "2026-05-13T08:00:00.000Z"),
        buildSchedule(dueInUserTimeZone.id, "2026-05-16T03:30:00.000Z"),
        buildSchedule(future.id, "2026-05-16T08:00:00.000Z"),
        buildSchedule(incomplete.id, "2026-05-15T08:00:00.000Z"),
        buildSchedule(unresolvedRepair.id, "2026-05-15T07:00:00.000Z"),
      ],
      sessionResults: [
        buildSessionResultWithPracticeRepair({
          correction:
            "State ATP and explain that it stores transferable energy.",
          lifecycle: {
            completedAt: "2026-05-14T09:10:00.000Z",
          },
          prompt: "Due with follow-up",
          questionResultId: "question-due-follow-up",
          resultId: "result-due-follow-up",
          studyNote: dueFollowUp,
        }),
        buildSessionResultWithPracticeRepair({
          correction: "Repair the answer before scheduled recall.",
          prompt: "Unresolved repair note",
          questionResultId: "question-unresolved-repair",
          resultId: "result-unresolved-repair",
          studyNote: unresolvedRepair,
        }),
      ],
      studyNotes: [
        future,
        dueNeedsPractice,
        unresolvedRepair,
        incomplete,
        overdue,
        dueFollowUp,
        dueInUserTimeZone,
      ],
      userTimeZone: "America/New_York",
    });

    expect(
      plan.dueForRecallQueue.map((item) => ({
        id: item.studyNote.id,
        nextRecallAt: item.schedule.nextRecallAt,
      })),
    ).toEqual([
      {
        id: overdue.id,
        nextRecallAt: "2026-05-13T08:00:00.000Z",
      },
      {
        id: dueInUserTimeZone.id,
        nextRecallAt: "2026-05-16T03:30:00.000Z",
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

    const plan = planRecallWork({
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
      plan.recallTodayQueue.map((item) => ({
        id: item.studyNote.id,
        primaryReason: item.primaryReason,
        reasons: item.reasons,
      })),
    ).toEqual([
      {
        id: needsPracticeAndDue.id,
        primaryReason: "needs-practice",
        reasons: ["needs-practice", "due-for-recall"],
      },
      {
        id: notRecalled.id,
        primaryReason: "not-recalled",
        reasons: ["not-recalled"],
      },
      {
        id: dueForRecall.id,
        primaryReason: "due-for-recall",
        reasons: ["due-for-recall"],
      },
    ]);
  });
});
