// @vitest-environment jsdom

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AppPersistentRecallService,
  createPersistentRecallContext,
  type RecallNoteSnapshot,
  type RecallQuestion,
  type RecallSelfRating,
  type SessionResult,
} from "../../modules/recall";
import {
  createDeterministicRecallTestContexts,
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
  return {
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
    updateFlashCardAttemptText: vi.fn(async () => {
      throw new Error("not used");
    }),
    ...overrides,
  };
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
  overrides: {
    completedAt?: string;
    createdAt?: string;
    id?: string;
    note?: RecallNoteSnapshot;
    rating?: RecallSelfRating;
    score?: number | null;
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
  };
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
    acronyms: [],
    expectedAnswer: input.expectedAnswer,
    labelIds: input.labelIds,
    metaphors: [],
    prompt: input.prompt,
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

function _getControlledPanel(control: HTMLElement) {
  const panelId = control.getAttribute("aria-controls");

  if (panelId === null) {
    throw new Error("Expected control to reference a detail panel.");
  }

  const panel = document.getElementById(panelId);

  if (panel === null) {
    throw new Error(`Expected detail panel "${panelId}" to exist.`);
  }

  return panel;
}

function _getDetailBlockByLabel(panel: HTMLElement, label: string) {
  const labelElement = within(panel).getByText(label);
  const block = labelElement.closest(
    ".recall-selected-result__question-detail-block",
  );

  if (!(block instanceof HTMLElement)) {
    throw new Error(`Expected "${label}" to be inside a detail block.`);
  }

  return block;
}

function _getDetailBlockCopy(block: HTMLElement) {
  const copy = block.querySelector(
    ".recall-selected-result__question-detail-copy",
  );

  if (!(copy instanceof HTMLElement)) {
    throw new Error("Expected detail block to include copy text.");
  }

  return copy;
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

    renderRoute("/recall", {
      ...contexts,
      session: {
        user: {
          ...testUser,
          userLanguage: "es",
        },
      },
    });

    const results = await screen.findByRole("region", {
      name: "Resultados de repaso",
    });
    expect(
      within(results).getByRole("link", { name: "Iniciar repaso" }),
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

    const breadcrumb = await screen.findByRole("navigation", {
      name: "Breadcrumb",
    });
    expect(
      within(breadcrumb).getByRole("link", { name: "Recall" }),
    ).toHaveAttribute("href", "/recall");
    expect(breadcrumb).toHaveTextContent(/Recall\s*\/\s*Session/);
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

  it("shows no-note guidance on /recall", async () => {
    renderRoute("/recall", { session: createSession() });

    expect(
      await screen.findByRole("heading", {
        name: "Recall starts with Study Notes",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Breadcrumb" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open Study Notes" }),
    ).toHaveAttribute("href", "/study-notes");
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

    renderRoute("/recall", {
      ...contexts,
      sessionContext: createRouteHydratedSessionContext(createSession()),
    });

    const results = await screen.findByRole("region", {
      name: "Recall results",
    });
    const selectedResult = screen.getByRole("region", {
      name: "Selected result",
    });
    expect(
      within(results).getByText("Showing 1-1 of 1 result"),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getAllByText("Stored prompt title").length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("navigation", { name: "Breadcrumb" }),
    ).not.toBeInTheDocument();
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

    renderRoute("/recall", { ...contexts, session: createSession() });

    await screen.findByRole("heading", { level: 3, name: "Recall" });
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
      within(selectedResult).getByRole("heading", {
        name: "Not reached Study Notes",
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

  it("links child Recall breadcrumbs back to the default Recall page", async () => {
    const contexts = createDeterministicRecallTestContexts();
    contexts.studyNotesContext.createStudyNote(testUser.id, {
      sourceBody: "Recall body",
      sourceTitle: "Recall Study Note",
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

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    const recallLink = within(breadcrumb).getByRole("link", {
      name: "Recall",
    });

    expect(breadcrumb).toHaveTextContent(/Recall\s*\/\s*Select Study Notes/);
    expect(recallLink).toHaveAttribute("href", "/recall");

    fireEvent.click(recallLink);

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Recall Today",
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
    expect(
      screen.queryByRole("navigation", { name: "Breadcrumb" }),
    ).not.toBeInTheDocument();
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

    renderRoute("/recall", {
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

    const routeRender = renderRoute("/recall", {
      ...contexts,
      persistentRecallContext,
      session: createSession(),
    });

    expect(
      await screen.findByRole("heading", { level: 3, name: "Recall" }),
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

    renderRoute("/recall", { ...contexts, session: createSession() });

    expect(
      await screen.findByRole("heading", { level: 3, name: "Recall" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("No results yet").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Results will appear here.").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: "Start Recall" })[0],
    ).toHaveAttribute("href", "/recall/select");
    expect(screen.getAllByRole("link", { name: "Start Recall" })).toHaveLength(
      1,
    );
    expect(
      screen.getByRole("option", { name: "All modes" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Showing/)).toBeNull();
  });

  it("explains empty Recall Today when Study Notes are not ready for recommended recall", async () => {
    const contexts = createDeterministicRecallTestContexts();
    contexts.studyNotesContext.createStudyNote(testUser.id, {
      expectedAnswer: " ",
      prompt: "Draft Study Note",
      sourceBody: "Draft source.",
      sourceTitle: "Draft source",
    });

    renderRoute("/recall", { ...contexts, session: createSession() });

    expect(
      await screen.findByRole("heading", { level: 3, name: "Recall Today" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Complete Study Notes with expected answers, then finish RecallSessions to create future Recall Today work.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Manual Recall Selection" }),
    ).toHaveAttribute("href", "/recall/select");
    expect(
      screen.queryByRole("button", { name: "Start Recall Today" }),
    ).toBeNull();
  });

  it("opens Recall Today by default and starts a FlashCard session from its queue", async () => {
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
      await screen.findByRole("heading", { level: 3, name: "Recall Today" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Manual Recall Selection" }),
    ).toHaveAttribute("href", "/recall/select");

    const queue = screen.getByRole("list", { name: "Recall Today queue" });
    const items = within(queue).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Needs practice prompt");
    expect(items[0]).toHaveTextContent("Needs practice");
    expect(items[0]).toHaveTextContent("Due for Recall");
    expect(items[1]).toHaveTextContent("Not recalled prompt");
    expect(items[1]).toHaveTextContent("Not recalled yet");
    expect(items[2]).toHaveTextContent("Due prompt");
    expect(items[2]).toHaveTextContent("Due for Recall");
    expect(screen.queryByText("Incomplete prompt")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Start Recall Today" }));

    await screen.findByRole("heading", { level: 3, name: "Recall session" });
    expect(router.state.location.pathname).toBe("/recall/session");
    expect(screen.getAllByText("Needs practice prompt").length).toBeGreaterThan(
      0,
    );
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

    const { router } = renderRoute("/recall", {
      ...contexts,
      session: createSession(),
    });

    const detail = await screen.findByRole("region", {
      name: "Selected result",
    });
    expect(
      within(detail).getAllByText("Newest result note").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Showing 1-2 of 2 results")).toBeInTheDocument();

    const results = screen.getByRole("region", { name: "Recall results" });
    const resultButtons = within(results).getAllByRole("button");
    fireEvent.click(resultButtons[1]);

    expect(router.state.location.pathname).toBe("/recall");
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

    renderRoute("/recall", { ...contexts, session: createSession() });

    await screen.findByRole("heading", { level: 3, name: "Recall" });
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
      acronyms: [{ description: "ABC remembers retrieval steps." }],
      expectedAnswer: "Searchable expected answer.",
      labelIds: [],
      metaphors: [{ description: "A lighthouse for recall." }],
      prompt: "Searchable Study Note",
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
    expect(screen.getByText("Metaphor description")).toBeInTheDocument();
    expect(screen.getByText("Acronym description")).toBeInTheDocument();
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
    expect(
      screen.getByRole("navigation", { name: "Breadcrumb" }),
    ).toHaveTextContent(/Recall\s*\/\s*Session/);
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
      ).getByText("1"),
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
    expect(screen.getByText("1")).toBeInTheDocument();

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
