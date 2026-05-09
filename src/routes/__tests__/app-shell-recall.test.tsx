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

function createSession() {
  return { user: testUser };
}

function completeRecallAt(input: {
  noteId: string;
  rating: RecallSelfRating;
  recallContext: ReturnType<
    typeof createDeterministicRecallTestContexts
  >["recallContext"];
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
  recallContext: ReturnType<
    typeof createDeterministicRecallTestContexts
  >["recallContext"];
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

function getControlledPanel(control: HTMLElement) {
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

function getDetailBlockByLabel(panel: HTMLElement, label: string) {
  const labelElement = within(panel).getByText(label);
  const block = labelElement.closest(
    ".recall-selected-result__question-detail-block",
  );

  if (!(block instanceof HTMLElement)) {
    throw new Error(`Expected "${label}" to be inside a detail block.`);
  }

  return block;
}

function getDetailBlockCopy(block: HTMLElement) {
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
    expect(screen.getByText("Contexto fuente")).toBeInTheDocument();
    expect(
      screen.getByText("Learner answer stays literal."),
    ).toBeInTheDocument();
    expect(screen.getByText("Stored mitochondria answer.")).toBeInTheDocument();
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
      screen.queryByRole("heading", { name: "Recall starts with Study Notes" }),
    ).not.toBeInTheDocument();
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
        name: "Recall starts with Study Notes",
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

    await routeRender.router.navigate({ to: "/notes" });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Recall note" }),
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

  it("runs the FlashCard reveal and self-rating flow, then saves to Results", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const note = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Saved result body.",
      title: "Saved result note",
    });
    contexts.recallContext.startFlashCardSession({
      noteIds: [note.id],
      userId: testUser.id,
    });

    const { router } = renderRoute("/recall/session", {
      ...contexts,
      session: createSession(),
    });

    expect(
      await screen.findByText(
        "Try to recall this Study Note before revealing it.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Saved result body.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reveal Study Note" }));
    expect(screen.getByText("Saved result body.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Good" }));
    fireEvent.click(screen.getByRole("button", { name: "Next Study Note" }));

    expect(router.state.location.pathname).toBe("/recall");
    expect(
      await screen.findByText("Recall session saved to results"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("75%").length).toBeGreaterThan(0);
  });

  it("reveals Study Note expected answer before source Note context", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const studyNote = contexts.studyNotesContext.createStudyNote(testUser.id, {
      sourceBody: "Broader source context comes second.",
      sourceTitle: "Source context title",
    });
    const updatedStudyNote = contexts.studyNotesContext.updateStudyNote(
      testUser.id,
      studyNote.id,
      {
        acronyms: [],
        expectedAnswer: "Specific expected answer comes first.",
        labelIds: [],
        metaphors: [],
        prompt: "Practice prompt",
        sourceBody: "Broader source context comes second.",
        sourceTitle: "Source context title",
      },
    );
    contexts.recallContext.startFlashCardSession({
      studyNoteIds: [updatedStudyNote.id],
      userId: testUser.id,
    });

    renderRoute("/recall/session", {
      ...contexts,
      session: createSession(),
    });

    fireEvent.click(await screen.findByRole("button", { name: /Reveal/ }));

    const expectedAnswer = screen.getByText(
      "Specific expected answer comes first.",
    );
    const sourceContext = screen.getByText(
      "Broader source context comes second.",
    );

    expect(
      expectedAnswer.compareDocumentPosition(sourceContext) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("Expected answer")).toBeInTheDocument();
    expect(screen.getByText("Source context")).toBeInTheDocument();
  });

  it("uses FlashCard session self-rating semantics in selected Results review", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const note = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Reference answer body.",
      title: "Self rating result note",
    });
    contexts.recallContext.startFlashCardSession({
      noteIds: [note.id],
      userId: testUser.id,
    });

    const { router } = renderRoute("/recall/session", {
      ...contexts,
      session: createSession(),
    });

    expect(
      await screen.findByText(
        "Try to recall this Study Note before revealing it.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reveal Study Note" }));
    fireEvent.click(screen.getByRole("button", { name: "Good" }));
    fireEvent.click(screen.getByRole("button", { name: "Next Study Note" }));

    expect(router.state.location.pathname).toBe("/recall");
    const selectedResult = await screen.findByRole("region", {
      name: "Selected result",
    });

    expect(
      within(selectedResult).getByText("Session self rating"),
    ).toBeInTheDocument();
    expect(within(selectedResult).getByText("75%")).toBeInTheDocument();
    expect(within(selectedResult).queryByText("Score")).toBeNull();
  });

  it("keeps Session self rating visible on tight layouts while only showing rating distribution when space stays calm", async () => {
    setViewportWidth(960);

    const contexts = createDeterministicRecallTestContexts();
    const notes = [
      createRecallNote(contexts.notesContext, testUser.id, {
        body: "Reference body for forgot.",
        title: "Forgot prompt",
      }),
      createRecallNote(contexts.notesContext, testUser.id, {
        body: "Reference body for hard.",
        title: "Hard prompt",
      }),
      createRecallNote(contexts.notesContext, testUser.id, {
        body: "Reference body for good.",
        title: "Good prompt",
      }),
      createRecallNote(contexts.notesContext, testUser.id, {
        body: "Reference body for easy.",
        title: "Easy prompt",
      }),
    ];

    completeMultiQuestionRecall({
      questions: [
        { noteId: notes[0].id, rating: "forgot" },
        { noteId: notes[1].id, rating: "hard" },
        { noteId: notes[2].id, rating: "good" },
        { noteId: notes[3].id, rating: "easy" },
      ],
      recallContext: contexts.recallContext,
      timestamp: "2026-04-05T09:00:00.000Z",
    });

    renderRoute("/recall", {
      ...contexts,
      session: createSession(),
    });

    const detail = await screen.findByRole("region", {
      name: "Selected result",
    });
    const detailScope = within(detail);
    const distributionLabel = "Easy 1 · Good 1 · Hard 1 · Forgot 1";

    expect(detailScope.getByText("Session self rating")).toBeInTheDocument();
    expect(detailScope.getByText("56%")).toBeInTheDocument();
    expect(detailScope.getByText(distributionLabel)).toBeInTheDocument();

    setViewportWidth(640);

    await waitFor(() => {
      expect(detailScope.getByText("Session self rating")).toBeInTheDocument();
      expect(detailScope.getByText("56%")).toBeInTheDocument();
      expect(detailScope.queryByText(distributionLabel)).toBeNull();
    });
  });

  it("discards a zero-attempt session after confirmation", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const note = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Discarded body.",
      title: "Discarded note",
    });
    contexts.recallContext.startFlashCardSession({
      noteIds: [note.id],
      userId: testUser.id,
    });

    const { router } = renderRoute("/recall/session", {
      ...contexts,
      session: createSession(),
    });

    expect(
      await screen.findByRole("navigation", { name: "Breadcrumb" }),
    ).toHaveTextContent(/Recall\s*\/\s*Session/);
    fireEvent.click(screen.getAllByRole("button", { name: "End session" })[0]);
    expect(
      screen.getByRole("dialog", { name: "Discard recall session?" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard session" }));

    expect(router.state.location.pathname).toBe("/recall");
    expect(
      contexts.recallContext.listSessionResults({ userId: testUser.id }),
    ).toEqual([]);
  });

  it("shows session review headings and keeps recall restart actions in the master panel only", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const note = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Historical answer body.",
      title: "Historical prompt",
    });

    completeRecallAt({
      noteId: note.id,
      rating: "good",
      recallContext: contexts.recallContext,
      timestamp: "2026-04-04T09:00:00.000Z",
    });

    renderRoute("/recall", {
      ...contexts,
      session: createSession(),
    });

    const detail = await screen.findByRole("region", {
      name: "Selected result",
    });
    const detailScope = within(detail);

    expect(
      detailScope.getByRole("heading", { level: 4, name: "Session review" }),
    ).toBeInTheDocument();
    expect(
      detailScope.getByRole("heading", { level: 4, name: "Questions" }),
    ).toBeInTheDocument();
    expect(
      detailScope.getByText("Questions", { selector: "span" }),
    ).toBeInTheDocument();
    expect(detailScope.queryByText("Notes used")).toBeNull();
    expect(detailScope.queryByText("Not reached notes")).toBeNull();
    expect(detailScope.getByText("1 note")).toBeInTheDocument();
    expect(detailScope.getByText("1 question")).toBeInTheDocument();
    expect(detailScope.queryByText(/targeted notes/i)).toBeNull();
    expect(
      detailScope.queryByRole("link", { name: "Back to selection" }),
    ).not.toBeInTheDocument();
    expect(
      detailScope.queryByRole("link", { name: "Start another recall" }),
    ).not.toBeInTheDocument();

    const restartLinks = screen.getAllByRole("link", { name: "Start Recall" });
    expect(restartLinks).toHaveLength(1);
  });

  it("shows early-ended coverage and only unreached note titles in Not reached notes", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const firstNote = createRecallNote(contexts.notesContext, testUser.id, {
      body: "First historical answer.",
      title: "First targeted note",
    });
    const secondNote = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Second unreached answer.",
      title: "Second targeted note",
    });
    const thirdNote = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Third unreached answer.",
      title: "Third targeted note",
    });

    vi.setSystemTime(new Date("2026-04-06T09:00:00.000Z"));
    const session = contexts.recallContext.startFlashCardSession({
      noteIds: [firstNote.id, secondNote.id, thirdNote.id],
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

    renderRoute("/recall", {
      ...contexts,
      session: createSession(),
    });

    const detail = await screen.findByRole("region", {
      name: "Selected result",
    });
    const detailScope = within(detail);
    const notReachedSection = detailScope
      .getByRole("heading", {
        level: 4,
        name: "Not reached notes",
      })
      .closest("section");

    expect(detailScope.getByText("3 targeted notes")).toBeInTheDocument();
    expect(
      detailScope.getByText("1 of 3 questions attempted"),
    ).toBeInTheDocument();
    expect(detailScope.queryByText("Notes used")).toBeNull();
    if (!(notReachedSection instanceof HTMLElement)) {
      throw new Error("Expected Not reached notes section to exist.");
    }

    const notReachedScope = within(notReachedSection);

    expect(
      notReachedScope.getByText("Second targeted note"),
    ).toBeInTheDocument();
    expect(
      notReachedScope.getByText("Third targeted note"),
    ).toBeInTheDocument();
    expect(notReachedScope.queryByText("First targeted note")).toBeNull();
    expect(notReachedScope.queryByText("Second unreached answer.")).toBeNull();
    expect(notReachedScope.queryByText("Third unreached answer.")).toBeNull();
  });

  it("shows FlashCard Questions as a collapsed single-open-row accordion with self-rating pills", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const firstNote = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Reference answer for the first question.",
      title: "First historical prompt",
    });
    const secondNote = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Reference answer for the second question.",
      title: "Second historical prompt",
    });

    completeMultiQuestionRecall({
      questions: [
        {
          noteId: firstNote.id,
          rating: "hard",
          typedAnswer: "Learner answer for the first question.",
        },
        {
          noteId: secondNote.id,
          rating: "easy",
          typedAnswer: "Learner answer for the second question.",
        },
      ],
      recallContext: contexts.recallContext,
      timestamp: "2026-04-05T09:00:00.000Z",
    });

    renderRoute("/recall", {
      ...contexts,
      session: createSession(),
    });

    const detail = await screen.findByRole("region", {
      name: "Selected result",
    });
    const detailScope = within(detail);
    const firstQuestion = detailScope.getByRole("button", {
      name: /First historical prompt/i,
    });
    const secondQuestion = detailScope.getByRole("button", {
      name: /Second historical prompt/i,
    });

    expect(firstQuestion).toHaveAttribute("aria-expanded", "false");
    expect(secondQuestion).toHaveAttribute("aria-expanded", "false");
    expect(
      detailScope.queryByText("Reference answer for the first question."),
    ).toBeNull();
    expect(detailScope.getByText("Hard")).toBeInTheDocument();
    expect(detailScope.getByText("Easy")).toBeInTheDocument();

    fireEvent.click(firstQuestion);

    expect(
      await screen.findByText("Reference answer for the first question."),
    ).toBeInTheDocument();
    expect(
      detailScope.getByRole("button", { name: /First historical prompt/i }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(detailScope.getByText("Your answer")).toBeInTheDocument();

    fireEvent.click(secondQuestion);

    expect(
      detailScope.getByRole("button", { name: /First historical prompt/i }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      detailScope.getByRole("button", { name: /Second historical prompt/i }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      detailScope.queryByText("Reference answer for the first question."),
    ).toBeNull();
    expect(
      detailScope.getByText("Reference answer for the second question."),
    ).toBeInTheDocument();
  });

  it("shows expanded historical detail with repeated self-rating, exact typed text, and empty-answer fallback", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const firstNote = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Historical reference body line one.\nHistorical reference body line two.",
      title: "Exact answer prompt",
    });
    const secondNote = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Reference note for empty typed answer.",
      title: "Empty answer prompt",
    });

    completeMultiQuestionRecall({
      questions: [
        {
          noteId: firstNote.id,
          rating: "good",
          typedAnswer:
            "  Learner line one.\nLearner line two with spaces preserved.  ",
        },
        {
          noteId: secondNote.id,
          rating: "forgot",
          typedAnswer: "   ",
        },
      ],
      recallContext: contexts.recallContext,
      timestamp: "2026-04-05T09:00:00.000Z",
    });

    renderRoute("/recall", {
      ...contexts,
      session: createSession(),
    });

    const detail = await screen.findByRole("region", {
      name: "Selected result",
    });
    const detailScope = within(detail);
    const exactAnswerQuestion = detailScope.getByRole("button", {
      name: /Exact answer prompt/i,
    });
    const emptyAnswerQuestion = detailScope.getByRole("button", {
      name: /Empty answer prompt/i,
    });

    fireEvent.click(exactAnswerQuestion);

    const detailPanel = getControlledPanel(exactAnswerQuestion);
    const selfRatingBlock = getDetailBlockByLabel(detailPanel, "Self rating");
    const answerBlock = getDetailBlockByLabel(detailPanel, "Your answer");
    const referenceBlock = getDetailBlockByLabel(detailPanel, "Source context");

    expect(selfRatingBlock).toHaveTextContent("Good");
    expect(
      selfRatingBlock.compareDocumentPosition(answerBlock) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      answerBlock.compareDocumentPosition(referenceBlock) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(getDetailBlockCopy(answerBlock).textContent).toBe(
      "  Learner line one.\nLearner line two with spaces preserved.  ",
    );
    expect(getDetailBlockCopy(referenceBlock).textContent).toBe(
      "Historical reference body line one.\nHistorical reference body line two.",
    );

    fireEvent.click(emptyAnswerQuestion);

    const emptyDetailPanel = getControlledPanel(emptyAnswerQuestion);
    expect(emptyAnswerQuestion).toHaveAttribute("aria-expanded", "true");
    expect(emptyDetailPanel).toHaveTextContent("No typed answer recorded");
    expect(emptyDetailPanel).toHaveTextContent(
      "Reference note for empty typed answer.",
    );
  });

  it("redirects direct /recall/session visits without an active session", async () => {
    const { router } = renderRoute("/recall/session", {
      session: createSession(),
    });

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Recall starts with Study Notes",
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
  });
});
