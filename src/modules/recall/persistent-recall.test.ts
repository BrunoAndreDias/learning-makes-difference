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
});
