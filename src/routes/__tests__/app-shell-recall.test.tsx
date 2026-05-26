// @vitest-environment jsdom

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AppLabel,
  createAppLabelsContext,
} from "../../modules/labels/label-management/labels";
import { createAppNotesContext } from "../../modules/notes";
import {
  type AppPersistentRecallService,
  createAppRecallContext,
  createPersistentRecallContext,
  type RecallAnswerCheckResult,
  type RecallNoteSnapshot,
  type RecallQuestion,
  type RecallSelfRating,
  type RecallSession,
  type SessionResult,
} from "../../modules/recall";
import {
  createPracticeRepairEntryId,
  type PracticeRepairEntry,
  type PracticeRepairEntryLifecycle,
  type PracticeRepairIntent,
} from "../../modules/recall/recall-practice-repair";
import {
  type AppPersistentStudyNotesService,
  type AppStudyNote,
  createAppStudyNotesContext,
  createPersistentStudyNotesContext,
} from "../../modules/study-notes";
import {
  createDeterministicRecallTestContexts,
  createLearningLoopTestContexts,
  createRecallNote,
  createRouteHydratedSessionContext,
  renderRoute,
} from "./app-shell-test-support";

const testUser = {
  displayName: "Jordan Recall",
  email: "jordan.recall@example.com",
  id: "user-recall",
  userLanguage: "en",
} as const;

type DeterministicRecallTestContexts = ReturnType<
  typeof createDeterministicRecallTestContexts
>;
type PersistentStudyNoteRecallTestContexts = Pick<
  DeterministicRecallTestContexts,
  "labelsContext" | "notesContext" | "recallContext" | "studyNotesContext"
> & {
  createRecallContext: () => DeterministicRecallTestContexts["recallContext"];
};

function createSession() {
  return { user: testUser };
}

function completeRecallAt(input: {
  noteId: string;
  rating: RecallSelfRating;
  recallContext: DeterministicRecallTestContexts["recallContext"];
  timestamp: string;
}) {
  vi.setSystemTime(new Date(input.timestamp));
  const session = input.recallContext.startFlashCardSession({
    noteIds: [input.noteId],
    userId: testUser.id,
  });

  input.recallContext.revealFlashCardAnswer({
    sessionId: session.id,
    userId: testUser.id,
  });
  input.recallContext.rateFlashCardAnswer({
    rating: input.rating,
    sessionId: session.id,
    userId: testUser.id,
  });
}

function createPersistentRecallService(
  overrides: Partial<AppPersistentRecallService>,
): AppPersistentRecallService {
  return Object.assign(
    {
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
        throw new Error("not used");
      }),
      getActiveSession: vi.fn(async () => null),
      listRecallSchedules: vi.fn(async () => []),
      listSessionResults: vi.fn(async () => []),
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
    } satisfies AppPersistentRecallService,
    overrides,
  );
}

function createPersistentStudyNotesService(
  overrides: Partial<AppPersistentStudyNotesService>,
): AppPersistentStudyNotesService {
  return Object.assign(
    {
      createStudyNote: vi.fn(async () => {
        throw new Error("not used");
      }),
      createStudyNoteFromSource: vi.fn(async () => {
        throw new Error("not used");
      }),
      deleteStudyNote: vi.fn(async () => {
        throw new Error("not used");
      }),
      listStudyNotes: vi.fn(async () => []),
      updateStudyNote: vi.fn(async () => {
        throw new Error("not used");
      }),
    } satisfies AppPersistentStudyNotesService,
    overrides,
  );
}

function createPendingPromise<T>() {
  return new Promise<T>(() => {});
}

function createStoredRecallNote(
  overrides: Partial<RecallNoteSnapshot> = {},
): RecallNoteSnapshot {
  return {
    acronyms: [],
    body: "Stored answer body.",
    createdAt: "2026-05-07T08:50:00.000Z",
    id: "note-restored",
    labelIds: [],
    metaphors: [],
    title: "Stored prompt title",
    updatedAt: "2026-05-07T08:50:00.000Z",
    ...overrides,
  };
}

function createStoredRecallQuestion(input: {
  note: RecallNoteSnapshot;
  score: number | null;
  selfRating: RecallSelfRating | null;
}): RecallQuestion {
  return {
    isAnswerRevealed: true,
    noteId: input.note.id,
    noteSnapshot: input.note,
    score: input.score,
    selfRating: input.selfRating,
    typedAnswer: "",
  };
}

function createStoredSessionResult(
  overrides: Partial<SessionResult> & {
    note?: RecallNoteSnapshot;
    rating?: RecallSelfRating;
  } = {},
): SessionResult {
  const note = overrides.note ?? createStoredRecallNote();
  const rating = overrides.rating ?? "good";
  const score = overrides.score === undefined ? 75 : overrides.score;

  return {
    attempts: [
      {
        noteId: note.id,
        rating,
      },
    ],
    completedAt: overrides.completedAt ?? "2026-05-07T09:10:00.000Z",
    createdAt: overrides.createdAt ?? "2026-05-07T09:00:00.000Z",
    id: overrides.id ?? "session-restored-result",
    mode: "FlashCard",
    notes: [note],
    questions: [
      createStoredRecallQuestion({
        note,
        score,
        selfRating: rating,
      }),
    ],
    score,
    ...overrides,
  };
}

function getStoredRecallSelfRatingScore(rating: RecallSelfRating) {
  switch (rating) {
    case "forgot":
      return 0;
    case "hard":
      return 50;
    case "good":
      return 75;
    case "easy":
      return 100;
  }
}

function createStoredPracticeRepairResult(
  overrides: {
    correction?: string;
    id?: string;
    intent?: PracticeRepairEntry["intent"];
    lifecycle?: PracticeRepairEntryLifecycle;
    note?: RecallNoteSnapshot;
    practiceRepairEntryId?: string;
    questionResultId?: string;
    rating?: RecallSelfRating;
  } = {},
): SessionResult {
  const note =
    overrides.note ??
    createStoredRecallNote({
      body: "ATP stores transferable energy for cells.",
      expectedAnswer: "ATP stores transferable energy for cells.",
      id: "study-note-practice-repair",
      prompt: "What stores transferable energy?",
      source: {
        body: "Cell respiration source.",
        id: "source-note-practice-repair",
        title: "Cell respiration",
        updatedAt: "2026-05-07T08:50:00.000Z",
      },
      sourceNoteId: "source-note-practice-repair",
      title: "What stores transferable energy?",
    });
  const id = overrides.id ?? "stored-practice-repair-result";
  const questionResultId = overrides.questionResultId ?? `${id}-question-0`;
  const rating = overrides.rating ?? "hard";
  const score = getStoredRecallSelfRatingScore(rating);
  const reference = {
    questionIndex: 0,
    questionResultId,
    sessionResultId: id,
    studyNoteId: note.id,
  };
  const practiceRepairEntry: PracticeRepairEntry = {
    confirmedAt: "2026-05-07T09:15:00.000Z",
    correction: overrides.correction ?? "State ATP directly.",
    intent: overrides.intent ?? "tighten-expected-answer",
    intentMetadata: {
      updatedExpectedAnswer: null,
    },
    lifecycle: overrides.lifecycle,
    practiceRepairEntryId:
      overrides.practiceRepairEntryId ?? createPracticeRepairEntryId(reference),
    reference,
  };

  return createStoredSessionResult({
    id,
    note,
    notes: [note],
    questions: [
      {
        ...createStoredRecallQuestion({
          note,
          score,
          selfRating: rating,
        }),
        noteId: note.id,
        practiceRepairEntry,
        questionResultId,
      },
    ],
    score,
  });
}

function completeMultiQuestionRecall(input: {
  questions: ReadonlyArray<{
    noteId: string;
    rating: RecallSelfRating;
    typedAnswer?: string;
  }>;
  recallContext: DeterministicRecallTestContexts["recallContext"];
  timestamp: string;
}) {
  vi.setSystemTime(new Date(input.timestamp));
  const sessionId = input.recallContext.startFlashCardSession({
    noteIds: input.questions.map((question) => question.noteId),
    userId: testUser.id,
  }).id;

  input.questions.forEach((question) => {
    if (question.typedAnswer !== undefined) {
      input.recallContext.updateFlashCardAttemptText({
        sessionId,
        text: question.typedAnswer,
        userId: testUser.id,
      });
    }

    input.recallContext.revealFlashCardAnswer({
      sessionId,
      userId: testUser.id,
    });
    input.recallContext.rateFlashCardAnswer({
      rating: question.rating,
      sessionId,
      userId: testUser.id,
    });
  });
}

function completeStudyNoteRecallAt(input: {
  rating: RecallSelfRating;
  recallContext: DeterministicRecallTestContexts["recallContext"];
  studyNoteId: string;
  timestamp: string;
}) {
  vi.setSystemTime(new Date(input.timestamp));
  const session = input.recallContext.startFlashCardSession({
    studyNoteIds: [input.studyNoteId],
    userId: testUser.id,
  });

  input.recallContext.revealFlashCardAnswer({
    sessionId: session.id,
    userId: testUser.id,
  });
  input.recallContext.rateFlashCardAnswer({
    rating: input.rating,
    sessionId: session.id,
    userId: testUser.id,
  });
}

function createPersistentStudyNoteRecallTestContexts(
  storageKeyPrefix: string,
): PersistentStudyNoteRecallTestContexts {
  const labelsContext = createAppLabelsContext({
    keyPrefix: `${storageKeyPrefix}-labels`,
    storage: window.localStorage,
  });
  const notesContext = createAppNotesContext({
    getOwnedLabelIdsForUser: (userId) =>
      labelsContext.getLabelsForUser(userId).map((label) => label.id),
    keyPrefix: `${storageKeyPrefix}-notes`,
    storage: window.localStorage,
  });
  const studyNotesContext = createAppStudyNotesContext({
    getOwnedLabelIdsForUser: (userId) =>
      labelsContext.getLabelsForUser(userId).map((label) => label.id),
    keyPrefix: `${storageKeyPrefix}-study-notes`,
    storage: window.localStorage,
  });
  const createRecallContext = () =>
    createAppRecallContext({
      getLabelsForUser: (userId) => labelsContext.getLabelsForUser(userId),
      keyPrefix: `${storageKeyPrefix}-recall`,
      notes: notesContext,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage: window.localStorage,
      studyNotes: studyNotesContext,
    });

  return {
    createRecallContext,
    labelsContext,
    notesContext,
    recallContext: createRecallContext(),
    studyNotesContext,
  };
}

function confirmStudyNotePracticeRepair(input: {
  correction: string;
  contexts: Pick<DeterministicRecallTestContexts, "recallContext">;
  intent: PracticeRepairIntent;
  studyNoteId: string;
}) {
  const questionReference = findStudyNoteQuestionResult({
    results: input.contexts.recallContext.listSessionResults({
      userId: testUser.id,
    }),
    studyNoteId: input.studyNoteId,
  });

  if (questionReference === null) {
    throw new Error("Expected a stored weak-recall result with a question id.");
  }

  return input.contexts.recallContext.confirmPracticeRepairEntry({
    correction: input.correction,
    intent: input.intent,
    reference: {
      questionIndex: questionReference.questionIndex,
      questionResultId: questionReference.questionResultId,
      sessionResultId: questionReference.result.id,
      studyNoteId: input.studyNoteId,
    },
    userId: testUser.id,
  });
}

function findStudyNoteQuestionResult(input: {
  results: readonly SessionResult[];
  studyNoteId: string;
}): {
  questionIndex: number;
  questionResultId: string;
  result: SessionResult;
} | null {
  for (const result of input.results) {
    const questionIndex = result.questions.findIndex(
      (question) => question.noteId === input.studyNoteId,
    );

    if (questionIndex < 0) {
      continue;
    }

    const questionResultId = result.questions[questionIndex]?.questionResultId;

    if (questionResultId !== undefined) {
      return {
        questionIndex,
        questionResultId,
        result,
      };
    }
  }

  return null;
}

function getConfirmedPracticeRepairEntryId(result: SessionResult) {
  const entryId =
    result.questions[0]?.practiceRepairEntry?.practiceRepairEntryId;

  if (entryId === undefined) {
    throw new Error("Expected a durable Practice Repair Entry id.");
  }

  return entryId;
}

function getConfirmedPracticeRepairReference(result: SessionResult) {
  const reference = result.questions[0]?.practiceRepairEntry?.reference;

  if (reference === undefined) {
    throw new Error("Expected a confirmed Practice Repair reference.");
  }

  return reference;
}

function getPracticeRepairEntryPath(
  reference: ReturnType<typeof getConfirmedPracticeRepairReference>,
) {
  return `/practice-repair/${createPracticeRepairEntryId(reference)}`;
}

function getStudyNoteEditorPath(studyNoteId: string) {
  return `/study-notes/${studyNoteId}`;
}

function getConfirmedPracticeRepairPath(result: SessionResult) {
  return getPracticeRepairEntryPath(
    getConfirmedPracticeRepairReference(result),
  );
}

type StudyNoteSnapshotInput = {
  expectedAnswer: string;
  labelIds: string[];
  prompt: string;
  sourceBody: string;
  sourceTitle: string;
};

function updateStudyNoteSnapshot(
  contexts: DeterministicRecallTestContexts,
  studyNoteId: string,
  input: StudyNoteSnapshotInput,
) {
  return contexts.studyNotesContext.updateStudyNote(testUser.id, studyNoteId, {
    acceptedVariants: [],
    acronyms: [],
    expectedAnswer: input.expectedAnswer,
    keyIdeas: [],
    labelIds: input.labelIds,
    metaphors: [],
    prompt: input.prompt,
    prohibitedPhrases: [],
    sourceBody: input.sourceBody,
    sourceTitle: input.sourceTitle,
  });
}

function createStudyNoteSnapshot(
  contexts: DeterministicRecallTestContexts,
  input: StudyNoteSnapshotInput,
) {
  const studyNote = contexts.studyNotesContext.createStudyNote(testUser.id, {
    labelIds: input.labelIds,
    sourceBody: input.sourceBody,
    sourceTitle: input.sourceTitle,
  });

  return updateStudyNoteSnapshot(contexts, studyNote.id, input);
}

function createRecallLabelSnapshot(label: AppLabel) {
  return {
    id: label.id,
    name: label.name,
  };
}

function createRecallNoteSnapshotFromStudyNote(
  studyNote: ReturnType<typeof createStudyNoteSnapshot>,
  overrides: Partial<RecallNoteSnapshot> = {},
): RecallNoteSnapshot {
  return createStoredRecallNote({
    body: studyNote.expectedAnswer,
    createdAt: studyNote.createdAt,
    id: studyNote.id,
    labelIds: [...studyNote.labelIds],
    title: studyNote.prompt,
    updatedAt: studyNote.updatedAt,
    ...overrides,
  });
}

