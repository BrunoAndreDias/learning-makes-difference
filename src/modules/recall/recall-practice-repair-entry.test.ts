import { afterEach, describe, expect, it, vi } from "vitest";

import { createAppNotesContext } from "../notes";
import { createAppStudyNotesContext } from "../study-notes";
import { AppRecallError, createAppRecallContext } from "./recall";
import type { PracticeRepairIntent } from "./recall-practice-repair";

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
        reference: {
          questionIndex: 0,
          questionResultId: `${result.id}-question-0`,
          sessionResultId: result.id,
          studyNoteId: studyNote.id,
        },
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
    const reference = {
      questionIndex: 0,
      questionResultId: `${result.id}-question-0`,
      sessionResultId: result.id,
      studyNoteId: studyNote.id,
    };

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
});
