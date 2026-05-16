import { afterEach, describe, expect, it, vi } from "vitest";

import { createAppNotesContext } from "../notes";
import { createAppStudyNotesContext } from "../study-notes";
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
  const reference = result.questions[0]?.practiceRepairEntry?.reference;

  if (reference === undefined) {
    throw new Error("Expected a confirmed Practice Repair reference.");
  }

  return reference;
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