function createStartedFlashCardQuestion(
  note: RecallNoteSnapshot,
): RecallQuestion {
  return {
    isAnswerRevealed: false,
    noteId: note.id,
    noteSnapshot: note,
    score: null,
    selfRating: null,
    typedAnswer: "",
  };
}

function createStartedFlashCardSession(input: {
  id: string;
  note: RecallNoteSnapshot;
}): RecallSession {
  return {
    attempts: [],
    createdAt: "2026-05-15T12:00:00.000Z",
    currentIndex: 0,
    currentQuestionIndex: 0,
    draftAnswer: "",
    id: input.id,
    isAnswerRevealed: false,
    mode: "FlashCard",
    notes: [input.note],
    questions: [createStartedFlashCardQuestion(input.note)],
  };
}

function createRecallTodayQueueScenario(
  contexts: DeterministicRecallTestContexts,
) {
  const practiceFollowUp = createStudyNoteSnapshot(contexts, {
    expectedAnswer: "ATP stores transferable energy for cells.",
    labelIds: [],
    prompt: "What stores transferable energy?",
    sourceBody: "Cell respiration source context.",
    sourceTitle: "Cell respiration source",
  });
  const needsPractice = createStudyNoteSnapshot(contexts, {
    expectedAnswer: "Mitochondria generate ATP.",
    labelIds: [],
    prompt: "What organelle generates ATP?",
    sourceBody: "Cell organelles source context.",
    sourceTitle: "Cell organelles source",
  });
  const notRecalledYet = createStudyNoteSnapshot(contexts, {
    expectedAnswer: "Fresh recall answer.",
    labelIds: [],
    prompt: "Not recalled prompt",
    sourceBody: "Fresh recall source.",
    sourceTitle: "Fresh recall source",
  });
  const dueForRecall = createStudyNoteSnapshot(contexts, {
    expectedAnswer: "Due answer.",
    labelIds: [],
    prompt: "Due prompt",
    sourceBody: "Due source.",
    sourceTitle: "Due source",
  });
  createStudyNoteSnapshot(contexts, {
    expectedAnswer: " ",
    labelIds: [],
    prompt: "Incomplete prompt",
    sourceBody: "Incomplete source.",
    sourceTitle: "Incomplete source",
  });

  completeStudyNoteRecallAt({
    rating: "hard",
    recallContext: contexts.recallContext,
    studyNoteId: practiceFollowUp.id,
    timestamp: "2026-05-14T09:00:00.000Z",
  });
  const confirmedRepair = confirmStudyNotePracticeRepair({
    contexts,
    correction: "State ATP and explain that it stores transferable energy.",
    intent: "tighten-expected-answer",
    studyNoteId: practiceFollowUp.id,
  });
  contexts.recallContext.completePracticeRepairEntry({
    reference: getConfirmedPracticeRepairReference(confirmedRepair),
    userId: testUser.id,
  });

  completeStudyNoteRecallAt({
    rating: "hard",
    recallContext: contexts.recallContext,
    studyNoteId: needsPractice.id,
    timestamp: "2026-05-14T10:00:00.000Z",
  });
  completeStudyNoteRecallAt({
    rating: "good",
    recallContext: contexts.recallContext,
    studyNoteId: dueForRecall.id,
    timestamp: "2026-05-11T11:00:00.000Z",
  });
  vi.setSystemTime(new Date("2026-05-15T10:00:00.000Z"));

  return {
    queuePrompts: [
      "What stores transferable energy?",
      "What organelle generates ATP?",
      "Not recalled prompt",
      "Due prompt",
    ],
    queueStudyNoteIds: [
      practiceFollowUp.id,
      needsPractice.id,
      notRecalledYet.id,
      dueForRecall.id,
    ],
  } as const;
}

const defaultViewportWidth = window.innerWidth;

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
    writable: true,
  });
  fireEvent(window, new Event("resize"));
}

afterEach(() => {
  setViewportWidth(defaultViewportWidth);
  vi.useRealTimers();
});

