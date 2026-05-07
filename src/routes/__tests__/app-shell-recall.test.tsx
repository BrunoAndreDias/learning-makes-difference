// @vitest-environment jsdom

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
  interfaceLanguage: "en",
  studyLanguage: "en",
} as const;

function createSession() {
  return { user: testUser };
}

function completeRecallAt(input: {
  noteId: string;
  rating: "easy" | "forgot" | "good" | "hard";
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
    rating: "easy" | "forgot" | "good" | "hard";
    typedAnswer?: string;
  }>;
  recallContext: ReturnType<
    typeof createDeterministicRecallTestContexts
  >["recallContext"];
  timestamp: string;
}) {
  vi.setSystemTime(new Date(input.timestamp));
  const session = input.recallContext.startFlashCardSession({
    noteIds: input.questions.map((question) => question.noteId),
    userId: testUser.id,
  });

  input.questions.forEach((question) => {
    if (question.typedAnswer !== undefined) {
      input.recallContext.updateFlashCardAttemptText({
        sessionId: session.id,
        text: question.typedAnswer,
        userId: testUser.id,
      });
    }

    input.recallContext.revealFlashCardAnswer({
      sessionId: session.id,
      userId: testUser.id,
    });
    input.recallContext.rateFlashCardAnswer({
      rating: question.rating,
      sessionId: session.id,
      userId: testUser.id,
    });
  });
}

describe("authenticated recall workspace", () => {
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
    expect(screen.getByRole("button", { name: "Reveal note" })).toBeEnabled();
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
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      }),
    });

    expect(
      await screen.findByText("Try to recall this note before revealing it."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Hydrated prompt title").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByRole("button", { name: "Reveal note" })).toBeEnabled();
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
      await screen.findByRole("heading", { name: "Recall starts with notes" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Breadcrumb" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open Notes Workspace" }),
    ).toHaveAttribute("href", "/notes");
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
      screen.queryByRole("heading", { name: "Recall starts with notes" }),
    ).not.toBeInTheDocument();
  });

  it("links child Recall breadcrumbs back to the default Recall page", async () => {
    const contexts = createDeterministicRecallTestContexts();
    createRecallNote(contexts.notesContext, testUser.id, {
      body: "Recall body",
      title: "Recall note",
    });

    const { router } = renderRoute("/recall/select", {
      ...contexts,
      session: createSession(),
    });

    expect(
      await screen.findByRole("heading", { level: 3, name: "Select notes" }),
    ).toBeInTheDocument();

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    const recallLink = within(breadcrumb).getByRole("link", {
      name: "Recall",
    });

    expect(breadcrumb).toHaveTextContent(/Recall\s*\/\s*Select notes/);
    expect(recallLink).toHaveAttribute("href", "/recall");

    fireEvent.click(recallLink);

    expect(
      await screen.findByRole("heading", { level: 3, name: "Recall" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
    expect(
      screen.queryByRole("navigation", { name: "Breadcrumb" }),
    ).not.toBeInTheDocument();
  });

  it("uses the route-hydrated session to load Recall setup notes immediately", async () => {
    const contexts = createDeterministicRecallTestContexts();
    createRecallNote(contexts.notesContext, testUser.id, {
      body: "Recall body",
      title: "Recall note",
    });

    renderRoute("/recall/select", {
      ...contexts,
      sessionContext: createRouteHydratedSessionContext(createSession()),
    });

    const availableNotes = await screen.findByRole("region", {
      name: "Available Notes",
    });
    expect(within(availableNotes).getByText("Recall note")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Recall starts with notes" }),
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

    renderRoute("/recall", {
      ...contexts,
      persistentRecallContext,
      session: createSession(),
    });

    expect(
      await screen.findByRole("heading", { level: 3, name: "Recall" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Notes" }));

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

  it("selects Notes, blocks disabled AI Recall types, clears selection, and starts FlashCard", async () => {
    const contexts = createDeterministicRecallTestContexts();
    contexts.notesContext.createNote(testUser.id, {
      acronyms: [{ description: "ABC remembers retrieval steps." }],
      body: "Searchable body.",
      labelIds: [],
      metaphors: [{ description: "A lighthouse for recall." }],
      title: "Searchable Note",
    });

    const { router } = renderRoute("/recall/select", {
      ...contexts,
      session: createSession(),
    });

    expect(
      await screen.findByRole("heading", { level: 3, name: "Select notes" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search Notes"), {
      target: { value: "lighthouse" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Searchable Note/ }));

    fireEvent.click(screen.getByRole("radio", { name: /AI Assisted/ }));
    expect(screen.getByRole("button", { name: "Start recall" })).toBeDisabled();
    expect(
      screen.getByText("Connect API key to start AI Assisted."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /FlashCard/ }));
    expect(screen.getByRole("button", { name: "Start recall" })).toBeEnabled();

    fireEvent.click(screen.getByRole("checkbox", { name: /Searchable Note/ }));
    expect(screen.getByRole("button", { name: "Start recall" })).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: /Searchable Note/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start recall" }));

    await screen.findByRole("heading", { level: 3, name: "Recall session" });
    expect(
      screen.getByRole("navigation", { name: "Breadcrumb" }),
    ).toHaveTextContent(/Recall\s*\/\s*Session/);
    expect(router.state.location.pathname).toBe("/recall/session");
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
      await screen.findByText("Try to recall this note before revealing it."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Saved result body.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reveal note" }));
    expect(screen.getByText("Saved result body.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Good" }));
    fireEvent.click(screen.getByRole("button", { name: "Next note" }));

    expect(router.state.location.pathname).toBe("/recall");
    expect(
      await screen.findByText("Recall session saved to results"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("75%").length).toBeGreaterThan(0);
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
      await screen.findByText("Try to recall this note before revealing it."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reveal note" }));
    fireEvent.click(screen.getByRole("button", { name: "Good" }));
    fireEvent.click(screen.getByRole("button", { name: "Next note" }));

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
    expect(
      detailScope.queryByRole("link", { name: "Back to selection" }),
    ).not.toBeInTheDocument();
    expect(
      detailScope.queryByRole("link", { name: "Start another recall" }),
    ).not.toBeInTheDocument();

    const restartLinks = screen.getAllByRole("link", { name: "Start Recall" });
    expect(restartLinks).toHaveLength(1);
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

  it("redirects direct /recall/session visits without an active session", async () => {
    const { router } = renderRoute("/recall/session", {
      session: createSession(),
    });

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Recall starts with notes",
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
  });
});
