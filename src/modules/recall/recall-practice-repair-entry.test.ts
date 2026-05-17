import { afterEach, describe, expect, it, vi } from "vitest";

import { createAppNotesContext } from "../notes";
import {
  createAppStudyNotesContext,
  toStudyNoteRecallHistories,
} from "../study-notes";
import {
  AppRecallError,
  createAppRecallContext,
  type SessionResult,
} from "./recall";
import {
  getPracticeRepairEntryLifecycleState,
  type PracticeRepairEntryLifecycle,
  type PracticeRepairIntent,
  type PracticeRepairQuestionReference,
} from "./recall-practice-repair";
import { buildRecallTodayQueue } from "./recall-today";

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

function createWeakStudyNoteResult(input: {
  rating?: "forgot" | "hard";
  recall: ReturnType<typeof createAppRecallContext>;
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
    rating: input.rating ?? "hard",
    sessionId: session.id,
    userId: input.userId,
  });

  return input.recall.listSessionResults({
    userId: input.userId,
  })[0];
}

function createPracticeRepairReference(input: {
  result: SessionResult;
  studyNoteId: string;
}): PracticeRepairQuestionReference {
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

function getConfirmedPracticeRepairReference(
  result: SessionResult,
): PracticeRepairQuestionReference {
  const entry = getConfirmedPracticeRepairEntry(result);

  return entry.reference;
}

function getConfirmedPracticeRepairEntry(result: SessionResult) {
  const entry = result.questions[0]?.practiceRepairEntry;

  if (entry === undefined) {
    throw new Error("Expected a confirmed Practice Repair entry.");
  }

  return entry;
}

function createConfirmedSplitPracticeRepairEntry(input: {
  keyPrefix: string;
  userId: string;
}) {
  const storage = createMemoryStorage();
  const notes = createAppNotesContext({
    keyPrefix: `${input.keyPrefix}-notes`,
    storage,
  });
  const studyNotes = createAppStudyNotesContext({
    keyPrefix: `${input.keyPrefix}-study-notes`,
    storage,
  });
  let sessionCounter = 0;
  const recall = createAppRecallContext({
    crypto: {
      randomUUID: () =>
        `${input.keyPrefix}-session-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
    },
    keyPrefix: `${input.keyPrefix}-recall`,
    notes,
    shuffleNotes: (sessionNotes) => [...sessionNotes],
    storage,
    studyNotes,
  });
  const studyNote = studyNotes.createStudyNote(input.userId, {
    expectedAnswer: "ATP stores transferable energy.",
    prompt: "What stores transferable energy?",
    sourceBody: "Cell respiration source context.",
    sourceTitle: "Cell respiration source",
  });
  const splitResult = recall.confirmPracticeRepairEntry({
    correction: "Narrow the original and break out the transport detail.",
    intent: "split-study-note",
    reference: createPracticeRepairReference({
      result: createWeakStudyNoteResult({
        rating: "forgot",
        recall,
        studyNoteId: studyNote.id,
        userId: input.userId,
      }),
      studyNoteId: studyNote.id,
    }),
    userId: input.userId,
  });

  return {
    recall,
    reference: getConfirmedPracticeRepairReference(splitResult),
    studyNote,
  };
}

type StoredPracticeRepairResultForTest = {
  id: string;
  questions: Array<{
    practiceRepairEntry?: {
      lifecycle?: PracticeRepairEntryLifecycle;
    };
  }>;
};

function markStoredPracticeRepairEntryCompleted(input: {
  completedAt: string;
  resultId: string;
  storage: ReturnType<typeof createMemoryStorage>;
  storageKeyPrefix: string;
}) {
  const storageKey = `${input.storageKeyPrefix}:session-results`;
  const storedSessionResults = JSON.parse(
    input.storage.getItem(storageKey) ?? "[]",
  ) as StoredPracticeRepairResultForTest[];
  const storedResult = storedSessionResults.find(
    (result) => result.id === input.resultId,
  );
  const storedEntry = storedResult?.questions[0]?.practiceRepairEntry;

  if (storedEntry === undefined) {
    throw new Error("Expected a stored Practice Repair Entry.");
  }

  storedEntry.lifecycle = {
    completedAt: input.completedAt,
  };
  input.storage.setItem(storageKey, JSON.stringify(storedSessionResults));
}

function buildRecallTodayQueueFromRecallContext(input: {
  now: string;
  recall: ReturnType<typeof createAppRecallContext>;
  studyNotes: ReturnType<typeof createAppStudyNotesContext>;
  userId: string;
}) {
  return buildRecallTodayQueue({
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

describe("confirmed Practice Repair entries", () => {
  it("stores intent metadata for every v1 intent and keeps next-practice optional", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T14:30:00.000Z"));

    const storage = createMemoryStorage();
    const userId = "user-practice-repair";
    const notes = createAppNotesContext({
      keyPrefix: "practice-repair-entry-notes",
      storage,
    });
    const studyNotes = createAppStudyNotesContext({
      keyPrefix: "practice-repair-entry-study-notes",
      storage,
    });
    let sessionCounter = 0;
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          `practice-repair-session-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "practice-repair-entry-recall",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
      studyNotes,
    });
    const studyNote = studyNotes.createStudyNote(userId, {
      expectedAnswer: "ATP stores transferable energy.",
      prompt: "What stores transferable energy?",
      sourceBody: "Cell respiration source context.",
      sourceTitle: "Cell respiration source",
    });
    const cases: ReadonlyArray<{
      correction: string;
      expectedMetadata: unknown;
      intent: PracticeRepairIntent;
      nextPracticeIdea?: string;
    }> = [
      {
        correction: "Name ATP and the transfer role.",
        expectedMetadata: {
          updatedExpectedAnswer: null,
        },
        intent: "tighten-expected-answer",
        nextPracticeIdea: "Retry once with the source hidden.",
      },
      {
        correction: "Narrow this prompt and break out the transport detail.",
        expectedMetadata: {
          createdStudyNoteIds: [],
          narrowedOriginalStudyNoteAt: null,
        },
        intent: "split-study-note",
      },
      {
        correction: "Create a separate Study Note for the electron carrier.",
        expectedMetadata: {
          createdStudyNoteId: null,
        },
        intent: "create-sibling-study-note",
      },
      {
        correction: "Add a memory hook for ATP as a rechargeable battery.",
        expectedMetadata: {
          memoryAidId: null,
          memoryAidKind: null,
        },
        intent: "add-memory-aid",
      },
    ];

    for (const testCase of cases) {
      const result = createWeakStudyNoteResult({
        recall,
        studyNoteId: studyNote.id,
        userId,
      });

      const updatedResult = recall.confirmPracticeRepairEntry({
        correction: testCase.correction,
        intent: testCase.intent,
        nextPracticeIdea: testCase.nextPracticeIdea,
        reference: createPracticeRepairReference({
          result,
          studyNoteId: studyNote.id,
        }),
        userId,
      });
      const entry = updatedResult.questions[0]?.practiceRepairEntry;

      expect(entry).toMatchObject({
        confirmedAt: "2026-05-16T14:30:00.000Z",
        correction: testCase.correction,
        intent: testCase.intent,
        intentMetadata: testCase.expectedMetadata,
        nextPracticeIdea: testCase.nextPracticeIdea,
      });
    }

    expect(
      recall
        .listSessionResults({
          userId,
        })
        .map((result) => result.questions[0]?.practiceRepairEntry?.intent),
    ).toEqual(expect.arrayContaining(cases.map((testCase) => testCase.intent)));
  });

  it("assigns a durable Practice Repair Entry id and backfills it for legacy stored entries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T14:35:00.000Z"));

    const storage = createMemoryStorage();
    const userId = "user-practice-repair";
    const keyPrefix = "practice-repair-entry-id";
    const notes = createAppNotesContext({
      keyPrefix: `${keyPrefix}-notes`,
      storage,
    });
    const studyNotes = createAppStudyNotesContext({
      keyPrefix: `${keyPrefix}-study-notes`,
      storage,
    });
    const recall = createAppRecallContext({
      keyPrefix: `${keyPrefix}-recall`,
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
      studyNotes,
    });
    const studyNote = studyNotes.createStudyNote(userId, {
      expectedAnswer: "ATP stores transferable energy.",
      prompt: "What stores transferable energy?",
      sourceBody: "Cell respiration source context.",
      sourceTitle: "Cell respiration source",
    });
    const result = createWeakStudyNoteResult({
      recall,
      studyNoteId: studyNote.id,
      userId,
    });
    const confirmedResult = recall.confirmPracticeRepairEntry({
      correction: "State ATP explicitly.",
      intent: "tighten-expected-answer",
      reference: createPracticeRepairReference({
        result,
        studyNoteId: studyNote.id,
      }),
      userId,
    });
    const confirmedEntry = getConfirmedPracticeRepairEntry(confirmedResult);
    const questionResultId = confirmedEntry.reference.questionResultId;

    if (questionResultId === undefined) {
      throw new Error("Expected confirmed Practice Repair question id.");
    }

    const expectedPracticeRepairEntryId = `practice-repair-entry-${questionResultId}`;

    expect(confirmedEntry.practiceRepairEntryId).toBe(
      expectedPracticeRepairEntryId,
    );

    const storageKey = `${keyPrefix}-recall:session-results`;
    const storedSessionResults = JSON.parse(
      storage.getItem(storageKey) ?? "[]",
    ) as Array<{
      questions: Array<{
        practiceRepairEntry?: {
          practiceRepairEntryId?: string;
        };
      }>;
    }>;
    const storedEntry =
      storedSessionResults[0]?.questions[0]?.practiceRepairEntry;

    if (storedEntry === undefined) {
      throw new Error("Expected a stored Practice Repair Entry.");
    }

    delete storedEntry.practiceRepairEntryId;
    storage.setItem(storageKey, JSON.stringify(storedSessionResults));

    const reloadedRecall = createAppRecallContext({
      keyPrefix: `${keyPrefix}-recall`,
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
      studyNotes,
    });
    const reloadedEntry = reloadedRecall.listPracticeRepairEntriesForQuestion({
      reference: getConfirmedPracticeRepairReference(confirmedResult),
      userId,
    })[0];

    expect(reloadedEntry).toMatchObject({
      correction: "State ATP explicitly.",
      practiceRepairEntryId: expectedPracticeRepairEntryId,
      reference: {
        questionResultId: confirmedEntry.reference.questionResultId,
        sessionResultId: confirmedEntry.reference.sessionResultId,
        studyNoteId: studyNote.id,
      },
    });
  });

  it("rejects missing required intent or correction", () => {
    const storage = createMemoryStorage();
    const userId = "user-practice-repair";
    const notes = createAppNotesContext({
      keyPrefix: "practice-repair-entry-validation-notes",
      storage,
    });
    const studyNotes = createAppStudyNotesContext({
      keyPrefix: "practice-repair-entry-validation-study-notes",
      storage,
    });
    const recall = createAppRecallContext({
      keyPrefix: "practice-repair-entry-validation-recall",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
      studyNotes,
    });
    const studyNote = studyNotes.createStudyNote(userId, {
      expectedAnswer: "ATP stores transferable energy.",
      prompt: "What stores transferable energy?",
      sourceBody: "Cell respiration source context.",
      sourceTitle: "Cell respiration source",
    });
    const result = createWeakStudyNoteResult({
      recall,
      studyNoteId: studyNote.id,
      userId,
    });
    const reference = createPracticeRepairReference({
      result,
      studyNoteId: studyNote.id,
    });

    expect(() =>
      recall.confirmPracticeRepairEntry({
        correction: "   ",
        intent: "tighten-expected-answer",
        reference,
        userId,
      }),
    ).toThrowError(
      new AppRecallError(
        "invalid_input",
        "Practice Repair correction is required.",
      ),
    );
    expect(() =>
      recall.confirmPracticeRepairEntry({
        correction: "Name ATP explicitly.",
        intent: "" as PracticeRepairIntent,
        reference,
        userId,
      }),
    ).toThrowError(
      new AppRecallError(
        "invalid_input",
        "Practice Repair intent is required.",
      ),
    );
  });

  it("keeps the original durable entry when the same draft confirmation repeats", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T14:40:00.000Z"));

    const storage = createMemoryStorage();
    const userId = "user-practice-repair";
    const notes = createAppNotesContext({
      keyPrefix: "practice-repair-entry-duplicate-notes",
      storage,
    });
    const studyNotes = createAppStudyNotesContext({
      keyPrefix: "practice-repair-entry-duplicate-study-notes",
      storage,
    });
    const recall = createAppRecallContext({
      keyPrefix: "practice-repair-entry-duplicate-recall",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
      studyNotes,
    });
    const studyNote = studyNotes.createStudyNote(userId, {
      expectedAnswer: "ATP stores transferable energy.",
      prompt: "What stores transferable energy?",
      sourceBody: "Cell respiration source context.",
      sourceTitle: "Cell respiration source",
    });
    const result = createWeakStudyNoteResult({
      recall,
      studyNoteId: studyNote.id,
      userId,
    });
    const reference = createPracticeRepairReference({
      result,
      studyNoteId: studyNote.id,
    });
    const firstConfirmedResult = recall.confirmPracticeRepairEntry({
      correction: "State ATP explicitly.",
      intent: "tighten-expected-answer",
      reference,
      userId,
    });

    vi.setSystemTime(new Date("2026-05-16T14:45:00.000Z"));

    const secondConfirmedResult = recall.confirmPracticeRepairEntry({
      correction: "Split the note instead.",
      intent: "split-study-note",
      reference,
      userId,
    });
    const repeatedEntry = getConfirmedPracticeRepairEntry(
      secondConfirmedResult,
    );
    const firstReference =
      getConfirmedPracticeRepairReference(firstConfirmedResult);
    const repeatedReference = getConfirmedPracticeRepairReference(
      secondConfirmedResult,
    );
    const storedEntries = recall.listPracticeRepairEntriesForQuestion({
      reference,
      userId,
    });

    expect(repeatedEntry).toMatchObject({
      confirmedAt: "2026-05-16T14:40:00.000Z",
      correction: "State ATP explicitly.",
      intent: "tighten-expected-answer",
      intentMetadata: {
        updatedExpectedAnswer: null,
      },
    });
    expect(storedEntries).toHaveLength(1);
    expect(repeatedReference).toEqual(firstReference);
  });

  it("supersedes an older active same-intent entry when a new draft is confirmed for the same Study Note", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T15:00:00.000Z"));

    const storage = createMemoryStorage();
    const userId = "user-practice-repair";
    const notes = createAppNotesContext({
      keyPrefix: "practice-repair-entry-supersede-notes",
      storage,
    });
    const studyNotes = createAppStudyNotesContext({
      keyPrefix: "practice-repair-entry-supersede-study-notes",
      storage,
    });
    let sessionCounter = 0;
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          `practice-repair-supersede-session-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "practice-repair-entry-supersede-recall",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
      studyNotes,
    });
    const studyNote = studyNotes.createStudyNote(userId, {
      expectedAnswer: "ATP stores transferable energy.",
      prompt: "What stores transferable energy?",
      sourceBody: "Cell respiration source context.",
      sourceTitle: "Cell respiration source",
    });
    const firstResult = createWeakStudyNoteResult({
      recall,
      studyNoteId: studyNote.id,
      userId,
    });
    const firstUpdatedResult = recall.confirmPracticeRepairEntry({
      correction: "State ATP explicitly.",
      intent: "tighten-expected-answer",
      reference: createPracticeRepairReference({
        result: firstResult,
        studyNoteId: studyNote.id,
      }),
      userId,
    });

    vi.setSystemTime(new Date("2026-05-16T15:10:00.000Z"));

    const secondResult = createWeakStudyNoteResult({
      rating: "forgot",
      recall,
      studyNoteId: studyNote.id,
      userId,
    });
    const secondUpdatedResult = recall.confirmPracticeRepairEntry({
      correction: "State ATP and explain the energy transfer role.",
      intent: "tighten-expected-answer",
      reference: createPracticeRepairReference({
        result: secondResult,
        studyNoteId: studyNote.id,
      }),
      userId,
    });

    expect(
      recall.listActivePracticeRepairEntriesForStudyNote({
        studyNoteId: studyNote.id,
        userId,
      }),
    ).toMatchObject([
      {
        correction: "State ATP and explain the energy transfer role.",
        intent: "tighten-expected-answer",
        reference:
          secondUpdatedResult.questions[0]?.practiceRepairEntry?.reference,
      },
    ]);
    expect(
      recall.listPracticeRepairEntriesForQuestion({
        reference: getConfirmedPracticeRepairReference(firstUpdatedResult),
        userId,
      }),
    ).toMatchObject([
      {
        correction: "State ATP explicitly.",
        intent: "tighten-expected-answer",
        lifecycle: {
          supersededAt: "2026-05-16T15:10:00.000Z",
        },
      },
    ]);
    expect(
      getPracticeRepairEntryLifecycleState(
        recall.listPracticeRepairEntriesForQuestion({
          reference: getConfirmedPracticeRepairReference(firstUpdatedResult),
          userId,
        })[0] ?? {
          lifecycle: undefined,
        },
      ),
    ).toBe("historical");
  });

  it("updates active correction text and rejects correction edits after the entry becomes historical", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T15:30:00.000Z"));

    const storage = createMemoryStorage();
    const userId = "user-practice-repair";
    const notes = createAppNotesContext({
      keyPrefix: "practice-repair-entry-edit-notes",
      storage,
    });
    const studyNotes = createAppStudyNotesContext({
      keyPrefix: "practice-repair-entry-edit-study-notes",
      storage,
    });
    let sessionCounter = 0;
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          `practice-repair-edit-session-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "practice-repair-entry-edit-recall",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
      studyNotes,
    });
    const studyNote = studyNotes.createStudyNote(userId, {
      expectedAnswer: "ATP stores transferable energy.",
      prompt: "What stores transferable energy?",
      sourceBody: "Cell respiration source context.",
      sourceTitle: "Cell respiration source",
    });
    const result = createWeakStudyNoteResult({
      recall,
      studyNoteId: studyNote.id,
      userId,
    });
    const confirmedResult = recall.confirmPracticeRepairEntry({
      correction: "State ATP explicitly.",
      intent: "tighten-expected-answer",
      reference: createPracticeRepairReference({
        result,
        studyNoteId: studyNote.id,
      }),
      userId,
    });
    const reference = getConfirmedPracticeRepairReference(confirmedResult);

    expect(
      recall.updatePracticeRepairEntryCorrection({
        correction: "  State ATP and explain its energy transfer role.  ",
        reference,
        userId,
      }).questions[0]?.practiceRepairEntry,
    ).toMatchObject({
      correction: "State ATP and explain its energy transfer role.",
    });

    vi.setSystemTime(new Date("2026-05-16T15:35:00.000Z"));

    recall.completePracticeRepairEntry({
      reference,
      userId,
    });

    expect(() =>
      recall.updatePracticeRepairEntryCorrection({
        correction: "This should fail after completion.",
        reference,
        userId,
      }),
    ).toThrowError(
      new AppRecallError(
        "invalid_input",
        "Only active Practice Repair entries can be edited.",
      ),
    );
  });

  it("explicitly completes or dismisses active Practice Repair entries and removes them from active planning work", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T16:00:00.000Z"));

    const storage = createMemoryStorage();
    const userId = "user-practice-repair";
    const notes = createAppNotesContext({
      keyPrefix: "practice-repair-entry-actions-notes",
      storage,
    });
    const studyNotes = createAppStudyNotesContext({
      keyPrefix: "practice-repair-entry-actions-study-notes",
      storage,
    });
    let sessionCounter = 0;
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          `practice-repair-actions-session-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "practice-repair-entry-actions-recall",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
      studyNotes,
    });
    const studyNote = studyNotes.createStudyNote(userId, {
      expectedAnswer: "ATP stores transferable energy.",
      prompt: "What stores transferable energy?",
      sourceBody: "Cell respiration source context.",
      sourceTitle: "Cell respiration source",
    });
    const completedResult = recall.confirmPracticeRepairEntry({
      correction: "State ATP explicitly.",
      intent: "tighten-expected-answer",
      reference: createPracticeRepairReference({
        result: createWeakStudyNoteResult({
          recall,
          studyNoteId: studyNote.id,
          userId,
        }),
        studyNoteId: studyNote.id,
      }),
      userId,
    });

    vi.setSystemTime(new Date("2026-05-16T16:05:00.000Z"));

    expect(
      recall.completePracticeRepairEntry({
        reference: getConfirmedPracticeRepairReference(completedResult),
        userId,
      }).questions[0]?.practiceRepairEntry,
    ).toMatchObject({
      lifecycle: {
        completedAt: "2026-05-16T16:05:00.000Z",
      },
    });
    expect(
      recall.listActivePracticeRepairEntriesForStudyNote({
        studyNoteId: studyNote.id,
        userId,
      }),
    ).toHaveLength(0);

    vi.setSystemTime(new Date("2026-05-16T16:10:00.000Z"));

    const dismissedResult = recall.confirmPracticeRepairEntry({
      correction: "Create a sibling Study Note for the transport detail.",
      intent: "create-sibling-study-note",
      reference: createPracticeRepairReference({
        result: createWeakStudyNoteResult({
          rating: "forgot",
          recall,
          studyNoteId: studyNote.id,
          userId,
        }),
        studyNoteId: studyNote.id,
      }),
      userId,
    });

    vi.setSystemTime(new Date("2026-05-16T16:15:00.000Z"));

    expect(
      recall.dismissPracticeRepairEntry({
        reference: getConfirmedPracticeRepairReference(dismissedResult),
        userId,
      }).questions[0]?.practiceRepairEntry,
    ).toMatchObject({
      lifecycle: {
        dismissedAt: "2026-05-16T16:15:00.000Z",
      },
    });
    expect(
      recall.listActivePracticeRepairEntriesForStudyNote({
        studyNoteId: studyNote.id,
        userId,
      }),
    ).toHaveLength(0);
  });

  it("satisfies later same-Study-Note Practice Follow-ups and removes them from Recall Today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T16:00:00.000Z"));

    const storage = createMemoryStorage();
    const userId = "user-practice-follow-up-satisfaction";
    const notes = createAppNotesContext({
      keyPrefix: "practice-follow-up-satisfaction-notes",
      storage,
    });
    const studyNotes = createAppStudyNotesContext({
      keyPrefix: "practice-follow-up-satisfaction-study-notes",
      storage,
    });
    let sessionCounter = 0;
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          `practice-follow-up-satisfaction-session-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "practice-follow-up-satisfaction-recall",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
      studyNotes,
    });
    const studyNote = studyNotes.createStudyNote(userId, {
      expectedAnswer: "ATP stores transferable energy.",
      prompt: "What stores transferable energy?",
      sourceBody: "Cell respiration source context.",
      sourceTitle: "Cell respiration source",
    });
    const confirmedResult = recall.confirmPracticeRepairEntry({
      correction: "State ATP explicitly.",
      intent: "tighten-expected-answer",
      reference: createPracticeRepairReference({
        result: createWeakStudyNoteResult({
          recall,
          studyNoteId: studyNote.id,
          userId,
        }),
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

    const laterSession = recall.startFlashCardSession({
      studyNoteIds: [studyNote.id],
      userId,
    });

    recall.revealFlashCardAnswer({
      sessionId: laterSession.id,
      userId,
    });
    recall.rateFlashCardAnswer({
      rating: "good",
      sessionId: laterSession.id,
      userId,
    });

    const originalEntry = recall.listPracticeRepairEntriesForQuestion({
      reference: originalReference,
      userId,
    })[0];

    expect(originalEntry).toMatchObject({
      lifecycle: {
        completedAt: "2026-05-16T16:05:00.000Z",
        followUpSatisfiedAt: "2026-05-16T16:10:00.000Z",
      },
      followUpSatisfaction: {
        questionReference: {
          questionIndex: 0,
          questionResultId:
            "practice-follow-up-satisfaction-session-2-question-0",
          sessionResultId: "practice-follow-up-satisfaction-session-2",
          studyNoteId: studyNote.id,
        },
        rating: "good",
        satisfiedAt: "2026-05-16T16:10:00.000Z",
      },
    });

    const queue = buildRecallTodayQueueFromRecallContext({
      now: "2026-05-16T16:10:00.000Z",
      recall,
      studyNotes,
      userId,
    });

    expect(queue).toEqual([]);
  });

  it("does not satisfy a Practice Follow-up when later recall attempts target another Study Note", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T16:00:00.000Z"));

    const storage = createMemoryStorage();
    const userId = "user-practice-follow-up-other-study-note";
    const notes = createAppNotesContext({
      keyPrefix: "practice-follow-up-other-study-note-notes",
      storage,
    });
    const studyNotes = createAppStudyNotesContext({
      keyPrefix: "practice-follow-up-other-study-note-study-notes",
      storage,
    });
    let sessionCounter = 0;
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          `practice-follow-up-other-study-note-session-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "practice-follow-up-other-study-note-recall",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
      studyNotes,
    });
    const originalStudyNote = studyNotes.createStudyNote(userId, {
      expectedAnswer: "ATP stores transferable energy.",
      prompt: "What stores transferable energy?",
      sourceBody: "Cell respiration source context.",
      sourceTitle: "Cell respiration source",
    });
    const laterStudyNote = studyNotes.createStudyNote(userId, {
      expectedAnswer: "Mitochondria generate ATP.",
      prompt: "What organelle generates ATP?",
      sourceBody: "Cell organelles source context.",
      sourceTitle: "Cell organelles source",
    });
    const confirmedResult = recall.confirmPracticeRepairEntry({
      correction: "State ATP explicitly.",
      intent: "tighten-expected-answer",
      reference: createPracticeRepairReference({
        result: createWeakStudyNoteResult({
          recall,
          studyNoteId: originalStudyNote.id,
          userId,
        }),
        studyNoteId: originalStudyNote.id,
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

    const laterSession = recall.startFlashCardSession({
      studyNoteIds: [laterStudyNote.id],
      userId,
    });

    recall.revealFlashCardAnswer({
      sessionId: laterSession.id,
      userId,
    });
    recall.rateFlashCardAnswer({
      rating: "good",
      sessionId: laterSession.id,
      userId,
    });

    const originalEntry = recall.listPracticeRepairEntriesForQuestion({
      reference: originalReference,
      userId,
    })[0];

    expect(originalEntry).toMatchObject({
      lifecycle: {
        completedAt: "2026-05-16T16:05:00.000Z",
      },
    });
    expect(originalEntry?.followUpSatisfaction).toBeUndefined();

    const queue = buildRecallTodayQueueFromRecallContext({
      now: "2026-05-16T16:10:00.000Z",
      recall,
      studyNotes,
      userId,
    });

    expect(
      queue.find((item) => item.studyNote.id === originalStudyNote.id),
    ).toMatchObject({
      reasons: ["practice-follow-up", "needs-practice"],
      studyNote: {
        id: originalStudyNote.id,
      },
    });
  });

  it("satisfies the original Practice Follow-up after later Hard recall and allows a new repair path", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T16:00:00.000Z"));

    const storage = createMemoryStorage();
    const userId = "user-practice-follow-up-hard-recall";
    const notes = createAppNotesContext({
      keyPrefix: "practice-follow-up-hard-recall-notes",
      storage,
    });
    const studyNotes = createAppStudyNotesContext({
      keyPrefix: "practice-follow-up-hard-recall-study-notes",
      storage,
    });
    let sessionCounter = 0;
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          `practice-follow-up-hard-recall-session-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "practice-follow-up-hard-recall-recall",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
      studyNotes,
    });
    const studyNote = studyNotes.createStudyNote(userId, {
      expectedAnswer: "ATP stores transferable energy.",
      prompt: "What stores transferable energy?",
      sourceBody: "Cell respiration source context.",
      sourceTitle: "Cell respiration source",
    });
    const confirmedResult = recall.confirmPracticeRepairEntry({
      correction: "State ATP explicitly.",
      intent: "tighten-expected-answer",
      reference: createPracticeRepairReference({
        result: createWeakStudyNoteResult({
          recall,
          studyNoteId: studyNote.id,
          userId,
        }),
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

    const laterSession = recall.startFlashCardSession({
      studyNoteIds: [studyNote.id],
      userId,
    });

    recall.revealFlashCardAnswer({
      sessionId: laterSession.id,
      userId,
    });
    recall.rateFlashCardAnswer({
      rating: "hard",
      sessionId: laterSession.id,
      userId,
    });

    const originalEntry = recall.listPracticeRepairEntriesForQuestion({
      reference: originalReference,
      userId,
    })[0];
    const laterResult = recall.listSessionResults({
      userId,
    })[0];
    const laterQuestionResultId = laterResult?.questions[0]?.questionResultId;

    expect(originalEntry).toMatchObject({
      lifecycle: {
        completedAt: "2026-05-16T16:05:00.000Z",
        followUpSatisfiedAt: "2026-05-16T16:10:00.000Z",
      },
      followUpSatisfaction: {
        rating: "hard",
      },
    });
    expect(laterQuestionResultId).toBe(
      "practice-follow-up-hard-recall-session-2-question-0",
    );

    const queue = buildRecallTodayQueueFromRecallContext({
      now: "2026-05-16T16:10:00.000Z",
      recall,
      studyNotes,
      userId,
    });

    expect(
      queue.find((item) => item.studyNote.id === studyNote.id),
    ).toMatchObject({
      reasons: ["needs-practice"],
      studyNote: {
        id: studyNote.id,
      },
    });

    if (laterResult === undefined || laterQuestionResultId === undefined) {
      throw new Error("Expected the later hard-recall result to exist.");
    }

    const replacementRepair = recall.confirmPracticeRepairEntry({
      correction: "Clarify ATP as the cell's transferable energy store.",
      intent: "tighten-expected-answer",
      reference: {
        questionIndex: 0,
        questionResultId: laterQuestionResultId,
        sessionResultId: laterResult.id,
        studyNoteId: studyNote.id,
      },
      userId,
    });

    expect(replacementRepair.questions[0]?.practiceRepairEntry).toMatchObject({
      correction: "Clarify ATP as the cell's transferable energy store.",
      reference: {
        questionResultId: laterQuestionResultId,
        sessionResultId: laterResult.id,
      },
    });
    expect(
      recall.listPracticeRepairEntriesForQuestion({
        reference: originalReference,
        userId,
      })[0],
    ).toMatchObject({
      followUpSatisfaction: {
        rating: "hard",
      },
      lifecycle: {
        followUpSatisfiedAt: "2026-05-16T16:10:00.000Z",
      },
    });
  });

  it("records linked completion evidence for expected-answer edits, sibling creation, and memory aids", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T16:20:00.000Z"));

    const storage = createMemoryStorage();
    const userId = "user-practice-repair-linked-actions";
    const recallStorageKeyPrefix =
      "practice-repair-entry-linked-actions-recall";
    const notes = createAppNotesContext({
      keyPrefix: "practice-repair-entry-linked-actions-notes",
      storage,
    });
    const studyNotes = createAppStudyNotesContext({
      keyPrefix: "practice-repair-entry-linked-actions-study-notes",
      storage,
    });
    let sessionCounter = 0;
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          `practice-repair-linked-actions-session-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: recallStorageKeyPrefix,
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
      studyNotes,
    });
    const studyNote = studyNotes.createStudyNote(userId, {
      expectedAnswer: "ATP stores transferable energy.",
      prompt: "What stores transferable energy?",
      sourceBody: "Cell respiration source context.",
      sourceTitle: "Cell respiration source",
    });
    const expectedAnswerResult = recall.confirmPracticeRepairEntry({
      correction: "Tighten the expected answer to state ATP directly.",
      intent: "tighten-expected-answer",
      reference: createPracticeRepairReference({
        result: createWeakStudyNoteResult({
          rating: "hard",
          recall,
          studyNoteId: studyNote.id,
          userId,
        }),
        studyNoteId: studyNote.id,
      }),
      userId,
    });

    vi.setSystemTime(new Date("2026-05-16T16:22:00.000Z"));

    expect(
      recall.completeLinkedPracticeRepairEntry({
        intent: "tighten-expected-answer",
        intentMetadata: {
          updatedExpectedAnswer:
            "ATP stores transferable energy for cell work.",
        },
        reference: getConfirmedPracticeRepairReference(expectedAnswerResult),
        userId,
      }).questions[0]?.practiceRepairEntry,
    ).toMatchObject({
      intentMetadata: {
        updatedExpectedAnswer: "ATP stores transferable energy for cell work.",
      },
      lifecycle: {
        completedAt: "2026-05-16T16:22:00.000Z",
      },
    });

    const siblingResult = recall.confirmPracticeRepairEntry({
      correction: "Create a sibling Study Note for the transport detail.",
      intent: "create-sibling-study-note",
      reference: createPracticeRepairReference({
        result: createWeakStudyNoteResult({
          rating: "forgot",
          recall,
          studyNoteId: studyNote.id,
          userId,
        }),
        studyNoteId: studyNote.id,
      }),
      userId,
    });

    vi.setSystemTime(new Date("2026-05-16T16:25:00.000Z"));

    expect(
      recall.completeLinkedPracticeRepairEntry({
        intent: "create-sibling-study-note",
        intentMetadata: {
          createdStudyNoteId: "study-note-sibling-2",
        },
        reference: getConfirmedPracticeRepairReference(siblingResult),
        userId,
      }).questions[0]?.practiceRepairEntry,
    ).toMatchObject({
      intentMetadata: {
        createdStudyNoteId: "study-note-sibling-2",
      },
      lifecycle: {
        completedAt: "2026-05-16T16:25:00.000Z",
      },
    });

    const memoryAidResult = recall.confirmPracticeRepairEntry({
      correction: "Add a memory hook for ATP.",
      intent: "add-memory-aid",
      reference: createPracticeRepairReference({
        result: createWeakStudyNoteResult({
          recall,
          studyNoteId: studyNote.id,
          userId,
        }),
        studyNoteId: studyNote.id,
      }),
      userId,
    });

    vi.setSystemTime(new Date("2026-05-16T16:30:00.000Z"));

    expect(
      recall.completeLinkedPracticeRepairEntry({
        intent: "add-memory-aid",
        intentMetadata: {
          memoryAidId: `${studyNote.id}:acronym`,
          memoryAidKind: "Acronym",
        },
        reference: getConfirmedPracticeRepairReference(memoryAidResult),
        userId,
      }).questions[0]?.practiceRepairEntry,
    ).toMatchObject({
      intentMetadata: {
        memoryAidId: `${studyNote.id}:acronym`,
        memoryAidKind: "Acronym",
      },
      lifecycle: {
        completedAt: "2026-05-16T16:30:00.000Z",
      },
    });

    const reloadedRecall = createAppRecallContext({
      keyPrefix: recallStorageKeyPrefix,
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
      studyNotes,
    });

    expect(
      reloadedRecall.listPracticeRepairEntriesForQuestion({
        reference: getConfirmedPracticeRepairReference(expectedAnswerResult),
        userId,
      })[0],
    ).toMatchObject({
      intentMetadata: {
        updatedExpectedAnswer: "ATP stores transferable energy for cell work.",
      },
      lifecycle: {
        completedAt: "2026-05-16T16:22:00.000Z",
      },
    });
  });

  it("keeps split-study-note active until sibling creation and original narrowing are both recorded", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T16:20:00.000Z"));

    const userId = "user-practice-repair-linked-split";
    const { recall, reference, studyNote } =
      createConfirmedSplitPracticeRepairEntry({
        keyPrefix: "practice-repair-entry-linked-split",
        userId,
      });

    vi.setSystemTime(new Date("2026-05-16T16:25:00.000Z"));

    expect(
      recall.completeLinkedPracticeRepairEntry({
        intent: "split-study-note",
        intentMetadata: {
          createdStudyNoteIds: ["study-note-sibling-2"],
          narrowedOriginalStudyNoteAt: null,
        },
        reference,
        userId,
      }).questions[0]?.practiceRepairEntry,
    ).toMatchObject({
      intentMetadata: {
        createdStudyNoteIds: ["study-note-sibling-2"],
        narrowedOriginalStudyNoteAt: null,
      },
      lifecycle: undefined,
    });
    expect(
      recall.listActivePracticeRepairEntriesForStudyNote({
        studyNoteId: studyNote.id,
        userId,
      }),
    ).toHaveLength(1);

    vi.setSystemTime(new Date("2026-05-16T16:30:00.000Z"));

    expect(
      recall.completeLinkedPracticeRepairEntry({
        intent: "split-study-note",
        intentMetadata: {
          createdStudyNoteIds: [],
          narrowedOriginalStudyNoteAt: "2026-05-16T16:30:00.000Z",
        },
        reference,
        userId,
      }).questions[0]?.practiceRepairEntry,
    ).toMatchObject({
      intentMetadata: {
        createdStudyNoteIds: ["study-note-sibling-2"],
        narrowedOriginalStudyNoteAt: "2026-05-16T16:30:00.000Z",
      },
      lifecycle: {
        completedAt: "2026-05-16T16:30:00.000Z",
      },
    });
  });

  it("keeps split-study-note active when the original is narrowed before any sibling is created", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T16:20:00.000Z"));

    const userId = "user-practice-repair-linked-split-missing-sibling";
    const { recall, reference, studyNote } =
      createConfirmedSplitPracticeRepairEntry({
        keyPrefix: "practice-repair-entry-linked-split-missing-sibling",
        userId,
      });

    vi.setSystemTime(new Date("2026-05-16T16:25:00.000Z"));

    expect(
      recall.completeLinkedPracticeRepairEntry({
        intent: "split-study-note",
        intentMetadata: {
          createdStudyNoteIds: [],
          narrowedOriginalStudyNoteAt: "2026-05-16T16:25:00.000Z",
        },
        reference,
        userId,
      }).questions[0]?.practiceRepairEntry,
    ).toMatchObject({
      intentMetadata: {
        createdStudyNoteIds: [],
        narrowedOriginalStudyNoteAt: "2026-05-16T16:25:00.000Z",
      },
      lifecycle: undefined,
    });
    expect(
      recall.listActivePracticeRepairEntriesForStudyNote({
        studyNoteId: studyNote.id,
        userId,
      }),
    ).toHaveLength(1);

    vi.setSystemTime(new Date("2026-05-16T16:30:00.000Z"));

    expect(
      recall.completeLinkedPracticeRepairEntry({
        intent: "split-study-note",
        intentMetadata: {
          createdStudyNoteIds: ["study-note-sibling-2"],
          narrowedOriginalStudyNoteAt: null,
        },
        reference,
        userId,
      }).questions[0]?.practiceRepairEntry,
    ).toMatchObject({
      intentMetadata: {
        createdStudyNoteIds: ["study-note-sibling-2"],
        narrowedOriginalStudyNoteAt: "2026-05-16T16:25:00.000Z",
      },
      lifecycle: {
        completedAt: "2026-05-16T16:30:00.000Z",
      },
    });
  });

  it("rejects linked completion evidence when the action does not match the active intent", () => {
    const storage = createMemoryStorage();
    const userId = "user-practice-repair-linked-action-mismatch";
    const notes = createAppNotesContext({
      keyPrefix: "practice-repair-entry-linked-action-mismatch-notes",
      storage,
    });
    const studyNotes = createAppStudyNotesContext({
      keyPrefix: "practice-repair-entry-linked-action-mismatch-study-notes",
      storage,
    });
    const recall = createAppRecallContext({
      keyPrefix: "practice-repair-entry-linked-action-mismatch-recall",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
      studyNotes,
    });
    const studyNote = studyNotes.createStudyNote(userId, {
      expectedAnswer: "ATP stores transferable energy.",
      prompt: "What stores transferable energy?",
      sourceBody: "Cell respiration source context.",
      sourceTitle: "Cell respiration source",
    });
    const confirmedResult = recall.confirmPracticeRepairEntry({
      correction: "Create a sibling Study Note for the transport detail.",
      intent: "create-sibling-study-note",
      reference: createPracticeRepairReference({
        result: createWeakStudyNoteResult({
          recall,
          studyNoteId: studyNote.id,
          userId,
        }),
        studyNoteId: studyNote.id,
      }),
      userId,
    });

    expect(() =>
      recall.completeLinkedPracticeRepairEntry({
        intent: "add-memory-aid",
        intentMetadata: {
          memoryAidId: `${studyNote.id}:acronym`,
          memoryAidKind: "Acronym",
        },
        reference: getConfirmedPracticeRepairReference(confirmedResult),
        userId,
      }),
    ).toThrowError(
      new AppRecallError(
        "invalid_input",
        "This linked action does not match the active Practice Repair intent.",
      ),
    );
  });

  it("lists active entries by Study Note and keeps Results-context lookups for historical entries", () => {
    const storage = createMemoryStorage();
    const userId = "user-practice-repair";
    const notes = createAppNotesContext({
      keyPrefix: "practice-repair-entry-query-notes",
      storage,
    });
    const studyNotes = createAppStudyNotesContext({
      keyPrefix: "practice-repair-entry-query-study-notes",
      storage,
    });
    let sessionCounter = 0;
    const recallStorageKeyPrefix = "practice-repair-entry-query-recall";
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          `practice-repair-query-session-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: recallStorageKeyPrefix,
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
      studyNotes,
    });
    const studyNote = studyNotes.createStudyNote(userId, {
      expectedAnswer: "ATP stores transferable energy.",
      prompt: "What stores transferable energy?",
      sourceBody: "Cell respiration source context.",
      sourceTitle: "Cell respiration source",
    });
    const firstResult = createWeakStudyNoteResult({
      recall,
      studyNoteId: studyNote.id,
      userId,
    });
    const firstUpdatedResult = recall.confirmPracticeRepairEntry({
      correction: "State ATP explicitly.",
      intent: "tighten-expected-answer",
      reference: createPracticeRepairReference({
        result: firstResult,
        studyNoteId: studyNote.id,
      }),
      userId,
    });
    const secondResult = createWeakStudyNoteResult({
      rating: "forgot",
      recall,
      studyNoteId: studyNote.id,
      userId,
    });
    const secondUpdatedResult = recall.confirmPracticeRepairEntry({
      correction: "Split the transport detail into a sibling Study Note.",
      intent: "create-sibling-study-note",
      reference: createPracticeRepairReference({
        result: secondResult,
        studyNoteId: studyNote.id,
      }),
      userId,
    });
    markStoredPracticeRepairEntryCompleted({
      completedAt: "2026-05-16T16:00:00.000Z",
      resultId: firstUpdatedResult.id,
      storage,
      storageKeyPrefix: recallStorageKeyPrefix,
    });

    const reloadedRecall = createAppRecallContext({
      keyPrefix: recallStorageKeyPrefix,
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
      studyNotes,
    });
    const activeEntries =
      reloadedRecall.listActivePracticeRepairEntriesForStudyNote({
        studyNoteId: studyNote.id,
        userId,
      });
    const historicalEntries =
      reloadedRecall.listPracticeRepairEntriesForQuestion({
        reference: getConfirmedPracticeRepairReference(firstUpdatedResult),
        userId,
      });

    expect(activeEntries).toMatchObject([
      {
        correction: "Split the transport detail into a sibling Study Note.",
        intent: "create-sibling-study-note",
        reference:
          secondUpdatedResult.questions[0]?.practiceRepairEntry?.reference,
      },
    ]);
    expect(activeEntries).toHaveLength(1);
    expect(historicalEntries).toMatchObject([
      {
        correction: "State ATP explicitly.",
        intent: "tighten-expected-answer",
      },
    ]);
    expect(historicalEntries).toHaveLength(1);

    const activeEntry = activeEntries[0];
    const historicalEntry = historicalEntries[0];

    if (activeEntry === undefined || historicalEntry === undefined) {
      throw new Error(
        "Expected active and historical Practice Repair entries.",
      );
    }

    expect(getPracticeRepairEntryLifecycleState(activeEntry)).toBe("active");
    expect(getPracticeRepairEntryLifecycleState(historicalEntry)).toBe(
      "historical",
    );
  });
});