describe("authenticated recall workspace", () => {
  it("translates Recall chrome while preserving historical session data", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const note = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Stored mitochondria answer.",
      title: "Stored mitochondria prompt",
    });

    completeMultiQuestionRecall({
      questions: [
        {
          noteId: note.id,
          rating: "good",
          typedAnswer: "Learner answer stays literal.",
        },
      ],
      recallContext: contexts.recallContext,
      timestamp: "2026-04-05T09:00:00.000Z",
    });

    renderRoute("/recall/results", {
      ...contexts,
      session: {
        user: {
          ...testUser,
          userLanguage: "es",
        },
      },
    });

    await screen.findByRole("region", {
      name: "Resultados de repaso",
    });
    expect(
      screen.getByRole("link", { name: "Repaso personalizado" }),
    ).toHaveAttribute("href", "/recall/select");
    expect(screen.getByLabelText("Buscar resultados")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Resultado seleccionado" }),
    ).toBeInTheDocument();

    expect(
      screen.getAllByText("Stored mitochondria prompt").length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText("Indicacion de mitocondrias guardada"),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: /Stored mitochondria prompt/i }),
    );

    expect(screen.getByText("Tu respuesta")).toBeInTheDocument();
    expect(screen.getByText("Respuesta esperada")).toBeInTheDocument();
    expect(screen.getByText("Explicacion de referencia")).toBeInTheDocument();
    expect(
      screen.getByText("Learner answer stays literal."),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Stored mitochondria answer.").length,
    ).toBeGreaterThan(0);
  });

  it("restores an active recall session from the persistent recall service on route entry", async () => {
    const persistentRecallContext = createPersistentRecallContext({
      service: createPersistentRecallService({
        getActiveSession: vi.fn(async () => ({
          attempts: [],
          createdAt: "2026-05-02T12:00:00.000Z",
          currentIndex: 0,
          currentQuestionIndex: 0,
          draftAnswer: "",
          id: "session-restored",
          isAnswerRevealed: false,
          mode: "FlashCard" as const,
          notes: [
            {
              acronyms: [],
              body: "Stored answer body.",
              createdAt: "2026-05-02T11:00:00.000Z",
              id: "note-restored",
              labelIds: [],
              metaphors: [],
              title: "Stored prompt title",
              updatedAt: "2026-05-02T11:00:00.000Z",
            },
          ],
          questions: [
            {
              isAnswerRevealed: false,
              noteId: "note-restored",
              noteSnapshot: {
                acronyms: [],
                body: "Stored answer body.",
                createdAt: "2026-05-02T11:00:00.000Z",
                id: "note-restored",
                labelIds: [],
                metaphors: [],
                title: "Stored prompt title",
                updatedAt: "2026-05-02T11:00:00.000Z",
              },
              score: null,
              selfRating: null,
              typedAnswer: "",
            },
          ],
        })),
      }),
    });

    renderRoute("/recall/session", {
      persistentRecallContext,
      session: createSession(),
    });

    await screen.findByRole("heading", {
      level: 3,
      name: "Recall session",
    });
    expect(screen.getAllByText("Stored prompt title").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByRole("button", { name: "Reveal Study Note" }),
    ).toBeEnabled();
  });

  it("uses the routed authenticated session to hydrate the Recall session view immediately", async () => {
    const userId = "user-route-hydrated-recall";
    const hydratedNote = {
      acronyms: [],
      body: "Hydrated answer body.",
      createdAt: "2026-05-07T08:55:00.000Z",
      id: "route-hydrated-note",
      labelIds: [],
      metaphors: [],
      title: "Hydrated prompt title",
      updatedAt: "2026-05-07T08:55:00.000Z",
    };
    const refreshSpy = vi.fn(async () => ({
      attempts: [],
      createdAt: "2026-05-07T09:00:00.000Z",
      currentIndex: 0,
      currentQuestionIndex: 0,
      draftAnswer: "",
      id: "route-hydrated-recall-session",
      isAnswerRevealed: false,
      mode: "FlashCard" as const,
      notes: [hydratedNote],
      questions: [
        {
          isAnswerRevealed: false,
          noteId: "route-hydrated-note",
          noteSnapshot: hydratedNote,
          score: null,
          selfRating: null,
          typedAnswer: "",
        },
      ],
    }));
    const persistentRecallContext = createPersistentRecallContext({
      service: {
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
          throw new Error("not used");
        }),
        getActiveSession: refreshSpy,
        listRecallSchedules: vi.fn(async () => []),
        listSessionResults: vi.fn(async () => []),
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
      },
    });

    const { router } = renderRoute("/recall/session", {
      persistentRecallContext,
      sessionContext: createRouteHydratedSessionContext({
        user: {
          displayName: "Casey Routed Recall",
          email: "casey.routed.recall@example.com",
          id: userId,
          userLanguage: "en",
        },
      }),
    });

    expect(
      await screen.findByText(
        "Try to recall this Study Note before revealing it.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Hydrated prompt title").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByRole("button", { name: "Reveal Study Note" }),
    ).toBeEnabled();
    expect(router.state.location.pathname).toBe("/recall/session");
    expect(refreshSpy).toHaveBeenCalled();
    expect(persistentRecallContext.readonlyContext.getSnapshot()).toMatchObject(
      {
        id: "route-hydrated-recall-session",
        userId,
      },
    );
  });

  it("shows the Recall Today empty shell on /recall", async () => {
    renderRoute("/recall", { session: createSession() });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Recall Today",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("No Recall Today work")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Choose notes" })).toHaveAttribute(
      "href",
      "/recall/select",
    );
  });

  it("renders Recall Today immediately while persistent recall refresh runs on route entry", async () => {
    let resolveRefresh: (() => void) | undefined;
    const refreshGate = new Promise<void>((resolve) => {
      resolveRefresh = resolve;
    });
    let refreshCount = 0;
    const persistentRecallContext = createPersistentRecallContext({
      service: createPersistentRecallService({
        getActiveSession: vi.fn(async () => {
          refreshCount += 1;

          if (refreshCount === 1) {
            return null;
          }

          await refreshGate;
          return null;
        }),
      }),
    });

    const { router } = renderRoute("/settings", {
      persistentRecallContext,
      session: createSession(),
    });

    await waitFor(() => expect(refreshCount).toBe(1));

    await router.navigate({ to: "/recall" });

    expect(router.state.location.pathname).toBe("/recall");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Recall Today",
      }),
    ).toBeInTheDocument();

    resolveRefresh?.();
  });

  it("shows newly recallable Study Notes in the Recall Today queue with prioritized reasons", async () => {
    vi.useFakeTimers();

    const contexts = createDeterministicRecallTestContexts();
    const scenario = createRecallTodayQueueScenario(contexts);

    renderRoute("/recall", {
      ...contexts,
      session: {
        user: {
          ...testUser,
          userTimeZone: "America/New_York",
        },
      },
    });

    await vi.runAllTimersAsync();

    expect(
      screen.getByRole("heading", { level: 1, name: "Recall Today" }),
    ).toBeInTheDocument();

    const queue = screen.getByRole("region", {
      name: "Recall Today queue",
    });
    expect(queue).toHaveTextContent("Today's plan");
    expect(queue).toHaveTextContent("Start here · Needs practice · 2");
    expect(queue).toHaveTextContent("Review these before adding new material.");
    expect(queue).toHaveTextContent("Continue after that");
    expect(queue).toHaveTextContent("Due reviews · 1");
    expect(queue).toHaveTextContent("Newly recallable · 1");
    expect(queue).toHaveTextContent("Upcoming · 0");
    expect(queue).toHaveTextContent("Needs practice");
    expect(queue).not.toHaveTextContent("Incomplete prompt");

    expect(within(queue).getByText(scenario.queuePrompts[0])).toBeVisible();
    expect(within(queue).getByText(scenario.queuePrompts[1])).toBeVisible();
    expect(within(queue).queryByText(scenario.queuePrompts[2])).toBeNull();
    expect(within(queue).queryByText(scenario.queuePrompts[3])).toBeNull();

    const rowActions = within(queue).getAllByRole("link", {
      name: "Recall this",
    });
    expect(rowActions).toHaveLength(2);
    expect(rowActions[0]).toHaveAttribute(
      "href",
      `/recall/select?studyNoteIds=${scenario.queueStudyNoteIds[0]}`,
    );
    expect(rowActions[1]).toHaveAttribute(
      "href",
      `/recall/select?studyNoteIds=${scenario.queueStudyNoteIds[1]}`,
    );
  });

  it("starts one FlashCard RecallSession from all current Recall Today Study Notes and uses session shuffling", async () => {
    const contexts = createLearningLoopTestContexts({
      shuffleNotes: (sessionNotes) => [...sessionNotes].reverse(),
    });
    const scenario = createRecallTodayQueueScenario(contexts);

    const sessionResultsBefore = contexts.recallContext
      .listSessionResults({
        userId: testUser.id,
      })
      .map((result) => result.id);
    const recallSchedulesBefore =
      contexts.recallContext.getRecallSchedulesSnapshot();

    const { router } = renderRoute("/recall", {
      ...contexts,
      session: {
        user: {
          ...testUser,
          userTimeZone: "America/New_York",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Recall Today" }),
    ).toBeInTheDocument();

    const queue = screen.getByRole("region", {
      name: "Recall Today queue",
    });
    expect(within(queue).getByText(scenario.queuePrompts[0])).toBeVisible();
    expect(within(queue).getByText(scenario.queuePrompts[1])).toBeVisible();
    expect(within(queue).queryByText(scenario.queuePrompts[2])).toBeNull();
    expect(within(queue).queryByText(scenario.queuePrompts[3])).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Recall 4 notes" }));

    expect(
      await screen.findByRole("heading", { level: 3, name: "Recall session" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall/session");
    expect(
      contexts.recallContext.getSnapshot()?.notes.map((note) => note.id),
    ).toEqual([...scenario.queueStudyNoteIds].reverse());
    expect(
      contexts.recallContext
        .listSessionResults({
          userId: testUser.id,
        })
        .map((result) => result.id),
    ).toEqual(sessionResultsBefore);
    expect(contexts.recallContext.getRecallSchedulesSnapshot()).toEqual(
      recallSchedulesBefore,
    );
  });

  it("uses the route-hydrated session to show Recall results immediately", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const note = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Stored answer body",
      title: "Stored prompt title",
    });

    completeRecallAt({
      noteId: note.id,
      rating: "good",
      recallContext: contexts.recallContext,
      timestamp: "2026-05-07T09:00:00.000Z",
    });

    renderRoute("/recall/results", {
      ...contexts,
      sessionContext: createRouteHydratedSessionContext(createSession()),
    });

    const results = await screen.findByRole("region", {
      name: "Recall results",
    });
    const selectedResult = screen.getByRole("region", {
      name: "Selected result",
    });
    expect(within(results).getByText("1 session shown")).toBeInTheDocument();
    expect(
      within(selectedResult).getAllByText("Stored prompt title").length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("heading", { name: "Recall starts with Study Notes" }),
    ).not.toBeInTheDocument();
  });

  it("renders Study Note result snapshots with source context and not-reached Study Notes", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const label = contexts.labelsContext.createLabel({
      name: "Cell biology",
      userId: testUser.id,
    });
    const attemptedStudyNote = createStudyNoteSnapshot(contexts, {
      expectedAnswer: "ATP transfers energy in cells.",
      labelIds: [label.id],
      prompt: "What does ATP do?",
      sourceBody: "Original ATP source context.",
      sourceTitle: "Original ATP source note",
    });
    const notReachedStudyNote = createStudyNoteSnapshot(contexts, {
      expectedAnswer: "Glucose is broken down during respiration.",
      labelIds: [label.id],
      prompt: "What happens to glucose?",
      sourceBody: "Original glucose source context.",
      sourceTitle: "Original glucose source note",
    });

    vi.setSystemTime(new Date("2026-05-07T09:00:00.000Z"));
    const session = contexts.recallContext.startFlashCardSession({
      studyNoteIds: [attemptedStudyNote.id, notReachedStudyNote.id],
      userId: testUser.id,
    });
    contexts.recallContext.updateFlashCardAttemptText({
      sessionId: session.id,
      text: "Energy currency",
      userId: testUser.id,
    });
    contexts.recallContext.revealFlashCardAnswer({
      sessionId: session.id,
      userId: testUser.id,
    });
    contexts.recallContext.rateFlashCardAnswer({
      rating: "good",
      sessionId: session.id,
      userId: testUser.id,
    });
    contexts.recallContext.endFlashCardSession({
      sessionId: session.id,
      userId: testUser.id,
    });

    updateStudyNoteSnapshot(contexts, attemptedStudyNote.id, {
      expectedAnswer: "Edited ATP answer.",
      labelIds: [],
      prompt: "Edited ATP prompt?",
      sourceBody: "Edited ATP source context.",
      sourceTitle: "Edited ATP source note",
    });
    updateStudyNoteSnapshot(contexts, notReachedStudyNote.id, {
      expectedAnswer: " ",
      labelIds: [],
      prompt: "Edited glucose prompt?",
      sourceBody: "Edited glucose source context.",
      sourceTitle: "Edited glucose source note",
    });

    renderRoute("/recall/results", { ...contexts, session: createSession() });

    await screen.findByRole("region", { name: "Selected result" });
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.change(screen.getByLabelText("Filter results by label"), {
      target: { value: label.id },
    });

    const selectedResult = screen.getByRole("region", {
      name: "Selected result",
    });
    expect(
      within(selectedResult).getByText("What does ATP do?"),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getByText("What happens to glucose?"),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getByText("2 targeted Study Notes"),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getByRole("region", {
        name: "Queued but not asked · 1",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(selectedResult).getByRole("button", {
        name: /What does ATP do?/i,
      }),
    );

    expect(within(selectedResult).getByText("Your answer")).toBeInTheDocument();
    expect(
      within(selectedResult).getByText("Expected answer"),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getByText("ATP transfers energy in cells."),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getByText("Reference explanation"),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getByText("Original ATP source note"),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getByText("Original ATP source context."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Edited ATP prompt?")).toBeNull();
    expect(screen.queryByText("Edited ATP answer.")).toBeNull();
    expect(screen.queryByText("Edited ATP source context.")).toBeNull();
  });

  it("shows persisted Answer Check guidance in Results review without recomputing from later Study Note edits", async () => {
    const storageKeyPrefix = `test-results-answer-check-${Math.random()
      .toString(36)
      .slice(2)}`;
    const contexts =
      createPersistentStudyNoteRecallTestContexts(storageKeyPrefix);
    const createdStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        labelIds: [],
        sourceBody: "Retrieval practice source context.",
        sourceTitle: "Retrieval practice",
      },
    );
    const studyNote = contexts.studyNotesContext.updateStudyNote(
      testUser.id,
      createdStudyNote.id,
      {
        acceptedVariants: [],
        acronyms: [],
        expectedAnswer:
          "Retrieval practice strengthens long-term memory through effortful recall.",
        keyIdeas: [],
        labelIds: [],
        metaphors: [],
        prompt: "What does retrieval practice strengthen?",
        prohibitedPhrases: [],
        sourceBody: "Retrieval practice source context.",
        sourceTitle: "Retrieval practice",
      },
    );
    const historicalNote = createStoredRecallNote({
      body: studyNote.expectedAnswer,
      expectedAnswer: studyNote.expectedAnswer,
      id: studyNote.id,
      prompt: studyNote.prompt,
      source: {
        body: "Retrieval practice source context.",
        id: studyNote.sourceNoteId,
        title: "Retrieval practice",
        updatedAt: studyNote.updatedAt,
      },
      sourceNoteId: studyNote.sourceNoteId,
      title: studyNote.prompt,
    });
    const historicalAnswerCheck = {
      algorithmVersion: "key_idea_accepted_variant_and_contradiction_guard_v5",
      confidence: "medium",
      evidence: {
        coveredConcepts: [
          {
            id: "key-idea-memory",
            importance: "required",
            text: "long-term memory",
          },
        ],
        contradictedConcepts: [
          {
            id: "key-idea-direction",
            importance: "required",
            text: "increase diffusion speed",
          },
        ],
        detectedContradictions: [
          {
            answerText: "decrease",
            concept: {
              id: "key-idea-direction",
              importance: "required",
              text: "increase diffusion speed",
            },
            referenceText: "increase",
            scope: "key_idea",
            type: "opposition",
          },
        ],
        matchedExpectedTerms: ["retrieval practice", "long-term memory"],
        matchedProhibitedPhrases: [
          {
            scope: "study_note",
            text: "passive review",
          },
        ],
        missingConcepts: [
          {
            id: "key-idea-effortful",
            importance: "required",
            text: "effortful recall",
          },
        ],
        missingExpectedTerms: ["effortful recall"],
        phraseCoverage: 0.42,
        tfidfCosineSimilarity: 0.38,
        tokenCoverage: 0.52,
      },
      primaryReason: "built_in_contradiction_guard",
      status: "uncertain",
      suggestedSelfRating: "hard",
    } satisfies RecallAnswerCheckResult;
    const storedResult = createStoredSessionResult({
      id: "stored-answer-check-result",
      note: historicalNote,
      notes: [historicalNote],
      questions: [
        {
          ...createStoredRecallQuestion({
            note: historicalNote,
            score: 75,
            selfRating: "good",
          }),
          answerCheck: historicalAnswerCheck,
          noteId: historicalNote.id,
          questionResultId: "stored-answer-check-result-question-0",
          typedAnswer:
            "Retrieval practice is passive review that decreases diffusion speed.",
        },
      ],
      rating: "good",
      score: 75,
    });

    contexts.studyNotesContext.updateStudyNote(testUser.id, studyNote.id, {
      acceptedVariants: [],
      acronyms: [],
      expectedAnswer: "Changed later answer.",
      keyIdeas: [
        {
          acceptedPhrases: [],
          id: "key-idea-changed",
          importance: "required",
          prohibitedPhrases: [],
          text: "changed later idea",
        },
      ],
      labelIds: [],
      metaphors: [],
      prompt: "Changed later prompt?",
      prohibitedPhrases: [
        {
          id: "study-note-prohibited-changed",
          text: "changed later prohibited phrase",
        },
      ],
      sourceBody: "Changed later source context.",
      sourceTitle: "Changed later source",
    });

    window.localStorage.setItem(
      `${storageKeyPrefix}-recall:session-results`,
      JSON.stringify([{ ...storedResult, userId: testUser.id }]),
    );

    renderRoute("/recall/results", {
      labelsContext: contexts.labelsContext,
      notesContext: contexts.notesContext,
      recallContext: contexts.createRecallContext(),
      session: createSession(),
      studyNotesContext: contexts.studyNotesContext,
    });

    const selectedResult = await screen.findByRole("region", {
      name: "Selected result",
    });

    fireEvent.click(
      within(selectedResult).getByRole("button", {
        name: /What does retrieval practice strengthen\?/i,
      }),
    );

    const selectedResultView = within(selectedResult);

    expect(selectedResultView.getByText("Answer Check")).toBeInTheDocument();
    expect(
      selectedResultView.getByText("Guidance only. Keep your own self-rating."),
    ).toBeInTheDocument();
    expect(selectedResultView.getByText("Uncertain")).toBeInTheDocument();
    expect(
      selectedResultView.getByText("Medium confidence"),
    ).toBeInTheDocument();
    expect(
      selectedResultView.getByText("Suggested self-rating"),
    ).toBeInTheDocument();
    expect(selectedResultView.getByText("Hard")).toBeInTheDocument();
    expect(
      selectedResultView.getByText("Algorithm version"),
    ).toBeInTheDocument();
    expect(
      selectedResultView.getByText(
        "key_idea_accepted_variant_and_contradiction_guard_v5",
      ),
    ).toBeInTheDocument();
    expect(
      selectedResultView.getByText(
        "Retrieval practice strengthens long-term memory through effortful recall.",
      ),
    ).toBeInTheDocument();
    expect(
      selectedResultView.getByText("increase -> decrease"),
    ).toBeInTheDocument();
    expect(
      selectedResultView.getByText("increase diffusion speed"),
    ).toBeInTheDocument();
    expect(
      selectedResultView.getByText("long-term memory"),
    ).toBeInTheDocument();
    expect(
      selectedResultView.getByText("effortful recall"),
    ).toBeInTheDocument();
    expect(selectedResultView.getByText("passive review")).toBeInTheDocument();
    expect(
      selectedResultView.getByText(
        "A built-in contradiction guard detected a direct negation or obvious opposing term, so likely-correct guidance is blocked.",
      ),
    ).toBeInTheDocument();
    expect(selectedResultView.queryByText("Changed later prompt?")).toBeNull();
    expect(selectedResultView.queryByText("Changed later answer.")).toBeNull();
    expect(selectedResultView.queryByText("changed later idea")).toBeNull();
  });

  it("opens a question-scoped Practice Repair draft under the Repair route from weak Results evidence", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const weakStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "ATP stores transferable energy for cells.",
        prompt: "What stores transferable energy?",
        sourceBody: "Cell respiration source context.",
        sourceTitle: "Cell respiration source",
      },
    );

    completeStudyNoteRecallAt({
      rating: "hard",
      recallContext: contexts.recallContext,
      studyNoteId: weakStudyNote.id,
      timestamp: "2026-05-15T09:00:00.000Z",
    });

    const result = contexts.recallContext.listSessionResults({
      userId: testUser.id,
    })[0];
    const questionResultId = result?.questions[0]?.questionResultId;

    if (result === undefined || questionResultId === undefined) {
      throw new Error(
        "Expected a stored weak-recall result with a question id.",
      );
    }

    const routeRender = renderRoute("/recall/results", {
      ...contexts,
      session: createSession(),
    });
    const selectedResult = await screen.findByRole("region", {
      name: "Selected result",
    });

    fireEvent.click(
      within(selectedResult).getByRole("button", {
        name: /What stores transferable energy\?/i,
      }),
    );

    fireEvent.click(
      within(selectedResult).getByRole("link", {
        name: "Practice Repair",
      }),
    );

    expect(routeRender.router.state.location.pathname).toBe(
      `/practice-repair/results/${result.id}/questions/${questionResultId}`,
    );
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Practice Repair",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Keep the original Needs practice evidence visible while you finish one concrete repair from Recall.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View full note" }),
    ).toHaveAttribute("href", getStudyNoteEditorPath(weakStudyNote.id));
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Cell respiration source",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("What stores transferable energy?"),
    ).toBeInTheDocument();
    expect(screen.getByText("No answer provided.")).toBeInTheDocument();
    expect(
      screen.getByText("ATP stores transferable energy for cells."),
    ).toBeInTheDocument();
    expect(screen.getByText("Last score")).toBeInTheDocument();
    expect(screen.getByText("Hard")).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Metaphors and acronyms are optional support material, not required.",
      ),
    ).toBeNull();
    expect(
      screen.queryByRole("heading", {
        name: "Choose one repair to confirm",
      }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit note" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Recall again/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Confirm Practice Repair" }),
    ).toBeNull();
  });

  it("opens the canonical draft Practice Repair route from Results and starts the selected repair from the keyboard", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const weakStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "ATP stores transferable energy for cells.",
        prompt: "What stores transferable energy?",
        sourceBody: "Cell respiration source context.",
        sourceTitle: "Cell respiration source",
      },
    );

    completeStudyNoteRecallAt({
      rating: "hard",
      recallContext: contexts.recallContext,
      studyNoteId: weakStudyNote.id,
      timestamp: "2026-05-15T09:00:00.000Z",
    });

    const result = contexts.recallContext.listSessionResults({
      userId: testUser.id,
    })[0];
    const questionResultId = result?.questions[0]?.questionResultId;

    if (result === undefined || questionResultId === undefined) {
      throw new Error(
        "Expected a stored weak-recall result with a question id.",
      );
    }

    const routeRender = renderRoute(
      `/practice-repair/results/${result.id}/questions/${questionResultId}`,
      {
        ...contexts,
        session: createSession(),
      },
    );

    expect(routeRender.router.state.location.pathname).toBe(
      `/practice-repair/results/${result.id}/questions/${questionResultId}`,
    );

    const suggestions = await screen.findByRole("complementary", {
      name: "Practice Repair actions",
    });
    const editExpectedAnswerButton = within(suggestions).getByRole("button", {
      name: "Edit expected answer",
    });

    expect(
      within(suggestions).getByRole("button", {
        name: "Split this Study Note",
      }),
    ).toBeInTheDocument();
    expect(
      within(suggestions).getByRole("button", {
        name: "Create a sibling Study Note",
      }),
    ).toBeInTheDocument();
    expect(
      within(suggestions).getByRole("button", {
        name: "Add a memory aid",
      }),
    ).toBeInTheDocument();
    expect(
      within(suggestions).queryByText("Recall again soon"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Confirm Practice Repair" }),
    ).toBeNull();

    editExpectedAnswerButton.focus();
    fireEvent.keyDown(editExpectedAnswerButton, { key: "Enter" });

    const practiceRepairEntryId = createPracticeRepairEntryId({
      questionIndex: 0,
      questionResultId,
      sessionResultId: result.id,
      studyNoteId: weakStudyNote.id,
    });

    await waitFor(() => {
      expect(routeRender.router.state.location.pathname).toBe(
        `/practice-repair/${practiceRepairEntryId}`,
      );
    });
    expect(routeRender.router.state.location.search).toEqual({
      mode: "edit-answer",
    });
    expect(
      contexts.recallContext.listActivePracticeRepairEntriesForStudyNote({
        studyNoteId: weakStudyNote.id,
        userId: testUser.id,
      }),
    ).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Confirm Practice Repair" }),
    ).toBeNull();
    expect(
      screen.queryByText(
        "This repair candidate stays in draft until you confirm this Practice Repair.",
      ),
    ).toBeNull();
    expect(
      screen.queryByRole("region", {
        name: "Linked Practice Repair",
      }),
    ).toBeNull();
    expect(
      await screen.findByRole("textbox", { name: "Expected answer" }),
    ).toBeInTheDocument();
  });

  it("keeps View full note as the Study Note exit from a draft Practice Repair workspace", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const weakStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "ATP stores transferable energy for cells.",
        prompt: "What stores transferable energy?",
        sourceBody: "Cell respiration source context.",
        sourceTitle: "Cell respiration source",
      },
    );

    completeStudyNoteRecallAt({
      rating: "hard",
      recallContext: contexts.recallContext,
      studyNoteId: weakStudyNote.id,
      timestamp: "2026-05-15T09:00:00.000Z",
    });

    const result = contexts.recallContext.listSessionResults({
      userId: testUser.id,
    })[0];
    const questionResultId = result?.questions[0]?.questionResultId;

    if (result === undefined || questionResultId === undefined) {
      throw new Error(
        "Expected a stored weak-recall result with a question id.",
      );
    }

    const practiceRepairDraftPath = `/practice-repair/results/${result.id}/questions/${questionResultId}`;
    const routeRender = renderRoute(practiceRepairDraftPath, {
      ...contexts,
      session: createSession(),
    });

    fireEvent.click(
      await screen.findByRole("link", {
        name: "View full note",
      }),
    );

    await waitFor(() => {
      expect(routeRender.router.state.location.pathname).toBe(
        getStudyNoteEditorPath(weakStudyNote.id),
      );
    });
    expect(routeRender.router.state.location.search).toEqual({});
  });

  it("falls back to the Practice Repair queue when a Repair draft result is missing", async () => {
    const { router } = renderRoute(
      "/practice-repair/results/missing-result/questions/missing-question",
      {
        session: createSession(),
      },
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/practice-repair");
    });
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Practice Repair",
      }),
    ).toBeInTheDocument();
  });

  it("falls back to the Practice Repair queue when a Repair draft question is missing", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const weakStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "ATP stores transferable energy for cells.",
        prompt: "What stores transferable energy?",
        sourceBody: "Cell respiration source context.",
        sourceTitle: "Cell respiration source",
      },
    );

    completeStudyNoteRecallAt({
      rating: "forgot",
      recallContext: contexts.recallContext,
      studyNoteId: weakStudyNote.id,
      timestamp: "2026-05-15T09:00:00.000Z",
    });

    const result = contexts.recallContext.listSessionResults({
      userId: testUser.id,
    })[0];

    if (result === undefined) {
      throw new Error("Expected a stored weak-recall result.");
    }

    const { router } = renderRoute(
      `/practice-repair/results/${result.id}/questions/missing-question`,
      {
        ...contexts,
        session: createSession(),
      },
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/practice-repair");
    });
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Practice Repair",
      }),
    ).toBeInTheDocument();
  });

  it("keeps an already confirmed draft URL on the question-scoped Practice Repair workspace", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const weakStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "ATP stores transferable energy for cells.",
        prompt: "What stores transferable energy?",
        sourceBody: "Cell respiration source context.",
        sourceTitle: "Cell respiration source",
      },
    );

    completeStudyNoteRecallAt({
      rating: "hard",
      recallContext: contexts.recallContext,
      studyNoteId: weakStudyNote.id,
      timestamp: "2026-05-15T09:00:00.000Z",
    });

    const confirmedResult = confirmStudyNotePracticeRepair({
      correction: "State ATP directly and mention energy transfer.",
      contexts,
      intent: "tighten-expected-answer",
      studyNoteId: weakStudyNote.id,
    });
    const confirmedReference =
      getConfirmedPracticeRepairReference(confirmedResult);
    const questionResultId = confirmedReference.questionResultId;

    if (questionResultId === undefined) {
      throw new Error(
        "Expected a confirmed Practice Repair reference with a question id.",
      );
    }

    const confirmedDraftPath = `/practice-repair/results/${confirmedReference.sessionResultId}/questions/${questionResultId}`;
    const { router } = renderRoute(confirmedDraftPath, {
      ...contexts,
      session: createSession(),
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(confirmedDraftPath);
    });
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Practice Repair",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mark repair complete" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Recall again/ })).toBeNull();
  });

  it("shows the active Practice Repair queue in newest-first order and navigates into a workspace", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const olderStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "ATP stores transferable energy for cells.",
        prompt: "What stores transferable energy?",
        sourceBody: "Cell respiration source context.",
        sourceTitle: "Cell respiration source",
      },
    );
    const newerStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "The Krebs cycle regenerates oxaloacetate.",
        prompt: "What does the Krebs cycle regenerate?",
        sourceBody: "Citric acid cycle source context.",
        sourceTitle: "Citric acid cycle source",
      },
    );
    const dismissedStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "NADH carries electrons.",
        prompt: "What carries electrons to the chain?",
        sourceBody: "Electron transport source context.",
        sourceTitle: "Electron transport source",
      },
    );

    completeStudyNoteRecallAt({
      rating: "hard",
      recallContext: contexts.recallContext,
      studyNoteId: olderStudyNote.id,
      timestamp: "2026-05-15T09:00:00.000Z",
    });
    completeStudyNoteRecallAt({
      rating: "forgot",
      recallContext: contexts.recallContext,
      studyNoteId: newerStudyNote.id,
      timestamp: "2026-05-16T09:00:00.000Z",
    });
    completeStudyNoteRecallAt({
      rating: "hard",
      recallContext: contexts.recallContext,
      studyNoteId: dismissedStudyNote.id,
      timestamp: "2026-05-14T09:00:00.000Z",
    });

    vi.setSystemTime(new Date("2026-05-16T10:00:00.000Z"));
    const olderResult = confirmStudyNotePracticeRepair({
      correction: "State ATP directly.",
      contexts,
      intent: "tighten-expected-answer",
      studyNoteId: olderStudyNote.id,
    });

    vi.setSystemTime(new Date("2026-05-17T11:00:00.000Z"));
    const newerResult = confirmStudyNotePracticeRepair({
      correction: "Call out oxaloacetate at the end of the cycle.",
      contexts,
      intent: "tighten-expected-answer",
      studyNoteId: newerStudyNote.id,
    });

    vi.setSystemTime(new Date("2026-05-17T12:00:00.000Z"));
    const dismissedResult = confirmStudyNotePracticeRepair({
      correction: "This repair was dismissed.",
      contexts,
      intent: "tighten-expected-answer",
      studyNoteId: dismissedStudyNote.id,
    });
    contexts.recallContext.dismissPracticeRepairEntry({
      reference: getConfirmedPracticeRepairReference(dismissedResult),
      userId: testUser.id,
    });

    const olderPracticeRepairEntryId =
      getConfirmedPracticeRepairEntryId(olderResult);
    const newerPracticeRepairPath = getConfirmedPracticeRepairPath(newerResult);

    const { router } = renderRoute("/practice-repair", {
      ...contexts,
      session: createSession(),
    });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Practice Repair",
      }),
    ).toBeInTheDocument();

    const queueList = screen.getByRole("list", {
      name: "Active repair entries",
    });
    const queueItems = within(queueList).getAllByRole("listitem");

    expect(queueItems).toHaveLength(2);
    expect(queueItems[0]).toHaveTextContent(
      "What does the Krebs cycle regenerate?",
    );
    expect(queueItems[0]).toHaveTextContent(
      "Call out oxaloacetate at the end of the cycle.",
    );
    expect(queueItems[1]).toHaveTextContent("What stores transferable energy?");
    expect(queueItems[1]).toHaveTextContent("State ATP directly.");
    expect(screen.queryByText("This repair was dismissed.")).toBeNull();

    fireEvent.click(
      within(queueItems[0]).getByRole("link", {
        name: "Continue repair",
      }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(newerPracticeRepairPath);
    });
    expect(
      await screen.findByRole("region", {
        name: "Practice Repair workspace",
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).not.toBe(
      `/practice-repair/${olderPracticeRepairEntryId}`,
    );
  });

  it("falls back to Results when the Practice Repair queue is empty but stored Results exist", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const weakStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "ATP stores transferable energy for cells.",
        prompt: "What stores transferable energy?",
        sourceBody: "Cell respiration source context.",
        sourceTitle: "Cell respiration source",
      },
    );

    completeStudyNoteRecallAt({
      rating: "good",
      recallContext: contexts.recallContext,
      studyNoteId: weakStudyNote.id,
      timestamp: "2026-05-15T09:00:00.000Z",
    });

    renderRoute("/practice-repair", {
      ...contexts,
      session: createSession(),
    });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Practice Repair",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "No repair work right now.",
    );
    expect(
      screen.getByRole("link", { name: "Review results" }),
    ).toHaveAttribute("href", "/recall/results");
  });

  it("falls back to custom recall when the Practice Repair queue is empty and recallable Study Notes exist", async () => {
    const contexts = createDeterministicRecallTestContexts();

    contexts.studyNotesContext.createStudyNote(testUser.id, {
      expectedAnswer: "ATP stores transferable energy for cells.",
      prompt: "What stores transferable energy?",
      sourceBody: "Cell respiration source context.",
      sourceTitle: "Cell respiration source",
    });

    renderRoute("/practice-repair", {
      ...contexts,
      session: createSession(),
    });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Practice Repair",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Start custom recall" }),
    ).toHaveAttribute("href", "/recall/select");
  });

  it("falls back to Study Notes when the Practice Repair queue is empty and no recallable Study Notes exist", async () => {
    renderRoute("/practice-repair", {
      session: createSession(),
    });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Practice Repair",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create first Study Note" }),
    ).toHaveAttribute("href", "/study-notes");
  });

  it("shows unconfirmed repair candidates in the queue and turns a confirmed candidate into active Practice Repair work", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const activeStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "The Krebs cycle regenerates oxaloacetate.",
        prompt: "What does the Krebs cycle regenerate?",
        sourceBody: "Citric acid cycle source context.",
        sourceTitle: "Citric acid cycle source",
      },
    );
    const candidateStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "ATP stores transferable energy for cells.",
        prompt: "What stores transferable energy?",
        sourceBody: "Cell respiration source context.",
        sourceTitle: "Cell respiration source",
      },
    );
    const suppressedStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "NADH carries electrons.",
        prompt: "What carries electrons to the chain?",
        sourceBody: "Electron transport source context.",
        sourceTitle: "Electron transport source",
      },
    );

    completeStudyNoteRecallAt({
      rating: "hard",
      recallContext: contexts.recallContext,
      studyNoteId: activeStudyNote.id,
      timestamp: "2026-05-15T09:00:00.000Z",
    });
    vi.setSystemTime(new Date("2026-05-15T10:00:00.000Z"));
    confirmStudyNotePracticeRepair({
      correction: "Call out oxaloacetate at the end of the cycle.",
      contexts,
      intent: "tighten-expected-answer",
      studyNoteId: activeStudyNote.id,
    });

    completeStudyNoteRecallAt({
      rating: "hard",
      recallContext: contexts.recallContext,
      studyNoteId: candidateStudyNote.id,
      timestamp: "2026-05-16T09:00:00.000Z",
    });
    completeStudyNoteRecallAt({
      rating: "forgot",
      recallContext: contexts.recallContext,
      studyNoteId: candidateStudyNote.id,
      timestamp: "2026-05-17T09:00:00.000Z",
    });

    completeStudyNoteRecallAt({
      rating: "hard",
      recallContext: contexts.recallContext,
      studyNoteId: suppressedStudyNote.id,
      timestamp: "2026-05-14T09:00:00.000Z",
    });
    vi.setSystemTime(new Date("2026-05-14T10:00:00.000Z"));
    confirmStudyNotePracticeRepair({
      correction: "Finish the existing electron transport repair first.",
      contexts,
      intent: "tighten-expected-answer",
      studyNoteId: suppressedStudyNote.id,
    });
    completeStudyNoteRecallAt({
      rating: "forgot",
      recallContext: contexts.recallContext,
      studyNoteId: suppressedStudyNote.id,
      timestamp: "2026-05-17T10:00:00.000Z",
    });

    const candidateReference = findStudyNoteQuestionResult({
      results: contexts.recallContext.listSessionResults({
        userId: testUser.id,
      }),
      studyNoteId: candidateStudyNote.id,
    });

    if (candidateReference === null) {
      throw new Error("Expected a queued Practice Repair candidate.");
    }

    const { router } = renderRoute("/practice-repair", {
      ...contexts,
      session: createSession(),
    });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Practice Repair",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 4,
        name: "Active repair",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 4,
        name: "New repair candidates",
      }),
    ).toBeInTheDocument();
    const candidateList = screen.getByRole("list", {
      name: "New repair candidates",
    });
    expect(
      within(candidateList).getByText("What stores transferable energy?"),
    ).toBeInTheDocument();
    expect(
      within(candidateList).getByText(
        "Also showed Needs practice in 1 earlier recent Recall result.",
      ),
    ).toBeInTheDocument();
    expect(
      within(candidateList).queryByText("What carries electrons to the chain?"),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("link", {
        name: "Open repair",
      }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        `/practice-repair/results/${candidateReference.result.id}/questions/${candidateReference.questionResultId}`,
      );
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit expected answer" }),
    );

    const candidatePracticeRepairEntryId = createPracticeRepairEntryId({
      questionIndex: candidateReference.questionIndex,
      questionResultId: candidateReference.questionResultId,
      sessionResultId: candidateReference.result.id,
      studyNoteId: candidateStudyNote.id,
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        `/practice-repair/${candidatePracticeRepairEntryId}`,
      );
    });
    expect(router.state.location.search).toEqual({
      mode: "edit-answer",
    });
    expect(
      contexts.recallContext.listActivePracticeRepairEntriesForStudyNote({
        studyNoteId: candidateStudyNote.id,
        userId: testUser.id,
      }),
    ).toHaveLength(1);
    expect(
      screen.queryByRole("region", {
        name: "Linked Practice Repair",
      }),
    ).toBeNull();

    await router.navigate({ to: "/practice-repair" });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Practice Repair",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "New repair candidates" }),
    ).toBeNull();
    expect(
      contexts.recallContext.listActivePracticeRepairEntriesForStudyNote({
        studyNoteId: candidateStudyNote.id,
        userId: testUser.id,
      }),
    ).toHaveLength(1);
  });

  it("resolves the canonical Practice Repair route across reloads by durable entry id", async () => {
    const storageKeyPrefix = `test-practice-repair-route-${Math.random()
      .toString(36)
      .slice(2)}`;
    const contexts =
      createPersistentStudyNoteRecallTestContexts(storageKeyPrefix);
    const { labelsContext, notesContext, recallContext, studyNotesContext } =
      contexts;
    const weakStudyNote = studyNotesContext.createStudyNote(testUser.id, {
      expectedAnswer: "ATP stores transferable energy for cells.",
      prompt: "What stores transferable energy?",
      sourceBody: "Cell respiration source context.",
      sourceTitle: "Cell respiration source",
    });

    completeStudyNoteRecallAt({
      rating: "hard",
      recallContext,
      studyNoteId: weakStudyNote.id,
      timestamp: "2026-05-15T09:00:00.000Z",
    });

    const confirmedResult = confirmStudyNotePracticeRepair({
      correction: "State ATP and explain that it stores transferable energy.",
      contexts,
      intent: "tighten-expected-answer",
      studyNoteId: weakStudyNote.id,
    });
    const practiceRepairEntryId =
      getConfirmedPracticeRepairEntryId(confirmedResult);
    const canonicalRepairPath = getConfirmedPracticeRepairPath(confirmedResult);

    const firstRender = renderRoute(
      `/practice-repair/${practiceRepairEntryId}`,
      {
        labelsContext,
        notesContext,
        recallContext,
        session: createSession(),
        studyNotesContext,
      },
    );

    await waitFor(() => {
      expect(firstRender.router.state.location.pathname).toBe(
        canonicalRepairPath,
      );
    });
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Practice Repair",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mark repair complete" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Recall again/ })).toBeNull();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Cell respiration source",
      }),
    ).toBeInTheDocument();

    firstRender.unmount();

    const reloadedRecallContext = contexts.createRecallContext();

    const secondRender = renderRoute(
      `/practice-repair/${practiceRepairEntryId}`,
      {
        labelsContext,
        notesContext,
        recallContext: reloadedRecallContext,
        session: createSession(),
        studyNotesContext,
      },
    );

    await waitFor(() => {
      expect(secondRender.router.state.location.pathname).toBe(
        canonicalRepairPath,
      );
    });
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Practice Repair",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mark repair complete" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Recall again/ })).toBeNull();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Cell respiration source",
      }),
    ).toBeInTheDocument();
  });

  it("renders the canonical Practice Repair workspace as a compact repair card", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const biologyLabel = contexts.labelsContext.createLabel({
      name: "Biology",
      userId: testUser.id,
    });
    const nervousSystemLabel = contexts.labelsContext.createLabel({
      name: "Nervous System",
      userId: testUser.id,
    });
    const weakStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer:
          "An action potential has resting, depolarization, peak, repolarization, and hyperpolarization phases.",
        labelIds: [biologyLabel.id, nervousSystemLabel.id],
        prompt:
          "List and briefly describe the phases of an action potential in a neuron.",
        sourceBody: "Action potential source context with phase details.",
        sourceTitle: "Action Potential Phases",
      },
    );

    vi.setSystemTime(new Date("2026-05-15T09:00:00.000Z"));
    const session = contexts.recallContext.startFlashCardSession({
      studyNoteIds: [weakStudyNote.id],
      userId: testUser.id,
    });

    contexts.recallContext.updateFlashCardAttemptText({
      sessionId: session.id,
      text: "",
      userId: testUser.id,
    });
    contexts.recallContext.revealFlashCardAnswer({
      sessionId: session.id,
      userId: testUser.id,
    });
    contexts.recallContext.rateFlashCardAnswer({
      rating: "forgot",
      sessionId: session.id,
      userId: testUser.id,
    });

    const confirmedResult = confirmStudyNotePracticeRepair({
      correction:
        "Add the missing phase list and one short description for each phase.",
      contexts,
      intent: "tighten-expected-answer",
      studyNoteId: weakStudyNote.id,
    });

    renderRoute(getConfirmedPracticeRepairPath(confirmedResult), {
      ...contexts,
      session: createSession(),
    });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Practice Repair",
      }),
    ).toBeInTheDocument();

    const evidence = screen.getByRole("region", {
      name: "Practice Repair evidence",
    });
    expect(
      within(evidence).getByRole("heading", {
        level: 2,
        name: "Action Potential Phases",
      }),
    ).toBeInTheDocument();
    expect(
      within(evidence).getByText("Biology · Nervous System"),
    ).toBeInTheDocument();
    expect(
      within(evidence).getByText(
        "List and briefly describe the phases of an action potential in a neuron.",
      ),
    ).toBeInTheDocument();
    expect(
      within(evidence).getByText("No answer provided."),
    ).toBeInTheDocument();
    expect(
      within(evidence).getAllByText(
        "An action potential has resting, depolarization, peak, repolarization, and hyperpolarization phases.",
      )[0],
    ).toBeInTheDocument();
    expect(
      within(evidence).getByRole("textbox", { name: "Current prompt" }),
    ).toHaveValue(
      "List and briefly describe the phases of an action potential in a neuron.",
    );
    expect(
      within(evidence).getByRole("textbox", {
        name: "Expected answer",
      }),
    ).toHaveValue(
      "An action potential has resting, depolarization, peak, repolarization, and hyperpolarization phases.",
    );
    expect(within(evidence).getByText("Last score")).toBeInTheDocument();
    expect(within(evidence).getByText("Forgot")).toBeInTheDocument();
    expect(
      within(evidence).getByText(
        "Weak recall is a signal to adjust and reinforce.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", {
        name: "Practice Repair actions",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Selected repair")).toBeNull();
    expect(screen.queryByText("Entry state")).toBeNull();
    expect(screen.queryByText("Reference explanation")).not.toBeInTheDocument();
    expect(
      within(evidence).getByRole("link", { name: /View full note/ }),
    ).toBeInTheDocument();
    expect(
      within(evidence).queryByRole("link", { name: /Edit note/ }),
    ).toBeNull();
    expect(
      within(evidence).queryByRole("button", { name: /Save changes/ }),
    ).toBeNull();
    expect(
      within(evidence).queryByRole("button", { name: /Recall again/ }),
    ).toBeNull();
    expect(
      within(evidence).queryByText(
        "Metaphors and acronyms are optional support material, not required.",
      ),
    ).toBeNull();
    expect(
      screen.queryByText(
        "Metaphors and acronyms are optional support material, not required.",
      ),
    ).toBeNull();
  });

  it("switches confirmed Practice Repair repair modes inline without leaving the detail route", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const weakStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "ATP stores transferable energy for cells.",
        prompt: "What stores transferable energy?",
        sourceBody: "Cell respiration source context.",
        sourceTitle: "Cell respiration source",
      },
    );

    completeStudyNoteRecallAt({
      rating: "hard",
      recallContext: contexts.recallContext,
      studyNoteId: weakStudyNote.id,
      timestamp: "2026-05-15T09:00:00.000Z",
    });

    const confirmedResult = confirmStudyNotePracticeRepair({
      correction:
        "State ATP directly and anchor the answer to energy transfer.",
      contexts,
      intent: "tighten-expected-answer",
      studyNoteId: weakStudyNote.id,
    });
    const practiceRepairPath = getConfirmedPracticeRepairPath(confirmedResult);
    const { router } = renderRoute(`${practiceRepairPath}?mode=not-a-mode`, {
      ...contexts,
      session: createSession(),
    });

    const evidence = await screen.findByRole("region", {
      name: "Practice Repair evidence",
    });
    expect(router.state.location.pathname).toBe(practiceRepairPath);
    expect(router.state.location.search.mode).toBe("edit-answer");
    expect(
      within(evidence).getByRole("textbox", { name: "Expected answer" }),
    ).toBeInTheDocument();

    const actionArea = screen.getByRole("complementary", {
      name: "Practice Repair actions",
    });
    fireEvent.click(
      within(actionArea).getByRole("button", {
        name: "Split this Study Note",
      }),
    );

    await waitFor(() => {
      expect(router.state.location.search.mode).toBe("split-note");
    });
    expect(router.state.location.pathname).toBe(practiceRepairPath);
    expect(
      within(evidence).getByText("What stores transferable energy?"),
    ).toBeInTheDocument();
    expect(
      within(evidence).getByRole("textbox", {
        name: "New Study Note prompt",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(actionArea).getByRole("button", {
        name: "Add a memory aid",
      }),
    );

    await waitFor(() => {
      expect(router.state.location.search.mode).toBe("memory-aid");
    });
    expect(router.state.location.pathname).toBe(practiceRepairPath);
    expect(
      within(evidence).getByLabelText("Memory aid type"),
    ).toBeInTheDocument();
  });

  it("keeps Dismiss repair quiet and asks for confirmation before removing active work", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const weakStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "ATP stores transferable energy for cells.",
        prompt: "What stores transferable energy?",
        sourceBody: "Cell respiration source context.",
        sourceTitle: "Cell respiration source",
      },
    );

    completeStudyNoteRecallAt({
      rating: "hard",
      recallContext: contexts.recallContext,
      studyNoteId: weakStudyNote.id,
      timestamp: "2026-05-15T09:00:00.000Z",
    });

    const confirmedResult = confirmStudyNotePracticeRepair({
      correction:
        "State ATP directly and anchor the answer to energy transfer.",
      contexts,
      intent: "tighten-expected-answer",
      studyNoteId: weakStudyNote.id,
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    try {
      renderRoute(getConfirmedPracticeRepairPath(confirmedResult), {
        ...contexts,
        session: createSession(),
      });

      const actionArea = await screen.findByRole("complementary", {
        name: "Practice Repair actions",
      });
      const dismissButton = within(actionArea).getByRole("button", {
        name: "Dismiss repair",
      });
      expect(dismissButton).toHaveClass("notes-action-secondary");

      fireEvent.click(dismissButton);
      expect(confirmSpy).toHaveBeenCalledWith(
        "Dismiss this Practice Repair? It will leave the active queue but stay in Results history.",
      );
      expect(
        contexts.recallContext.listActivePracticeRepairEntriesForStudyNote({
          studyNoteId: weakStudyNote.id,
          userId: testUser.id,
        }),
      ).toHaveLength(1);

      confirmSpy.mockReturnValue(true);
      fireEvent.click(dismissButton);

      await screen.findByText("Practice Repair dismissed");
      expect(
        contexts.recallContext.listActivePracticeRepairEntriesForStudyNote({
          studyNoteId: weakStudyNote.id,
          userId: testUser.id,
        }),
      ).toHaveLength(0);
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it("does not offer Recall again before an active Practice Repair is complete", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const weakStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "ATP stores transferable energy for cells.",
        prompt: "What stores transferable energy?",
        sourceBody: "Cell respiration source context.",
        sourceTitle: "Cell respiration source",
      },
    );

    completeStudyNoteRecallAt({
      rating: "hard",
      recallContext: contexts.recallContext,
      studyNoteId: weakStudyNote.id,
      timestamp: "2026-05-15T09:00:00.000Z",
    });

    const confirmedResult = confirmStudyNotePracticeRepair({
      correction:
        "State ATP directly and anchor the answer to energy transfer.",
      contexts,
      intent: "tighten-expected-answer",
      studyNoteId: weakStudyNote.id,
    });

    renderRoute(getConfirmedPracticeRepairPath(confirmedResult), {
      ...contexts,
      session: createSession(),
    });

    expect(
      await screen.findByRole("button", { name: "Mark repair complete" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Recall again/ })).toBeNull();
  });

  it("keeps persistent active Practice Repair work on complete and dismiss actions", async () => {
    const sessionResults = [
      createStoredPracticeRepairResult({
        correction:
          "State ATP directly and anchor the answer to energy transfer.",
        id: "persistent-practice-repair-result",
      }),
    ];
    const startFlashCardSession = vi.fn(async () => ({
      attempts: [],
      createdAt: "2026-05-18T09:00:00.000Z",
      currentIndex: 0,
      currentQuestionIndex: 0,
      id: "persistent-follow-up-session",
      isAnswerRevealed: false,
      mode: "FlashCard" as const,
      notes: [
        createStoredRecallNote({
          id: "study-note-practice-repair",
        }),
      ],
      questions: [
        createStoredRecallQuestion({
          note: createStoredRecallNote({
            id: "study-note-practice-repair",
          }),
          score: null,
          selfRating: null,
        }),
      ],
    }));
    const persistentRecallContext = createPersistentRecallContext({
      service: createPersistentRecallService({
        listSessionResults: vi.fn(async () => sessionResults),
        startFlashCardSession,
      }),
    });

    renderRoute(getConfirmedPracticeRepairPath(sessionResults[0]), {
      persistentRecallContext,
      session: createSession(),
    });

    expect(
      await screen.findByRole("button", { name: "Mark repair complete" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Recall again/ })).toBeNull();
    expect(startFlashCardSession).not.toHaveBeenCalled();
  });

  it("saves current prompt and expected answer edits from Practice Repair without completing the entry", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const weakStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "ATP stores transferable energy for cells.",
        prompt: "What stores transferable energy?",
        sourceBody: "Cell respiration source context.",
        sourceTitle: "Cell respiration source",
      },
    );

    completeStudyNoteRecallAt({
      rating: "hard",
      recallContext: contexts.recallContext,
      studyNoteId: weakStudyNote.id,
      timestamp: "2026-05-15T09:00:00.000Z",
    });

    const confirmedResult = confirmStudyNotePracticeRepair({
      correction:
        "State ATP directly and anchor the answer to energy transfer.",
      contexts,
      intent: "tighten-expected-answer",
      studyNoteId: weakStudyNote.id,
    });
    renderRoute(getConfirmedPracticeRepairPath(confirmedResult), {
      ...contexts,
      session: createSession(),
    });

    const evidence = await screen.findByRole("region", {
      name: "Practice Repair evidence",
    });
    const promptInput = within(evidence).getByRole("textbox", {
      name: "Current prompt",
    });
    const expectedAnswerInput = within(evidence).getByRole("textbox", {
      name: "Expected answer",
    });

    fireEvent.change(promptInput, {
      target: { value: "What molecule transfers energy in cells?" },
    });
    fireEvent.change(expectedAnswerInput, {
      target: {
        value: "ATP transfers usable energy between cellular reactions.",
      },
    });

    fireEvent.click(
      within(evidence).getByRole("button", { name: /Save changes/ }),
    );

    await screen.findByText("Study Note changes saved");

    const updatedStudyNote = contexts.studyNotesContext
      .getSnapshot()
      .find((studyNote) => studyNote.id === weakStudyNote.id);
    expect(updatedStudyNote).toMatchObject({
      expectedAnswer: "ATP transfers usable energy between cellular reactions.",
      prompt: "What molecule transfers energy in cells?",
    });
    const updatedResult = contexts.recallContext
      .getSessionResultsSnapshot()
      .find((result) => result.id === confirmedResult.id);
    expect(
      updatedResult?.questions[0]?.practiceRepairEntry?.lifecycle?.completedAt,
    ).toBeUndefined();
  });

  it("shows the next step for a completed Practice Repair workspace", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const weakStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "ATP stores transferable energy for cells.",
        prompt: "What stores transferable energy?",
        sourceBody: "Cell respiration source context.",
        sourceTitle: "Cell respiration source",
      },
    );

    completeStudyNoteRecallAt({
      rating: "hard",
      recallContext: contexts.recallContext,
      studyNoteId: weakStudyNote.id,
      timestamp: "2026-05-15T09:00:00.000Z",
    });

    const confirmedResult = confirmStudyNotePracticeRepair({
      correction:
        "State ATP directly and anchor the answer to energy transfer.",
      contexts,
      intent: "tighten-expected-answer",
      studyNoteId: weakStudyNote.id,
    });

    contexts.recallContext.completePracticeRepairEntry({
      reference: getConfirmedPracticeRepairReference(confirmedResult),
      userId: testUser.id,
    });

    renderRoute(getConfirmedPracticeRepairPath(confirmedResult), {
      ...contexts,
      session: createSession(),
    });

    const actionArea = await screen.findByRole("complementary", {
      name: "Practice Repair actions",
    });
    expect(within(actionArea).queryByText("Entry state")).toBeNull();
    expect(
      within(actionArea).getByText(
        "Use Recall again soon after the repair work is complete to test this Study Note again.",
      ),
    ).toBeInTheDocument();
    expect(
      within(actionArea).getByText(
        "Results keeps the historical evidence. The follow-up closes only after you attempt recall again.",
      ),
    ).toBeInTheDocument();
  });

  it("starts targeted Recall again soon from a completed Practice Repair workspace without satisfying the follow-up on session start", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const weakStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "ATP stores transferable energy for cells.",
        prompt: "What stores transferable energy?",
        sourceBody: "Cell respiration source context.",
        sourceTitle: "Cell respiration source",
      },
    );

    completeStudyNoteRecallAt({
      rating: "hard",
      recallContext: contexts.recallContext,
      studyNoteId: weakStudyNote.id,
      timestamp: "2026-05-15T09:00:00.000Z",
    });

    const confirmedResult = confirmStudyNotePracticeRepair({
      correction:
        "State ATP directly and anchor the answer to energy transfer.",
      contexts,
      intent: "tighten-expected-answer",
      studyNoteId: weakStudyNote.id,
    });
    const confirmedReference =
      getConfirmedPracticeRepairReference(confirmedResult);

    contexts.recallContext.completePracticeRepairEntry({
      reference: confirmedReference,
      userId: testUser.id,
    });

    const { router } = renderRoute(
      getConfirmedPracticeRepairPath(confirmedResult),
      {
        ...contexts,
        session: createSession(),
      },
    );

    const actionArea = await screen.findByRole("complementary", {
      name: "Practice Repair actions",
    });

    fireEvent.click(
      within(actionArea).getByRole("button", {
        name: "Recall again soon",
      }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/recall/session");
    });
    expect(await screen.findByText(weakStudyNote.prompt)).toBeInTheDocument();

    const startedSession = contexts.recallContext.getSnapshot();

    expect(startedSession?.notes).toMatchObject([
      {
        id: weakStudyNote.id,
      },
    ]);
    expect(startedSession?.notes).toHaveLength(1);
    expect(
      contexts.recallContext.listPracticeRepairEntriesForQuestion({
        reference: confirmedReference,
        userId: testUser.id,
      })[0]?.followUpSatisfaction,
    ).toBeUndefined();
  });

  it.each([
    {
      expectedNextStep:
        "A later recall attempt closed this repair loop, so this entry stays available as history only.",
      expectedSupport:
        "Results keeps the historical evidence that led to this repair and the later recall that closed it.",
      lifecycle: {
        completedAt: "2026-05-18T08:45:00.000Z",
        followUpSatisfiedAt: "2026-05-18T09:00:00.000Z",
      },
      stateName: "follow-up-satisfied",
    },
    {
      expectedNextStep:
        "Use Results for the historical evidence because this Study Note is no longer available for active repair.",
      expectedSupport:
        "Results keeps the historical evidence even though the original Study Note no longer exists.",
      lifecycle: {
        studyNoteDeletedAt: "2026-05-18T09:00:00.000Z",
      },
      stateName: "deleted-note",
    },
  ])("renders the $stateName Practice Repair workspace with historical next steps", async ({
    expectedNextStep,
    expectedSupport,
    lifecycle,
    stateName,
  }) => {
    const storedResult = createStoredPracticeRepairResult({
      id: `stored-practice-repair-${stateName}`,
      lifecycle,
    });
    const persistentRecallContext = createPersistentRecallContext({
      service: createPersistentRecallService({
        listSessionResults: vi.fn(async () => [storedResult]),
      }),
    });

    renderRoute(getConfirmedPracticeRepairPath(storedResult), {
      persistentRecallContext,
      session: createSession(),
    });

    const actionArea = await screen.findByRole("complementary", {
      name: "Practice Repair actions",
    });
    expect(within(actionArea).queryByText("Entry state")).toBeNull();
    expect(within(actionArea).getByText(expectedNextStep)).toBeInTheDocument();
    expect(within(actionArea).getByText(expectedSupport)).toBeInTheDocument();
    expect(
      within(actionArea).getByRole("link", { name: "Open Results" }),
    ).toBeInTheDocument();
    expect(
      within(actionArea).queryByRole("button", {
        name: "Mark repair complete",
      }),
    ).toBeNull();
    expect(
      within(actionArea).queryByRole("button", { name: "Dismiss repair" }),
    ).toBeNull();

    if (stateName === "deleted-note") {
      expect(screen.queryByRole("link", { name: "View full note" })).toBeNull();
    } else {
      expect(
        screen.getByRole("link", { name: "View full note" }),
      ).toBeInTheDocument();
    }
  });

  it("links a superseded Practice Repair workspace to the newer active entry", async () => {
    const supersededResult = createStoredPracticeRepairResult({
      correction: "Older Practice Repair correction.",
      id: "stored-practice-repair-superseded",
      lifecycle: {
        supersededAt: "2026-05-18T09:00:00.000Z",
      },
    });
    const supersededEntry = supersededResult.questions[0]?.practiceRepairEntry;

    if (supersededEntry === undefined) {
      throw new Error("Expected a superseded Practice Repair entry.");
    }

    const newerReference = {
      ...supersededEntry.reference,
      questionResultId: "stored-practice-repair-newer-question-0",
      sessionResultId: "stored-practice-repair-newer",
    };
    const newerResult = createStoredPracticeRepairResult({
      correction: "Newer Practice Repair correction.",
      id: "stored-practice-repair-newer",
      note: supersededResult.notes[0],
      practiceRepairEntryId: createPracticeRepairEntryId(newerReference),
      questionResultId: newerReference.questionResultId,
    });
    const persistentRecallContext = createPersistentRecallContext({
      service: createPersistentRecallService({
        listSessionResults: vi.fn(async () => [newerResult, supersededResult]),
      }),
    });
    const { router } = renderRoute(
      getConfirmedPracticeRepairPath(supersededResult),
      {
        persistentRecallContext,
        session: createSession(),
      },
    );

    const actionArea = await screen.findByRole("complementary", {
      name: "Practice Repair actions",
    });

    expect(within(actionArea).queryByText("Entry state")).toBeNull();

    fireEvent.click(
      within(actionArea).getByRole("link", {
        name: "Open newer Practice Repair",
      }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        getConfirmedPracticeRepairPath(newerResult),
      );
    });
    expect(
      await screen.findByRole("button", { name: "Mark repair complete" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Recall again/ })).toBeNull();
  });

  it("falls back to the Practice Repair queue when a Practice Repair entry is missing", async () => {
    const { router } = renderRoute("/practice-repair/missing-entry", {
      session: createSession(),
    });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Practice Repair",
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/practice-repair");
  });

  it("shows route-owned Practice Repair readiness states while protected refresh is pending", async () => {
    const scenarios = [
      {
        expectedSkeletonCount: 2,
        label: "Preparing Practice Repair queue",
        path: "/practice-repair",
        skeletonSelector: ".recall-practice-repair-readiness__section",
      },
      {
        expectedSkeletonCount: 1,
        label: "Preparing Practice Repair workspace",
        path: "/practice-repair/pending-entry",
        skeletonSelector: ".recall-practice-repair-workspace__current-editor",
      },
      {
        expectedSkeletonCount: 4,
        label: "Preparing Practice Repair draft view",
        path: "/practice-repair/results/pending-result/questions/pending-question",
        skeletonSelector: ".recall-practice-repair-readiness__option",
      },
    ] as const;

    for (const scenario of scenarios) {
      const listSessionResults = vi.fn(() =>
        createPendingPromise<SessionResult[]>(),
      );
      const listStudyNotes = vi.fn(() =>
        createPendingPromise<AppStudyNote[]>(),
      );
      const persistentRecallContext = createPersistentRecallContext({
        service: createPersistentRecallService({
          listSessionResults,
        }),
      });
      const persistentStudyNotesContext = createPersistentStudyNotesContext({
        service: createPersistentStudyNotesService({
          listStudyNotes,
        }),
      });
      const routeRender = renderRoute(scenario.path, {
        persistentRecallContext,
        persistentStudyNotesContext,
        session: createSession(),
      });

      await waitFor(() => {
        expect(listSessionResults).toHaveBeenCalled();
        expect(listStudyNotes).toHaveBeenCalled();
      });
      expect(
        await screen.findByRole("region", {
          name: scenario.label,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("status", {
          name: scenario.label,
        }),
      ).toBeInTheDocument();
      expect(document.querySelectorAll(scenario.skeletonSelector)).toHaveLength(
        scenario.expectedSkeletonCount,
      );
      expect(
        screen.queryByRole("heading", {
          level: 1,
          name: "Practice Repair",
        }),
      ).not.toBeInTheDocument();

      routeRender.unmount();
    }
  });

  it("uses the route-hydrated session to load Recall setup notes immediately", async () => {
    const contexts = createDeterministicRecallTestContexts();
    contexts.studyNotesContext.createStudyNote(testUser.id, {
      sourceBody: "Recall body",
      sourceTitle: "Recall Study Note",
    });

    renderRoute("/recall/select", {
      ...contexts,
      sessionContext: createRouteHydratedSessionContext(createSession()),
    });

    const availableNotes = await screen.findByRole("region", {
      name: "Available Study Notes",
    });
    expect(
      within(availableNotes).getByText("Recall Study Note"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Recall starts with Study Notes" }),
    ).not.toBeInTheDocument();
  });

  it("uses the route-hydrated session when refreshing persistent Recall results", async () => {
    const persistentRecallContext = createPersistentRecallContext({
      service: createPersistentRecallService({
        listSessionResults: vi.fn(async () => [createStoredSessionResult()]),
      }),
    });

    renderRoute("/recall/results", {
      persistentRecallContext,
      sessionContext: createRouteHydratedSessionContext(createSession()),
    });

    await waitFor(() => {
      expect(
        persistentRecallContext.readonlyContext.listSessionResults({
          userId: testUser.id,
        }),
      ).toHaveLength(1);
    });

    const selectedResult = await screen.findByRole("region", {
      name: "Selected result",
    });
    await waitFor(() => {
      expect(
        within(selectedResult).getAllByText("Stored prompt title").length,
      ).toBeGreaterThan(0);
    });
  });

  it("does not crash when switching from Recall results to Notes if a persisted result has an overflowing completed timestamp", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const note = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Recall body",
      title: "Recall note",
    });
    const persistentRecallContext = createPersistentRecallContext({
      service: createPersistentRecallService({
        listSessionResults: vi.fn(async () => [
          createStoredSessionResult({
            completedAt: "+275760-09-13T00:00:00.000Z",
            createdAt: "2026-05-02T12:00:00.000Z",
            id: "session-invalid-date",
            note,
            score: null,
          }),
        ]),
      }),
    });

    const routeRender = renderRoute("/recall/results", {
      ...contexts,
      persistentRecallContext,
      session: createSession(),
    });

    expect(
      await screen.findByRole("region", { name: "Selected result" }),
    ).toBeInTheDocument();

    await routeRender.router.navigate({ to: "/study-notes" });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Study Notes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "New Study Note" }),
    ).toBeInTheDocument();
  });

  it("keeps the Results layout empty state when Notes exist but Results do not", async () => {
    const contexts = createDeterministicRecallTestContexts();
    createRecallNote(contexts.notesContext, testUser.id, {
      body: "Recall body",
      title: "Recall note",
    });

    renderRoute("/recall/results", { ...contexts, session: createSession() });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Results",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Recall results" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("No results yet").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Results will appear here.").length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Custom recall" })).toHaveAttribute(
      "href",
      "/recall/select",
    );
    expect(screen.queryByRole("link", { name: "Start Recall" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    expect(
      screen.getByRole("option", { name: "All modes" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Showing/)).toBeNull();
  });

  it("keeps Results start recall focused on Recall Selection when Due today has work", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const dueTodayStudyNote = createStudyNoteSnapshot(contexts, {
      expectedAnswer: "Due today answer.",
      labelIds: [],
      prompt: "Due today prompt",
      sourceBody: "Due today source.",
      sourceTitle: "Due today source",
    });

    completeStudyNoteRecallAt({
      rating: "good",
      recallContext: contexts.recallContext,
      studyNoteId: dueTodayStudyNote.id,
      timestamp: "2026-05-11T09:00:00.000Z",
    });
    vi.setSystemTime(new Date("2026-05-15T10:00:00.000Z"));

    const { router } = renderRoute("/recall/results", {
      ...contexts,
      session: {
        user: {
          ...testUser,
          userTimeZone: "America/New_York",
        },
      },
    });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Results",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Selected result" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Custom recall" })).toHaveAttribute(
      "href",
      "/recall/select",
    );
    expect(
      screen.queryByRole("button", { name: "Start scheduled recall" }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("link", { name: "Custom recall" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/recall/select");
    });
  });

  it("explains empty Due today when Study Notes are not schedule-due", async () => {
    const contexts = createDeterministicRecallTestContexts();
    contexts.studyNotesContext.createStudyNote(testUser.id, {
      expectedAnswer: " ",
      prompt: "Draft Study Note",
      sourceBody: "Draft source.",
      sourceTitle: "Draft source",
    });

    renderRoute("/recall/due-today", {
      ...contexts,
      session: createSession(),
    });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Scheduled recall",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Nothing is scheduled for recall right now. Start a custom recall session or return to Recall Today for broader priorities.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Custom recall" })).toHaveAttribute(
      "href",
      "/recall/select",
    );
    expect(
      screen.queryByRole("button", { name: "Start scheduled recall" }),
    ).toBeNull();
  });

  it("keeps /recall on the Recall Today shell without in-page Recall navigation", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const dueToday = createStudyNoteSnapshot(contexts, {
      expectedAnswer: "Due today answer.",
      labelIds: [],
      prompt: "Due today prompt",
      sourceBody: "Due today source.",
      sourceTitle: "Due today source",
    });

    completeStudyNoteRecallAt({
      rating: "good",
      recallContext: contexts.recallContext,
      studyNoteId: dueToday.id,
      timestamp: "2026-05-14T09:00:00.000Z",
    });
    vi.setSystemTime(new Date("2026-05-15T10:00:00.000Z"));

    const { router } = renderRoute("/recall", {
      ...contexts,
      session: {
        user: {
          ...testUser,
          userTimeZone: "America/New_York",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Recall Today" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your recommended recall queue for today."),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
    expect(screen.getByRole("link", { name: "Choose notes" })).toHaveAttribute(
      "href",
      "/recall/select",
    );

    expect(
      screen.queryByRole("navigation", { name: "Recall pages" }),
    ).not.toBeInTheDocument();
  });

  it("opens Due today directly and starts a FlashCard session from its queue", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const needsPractice = createStudyNoteSnapshot(contexts, {
      expectedAnswer: "Needs practice answer.",
      labelIds: [],
      prompt: "Needs practice prompt",
      sourceBody: "Needs practice source.",
      sourceTitle: "Needs practice source",
    });
    createStudyNoteSnapshot(contexts, {
      expectedAnswer: "Not recalled answer.",
      labelIds: [],
      prompt: "Not recalled prompt",
      sourceBody: "Not recalled source.",
      sourceTitle: "Not recalled source",
    });
    const dueForRecall = createStudyNoteSnapshot(contexts, {
      expectedAnswer: "Due answer.",
      labelIds: [],
      prompt: "Due prompt",
      sourceBody: "Due source.",
      sourceTitle: "Due source",
    });
    createStudyNoteSnapshot(contexts, {
      expectedAnswer: " ",
      labelIds: [],
      prompt: "Incomplete prompt",
      sourceBody: "Incomplete source.",
      sourceTitle: "Incomplete source",
    });

    completeStudyNoteRecallAt({
      rating: "hard",
      recallContext: contexts.recallContext,
      studyNoteId: needsPractice.id,
      timestamp: "2026-05-14T09:00:00.000Z",
    });
    completeStudyNoteRecallAt({
      rating: "good",
      recallContext: contexts.recallContext,
      studyNoteId: dueForRecall.id,
      timestamp: "2026-05-11T09:00:00.000Z",
    });
    vi.setSystemTime(new Date("2026-05-15T10:00:00.000Z"));

    const { router } = renderRoute("/recall/due-today", {
      ...contexts,
      session: {
        user: {
          ...testUser,
          userTimeZone: "America/New_York",
        },
      },
    });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Scheduled recall",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("May 15, 2026").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Custom recall" })).toBeNull();

    const summary = screen.getByRole("region", {
      name: "Scheduled recall summary",
    });
    expect(summary).toHaveTextContent("1 note ready·1 overdue·0 later today");
    expect(summary).toHaveTextContent("Overdue notes are recalled first.");

    const disclosure = screen.getByRole("button", {
      name: "How scheduled recall works",
    });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByText(
        "Only scheduled Study Notes appear here. Active repair stays in Recall Today and Practice Repair.",
      ),
    ).toBeNull();
    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(
        "Only scheduled Study Notes appear here. Active repair stays in Recall Today and Practice Repair.",
      ),
    ).toBeInTheDocument();

    const dueTodayQueue = screen.getByRole("region", {
      name: "Scheduled recall queue",
    });
    expect(
      within(dueTodayQueue).getByRole("heading", {
        level: 2,
        name: "Ready for scheduled recall 1",
      }),
    ).toBeInTheDocument();
    expect(dueTodayQueue).toHaveTextContent("Due prompt");
    expect(dueTodayQueue).toHaveTextContent(
      "Last result:Good·Overdue since May 14, 2026",
    );
    expect(dueTodayQueue).not.toHaveTextContent("Needs practice prompt");
    expect(dueTodayQueue).not.toHaveTextContent("Not recalled prompt");
    expect(dueTodayQueue).not.toHaveTextContent("Incomplete prompt");

    fireEvent.click(
      screen.getByRole("button", { name: "Start scheduled recall" }),
    );

    await screen.findByRole("heading", { level: 3, name: "Recall session" });
    expect(router.state.location.pathname).toBe("/recall/session");
  });

  it("keeps active unresolved Practice Repair work out of Due today", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const dueStudyNote = createStudyNoteSnapshot(contexts, {
      expectedAnswer: "Needs practice answer.",
      labelIds: [],
      prompt: "Needs practice prompt",
      sourceBody: "Needs practice source.",
      sourceTitle: "Needs practice source",
    });

    completeStudyNoteRecallAt({
      rating: "hard",
      recallContext: contexts.recallContext,
      studyNoteId: dueStudyNote.id,
      timestamp: "2026-05-14T09:00:00.000Z",
    });
    confirmStudyNotePracticeRepair({
      contexts,
      correction: "Tighten the answer before recalling again.",
      intent: "tighten-expected-answer",
      studyNoteId: dueStudyNote.id,
    });
    vi.setSystemTime(new Date("2026-05-15T10:00:00.000Z"));

    renderRoute("/recall/due-today", {
      ...contexts,
      session: {
        user: {
          ...testUser,
          userTimeZone: "America/New_York",
        },
      },
    });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Scheduled recall",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Needs practice prompt")).toBeNull();
    expect(screen.getByText("Nothing scheduled today")).toBeInTheDocument();
  });

  it("keeps schedule-due Practice Follow-ups out of Due today", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const practiceFollowUp = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "ATP stores transferable energy for cells.",
        prompt: "What stores transferable energy?",
        sourceBody: "Cell respiration source context.",
        sourceTitle: "Cell respiration source",
      },
    );
    const needsPracticeOnly = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "Mitochondria generate ATP.",
        prompt: "What organelle generates ATP?",
        sourceBody: "Cell organelles source context.",
        sourceTitle: "Cell organelles source",
      },
    );

    completeStudyNoteRecallAt({
      rating: "hard",
      recallContext: contexts.recallContext,
      studyNoteId: practiceFollowUp.id,
      timestamp: "2026-05-14T09:00:00.000Z",
    });

    const confirmedRepair = confirmStudyNotePracticeRepair({
      contexts,
      correction: "State ATP and explain that it stores transferable energy.",
      intent: "tighten-expected-answer",
      studyNoteId: practiceFollowUp.id,
    });

    contexts.recallContext.completePracticeRepairEntry({
      reference: getConfirmedPracticeRepairReference(confirmedRepair),
      userId: testUser.id,
    });

    completeStudyNoteRecallAt({
      rating: "hard",
      recallContext: contexts.recallContext,
      studyNoteId: needsPracticeOnly.id,
      timestamp: "2026-05-14T10:00:00.000Z",
    });
    vi.setSystemTime(new Date("2026-05-15T10:00:00.000Z"));

    renderRoute("/recall/due-today", {
      ...contexts,
      session: {
        user: {
          ...testUser,
          userTimeZone: "America/New_York",
        },
      },
    });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Scheduled recall",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", {
        name: "Scheduled recall queue",
      }),
    ).toBeNull();
    expect(screen.queryByText("What stores transferable energy?")).toBeNull();
    expect(screen.queryByText("What organelle generates ATP?")).toBeNull();
    expect(screen.getByText("Nothing scheduled today")).toBeInTheDocument();
  });

  it("keeps schedule-future Practice Follow-ups out of Due today", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const practiceFollowUp = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "ATP stores transferable energy for cells.",
        prompt: "What stores transferable energy?",
        sourceBody: "Cell respiration source context.",
        sourceTitle: "Cell respiration source",
      },
    );

    completeStudyNoteRecallAt({
      rating: "hard",
      recallContext: contexts.recallContext,
      studyNoteId: practiceFollowUp.id,
      timestamp: "2026-05-14T09:00:00.000Z",
    });

    const confirmedRepair = confirmStudyNotePracticeRepair({
      contexts,
      correction: "State ATP and explain that it stores transferable energy.",
      intent: "tighten-expected-answer",
      studyNoteId: practiceFollowUp.id,
    });

    contexts.recallContext.completePracticeRepairEntry({
      reference: getConfirmedPracticeRepairReference(confirmedRepair),
      userId: testUser.id,
    });

    vi.setSystemTime(new Date("2026-05-14T10:00:00.000Z"));

    renderRoute("/recall/due-today", {
      ...contexts,
      session: {
        user: {
          ...testUser,
          userTimeZone: "America/New_York",
        },
      },
    });

    expect(
      await screen.findByText("Nothing scheduled today"),
    ).toBeInTheDocument();
    expect(screen.queryByText("What stores transferable energy?")).toBeNull();
  });

  it("keeps completed Practice Follow-ups visible in Results context", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const practiceFollowUp = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "ATP stores transferable energy for cells.",
        prompt: "What stores transferable energy?",
        sourceBody: "Cell respiration source context.",
        sourceTitle: "Cell respiration source",
      },
    );

    completeStudyNoteRecallAt({
      rating: "hard",
      recallContext: contexts.recallContext,
      studyNoteId: practiceFollowUp.id,
      timestamp: "2026-05-14T09:00:00.000Z",
    });

    const confirmedRepair = confirmStudyNotePracticeRepair({
      contexts,
      correction: "State ATP and explain that it stores transferable energy.",
      intent: "tighten-expected-answer",
      studyNoteId: practiceFollowUp.id,
    });

    contexts.recallContext.completePracticeRepairEntry({
      reference: getConfirmedPracticeRepairReference(confirmedRepair),
      userId: testUser.id,
    });

    renderRoute("/recall/results", {
      ...contexts,
      session: createSession(),
    });

    const selectedResult = await screen.findByRole("region", {
      name: "Selected result",
    });

    fireEvent.click(
      within(selectedResult).getByRole("button", {
        name: /What stores transferable energy\?/i,
      }),
    );

    expect(
      within(selectedResult).getByText("Actionable in Recall Today"),
    ).toBeInTheDocument();
  });

  it("opens the canonical Practice Repair workspace from confirmed Results evidence", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const practiceRepairStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "ATP stores transferable energy for cells.",
        prompt: "What stores transferable energy?",
        sourceBody: "Cell respiration source context.",
        sourceTitle: "Cell respiration source",
      },
    );

    completeStudyNoteRecallAt({
      rating: "hard",
      recallContext: contexts.recallContext,
      studyNoteId: practiceRepairStudyNote.id,
      timestamp: "2026-05-14T09:00:00.000Z",
    });

    const confirmedRepair = confirmStudyNotePracticeRepair({
      contexts,
      correction: "State ATP and explain that it stores transferable energy.",
      intent: "tighten-expected-answer",
      studyNoteId: practiceRepairStudyNote.id,
    });
    const practiceRepairPath = getConfirmedPracticeRepairPath(confirmedRepair);
    const { router } = renderRoute("/recall/results", {
      ...contexts,
      session: createSession(),
    });

    const selectedResult = await screen.findByRole("region", {
      name: "Selected result",
    });

    fireEvent.click(
      within(selectedResult).getByRole("button", {
        name: /What stores transferable energy\?/i,
      }),
    );

    const openPracticeRepairLink = within(selectedResult).getByRole("link", {
      name: "Open Practice Repair",
    });
    expect(openPracticeRepairLink).toHaveAttribute("href", practiceRepairPath);

    fireEvent.click(openPracticeRepairLink);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Practice Repair",
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(practiceRepairPath);
  });

  it("selects the newest Result by default and changes selection without changing route", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const olderNote = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Older result body.",
      title: "Older result note",
    });
    const newerNote = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Newest result body.",
      title: "Newest result note",
    });

    completeRecallAt({
      noteId: olderNote.id,
      rating: "hard",
      recallContext: contexts.recallContext,
      timestamp: "2026-04-01T09:00:00.000Z",
    });
    completeRecallAt({
      noteId: newerNote.id,
      rating: "easy",
      recallContext: contexts.recallContext,
      timestamp: "2026-04-02T09:00:00.000Z",
    });

    const { router } = renderRoute("/recall/results", {
      ...contexts,
      session: createSession(),
    });

    const detail = await screen.findByRole("region", {
      name: "Selected result",
    });
    expect(
      within(detail).getAllByText("Newest result note").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("2 sessions shown")).toBeInTheDocument();

    const results = screen.getByRole("region", { name: "Recall results" });
    const resultButtons = within(results).getAllByRole("button");
    fireEvent.click(resultButtons[2]);

    expect(router.state.location.pathname).toBe("/recall/results");
    expect(
      within(detail).getAllByText("Older result note").length,
    ).toBeGreaterThan(0);
  });

  it("filters Results by search, label, and Recall type in the main content", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const label = contexts.labelsContext.createLabel({
      name: "Neuroscience",
      userId: testUser.id,
    });
    const labeledNote = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Synapse snapshot.",
      labelIds: [label.id],
      title: "Labeled result",
    });
    const plainNote = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Plain snapshot.",
      title: "Plain result",
    });

    completeRecallAt({
      noteId: labeledNote.id,
      rating: "good",
      recallContext: contexts.recallContext,
      timestamp: "2026-04-02T09:00:00.000Z",
    });
    completeRecallAt({
      noteId: plainNote.id,
      rating: "easy",
      recallContext: contexts.recallContext,
      timestamp: "2026-04-03T09:00:00.000Z",
    });

    renderRoute("/recall/results", { ...contexts, session: createSession() });

    await screen.findByRole("region", { name: "Recall results" });
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.change(screen.getByLabelText("Filter results by label"), {
      target: { value: label.id },
    });
    expect(screen.getAllByText("Labeled result").length).toBeGreaterThan(0);
    expect(screen.queryByText("Plain result")).toBeNull();

    fireEvent.change(screen.getByLabelText("Search results"), {
      target: { value: "plain" },
    });
    expect(screen.getByText("No matching results")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter results by recall type"), {
      target: { value: "AiAssisted" },
    });
    expect(screen.getByText("No matching results")).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(screen.getByRole("button", { name: "Filter" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(
      screen.getByLabelText("Filter results by label").closest("div"),
    ).toHaveAttribute("hidden");
  });

  it("selects Study Notes, blocks disabled AI Recall types, clears selection, and starts FlashCard", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const studyNote = contexts.studyNotesContext.createStudyNote(testUser.id, {
      acronyms: [{ description: "ABC remembers retrieval steps." }],
      sourceBody: "Searchable source context.",
      sourceTitle: "Searchable source",
      metaphors: [{ description: "A lighthouse for recall." }],
    });
    contexts.studyNotesContext.updateStudyNote(testUser.id, studyNote.id, {
      acceptedVariants: [],
      acronyms: [{ description: "ABC remembers retrieval steps." }],
      expectedAnswer: "Searchable expected answer.",
      keyIdeas: [],
      labelIds: [],
      metaphors: [{ description: "A lighthouse for recall." }],
      prompt: "Searchable Study Note",
      prohibitedPhrases: [],
      sourceBody: "Searchable source context.",
      sourceTitle: "Searchable source",
    });

    const { router } = renderRoute("/recall/select", {
      ...contexts,
      session: createSession(),
    });

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Select Study Notes",
      }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search Study Notes"), {
      target: { value: "lighthouse" },
    });
    expect(screen.getByText("1 metaphor · 1 acronym")).toBeInTheDocument();
    expect(screen.queryByText("Metaphors")).toBeNull();
    expect(screen.queryByText("Acronyms")).toBeNull();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Searchable Study Note/ }),
    );

    fireEvent.click(screen.getByRole("radio", { name: /AI Assisted/ }));
    expect(screen.getByRole("button", { name: "Start recall" })).toBeDisabled();
    expect(
      screen.getByText("Connect API key to start AI Assisted."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /FlashCard/ }));
    expect(screen.getByRole("button", { name: "Start recall" })).toBeEnabled();

    fireEvent.click(
      screen.getByRole("checkbox", { name: /Searchable Study Note/ }),
    );
    expect(screen.getByRole("button", { name: "Start recall" })).toBeDisabled();

    fireEvent.click(
      screen.getByRole("checkbox", { name: /Searchable Study Note/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Start recall" }));

    await screen.findByRole("heading", { level: 3, name: "Recall session" });
    expect(router.state.location.pathname).toBe("/recall/session");
  });

  it("filters Study Notes by Label from the dropdown and selects all visible recallable matches", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const biologyLabel = contexts.labelsContext.createLabel({
      name: "Biology",
      userId: testUser.id,
    });
    const historyLabel = contexts.labelsContext.createLabel({
      name: "History",
      userId: testUser.id,
    });
    const selectedBiologyStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        labelIds: [biologyLabel.id],
        prompt: "Selected biology Study Note",
        sourceBody: "Selected biology answer.",
        sourceTitle: "Selected biology source",
      },
    );
    const addedBiologyStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        labelIds: [biologyLabel.id],
        prompt: "Added biology Study Note",
        sourceBody: "Added biology answer.",
        sourceTitle: "Added biology source",
      },
    );
    const incompleteBiologyStudyNote =
      contexts.studyNotesContext.createStudyNote(testUser.id, {
        expectedAnswer: "",
        labelIds: [biologyLabel.id],
        prompt: "Incomplete biology Study Note",
        sourceBody: "Incomplete biology source.",
        sourceTitle: "Incomplete biology source",
      });
    contexts.studyNotesContext.createStudyNote(testUser.id, {
      labelIds: [historyLabel.id],
      prompt: "History Study Note",
      sourceBody: "History answer.",
      sourceTitle: "History source",
    });

    const { router } = renderRoute("/recall/select", {
      ...contexts,
      session: createSession(),
    });

    await screen.findByRole("complementary", { name: "Session setup" });
    fireEvent.change(screen.getByLabelText("Filter Study Notes by label"), {
      target: { value: biologyLabel.id },
    });

    expect(screen.getByText("3 notes shown")).toBeInTheDocument();
    expect(screen.getAllByText("Biology").length).toBeGreaterThan(0);
    expect(screen.getByText("Selected biology Study Note")).toBeInTheDocument();
    expect(screen.getByText("Added biology Study Note")).toBeInTheDocument();
    expect(
      screen.getByText("Incomplete biology Study Note"),
    ).toBeInTheDocument();
    expect(screen.queryByText("History Study Note")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Select all from current view" }),
    );

    const sessionSetup = screen.getByRole("complementary", {
      name: "Session setup",
    });
    expect(
      within(sessionSetup).getByText("2 notes selected", {
        selector: ".recall-select-session-setup__selected-count",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /Selected biology Study Note/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Added biology Study Note/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Incomplete biology Study Note/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: /Incomplete biology Study Note/ }),
    ).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Reset current view" }));
    expect(
      within(sessionSetup).getByText("0 notes selected", {
        selector: ".recall-select-session-setup__selected-count",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /Selected biology Study Note/ }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Added biology Study Note/ }),
    ).not.toBeChecked();

    fireEvent.click(
      screen.getByRole("button", { name: "Select all from current view" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Reset",
      }),
    );
    expect(
      within(sessionSetup).getByText("0 notes selected", {
        selector: ".recall-select-session-setup__selected-count",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Select all from current view" }),
    );
    fireEvent.click(
      within(sessionSetup).getByRole("button", {
        name: "Remove Selected biology Study Note",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Start recall" }));

    await screen.findByRole("heading", { level: 3, name: "Recall session" });
    const startedStudyNoteIds =
      contexts.recallContext.getSnapshot()?.notes.map((note) => note.id) ?? [];

    expect(startedStudyNoteIds).toEqual([addedBiologyStudyNote.id]);
    expect(startedStudyNoteIds).not.toContain(selectedBiologyStudyNote.id);
    expect(startedStudyNoteIds).not.toContain(incompleteBiologyStudyNote.id);
    expect(router.state.location.pathname).toBe("/recall/session");
  });

  it("shows selected Study Note label context and remove controls in Session setup", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const biologyLabel = contexts.labelsContext.createLabel({
      name: "Biology",
      userId: testUser.id,
    });
    const examOneLabel = contexts.labelsContext.createLabel({
      name: "Exam 1",
      userId: testUser.id,
    });
    const chemistryLabel = contexts.labelsContext.createLabel({
      name: "Chemistry",
      userId: testUser.id,
    });
    const chemistryStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        labelIds: [chemistryLabel.id],
        sourceBody: "Manual chemistry answer.",
        sourceTitle: "Manual chemistry Study Note",
      },
    );
    const biologyStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        labelIds: [biologyLabel.id, examOneLabel.id],
        sourceBody: "Biology exam answer.",
        sourceTitle: "Biology exam Study Note",
      },
    );

    renderRoute("/recall/select", {
      ...contexts,
      session: createSession(),
    });

    const sessionSetup = await screen.findByRole("complementary", {
      name: "Session setup",
    });

    fireEvent.click(
      screen.getByRole("checkbox", { name: /Manual chemistry Study Note/ }),
    );
    fireEvent.change(screen.getByLabelText("Filter Study Notes by label"), {
      target: { value: biologyLabel.id },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Select all from current view" }),
    );

    const selectedStudyNotesList = within(sessionSetup).getByRole("list", {
      name: "Selected Study Notes",
    });
    const getSelectedStudyNoteRow = (prompt: string) => {
      const row = within(selectedStudyNotesList)
        .getByText(prompt)
        .closest("li");

      if (row === null) {
        throw new Error(`Missing selected Study Note row for "${prompt}".`);
      }

      return row;
    };
    const chemistrySelectedRow = getSelectedStudyNoteRow(
      chemistryStudyNote.prompt,
    );
    const biologySelectedRow = getSelectedStudyNoteRow(biologyStudyNote.prompt);

    expect(
      within(chemistrySelectedRow).getByText("Chemistry"),
    ).toBeInTheDocument();
    expect(within(biologySelectedRow).getByText("Biology")).toBeInTheDocument();
    expect(within(biologySelectedRow).getByText("Exam 1")).toBeInTheDocument();
    expect(
      within(chemistrySelectedRow).getByRole("button", {
        name: `Remove ${chemistryStudyNote.prompt}`,
      }),
    ).toBeInTheDocument();
    expect(within(chemistrySelectedRow).queryByRole("checkbox")).toBeNull();
  });

  it("keeps the label filter as an optional dropdown when the User has no Labels", async () => {
    const contexts = createDeterministicRecallTestContexts();
    contexts.studyNotesContext.createStudyNote(testUser.id, {
      sourceBody: "Standalone answer.",
      sourceTitle: "Standalone Study Note",
    });

    renderRoute("/recall/select", {
      ...contexts,
      session: createSession(),
    });

    await screen.findByRole("complementary", { name: "Session setup" });

    expect(screen.getByLabelText("Filter Study Notes by label")).toHaveValue(
      "",
    );
    expect(
      screen.getByRole("button", { name: "Select all from current view" }),
    ).toBeEnabled();
    expect(screen.queryByText("Add Study Notes from Labels")).toBeNull();
  });

  it("starts persistent dropdown-selected recall with only final Study Note ids and no Label provenance", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const biologyLabel = contexts.labelsContext.createLabel({
      name: "Biology",
      userId: testUser.id,
    });
    const selectedBiologyStudyNote = createStudyNoteSnapshot(contexts, {
      expectedAnswer: "Selected biology answer.",
      labelIds: [biologyLabel.id],
      prompt: "Selected biology Study Note",
      sourceBody: "Selected biology source.",
      sourceTitle: "Selected biology source",
    });
    const addedBiologyStudyNote = createStudyNoteSnapshot(contexts, {
      expectedAnswer: "Added biology answer.",
      labelIds: [biologyLabel.id],
      prompt: "Added biology Study Note",
      sourceBody: "Added biology source.",
      sourceTitle: "Added biology source",
    });
    const addedBiologyRecallNote = createRecallNoteSnapshotFromStudyNote(
      addedBiologyStudyNote,
      {
        labels: [createRecallLabelSnapshot(biologyLabel)],
      },
    );
    const startedSession = createStartedFlashCardSession({
      id: "persistent-label-add-session",
      note: addedBiologyRecallNote,
    });
    const startFlashCardSession = vi.fn<
      AppPersistentRecallService["startFlashCardSession"]
    >(async () => startedSession);
    const persistentRecallContext = createPersistentRecallContext({
      service: createPersistentRecallService({
        startFlashCardSession,
      }),
    });

    const { router } = renderRoute(
      `/recall/select?studyNoteIds=${selectedBiologyStudyNote.id}`,
      {
        ...contexts,
        persistentRecallContext,
        recallContext: persistentRecallContext.readonlyContext,
        session: createSession(),
      },
    );

    await screen.findByRole("complementary", { name: "Session setup" });
    fireEvent.change(screen.getByLabelText("Filter Study Notes by label"), {
      target: { value: biologyLabel.id },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Select all from current view" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove Selected biology Study Note",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Start recall" }));

    await screen.findByRole("heading", { level: 3, name: "Recall session" });

    const startInput = startFlashCardSession.mock.calls[0]?.[0];

    expect(startFlashCardSession).toHaveBeenCalledTimes(1);
    expect(startInput).toEqual({
      mode: "FlashCard",
      studyNoteIds: [addedBiologyStudyNote.id],
    });
    expect(startInput).not.toHaveProperty("noteIds");
    expect(startInput).not.toHaveProperty("selectedLabelIds");
    expect(startInput).not.toHaveProperty("labelId");
    expect(router.state.location.pathname).toBe("/recall/session");
  });

  it("starts selected Study Note recall through the persistent recall service", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const studyNote = contexts.studyNotesContext.createStudyNote(testUser.id, {
      expectedAnswer: "Persistent expected answer.",
      prompt: "Persistent selected Study Note",
      sourceBody: "Persistent source context.",
      sourceTitle: "Persistent source",
    });
    const startedSession = createStartedFlashCardSession({
      id: "persistent-start-session",
      note: createRecallNoteSnapshotFromStudyNote(studyNote),
    });
    const startFlashCardSession = vi.fn(async () => startedSession);
    const persistentRecallContext = createPersistentRecallContext({
      service: createPersistentRecallService({
        startFlashCardSession,
      }),
    });

    const { router } = renderRoute("/recall/select", {
      ...contexts,
      persistentRecallContext,
      recallContext: persistentRecallContext.readonlyContext,
      session: createSession(),
    });

    await screen.findByRole("heading", {
      level: 3,
      name: "Select Study Notes",
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Persistent selected Study Note/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Start recall" }));

    await screen.findByRole("heading", { level: 3, name: "Recall session" });
    expect(startFlashCardSession).toHaveBeenCalledWith({
      mode: "FlashCard",
      studyNoteIds: [studyNote.id],
    });
    expect(router.state.location.pathname).toBe("/recall/session");
  });

  it("keeps incomplete Study Notes out of Recall selection and starts only completed selections", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const incompleteStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "",
        prompt: "Incomplete Study Note",
        sourceBody: "Draft source context.",
        sourceTitle: "Draft source",
      },
    );
    const completedStudyNote = contexts.studyNotesContext.createStudyNote(
      testUser.id,
      {
        expectedAnswer: "Completed expected answer.",
        prompt: "Completed Study Note",
        sourceBody: "",
        sourceTitle: "",
      },
    );

    const { router } = renderRoute(
      `/recall/select?studyNoteIds=${incompleteStudyNote.id},${completedStudyNote.id}`,
      {
        ...contexts,
        session: createSession(),
      },
    );

    const availableNotes = await screen.findByRole("region", {
      name: "Available Study Notes",
    });
    expect(
      within(availableNotes).getByRole("checkbox", {
        name: /Incomplete Study Note/,
      }),
    ).toBeDisabled();
    expect(
      within(availableNotes).getByText("Add expected answer"),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("complementary", { name: "Session setup" }),
      ).getByText("1 note selected"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start recall" }));

    await screen.findByRole("heading", { level: 3, name: "Recall session" });
    expect(router.state.location.pathname).toBe("/recall/session");
    expect(screen.getAllByText("Completed Study Note").length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText("Incomplete Study Note")).toBeNull();
  });

  it("clears temporary Study Note selections on setup cancel", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const studyNote = contexts.studyNotesContext.createStudyNote(testUser.id, {
      sourceBody: "Temporary answer.",
      sourceTitle: "Temporary Study Note",
    });

    const { router } = renderRoute(
      `/recall/select?studyNoteIds=${studyNote.id}`,
      {
        ...contexts,
        session: createSession(),
      },
    );

    await screen.findByRole("heading", {
      level: 3,
      name: "Select Study Notes",
    });
    expect(screen.getByText("1 note selected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/recall"));

    await router.navigate({ to: "/recall/select" });

    await screen.findByRole("heading", {
      level: 3,
      name: "Select Study Notes",
    });
    expect(screen.getByRole("button", { name: "Start recall" })).toBeDisabled();
  });
});
