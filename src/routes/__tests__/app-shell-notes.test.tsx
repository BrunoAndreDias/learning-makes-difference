// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createPersistentNotesContext } from "../../modules/notes";
import { createPersistentRecallContext } from "../../modules/recall";
import {
  createAppFocusContext,
  createAppLabelsContext,
  createAppNotesContext,
  createLearningLoopTestContexts,
  createRecallNote,
  listNotesForUser,
  openAccountMenu,
  renderRoute,
} from "./app-shell-test-support";

describe("authenticated app shell", () => {
  it("sizes the notes list from the workspace grid instead of viewport subtraction", () => {
    const notesEditorCss = readFileSync(
      join(
        process.cwd(),
        "src/modules/notes/notes-workspace/notes-editor-route.css",
      ),
      {
        encoding: "utf8",
      },
    );

    expect(notesEditorCss).not.toMatch(
      /\.notes-list-panel\s*{[^}]*height:\s*calc\(100vh/s,
    );
    expect(notesEditorCss).not.toContain("height: 34rem;");
    expect(notesEditorCss).not.toContain("max-height: 68vh;");
    expect(notesEditorCss).toMatch(
      /\.notes-form__body-field textarea\s*{[^}]*height:\s*100%/s,
    );
    expect(notesEditorCss).toMatch(
      /\.app-frame\[data-workspace="notes"\]\s+\.notes-list-panel\s*{[^}]*height:\s*100%/s,
    );
    expect(notesEditorCss).toMatch(
      /\.app-frame\[data-workspace="notes"\]\s+\.notes-workspace\s*{[^}]*grid-template-rows:\s*auto minmax\(0,\s*1fr\)/s,
    );
    expect(notesEditorCss).not.toMatch(
      /\.app-frame\[data-workspace="notes"\]\s+\.notes-workspace\s*{[^}]*grid-template-rows:\s*auto auto minmax\(0,\s*1fr\)/s,
    );
  });

  it("keeps recall workspace styles from overriding the notes workspace layout", () => {
    const recallWorkspacesCss = readFileSync(
      join(process.cwd(), "src/modules/recall/recall-workspaces.css"),
      {
        encoding: "utf8",
      },
    );

    expect(recallWorkspacesCss).not.toMatch(/\.notes-workspace(?:__|\s*{)/);
    expect(recallWorkspacesCss).not.toMatch(/\.notes-layout\s*{/);
  });

  it("does not show breadcrumbs on the default Notes page", async () => {
    renderRoute("/notes");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Breadcrumb" }),
    ).not.toBeInTheDocument();
  });

  it("translates Portuguese notes chrome without changing authored note data", async () => {
    const labelsContext = createAppLabelsContext({
      keyPrefix: `test-labels-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const notesContext = createAppNotesContext({
      getOwnedLabelIdsForUser: (ownerId) =>
        labelsContext.getLabelsForUser(ownerId).map((label) => label.id),
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-portuguese-notes";

    labelsContext.createLabel({
      name: "Organic Chemistry",
      userId,
    });
    notesContext.createNote(userId, {
      acronyms: [
        {
          description: "SN1 stays exactly as written",
        },
      ],
      body: "Cyclohexane chair flips stay in English.",
      labelIds: [],
      metaphors: [
        {
          description: "A conformer is like a folding chair",
        },
      ],
      title: "Chair conformations",
    });

    renderRoute("/notes", {
      labelsContext,
      notesContext,
      session: {
        user: {
          displayName: "Joana Notes",
          email: "joana.notes@example.com",
          id: userId,
          userLanguage: "pt-PT",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nova nota" }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Pesquisar notas")).toBeInTheDocument();
    expect(screen.getByLabelText("Titulo")).toHaveDisplayValue(
      "Chair conformations",
    );
    const hideCatalogButton = screen.getByRole("button", {
      name: "Ocultar catalogo de notas",
    });
    expect(hideCatalogButton).toHaveTextContent("Focar escrita");

    fireEvent.click(hideCatalogButton);

    expect(
      screen.getByRole("button", { name: "Mostrar catalogo de notas" }),
    ).toHaveTextContent("Mostrar lista (1)");
    expect(
      screen.getByDisplayValue("Cyclohexane chair flips stay in English."),
    ).toBeInTheDocument();

    expect(listNotesForUser(notesContext.getSnapshot(), userId)).toMatchObject([
      {
        acronyms: [{ description: "SN1 stays exactly as written" }],
        body: "Cyclohexane chair flips stay in English.",
        metaphors: [{ description: "A conformer is like a folding chair" }],
        title: "Chair conformations",
      },
    ]);
  });

  it("keeps the notes header Focus action primary and second beside recall entry", async () => {
    renderRoute("/notes");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();

    const startRecallButton = screen.getByRole("button", {
      name: "Start Recall",
    });
    const startFocusButton = screen.getByRole("button", {
      name: "Start Focus",
    });

    expect(startFocusButton).toHaveClass("notes-action-primary");
    expect(
      startRecallButton.compareDocumentPosition(startFocusButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(startRecallButton).not.toHaveClass("notes-action-primary");
  });

  it("starts focus from the notes header without leaving notes", async () => {
    const focusContext = createAppFocusContext({
      keyPrefix: `test-focus-notes-header-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-notes-header-focus";
    const { router } = renderRoute("/notes", {
      focusContext,
      session: {
        user: {
          displayName: "Jordan Notes Focus",
          email: "jordan.notes.focus@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start Focus" }));

    expect(router.state.location.pathname).toBe("/notes");
    expect(
      screen.getByRole("button", { name: "End focus" }),
    ).toBeInTheDocument();
    expect(focusContext.getActiveSession({ userId })).toMatchObject({
      breakIntervalMinutes: 5,
      currentInterval: "Focus",
      focusIntervalMinutes: 25,
      plannedFocusIntervalCount: null,
    });
  });

  it("keeps the discard dialog focused when an in-page note change is guarded", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "The protected phrase appears here.",
      labelIds: [],
      metaphors: [],
      title: "Older protected note",
    });
    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Current note has work in progress.",
      labelIds: [],
      metaphors: [],
      title: "Current draftable note",
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          userLanguage: "en",
        },
      },
    });

    const bodyEditor = await screen.findByDisplayValue(
      "Current note has work in progress.",
    );
    const notesList = screen.getByRole("navigation", {
      name: "Notes list",
    });

    fireEvent.change(bodyEditor, {
      target: {
        value: "Current note has work in progress and should stay guarded.",
      },
    });
    fireEvent.click(
      within(notesList).getByRole("button", {
        name: "Older protected note",
      }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Discard unsaved changes?",
    });

    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toHaveFocus();
    expect(screen.getByLabelText("Title")).not.toHaveFocus();
  });

  it("renders the notes list inside the notes workspace content", async () => {
    const labelsContext = createAppLabelsContext({
      keyPrefix: `test-labels-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const notesContext = createAppNotesContext({
      getOwnedLabelIdsForUser: (userId) =>
        labelsContext.getLabelsForUser(userId).map((label) => label.id),
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";
    const biology = labelsContext.createLabel({
      name: "Biology",
      userId,
    });

    notesContext.createNote(userId, {
      acronyms: [],
      body: "Patterns emerge after several careful comparison passes.",
      labelIds: [],
      metaphors: [],
      title: "Second note",
    });

    const firstNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "Signals travel across neurons and strengthen with repeated use.",
      labelIds: [biology.id],
      metaphors: [],
      title: "Neural pathways",
    });

    renderRoute("/notes", {
      labelsContext,
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("navigation", { name: "Breadcrumb" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Capture small concepts and reinforce them through recall.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Notes" })).toHaveLength(1);

    const appSidebar = screen.getByRole("complementary", {
      name: "Notes workspace",
    });
    const notesCatalog = screen.getByRole("complementary", {
      name: "Notes catalog",
    });
    const notesNavigation = within(notesCatalog).getByRole("navigation", {
      name: "Notes list",
    });
    const notesLinks = within(notesNavigation).getAllByRole("button", {
      name: /^(Neural pathways|Second note)$/,
    });

    expect(
      within(notesCatalog).getByRole("button", { name: "New note" }),
    ).toBeInTheDocument();
    expect(notesLinks).toHaveLength(2);
    expect(notesLinks[0]).toHaveTextContent("Neural pathways");
    expect(notesLinks[1]).toHaveTextContent("Second note");
    expect(notesLinks[0]).toHaveAttribute("aria-current", "page");
    expect(
      within(notesNavigation).queryByRole("button", {
        name: /^Delete (Neural pathways|Second note)$/,
      }),
    ).not.toBeInTheDocument();
    expect(
      within(notesNavigation).getAllByRole("button", {
        name: /^Actions for (Neural pathways|Second note)$/,
      }),
    ).toHaveLength(2);

    expect(
      within(notesCatalog).getByRole("combobox", { name: "Search notes" }),
    ).toBeInTheDocument();
    expect(within(notesCatalog).getByText("2 notes")).toBeInTheDocument();
    expect(
      within(notesCatalog).getByText("Showing 1-2 of 2 notes"),
    ).toBeInTheDocument();
    expect(
      within(notesCatalog).getByRole("combobox", { name: "Filter by label" }),
    ).toBeInTheDocument();
    expect(
      within(notesCatalog).getByRole("combobox", { name: "Sort notes" }),
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Note editor surface")).toBeInTheDocument();
    expect(
      within(appSidebar).queryByRole("navigation", { name: "Notes list" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Biology").length).toBeGreaterThan(0);
    expect(firstNote.title).toBe("Neural pathways");
  });

  it("shows compact Learning State metadata in the notes list", async () => {
    const userId = "user-learning-state-list";
    const contexts = createLearningLoopTestContexts({
      shuffleNotes: (sessionNotes) => [...sessionNotes],
    });
    const recalledNote = createRecallNote(contexts.notesContext, userId, {
      body: "Active recall should leave simple row evidence.",
      title: "Recalled concept",
    });
    createRecallNote(contexts.notesContext, userId, {
      body: "This concept has no recall evidence yet.",
      title: "Fresh concept",
    });
    const session = contexts.recallContext.startFlashCardSession({
      noteIds: [recalledNote.id],
      userId,
    });

    contexts.recallContext.revealFlashCardAnswer({
      sessionId: session.id,
      userId,
    });
    contexts.recallContext.rateFlashCardAnswer({
      rating: "good",
      sessionId: session.id,
      userId,
    });

    renderRoute("/notes", {
      ...contexts,
      session: {
        user: {
          displayName: "Jordan State",
          email: "jordan.state@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();

    const notesCatalog = screen.getByRole("complementary", {
      name: "Notes catalog",
    });
    const recalledRow = within(notesCatalog).getByRole("button", {
      name: "Recalled concept",
    });
    const freshRow = within(notesCatalog).getByRole("button", {
      name: "Fresh concept",
    });

    expect(recalledRow).toHaveTextContent("Last score: Good");
    expect(recalledRow).toHaveTextContent("Last recalled");
    const learningState = recalledRow.querySelector(
      ".notes-list__learning-state",
    );
    expect(
      learningState === null ? [] : Array.from(learningState.children),
    ).toHaveLength(2);
    expect(learningState?.children[0]).toHaveTextContent("Last score: Good");
    expect(learningState?.children[1]).toHaveTextContent("Last recalled");
    expect(
      recalledRow.querySelector(".notes-list__item-status"),
    ).not.toHaveTextContent("Last score: Good · Last recalled");
    expect(freshRow).toHaveTextContent("Not recalled yet");
    expect(screen.queryByLabelText("Learning state")).not.toBeInTheDocument();
  });

  it("hydrates Learning State metadata from persisted recall results on notes reload", async () => {
    const userId = "user-learning-state-persisted";
    const contexts = createLearningLoopTestContexts({
      shuffleNotes: (sessionNotes) => [...sessionNotes],
    });
    const recalledNote = createRecallNote(contexts.notesContext, userId, {
      body: "Persisted recall results should survive a refresh.",
      title: "Persisted concept",
    });

    createRecallNote(contexts.notesContext, userId, {
      body: "No recall result exists yet.",
      title: "Unrecalled concept",
    });

    const session = contexts.recallContext.startFlashCardSession({
      noteIds: [recalledNote.id],
      userId,
    });

    contexts.recallContext.revealFlashCardAnswer({
      sessionId: session.id,
      userId,
    });
    contexts.recallContext.rateFlashCardAnswer({
      rating: "good",
      sessionId: session.id,
      userId,
    });

    const listSessionResults = vi.fn(async () => [
      ...contexts.recallContext.getSessionResultsSnapshot(),
    ]);
    const persistentRecallContext = createPersistentRecallContext({
      service: {
        endRecallSession: vi.fn(async () => {
          throw new Error("not used");
        }),
        getActiveSession: vi.fn(async () => null),
        listSessionResults,
        rateFlashCardAnswer: vi.fn(async () => {
          throw new Error("not used");
        }),
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

    renderRoute("/notes", {
      focusContext: contexts.focusContext,
      labelsContext: contexts.labelsContext,
      notesContext: contexts.notesContext,
      persistentRecallContext,
      session: {
        user: {
          displayName: "Jordan Persisted",
          email: "jordan.persisted@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();

    const notesCatalog = screen.getByRole("complementary", {
      name: "Notes catalog",
    });
    const recalledRow = within(notesCatalog).getByRole("button", {
      name: "Persisted concept",
    });
    const freshRow = within(notesCatalog).getByRole("button", {
      name: "Unrecalled concept",
    });

    expect(listSessionResults).toHaveBeenCalled();
    expect(recalledRow).toHaveTextContent("Last score: Good");
    expect(recalledRow).toHaveTextContent("Last recalled");
    expect(freshRow).toHaveTextContent("Not recalled yet");
  });

  it("lets an authenticated user delete notes from the in-page notes list", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";

    notesContext.createNote(userId, {
      acronyms: [],
      body: "One note should remain after deleting the other.",
      labelIds: [],
      metaphors: [],
      title: "Remaining note",
    });
    notesContext.createNote(userId, {
      acronyms: [],
      body: "This note can be removed from the notes list.",
      labelIds: [],
      metaphors: [],
      title: "Disposable note",
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();

    const notesNavigation = screen.getByRole("navigation", {
      name: "Notes list",
    });
    const disposableNoteRow = within(notesNavigation)
      .getByRole("button", { name: "Disposable note" })
      .closest("li");

    expect(disposableNoteRow).not.toBeNull();

    fireEvent.click(
      within(disposableNoteRow as HTMLElement).getByRole("button", {
        name: "Actions for Disposable note",
      }),
    );
    fireEvent.click(
      within(disposableNoteRow as HTMLElement).getByRole("menuitem", {
        name: "Delete note",
      }),
    );

    const dialog = screen.getByRole("dialog", { name: "Delete this note?" });

    expect(
      within(dialog).getByText(
        "This will permanently delete the note and its memory hooks. Past results keep their saved snapshots.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete note" }),
    );

    expect(
      within(notesNavigation).queryByRole("button", {
        name: "Disposable note",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(notesNavigation).getByRole("button", { name: "Remaining note" }),
    ).toBeInTheDocument();
    expect(
      listNotesForUser(notesContext.getSnapshot(), userId).map(
        (note) => note.title,
      ),
    ).not.toContain("Disposable note");
  });

  it("renders every note in the in-page notes list without a fixed item cap", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";

    for (let index = 1; index <= 12; index += 1) {
      notesContext.createNote(userId, {
        acronyms: [],
        body: `Study note ${index} body`,
        labelIds: [],
        metaphors: [],
        title: `Study note ${index}`,
      });
    }

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();

    const notesNavigation = screen.getByRole("navigation", {
      name: "Notes list",
    });

    expect(
      within(notesNavigation).getAllByRole("button", {
        name: /^Study note \d+$/,
      }),
    ).toHaveLength(12);
    expect(
      within(notesNavigation).getByRole("button", { name: "Study note 12" }),
    ).toBeInTheDocument();
  });

  it("does not crash when opening Notes from Recall if a persisted note has an invalid updated timestamp", async () => {
    const persistentNotesContext = createPersistentNotesContext({
      service: {
        createNote: vi.fn(async () => {
          throw new Error("not used");
        }),
        deleteNote: vi.fn(async () => {
          throw new Error("not used");
        }),
        listNotes: vi.fn(async () => [
          {
            acronyms: [],
            body: "Persisted note body.",
            createdAt: "2026-05-02T12:00:00.000Z",
            id: "persisted-note-1",
            labelIds: [],
            metaphors: [],
            title: "Persisted note",
            updatedAt: "",
          },
        ]),
        updateNote: vi.fn(async () => {
          throw new Error("not used");
        }),
      },
    });

    const routeRender = renderRoute("/recall", {
      persistentNotesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Recall starts with Study Notes",
      }),
    ).toBeInTheDocument();

    await routeRender.router.navigate({ to: "/notes" });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Persisted note" }),
    ).toBeInTheDocument();
  });

  it("keeps the in-page notes list visible when the app sidebar collapses", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Repeated review strengthens long-term retention.",
      labelIds: [],
      metaphors: [],
      title: "Spaced repetition",
    });
    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Retrieval cues make later recall easier.",
      labelIds: [],
      metaphors: [],
      title: "Retrieval practice",
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary", {
      name: "Notes workspace",
    });
    const notesList = screen.getByRole("navigation", {
      name: "Notes list",
    });
    const collapseSidebarButton = within(sidebar).getByRole("button", {
      name: "Collapse sidebar",
    });

    expect(notesList).toBeVisible();
    expect(screen.getByRole("heading", { name: "Notes" })).toBeVisible();
    expect(
      screen.getAllByRole("button", { name: "Collapse sidebar" }),
    ).toHaveLength(1);
    fireEvent.click(
      within(notesList).getByRole("button", { name: "Spaced repetition" }),
    );
    expect(
      screen.getByDisplayValue(
        "Repeated review strengthens long-term retention.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "Notes catalog" }),
    ).toBeVisible();

    fireEvent.click(collapseSidebarButton);

    expect(sidebar).not.toBeVisible();
    expect(notesList).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Expand sidebar" }),
    ).toHaveFocus();
    expect(
      screen.queryByRole("navigation", { name: "App sections" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Log out" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Show notes catalog" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Search notes" }), {
      target: { value: "retrieval practice" },
    });
    fireEvent.click(
      within(screen.getByLabelText("Notes search results")).getByRole(
        "option",
        { name: /Retrieval practice/ },
      ),
    );

    expect(
      screen.getByDisplayValue("Retrieval cues make later recall easier."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));

    expect(sidebar).toBeVisible();
    expect(notesList).toBeVisible();
    expect(
      within(notesList).getByRole("button", { name: "Retrieval practice" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("lets the user hide the notes catalog from the editor without affecting the app sidebar", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Repeated review strengthens long-term retention.",
      labelIds: [],
      metaphors: [],
      title: "Spaced repetition",
    });
    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Retrieval cues make later recall easier.",
      labelIds: [],
      metaphors: [],
      title: "Retrieval practice",
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary", {
      name: "Notes workspace",
    });
    const notesCatalog = screen.getByRole("complementary", {
      name: "Notes catalog",
    });
    const notesList = within(notesCatalog).getByRole("navigation", {
      name: "Notes list",
    });

    fireEvent.click(
      within(notesList).getByRole("button", { name: "Spaced repetition" }),
    );

    expect(notesCatalog).toBeVisible();
    expect(sidebar).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Hide notes catalog" }));

    expect(notesCatalog).toHaveAttribute("aria-hidden", "true");
    expect(
      screen.queryByRole("complementary", { name: "Notes catalog" }),
    ).not.toBeInTheDocument();
    expect(sidebar).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Show notes catalog" }),
    ).toHaveTextContent("Show list (2)");
    expect(screen.getByDisplayValue("Spaced repetition")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        "Repeated review strengthens long-term retention.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show notes catalog" }));

    expect(notesCatalog).toBeVisible();
    expect(
      within(notesList).getByRole("button", { name: "Spaced repetition" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("keeps account utilities in the app sidebar while long notes stay reachable", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const longTitle =
      "Very long note title that should still stay reachable from the notes list";

    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Repeated review strengthens long-term retention.",
      labelIds: [],
      metaphors: [],
      title: longTitle,
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Alexandria Review Coordinator",
          email: "jordan.alexandria.review.coordinator@example-learning.test",
          id: "user-jordan",
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary", {
      name: "Notes workspace",
    });
    const notesList = screen.getByRole("navigation", {
      name: "Notes list",
    });
    const accountMenuButton = within(sidebar).getByRole("button", {
      name: /Jordan Alexandria Review Coordinator .* account menu/,
    });

    expect(
      within(sidebar).getByRole("navigation", { name: "App sections" }),
    ).toBeInTheDocument();
    expect(
      within(sidebar).queryByRole("navigation", { name: "Notes list" }),
    ).not.toBeInTheDocument();
    expect(
      within(notesList).getByRole("button", { name: longTitle }),
    ).toBeInTheDocument();
    expect(sidebar).toContainElement(accountMenuButton);
    expect(
      within(accountMenuButton).getByText(/Jordan Alexandria Review/),
    ).toBeVisible();
    expect(
      within(accountMenuButton).getByText(
        "jordan.alexandria.review.coordinator@example-learning.test",
      ),
    ).toBeVisible();
    openAccountMenu();
    const accountMenu = screen.getByRole("menu", { name: "Account options" });
    expect(
      within(accountMenu).getByRole("menuitem", { name: "Settings" }),
    ).toBeVisible();
    expect(
      within(accountMenu).getByRole("menuitem", { name: "Log out" }),
    ).toBeVisible();
  });

  it("lets an authenticated user create and edit notes inside the notes workspace", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No notes yet")).toBeInTheDocument();
    expect(screen.getByLabelText("Title").closest("header")).toContainElement(
      screen.getByRole("button", { name: "Create note" }),
    );
    expect(
      within(
        screen.getByRole("complementary", { name: "Notes catalog" }),
      ).getAllByRole("button", { name: "New note" }),
    ).toHaveLength(2);

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Spaced repetition" },
    });
    fireEvent.change(screen.getByLabelText("Body"), {
      target: {
        value: "Reviewing at expanding intervals improves long-term retention.",
      },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Note editor" }));

    expect(
      await screen.findByRole("button", { name: "Spaced repetition" }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Spaced repetition")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        "Reviewing at expanding intervals improves long-term retention.",
      ),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Body"), {
      target: {
        value:
          "Reviewing at expanding intervals improves recall over long spans.",
      },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Note editor" }));
    fireEvent.click(
      within(
        screen.getByRole("complementary", { name: "Notes catalog" }),
      ).getByRole("button", { name: "New note" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Spaced repetition" }));

    expect(
      screen.getByDisplayValue(
        "Reviewing at expanding intervals improves recall over long spans.",
      ),
    ).toBeInTheDocument();
  });

  it("shows save changes only for unsaved note edits and places it near the title", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Reviewing at expanding intervals improves long-term retention.",
      labelIds: [],
      metaphors: [],
      title: "Spaced repetition",
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByDisplayValue("Spaced repetition"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Body"), {
      target: {
        value:
          "Reviewing at expanding intervals improves recall over long spans.",
      },
    });

    const saveButton = screen.getByRole("button", { name: "Save" });
    const titleHeader = screen.getByLabelText("Title").closest("header");
    const memoryHooks = screen.getByLabelText("Memory hooks");

    expect(titleHeader).not.toBeNull();
    expect(titleHeader).toContainElement(saveButton);
    expect(memoryHooks).not.toContainElement(saveButton);

    fireEvent.click(saveButton);

    expect(
      await screen.findByDisplayValue(
        "Reviewing at expanding intervals improves recall over long spans.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();
  });
});
