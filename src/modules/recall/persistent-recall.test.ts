import { describe, expect, it, vi } from "vitest";
import {
  type AppPersistentRecallService,
  createPersistentRecallContext,
} from "./persistent-recall";
import type { RecallQuestion, RecallSession, SessionResult } from "./recall";
import type { RecallSchedule } from "./recall-schedule";

function createQuestion(
  override: Partial<RecallQuestion> & Pick<RecallQuestion, "noteId">,
): RecallQuestion {
  const { noteId, ...rest } = override;

  return {
    isAnswerRevealed: false,
    noteId,
    noteSnapshot: {
      acronyms: [],
      body: "Stored body",
      createdAt: "2026-05-02T12:00:00.000Z",
      id: noteId,
      labelIds: [],
      metaphors: [],
      title: "Stored title",
      updatedAt: "2026-05-02T12:00:00.000Z",
    },
    selfRating: null,
    typedAnswer: "",
    ...rest,
  };
}

function createSession(
  override: Partial<RecallSession> & Pick<RecallSession, "id">,
): RecallSession {
  const { id, ...rest } = override;
  const noteId = override.notes?.[0]?.id ?? "note-1";

  return {
    attempts: [],
    createdAt: "2026-05-02T12:00:00.000Z",
    currentIndex: 0,
    currentQuestionIndex: 0,
    draftAnswer: "",
    id,
    isAnswerRevealed: false,
    mode: "FlashCard",
    notes: [
      {
        acronyms: [],
        body: "Stored body",
        createdAt: "2026-05-02T12:00:00.000Z",
        id: noteId,
        labelIds: [],
        metaphors: [],
        title: "Stored title",
        updatedAt: "2026-05-02T12:00:00.000Z",
      },
    ],
    questions: [createQuestion({ noteId })],
    ...rest,
  };
}

function createResult(
  override: Partial<SessionResult> & Pick<SessionResult, "id">,
): SessionResult {
  const { id, ...rest } = override;
  const noteId = override.notes?.[0]?.id ?? "note-1";

  return {
    attempts: [],
    completedAt: "2026-05-02T12:10:00.000Z",
    createdAt: "2026-05-02T12:00:00.000Z",
    id,
    mode: "FlashCard",
    notes: [
      {
        acronyms: [],
        body: "Stored body",
        createdAt: "2026-05-02T12:00:00.000Z",
        id: noteId,
        labelIds: [],
        metaphors: [],
        title: "Stored title",
        updatedAt: "2026-05-02T12:00:00.000Z",
      },
    ],
    questions: [createQuestion({ noteId, selfRating: "hard" })],
    ...rest,
  };
}

function createSchedule(
  override: Partial<RecallSchedule> & Pick<RecallSchedule, "studyNoteId">,
): RecallSchedule {
  return {
    ease: 2.5,
    intervalDays: 0,
    lastRecalledAt: null,
    nextRecallAt: "2026-05-02T12:00:00.000Z",
    repetitionCount: 0,
    ...override,
  };
}

describe("createPersistentRecallContext", () => {
  it("refreshes and mutates the in-memory recall snapshot from the async recall service", async () => {
    let activeSession: RecallSession | null = createSession({
      currentIndex: 1,
      currentQuestionIndex: 1,
      id: "session-1",
      isAnswerRevealed: true,
      questions: [
        createQuestion({
          isAnswerRevealed: false,
          noteId: "note-1",
          selfRating: "easy",
        }),
        createQuestion({
          isAnswerRevealed: true,
          noteId: "note-2",
          noteSnapshot: {
            acronyms: [],
            body: "Second body",
            createdAt: "2026-05-02T12:01:00.000Z",
            id: "note-2",
            labelIds: [],
            metaphors: [],
            title: "Second note",
            updatedAt: "2026-05-02T12:01:00.000Z",
          },
        }),
      ],
      notes: [
        {
          acronyms: [],
          body: "Stored body",
          createdAt: "2026-05-02T12:00:00.000Z",
          id: "note-1",
          labelIds: [],
          metaphors: [],
          title: "Stored title",
          updatedAt: "2026-05-02T12:00:00.000Z",
        },
        {
          acronyms: [],
          body: "Second body",
          createdAt: "2026-05-02T12:01:00.000Z",
          id: "note-2",
          labelIds: [],
          metaphors: [],
          title: "Second note",
          updatedAt: "2026-05-02T12:01:00.000Z",
        },
      ],
    });
    let sessionResults: SessionResult[] = [
      createResult({
        id: "result-1",
      }),
    ];
    let recallSchedules: RecallSchedule[] = [
      createSchedule({
        intervalDays: 1,
        lastRecalledAt: "2026-05-01T12:00:00.000Z",
        nextRecallAt: "2026-05-02T12:00:00.000Z",
        repetitionCount: 1,
        studyNoteId: "note-2",
      }),
    ];

    const service: AppPersistentRecallService = {
      completePracticeRepairEntry: vi.fn(async () => {
        throw new Error("not used");
      }),
      completeLinkedPracticeRepairEntry: vi.fn(async () => {
        throw new Error("not used");
      }),
      confirmPracticeRepairEntry: vi.fn(
        async ({ correction, intent, reference }) => {
          const existingResult = sessionResults.find(
            (result) => result.id === reference.sessionResultId,
          );

          if (existingResult === undefined) {
            throw new Error("Missing result");
          }

          const updatedResult = {
            ...existingResult,
            questions: existingResult.questions.map((question, index) =>
              index === reference.questionIndex
                ? {
                    ...question,
                    practiceRepairEntry: {
                      confirmedAt: "2026-05-02T12:15:00.000Z",
                      correction,
                      intent,
                      intentMetadata: {
                        updatedExpectedAnswer: null,
                      },
                      practiceRepairEntryId:
                        "practice-repair-entry-result-weak-question-0",
                      reference: {
                        ...reference,
                        questionResultId:
                          question.questionResultId ??
                          reference.questionResultId,
                      },
                    },
                  }
                : question,
            ),
          } satisfies SessionResult;

          sessionResults = [
            updatedResult,
            ...sessionResults.filter(
              (result) => result.id !== updatedResult.id,
            ),
          ];

          return updatedResult;
        },
      ),
      dismissPracticeRepairEntry: vi.fn(async () => {
        throw new Error("not used");
      }),
      endRecallSession: vi.fn(async () => {
        if (activeSession === null) {
          throw new Error("Missing session");
        }

        const endedSession = activeSession;
        sessionResults = [
          createResult({
            attempts: endedSession.attempts,
            completedAt: "2026-05-02T12:20:00.000Z",
            createdAt: endedSession.createdAt,
            id: endedSession.id,
            notes: endedSession.notes,
            questions: endedSession.questions,
          }),
          ...sessionResults.filter((result) => result.id !== endedSession.id),
        ];
        activeSession = null;

        return endedSession;
      }),
      getActiveSession: vi.fn(async () => activeSession),
      listRecallSchedules: vi.fn(async () => recallSchedules),
      listSessionResults: vi.fn(async () => sessionResults),
      rateFlashCardAnswer: vi.fn(async ({ rating }) => {
        if (activeSession === null) {
          throw new Error("Missing session");
        }

        const ratedSession = {
          ...activeSession,
          attempts: [
            ...activeSession.attempts,
            {
              noteId: "note-2",
              rating,
              text: activeSession.draftAnswer?.trim() || null,
            },
          ],
          currentIndex: 2,
          currentQuestionIndex: 2,
          draftAnswer: "",
          isAnswerRevealed: false,
          questions: activeSession.questions.map((question, index) =>
            index === 1
              ? {
                  ...question,
                  isAnswerRevealed: false,
                  selfRating: rating,
                  typedAnswer: activeSession?.draftAnswer ?? "",
                }
              : question,
          ),
        } satisfies RecallSession;

        activeSession = null;
        recallSchedules = [
          createSchedule({
            intervalDays: 3,
            lastRecalledAt: "2026-05-02T12:30:00.000Z",
            nextRecallAt: "2026-05-05T12:30:00.000Z",
            repetitionCount: 2,
            studyNoteId: "note-2",
          }),
        ];
        sessionResults = [
          createResult({
            attempts: ratedSession.attempts,
            completedAt: "2026-05-02T12:30:00.000Z",
            createdAt: ratedSession.createdAt,
            id: ratedSession.id,
            notes: ratedSession.notes,
            questions: ratedSession.questions,
          }),
          ...sessionResults.filter((result) => result.id !== ratedSession.id),
        ];

        return null;
      }),
      revealFlashCardAnswer: vi.fn(async () => {
        if (activeSession === null) {
          throw new Error("Missing session");
        }

        activeSession = {
          ...activeSession,
          isAnswerRevealed: true,
        };

        return activeSession;
      }),
      startFlashCardSession: vi.fn(async ({ noteIds }) => {
        activeSession = createSession({
          id: "session-2",
          notes: noteIds.map((noteId: string, index: number) => ({
            acronyms: [],
            body: `Body ${index + 1}`,
            createdAt: "2026-05-02T12:40:00.000Z",
            id: noteId,
            labelIds: [],
            metaphors: [],
            title: `Note ${index + 1}`,
            updatedAt: "2026-05-02T12:40:00.000Z",
          })),
          questions: noteIds.map((noteId: string) =>
            createQuestion({ noteId }),
          ),
        });

        return activeSession;
      }),
      updatePracticeRepairEntryCorrection: vi.fn(async () => {
        throw new Error("not used");
      }),
      updateFlashCardAttemptText: vi.fn(async ({ text }) => {
        if (activeSession === null) {
          throw new Error("Missing session");
        }

        activeSession = {
          ...activeSession,
          draftAnswer: text,
          questions: activeSession.questions.map((question, index) =>
            index === activeSession?.currentQuestionIndex
              ? {
                  ...question,
                  typedAnswer: text,
                }
              : question,
          ),
        };

        return activeSession;
      }),
    };
    const persistentRecall = createPersistentRecallContext({
      service,
    });

    await expect(persistentRecall.refresh("user-casey")).resolves.toMatchObject(
      {
        activeSession: {
          id: "session-1",
          userId: "user-casey",
        },
        sessionResults: [{ id: "result-1" }],
        recallSchedules: [{ studyNoteId: "note-2" }],
      },
    );

    await expect(
      persistentRecall.updateFlashCardAttemptText("user-casey", {
        sessionId: "session-1",
        text: "Working draft",
      }),
    ).resolves.toMatchObject({
      draftAnswer: "Working draft",
      id: "session-1",
    });
    await expect(
      persistentRecall.revealFlashCardAnswer("user-casey", {
        sessionId: "session-1",
      }),
    ).resolves.toMatchObject({
      id: "session-1",
      isAnswerRevealed: true,
    });
    await expect(
      persistentRecall.rateFlashCardAnswer("user-casey", {
        rating: "hard",
        sessionId: "session-1",
      }),
    ).resolves.toBeNull();
    await expect(
      persistentRecall.startFlashCardSession("user-casey", {
        noteIds: ["note-3"],
      }),
    ).resolves.toMatchObject({
      id: "session-2",
    });
    await expect(
      persistentRecall.endFlashCardSession("user-casey", {
        sessionId: "session-2",
      }),
    ).resolves.toMatchObject({
      id: "session-2",
    });

    expect(persistentRecall.getSnapshot()).toBeNull();
    expect(persistentRecall.getRecallSchedulesSnapshot()).toMatchObject([
      {
        intervalDays: 3,
        nextRecallAt: "2026-05-05T12:30:00.000Z",
        studyNoteId: "note-2",
      },
    ]);
    expect(persistentRecall.getSessionResultsSnapshot()).toMatchObject([
      {
        id: "session-2",
      },
      {
        id: "session-1",
        questions: [
          {
            noteId: "note-1",
            selfRating: "easy",
          },
          {
            noteId: "note-2",
            selfRating: "hard",
            typedAnswer: "Working draft",
          },
        ],
      },
      {
        id: "result-1",
      },
    ]);
  });

  it("refreshes only the authoritative Recall state each async mutation requires", async () => {
    let sessionCounter = 0;
    let activeSession: RecallSession | null = null;
    let sessionResults: SessionResult[] = [];
    let recallSchedules: RecallSchedule[] = [];

    function createStartedSession(noteIds: string[]) {
      const id = `session-${++sessionCounter}`;

      return createSession({
        id,
        notes: noteIds.map((noteId, index) => ({
          acronyms: [],
          body: `Body ${index + 1}`,
          createdAt: "2026-05-02T12:00:00.000Z",
          id: noteId,
          labelIds: [],
          metaphors: [],
          title: `Note ${index + 1}`,
          updatedAt: "2026-05-02T12:00:00.000Z",
        })),
        questions: noteIds.map((noteId, index) =>
          createQuestion({
            noteId,
            noteSnapshot: {
              acronyms: [],
              body: `Body ${index + 1}`,
              createdAt: "2026-05-02T12:00:00.000Z",
              id: noteId,
              labelIds: [],
              metaphors: [],
              title: `Note ${index + 1}`,
              updatedAt: "2026-05-02T12:00:00.000Z",
            },
          }),
        ),
      });
    }

    function storeResult(session: RecallSession, completedAt: string) {
      sessionResults = [
        createResult({
          attempts: session.attempts,
          completedAt,
          createdAt: session.createdAt,
          id: session.id,
          notes: session.notes,
          questions: session.questions,
        }),
        ...sessionResults.filter((result) => result.id !== session.id),
      ];
    }

    const listSessionResults = vi.fn(async () => sessionResults);
    const listRecallSchedules = vi.fn(async () => recallSchedules);
    const service: AppPersistentRecallService = {
      completePracticeRepairEntry: vi.fn(async () => {
        throw new Error("not used");
      }),
      completeLinkedPracticeRepairEntry: vi.fn(async () => {
        throw new Error("not used");
      }),
      confirmPracticeRepairEntry: vi.fn(async () => {
        throw new Error("not used");
      }),
      dismissPracticeRepairEntry: vi.fn(async () => {
        throw new Error("not used");
      }),
      endRecallSession: vi.fn(async () => {
        if (activeSession === null) {
          throw new Error("Missing session");
        }

        const endedSession = activeSession;
        activeSession = null;
        storeResult(endedSession, "2026-05-02T12:40:00.000Z");

        return endedSession;
      }),
      getActiveSession: vi.fn(async () => activeSession),
      listRecallSchedules,
      listSessionResults,
      rateFlashCardAnswer: vi.fn(async ({ rating }) => {
        if (activeSession === null) {
          throw new Error("Missing session");
        }

        const currentQuestionIndex = activeSession.currentQuestionIndex;
        const currentQuestion = activeSession.questions[currentQuestionIndex];

        if (currentQuestion === undefined) {
          throw new Error("Missing question");
        }

        const ratedSession = {
          ...activeSession,
          attempts: [
            ...activeSession.attempts,
            {
              noteId: currentQuestion.noteId,
              rating,
              text: activeSession.draftAnswer?.trim() || null,
            },
          ],
          currentIndex: currentQuestionIndex + 1,
          currentQuestionIndex: currentQuestionIndex + 1,
          draftAnswer: "",
          isAnswerRevealed: false,
          questions: activeSession.questions.map((question, index) =>
            index === currentQuestionIndex
              ? {
                  ...question,
                  isAnswerRevealed: false,
                  selfRating: rating,
                  typedAnswer: activeSession?.draftAnswer ?? "",
                }
              : question,
          ),
        } satisfies RecallSession;

        recallSchedules = [
          createSchedule({
            intervalDays: ratedSession.currentQuestionIndex >= ratedSession.notes.length ? 5 : 3,
            lastRecalledAt:
              ratedSession.currentQuestionIndex >= ratedSession.notes.length
                ? "2026-05-02T12:35:00.000Z"
                : "2026-05-02T12:20:00.000Z",
            nextRecallAt:
              ratedSession.currentQuestionIndex >= ratedSession.notes.length
                ? "2026-05-07T12:35:00.000Z"
                : "2026-05-05T12:20:00.000Z",
            repetitionCount:
              ratedSession.currentQuestionIndex >= ratedSession.notes.length
                ? 2
                : 1,
            studyNoteId: currentQuestion.noteId,
          }),
        ];

        if (ratedSession.currentQuestionIndex >= ratedSession.notes.length) {
          activeSession = null;
          storeResult(ratedSession, "2026-05-02T12:35:00.000Z");

          return null;
        }

        activeSession = ratedSession;

        return ratedSession;
      }),
      revealFlashCardAnswer: vi.fn(async () => {
        if (activeSession === null) {
          throw new Error("Missing session");
        }

        activeSession = {
          ...activeSession,
          isAnswerRevealed: true,
          questions: activeSession.questions.map((question, index) =>
            index === activeSession?.currentQuestionIndex
              ? {
                  ...question,
                  isAnswerRevealed: true,
                }
              : question,
          ),
        };

        return activeSession;
      }),
      skipFlashCardQuestion: vi.fn(async () => {
        if (activeSession === null) {
          throw new Error("Missing session");
        }

        const skippedSession = {
          ...activeSession,
          currentIndex: activeSession.currentQuestionIndex + 1,
          currentQuestionIndex: activeSession.currentQuestionIndex + 1,
          draftAnswer: "",
          isAnswerRevealed: false,
        } satisfies RecallSession;

        if (skippedSession.currentQuestionIndex >= skippedSession.notes.length) {
          activeSession = null;
          storeResult(skippedSession, "2026-05-02T12:50:00.000Z");

          return null;
        }

        activeSession = skippedSession;

        return skippedSession;
      }),
      startFlashCardSession: vi.fn(async ({ noteIds }) => {
        activeSession = createStartedSession(noteIds);

        return activeSession;
      }),
      updatePracticeRepairEntryCorrection: vi.fn(async () => {
        throw new Error("not used");
      }),
      updateFlashCardAttemptText: vi.fn(async ({ text }) => {
        if (activeSession === null) {
          throw new Error("Missing session");
        }

        activeSession = {
          ...activeSession,
          draftAnswer: text,
          questions: activeSession.questions.map((question, index) =>
            index === activeSession?.currentQuestionIndex
              ? {
                  ...question,
                  typedAnswer: text,
                }
              : question,
          ),
        };

        return activeSession;
      }),
    };
    const persistentRecall = createPersistentRecallContext({
      service,
    });

    await persistentRecall.startFlashCardSession("user-casey", {
      noteIds: ["note-1", "note-2"],
    });
    expect(listSessionResults).not.toHaveBeenCalled();
    expect(listRecallSchedules).not.toHaveBeenCalled();

    await persistentRecall.updateFlashCardAttemptText("user-casey", {
      sessionId: "session-1",
      text: "First draft",
    });
    await persistentRecall.revealFlashCardAnswer("user-casey", {
      sessionId: "session-1",
    });
    expect(listSessionResults).not.toHaveBeenCalled();
    expect(listRecallSchedules).not.toHaveBeenCalled();

    await persistentRecall.rateFlashCardAnswer("user-casey", {
      rating: "hard",
      sessionId: "session-1",
    });
    expect(listSessionResults).not.toHaveBeenCalled();
    expect(listRecallSchedules).toHaveBeenCalledTimes(1);

    listSessionResults.mockClear();
    listRecallSchedules.mockClear();

    await persistentRecall.revealFlashCardAnswer("user-casey", {
      sessionId: "session-1",
    });
    await persistentRecall.rateFlashCardAnswer("user-casey", {
      rating: "good",
      sessionId: "session-1",
    });
    expect(listRecallSchedules).toHaveBeenCalledTimes(1);
    expect(listSessionResults).toHaveBeenCalledTimes(1);

    listSessionResults.mockClear();
    listRecallSchedules.mockClear();

    await persistentRecall.startFlashCardSession("user-casey", {
      noteIds: ["note-1", "note-2"],
    });
    await persistentRecall.revealFlashCardAnswer("user-casey", {
      sessionId: "session-2",
    });
    await persistentRecall.rateFlashCardAnswer("user-casey", {
      rating: "hard",
      sessionId: "session-2",
    });

    listSessionResults.mockClear();
    listRecallSchedules.mockClear();

    await persistentRecall.endFlashCardSession("user-casey", {
      sessionId: "session-2",
    });
    expect(listSessionResults).toHaveBeenCalledTimes(1);
    expect(listRecallSchedules).not.toHaveBeenCalled();

    listSessionResults.mockClear();
    listRecallSchedules.mockClear();

    await persistentRecall.startFlashCardSession("user-casey", {
      noteIds: ["note-1", "note-2"],
    });
    await persistentRecall.revealFlashCardAnswer("user-casey", {
      sessionId: "session-3",
    });
    await persistentRecall.rateFlashCardAnswer("user-casey", {
      rating: "good",
      sessionId: "session-3",
    });

    listSessionResults.mockClear();
    listRecallSchedules.mockClear();

    await persistentRecall.skipFlashCardQuestion("user-casey", {
      sessionId: "session-3",
    });
    expect(listSessionResults).toHaveBeenCalledTimes(1);
    expect(listRecallSchedules).not.toHaveBeenCalled();
  });

  it("confirms Practice Repair entries into the persisted results snapshot", async () => {
    let sessionResults: SessionResult[] = [
      createResult({
        id: "result-weak",
        notes: [
          {
            acronyms: [],
            body: "ATP stores transferable energy.",
            createdAt: "2026-05-02T12:00:00.000Z",
            expectedAnswer: "ATP stores transferable energy.",
            id: "study-note-1",
            labelIds: [],
            metaphors: [],
            prompt: "What stores transferable energy?",
            source: {
              body: "Cell respiration source.",
              id: "source-note-1",
              title: "Cell respiration",
              updatedAt: "2026-05-02T12:00:00.000Z",
            },
            sourceNoteId: "source-note-1",
            title: "What stores transferable energy?",
            updatedAt: "2026-05-02T12:00:00.000Z",
          },
        ],
        questions: [
          createQuestion({
            noteId: "study-note-1",
            noteSnapshot: {
              acronyms: [],
              body: "ATP stores transferable energy.",
              createdAt: "2026-05-02T12:00:00.000Z",
              expectedAnswer: "ATP stores transferable energy.",
              id: "study-note-1",
              labelIds: [],
              metaphors: [],
              prompt: "What stores transferable energy?",
              source: {
                body: "Cell respiration source.",
                id: "source-note-1",
                title: "Cell respiration",
                updatedAt: "2026-05-02T12:00:00.000Z",
              },
              sourceNoteId: "source-note-1",
              title: "What stores transferable energy?",
              updatedAt: "2026-05-02T12:00:00.000Z",
            },
            questionResultId: "result-weak-question-0",
            selfRating: "hard",
          }),
        ],
      }),
    ];
    const service: AppPersistentRecallService = {
      completePracticeRepairEntry: vi.fn(async () => {
        throw new Error("not used");
      }),
      completeLinkedPracticeRepairEntry: vi.fn(async () => {
        throw new Error("not used");
      }),
      confirmPracticeRepairEntry: vi.fn(
        async ({ correction, intent, reference }) => {
          const existingResult = sessionResults[0];
          const updatedResult = {
            ...existingResult,
            questions: existingResult.questions.map((question, index) =>
              index === reference.questionIndex
                ? {
                    ...question,
                    practiceRepairEntry: {
                      confirmedAt: "2026-05-02T12:15:00.000Z",
                      correction,
                      intent,
                      intentMetadata: {
                        updatedExpectedAnswer: null,
                      },
                      practiceRepairEntryId:
                        "practice-repair-entry-result-weak-question-0",
                      reference,
                    },
                  }
                : question,
            ),
          } satisfies SessionResult;

          sessionResults = [updatedResult];

          return updatedResult;
        },
      ),
      dismissPracticeRepairEntry: vi.fn(async () => {
        throw new Error("not used");
      }),
      endRecallSession: vi.fn(async () => {
        throw new Error("not used");
      }),
      getActiveSession: vi.fn(async () => null),
      listRecallSchedules: vi.fn(async () => []),
      listSessionResults: vi.fn(async () => sessionResults),
      rateFlashCardAnswer: vi.fn(async () => null),
      revealFlashCardAnswer: vi.fn(async () => {
        throw new Error("not used");
      }),
      startFlashCardSession: vi.fn(async () => {
        throw new Error("not used");
      }),
      updatePracticeRepairEntryCorrection: vi.fn(async () => {
        throw new Error("not used");
      }),
      updateFlashCardAttemptText: vi.fn(async () => {
        throw new Error("not used");
      }),
    };
    const persistentRecall = createPersistentRecallContext({
      service,
    });

    await persistentRecall.refresh("user-casey");
    await expect(
      persistentRecall.confirmPracticeRepairEntry("user-casey", {
        correction: "State ATP and its energy role.",
        intent: "tighten-expected-answer",
        reference: {
          questionIndex: 0,
          questionResultId: "result-weak-question-0",
          sessionResultId: "result-weak",
          studyNoteId: "study-note-1",
        },
      }),
    ).resolves.toMatchObject({
      id: "result-weak",
      questions: [
        {
          practiceRepairEntry: {
            correction: "State ATP and its energy role.",
            intent: "tighten-expected-answer",
            intentMetadata: {
              updatedExpectedAnswer: null,
            },
          },
        },
      ],
    });

    expect(persistentRecall.getSessionResultsSnapshot()).toMatchObject([
      {
        id: "result-weak",
        questions: [
          {
            practiceRepairEntry: {
              correction: "State ATP and its energy role.",
              intent: "tighten-expected-answer",
              intentMetadata: {
                updatedExpectedAnswer: null,
              },
              practiceRepairEntryId:
                "practice-repair-entry-result-weak-question-0",
              reference: {
                questionResultId: "result-weak-question-0",
              },
            },
          },
        ],
      },
    ]);
  });

  it("applies Practice Repair lifecycle mutations into the persisted results snapshot", async () => {
    let sessionResults: SessionResult[] = [
      createResult({
        id: "result-complete",
        questions: [
          createQuestion({
            noteId: "study-note-complete",
            noteSnapshot: {
              acronyms: [],
              body: "ATP stores transferable energy.",
              createdAt: "2026-05-02T12:00:00.000Z",
              expectedAnswer: "ATP stores transferable energy.",
              id: "study-note-complete",
              labelIds: [],
              metaphors: [],
              prompt: "What stores transferable energy?",
              source: {
                body: "Cell respiration source.",
                id: "source-note-complete",
                title: "Cell respiration",
                updatedAt: "2026-05-02T12:00:00.000Z",
              },
              sourceNoteId: "source-note-complete",
              title: "What stores transferable energy?",
              updatedAt: "2026-05-02T12:00:00.000Z",
            },
            practiceRepairEntry: {
              confirmedAt: "2026-05-02T12:15:00.000Z",
              correction: "State ATP directly.",
              intent: "tighten-expected-answer",
              intentMetadata: {
                updatedExpectedAnswer: null,
              },
              practiceRepairEntryId:
                "practice-repair-entry-result-complete-question-0",
              reference: {
                questionIndex: 0,
                questionResultId: "result-complete-question-0",
                sessionResultId: "result-complete",
                studyNoteId: "study-note-complete",
              },
            },
            questionResultId: "result-complete-question-0",
            selfRating: "hard",
          }),
        ],
      }),
      createResult({
        id: "result-dismiss",
        questions: [
          createQuestion({
            noteId: "study-note-dismiss",
            noteSnapshot: {
              acronyms: [],
              body: "NADH carries electrons.",
              createdAt: "2026-05-02T12:00:00.000Z",
              expectedAnswer: "NADH carries electrons.",
              id: "study-note-dismiss",
              labelIds: [],
              metaphors: [],
              prompt: "What carries electrons?",
              source: {
                body: "Electron transport source.",
                id: "source-note-dismiss",
                title: "Electron transport",
                updatedAt: "2026-05-02T12:00:00.000Z",
              },
              sourceNoteId: "source-note-dismiss",
              title: "What carries electrons?",
              updatedAt: "2026-05-02T12:00:00.000Z",
            },
            practiceRepairEntry: {
              confirmedAt: "2026-05-02T12:20:00.000Z",
              correction: "Pause this repair.",
              intent: "tighten-expected-answer",
              intentMetadata: {
                updatedExpectedAnswer: null,
              },
              practiceRepairEntryId:
                "practice-repair-entry-result-dismiss-question-0",
              reference: {
                questionIndex: 0,
                questionResultId: "result-dismiss-question-0",
                sessionResultId: "result-dismiss",
                studyNoteId: "study-note-dismiss",
              },
            },
            questionResultId: "result-dismiss-question-0",
            selfRating: "hard",
          }),
        ],
      }),
    ];

    function updateLifecycleResult(input: {
      completedAt?: string;
      dismissedAt?: string;
      sessionResultId: string;
    }): SessionResult {
      const existingResult = sessionResults.find(
        (result) => result.id === input.sessionResultId,
      );

      if (existingResult === undefined) {
        throw new Error("Missing stored Practice Repair result.");
      }

      const existingEntry = existingResult.questions[0]?.practiceRepairEntry;

      if (existingEntry === undefined) {
        throw new Error("Missing stored Practice Repair entry.");
      }

      const updatedResult = {
        ...existingResult,
        questions: existingResult.questions.map((question, index) =>
          index === 0
            ? {
                ...question,
                practiceRepairEntry: {
                  ...existingEntry,
                  lifecycle: {
                    ...existingEntry.lifecycle,
                    completedAt: input.completedAt,
                    dismissedAt: input.dismissedAt,
                  },
                },
              }
            : question,
        ),
      } satisfies SessionResult;

      sessionResults = [
        updatedResult,
        ...sessionResults.filter((result) => result.id !== updatedResult.id),
      ];

      return updatedResult;
    }

    const service: AppPersistentRecallService = {
      completePracticeRepairEntry: vi.fn(async () =>
        updateLifecycleResult({
          completedAt: "2026-05-02T12:40:00.000Z",
          sessionResultId: "result-complete",
        }),
      ),
      completeLinkedPracticeRepairEntry: vi.fn(async () => {
        throw new Error("not used");
      }),
      confirmPracticeRepairEntry: vi.fn(async () => {
        throw new Error("not used");
      }),
      dismissPracticeRepairEntry: vi.fn(async () =>
        updateLifecycleResult({
          dismissedAt: "2026-05-02T12:45:00.000Z",
          sessionResultId: "result-dismiss",
        }),
      ),
      endRecallSession: vi.fn(async () => {
        throw new Error("not used");
      }),
      getActiveSession: vi.fn(async () => null),
      listRecallSchedules: vi.fn(async () => []),
      listSessionResults: vi.fn(async () => sessionResults),
      rateFlashCardAnswer: vi.fn(async () => null),
      revealFlashCardAnswer: vi.fn(async () => {
        throw new Error("not used");
      }),
      startFlashCardSession: vi.fn(async () => {
        throw new Error("not used");
      }),
      updatePracticeRepairEntryCorrection: vi.fn(async () => {
        throw new Error("not used");
      }),
      updateFlashCardAttemptText: vi.fn(async () => {
        throw new Error("not used");
      }),
    };
    const persistentRecall = createPersistentRecallContext({
      service,
    });

    await persistentRecall.refresh("user-casey");
    await expect(
      persistentRecall.completePracticeRepairEntry("user-casey", {
        reference: {
          questionIndex: 0,
          questionResultId: "result-complete-question-0",
          sessionResultId: "result-complete",
          studyNoteId: "study-note-complete",
        },
      }),
    ).resolves.toMatchObject({
      id: "result-complete",
      questions: [
        {
          practiceRepairEntry: {
            lifecycle: {
              completedAt: "2026-05-02T12:40:00.000Z",
            },
          },
        },
      ],
    });
    await expect(
      persistentRecall.dismissPracticeRepairEntry("user-casey", {
        reference: {
          questionIndex: 0,
          questionResultId: "result-dismiss-question-0",
          sessionResultId: "result-dismiss",
          studyNoteId: "study-note-dismiss",
        },
      }),
    ).resolves.toMatchObject({
      id: "result-dismiss",
      questions: [
        {
          practiceRepairEntry: {
            lifecycle: {
              dismissedAt: "2026-05-02T12:45:00.000Z",
            },
          },
        },
      ],
    });

    expect(persistentRecall.getSessionResultsSnapshot()).toMatchObject([
      {
        id: "result-dismiss",
        questions: [
          {
            practiceRepairEntry: {
              lifecycle: {
                dismissedAt: "2026-05-02T12:45:00.000Z",
              },
            },
          },
        ],
      },
      {
        id: "result-complete",
        questions: [
          {
            practiceRepairEntry: {
              lifecycle: {
                completedAt: "2026-05-02T12:40:00.000Z",
              },
            },
          },
        ],
      },
    ]);
  });
});
