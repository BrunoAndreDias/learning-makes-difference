// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  screen,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  type AppSessionSnapshot,
  completeRecallSessionAt,
  createAppFocusContext,
  createAppLabelsContext,
  createAppNotesContext,
  createAppRecallContext,
  createCompletedRecallSession,
  createDeterministicRecallTestContexts,
  createLearningLoopTestContexts,
  createRecallNote,
  expectReturnedToRecall,
  getSelectedSessionResultRegion,
  listNotesForUser,
  openRecallResultsSection,
  rateFlashCardAnswers,
  renderRecallSelection,
  renderRoute,
  selectRecallableNote,
  startSelectedRecallSession,
} from "./app-shell-test-support";

describe("authenticated app shell", () => {
  it("opens recall from notes without preselecting the edited note", async () => {
    const labelsContext = createAppLabelsContext({
      keyPrefix: `test-labels-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const recallContext = createAppRecallContext({
      keyPrefix: `test-recall-${Math.random().toString(36).slice(2)}`,
      notes: notesContext,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage: window.localStorage,
    });
    const userId = "user-jordan";
    notesContext.createNote(userId, {
      acronyms: [],
      body: "Retrieval is strengthened by effortful recall.",
      labelIds: [],
      metaphors: [],
      title: "Testing effect",
    });

    const { router } = renderRoute("/notes", {
      labelsContext,
      notesContext,
      recallContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByDisplayValue(
        "Retrieval is strengthened by effortful recall.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start Recall" }));

    expect(
      await screen.findByRole("heading", { level: 3, name: "Recall setup" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall/select");
    expect(
      within(screen.getByLabelText("Recall selection controls")).getByText(
        "0 notes selected",
      ),
    ).toBeInTheDocument();
    expect(recallContext.getSnapshot()).toBeNull();
    expect(recallContext.listSessionResults({ userId })).toHaveLength(0);
  });

  it("opens recall from notes even when the edited note has unsaved changes", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const recallContext = createAppRecallContext({
      keyPrefix: `test-recall-${Math.random().toString(36).slice(2)}`,
      notes: notesContext,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage: window.localStorage,
    });
    const userId = "user-jordan";
    const note = notesContext.createNote(userId, {
      acronyms: [],
      body: "Original recall answer.",
      labelIds: [],
      metaphors: [],
      title: "Guarded recall start",
    });

    const { router } = renderRoute("/notes", {
      notesContext,
      recallContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    const bodyEditor = await screen.findByDisplayValue(
      "Original recall answer.",
    );

    fireEvent.change(bodyEditor, {
      target: { value: "Unsaved recall answer." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start Recall" }));

    expect(
      await screen.findByRole("heading", { level: 3, name: "Recall setup" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall/select");
    expect(
      within(screen.getByLabelText("Recall selection controls")).getByText(
        "0 notes selected",
      ),
    ).toBeInTheDocument();
    expect(recallContext.getSnapshot()).toBeNull();
    expect(
      listNotesForUser(notesContext.getSnapshot(), userId).find(
        (currentNote) => currentNote.id === note.id,
      )?.body,
    ).toBe("Original recall answer.");
    expect(
      screen.queryByRole("dialog", { name: "Discard unsaved changes?" }),
    ).toBeNull();
  });

  it("shows learning state in notes and starts practice for the selected note", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const recallContext = createAppRecallContext({
      keyPrefix: `test-recall-${Math.random().toString(36).slice(2)}`,
      notes: notesContext,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage: window.localStorage,
    });
    const userId = "user-jordan";
    const weakNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "Original recall answer.",
      labelIds: [],
      metaphors: [{ description: "Gate: remember the gate." }],
      title: "Weak note",
    });
    notesContext.createNote(userId, {
      acronyms: [],
      body: "Fresh note body.",
      labelIds: [],
      metaphors: [],
      title: "Fresh note",
    });

    try {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-11T09:00:00.000Z"));
      const session = recallContext.startFlashCardSession({
        noteIds: [weakNote.id],
        userId,
      });
      recallContext.revealFlashCardAnswer({ sessionId: session.id, userId });
      recallContext.rateFlashCardAnswer({
        rating: "partial",
        sessionId: session.id,
        userId,
      });
    } finally {
      vi.useRealTimers();
    }

    const { router } = renderRoute("/notes", {
      notesContext,
      recallContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    const sidebar = screen.getByRole("navigation", { name: "Notes list" });
    fireEvent.click(within(sidebar).getByRole("button", { name: "Weak note" }));

    expect(
      await screen.findByDisplayValue("Original recall answer."),
    ).toBeInTheDocument();
    expect(within(sidebar).getByText("Weak")).toBeInTheDocument();
    expect(within(sidebar).getByText("Unpracticed")).toBeInTheDocument();

    const learningState = screen.getByLabelText("Learning state");
    expect(within(learningState).getByText("Weak")).toBeInTheDocument();
    expect(
      within(learningState).getByText("Latest rating"),
    ).toBeInTheDocument();
    expect(within(learningState).getByText("Partial")).toBeInTheDocument();
    expect(
      within(learningState).getByText("Last practiced"),
    ).toBeInTheDocument();
    expect(within(learningState).getByText("Apr 11, 2026")).toBeInTheDocument();
    expect(within(learningState).getByText("Next review")).toBeInTheDocument();
    expect(within(learningState).getByText("Apr 14, 2026")).toBeInTheDocument();
    expect(within(learningState).getByText("1 hook")).toBeInTheDocument();

    fireEvent.click(
      within(learningState).getByRole("button", { name: "Practice this note" }),
    );

    expect(router.state.location.pathname).toBe("/recall/session");
    expect(
      await screen.findByRole("button", { name: "Reveal answer" }),
    ).toBeInTheDocument();
    expect(recallContext.getSnapshot()?.notes.map((note) => note.id)).toEqual([
      weakNote.id,
    ]);
  });

  it("removes notes-owned recall selection controls from notes", async () => {
    renderRoute("/notes");

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start Recall" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Select for recall" }),
    ).toBeNull();
    expect(screen.queryByText("Selecting for recall")).toBeNull();
    expect(screen.queryByLabelText("Recall selection controls")).toBeNull();
  });

  it("lands on Practice by default and navigates between Recall workspace sections", async () => {
    vi.useFakeTimers();

    const { labelsContext, notesContext, recallContext } =
      createDeterministicRecallTestContexts();
    const userId = "user-placeholder";
    createRecallNote(notesContext, userId, {
      body: "This note is still due for practice.",
      title: "Due prompt",
    });
    const weakNote = createRecallNote(notesContext, userId, {
      body: "This note needs another pass.",
      title: "Weak prompt",
    });
    const strongNote = createRecallNote(notesContext, userId, {
      body: "This note should stay out of Due and Weak.",
      title: "Strong prompt",
    });

    completeRecallSessionAt({
      noteId: weakNote.id,
      rating: "partial",
      recallContext,
      timestamp: "2026-04-28T09:00:00.000Z",
      userId,
    });
    completeRecallSessionAt({
      noteId: strongNote.id,
      rating: "nailed",
      recallContext,
      timestamp: "2026-05-01T09:00:00.000Z",
      userId,
    });

    vi.useRealTimers();

    const { router } = renderRoute("/recall", {
      labelsContext,
      notesContext,
      recallContext,
    });

    expect(
      await screen.findByRole("heading", { level: 3, name: "Practice" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Practice" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Recall", { selector: ".section-label" }),
    ).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
    expect(screen.getByRole("link", { name: "Start recall" })).toHaveAttribute(
      "href",
      "/recall/select",
    );

    const sectionNav = screen.getByRole("navigation", {
      name: "Recall sections",
    });
    expect(
      within(sectionNav).getByRole("link", { name: "Practice" }),
    ).toHaveAttribute("aria-current", "page");

    fireEvent.click(within(sectionNav).getByRole("link", { name: "Due" }));

    expect(
      await screen.findByRole("heading", { level: 3, name: "Due" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Due" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Due prompt")).toBeInTheDocument();
    expect(screen.getByText("Weak prompt")).toBeInTheDocument();
    expect(screen.queryByText("Strong prompt")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Open due setup" }),
    ).toHaveAttribute("href", "/recall/select?filter=due");

    fireEvent.click(
      within(sectionNav).getByRole("link", { name: "Weak notes" }),
    );

    expect(
      await screen.findByRole("heading", { level: 3, name: "Weak notes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Weak notes" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Weak prompt")).toBeInTheDocument();
    expect(screen.queryByText("Due prompt")).toBeNull();
    expect(screen.queryByText("Strong prompt")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Open weak-note setup" }),
    ).toHaveAttribute("href", "/recall/select?filter=weak");

    fireEvent.click(within(sectionNav).getByRole("link", { name: "Results" }));

    expect(
      await screen.findByRole("heading", { level: 3, name: "Results" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Results" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Selected review" }),
    ).toBeInTheDocument();
  });

  it("renders /recall as an empty results workspace with a start action", async () => {
    const { labelsContext, notesContext } = createLearningLoopTestContexts();
    const userId = "user-placeholder";

    notesContext.createNote(userId, {
      acronyms: [],
      body: "Retrieval practice compounds through repeated effort.",
      labelIds: [],
      metaphors: [],
      title: "Retrieval practice",
    });

    const { router } = renderRoute("/recall?section=results", {
      labelsContext,
      notesContext,
    });

    expect(
      await screen.findByRole("heading", { level: 3, name: "Results" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
    expect(screen.getByRole("link", { name: "Start Recall" })).toHaveAttribute(
      "href",
      "/recall/select",
    );
    expect(
      screen.getByRole("heading", { level: 4, name: "No results yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Complete a recall session to build reviewable results.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps no-note users on /recall with note-creation guidance", async () => {
    const { router } = renderRoute("/recall");

    expect(
      await screen.findByRole("heading", { level: 3, name: "Practice" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
    expect(
      screen.getByRole("heading", {
        level: 4,
        name: "No recallable notes yet",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Create notes first, then come back to start recall."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Notes" })).toHaveAttribute(
      "href",
      "/notes",
    );
  });

  it("runs dedicated recall selection mode from /recall/select without opening the note editor", async () => {
    const { labelsContext, notesContext, recallContext } =
      createLearningLoopTestContexts({
        shuffleNotes: (sessionNotes) => [...sessionNotes],
      });
    const userId = "user-placeholder";
    const titleNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "The title carries this selection cue.",
      labelIds: [],
      metaphors: [],
      title: "Encoding specificity",
    });
    const bodyNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "A distinctive body cue should be searchable for recall.",
      labelIds: [],
      metaphors: [],
      title: "Retrieval cues",
    });
    const metaphorNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "Visual aids support concept recall.",
      labelIds: [],
      metaphors: [
        {
          description:
            "Lighthouse harbor: the lighthouse beam points back to the safe harbor.",
        },
      ],
      title: "Context reinstatement",
    });
    const acronymNote = notesContext.createNote(userId, {
      acronyms: [
        {
          description: "POME means Plan Organize Monitor Evaluate.",
        },
      ],
      body: "Acronyms can carry a recall selection cue.",
      labelIds: [],
      metaphors: [],
      title: "Metacognition",
    });

    const { router } = renderRoute("/recall/select", {
      labelsContext,
      notesContext,
      recallContext,
    });

    expect(
      await screen.findByRole("heading", { level: 3, name: "Recall setup" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Recall setup" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Recall", { selector: ".section-label" }),
    ).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall/select");
    expect(
      screen.queryByRole("combobox", { name: "Search recall sessions" }),
    ).toBeNull();
    expect(screen.queryByRole("form", { name: "Note editor" })).toBeNull();
    let recallControls = within(
      screen.getByLabelText("Recall selection controls"),
    );
    expect(recallControls.getByText("0 notes selected")).toBeInTheDocument();
    expect(
      recallControls.getByRole("button", { name: "Start recall" }),
    ).toBeDisabled();

    const searchInput = screen.getByLabelText("Search notes");
    const searchResults = () =>
      within(screen.getByRole("listbox", { name: "Recall selection matches" }));

    fireEvent.change(searchInput, {
      target: { value: "encoding specificity" },
    });
    fireEvent.click(
      searchResults().getByRole("option", {
        name: /Encoding specificity Prompt/,
      }),
    );
    expect(recallControls.getByText("1 note selected")).toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: { value: "distinctive body cue" },
    });
    fireEvent.click(
      searchResults().getByRole("option", {
        name: /Retrieval cues Notes/,
      }),
    );
    expect(recallControls.getByText("2 notes selected")).toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: { value: "safe harbor" },
    });
    fireEvent.click(
      searchResults().getByRole("option", {
        name: /Context reinstatement Hook/,
      }),
    );
    expect(recallControls.getByText("3 notes selected")).toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: { value: "plan organize monitor" },
    });
    fireEvent.click(
      searchResults().getByRole("option", {
        name: /Metacognition Hook/,
      }),
    );
    expect(recallControls.getByText("4 notes selected")).toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: { value: "lighthouse harbor" },
    });
    fireEvent.click(
      searchResults().getByRole("option", {
        name: /Context reinstatement Hook/,
      }),
    );
    expect(recallControls.getByText("3 notes selected")).toBeInTheDocument();

    fireEvent.click(recallControls.getByRole("button", { name: "Cancel" }));

    expect(
      await screen.findByRole("heading", { level: 3, name: "Practice" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");

    fireEvent.click(screen.getByRole("link", { name: "Start recall" }));

    expect(
      await screen.findByRole("heading", { level: 3, name: "Recall setup" }),
    ).toBeInTheDocument();
    recallControls = within(screen.getByLabelText("Recall selection controls"));
    expect(recallControls.getByText("0 notes selected")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search notes"), {
      target: { value: "encoding specificity" },
    });
    fireEvent.click(
      searchResults().getByRole("option", {
        name: /Encoding specificity Prompt/,
      }),
    );
    fireEvent.change(screen.getByLabelText("Search notes"), {
      target: { value: "plan organize monitor" },
    });
    fireEvent.click(
      searchResults().getByRole("option", {
        name: /Metacognition Hook/,
      }),
    );

    fireEvent.click(
      recallControls.getByRole("button", { name: "Start recall" }),
    );

    expect(router.state.location.pathname).toBe("/recall/session");
    expect(
      await screen.findByRole("heading", { name: "Recall session" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Recall session" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Recall", { selector: ".section-label" }),
    ).not.toBeInTheDocument();
    expect(recallContext.getSnapshot()).toMatchObject({
      mode: "FlashCard",
      notes: [
        { id: titleNote.id, title: "Encoding specificity" },
        { id: acronymNote.id, title: "Metacognition" },
      ],
      questions: [{ noteId: titleNote.id }, { noteId: acronymNote.id }],
    });
    expect(recallContext.getSnapshot()?.notes).not.toEqual(
      expect.arrayContaining([{ id: bodyNote.id }, { id: metaphorNote.id }]),
    );
  });

  it("starts focus from recall setup without interrupting the selected session plan", async () => {
    const focusContext = createAppFocusContext({
      keyPrefix: `test-focus-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const { notesContext, recallContext } =
      createDeterministicRecallTestContexts();
    const userId = "user-recall-focus";

    notesContext.createNote(userId, {
      acronyms: [],
      body: "Recall plan body.",
      labelIds: [],
      metaphors: [],
      title: "Focused recall setup",
    });

    const { router } = renderRoute("/recall/select", {
      focusContext,
      notesContext,
      recallContext,
      session: {
        user: {
          displayName: "Casey Recall",
          email: "casey.recall@example.com",
          id: userId,
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 3, name: "Recall setup" }),
    ).toBeInTheDocument();

    selectRecallableNote("Focused recall setup", "Recall plan body.");

    fireEvent.click(
      screen.getByRole("button", { name: "Start focus for this session" }),
    );

    expect(router.state.location.pathname).toBe("/recall/select");
    expect(
      within(screen.getByLabelText("Recall selection controls")).getByText(
        "1 note selected",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Selected notes")).getByText(
        "Focused recall setup",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "End focus" }),
    ).toBeInTheDocument();
    expect(focusContext.getActiveSession({ userId })).toMatchObject({
      currentInterval: "Focus",
      intervalState: "Focus",
    });
  });

  it("rebuilds recall selection as a setup flow with selected tray, summary, and empty states", async () => {
    const { labelsContext, notesContext, recallContext } =
      createDeterministicRecallTestContexts();
    const userId = "user-placeholder";
    const science = labelsContext.createLabel({ name: "Science", userId });
    notesContext.createNote(userId, {
      acronyms: [],
      body: "ATP powers cellular work.",
      labelIds: [science.id],
      metaphors: [],
      title: "ATP",
    });
    notesContext.createNote(userId, {
      acronyms: [],
      body: "Mitochondria produce ATP.",
      labelIds: [science.id],
      metaphors: [],
      title: "Mitochondria",
    });

    renderRoute("/recall/select", {
      labelsContext,
      notesContext,
      recallContext,
    });

    expect(
      await screen.findByRole("heading", { level: 3, name: "Recall setup" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Note editor" })).toBeNull();
    expect(screen.queryByText("Find recall targets")).not.toBeInTheDocument();

    const summary = screen.getByRole("region", { name: "Session summary" });
    expect(within(summary).getByText("0 selected")).toBeInTheDocument();
    expect(within(summary).getByText("0 min")).toBeInTheDocument();
    expect(within(summary).getByText("General recall")).toBeInTheDocument();
    expect(within(summary).getByText("No notes selected")).toBeInTheDocument();

    const startButton = screen.getByRole("button", { name: "Start recall" });
    expect(startButton).toBeDisabled();
    expect(
      screen.getByText("Pick at least one note to start recall."),
    ).toBeInTheDocument();

    expect(
      within(screen.getByRole("region", { name: "Selected notes" })).getByText(
        "No notes selected yet.",
      ),
    ).toBeInTheDocument();

    const availableNotes = within(
      screen.getByRole("region", { name: "Available notes" }),
    );
    fireEvent.click(
      availableNotes.getByRole("button", {
        name: /Select ATP/i,
      }),
    );

    expect(within(summary).getByText("1 selected")).toBeInTheDocument();
    expect(within(summary).getByText("2 min")).toBeInTheDocument();
    expect(within(summary).getByText("First-pass recall")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start recall" })).toBeEnabled();
    expect(availableNotes.getByText("Selected")).toBeInTheDocument();

    const selectedNotes = within(
      screen.getByRole("region", { name: "Selected notes" }),
    );
    expect(selectedNotes.getByText("ATP")).toBeInTheDocument();
    fireEvent.click(
      selectedNotes.getByRole("button", {
        name: "Remove ATP from recall setup",
      }),
    );

    expect(
      selectedNotes.getByText("No notes selected yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start recall" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Search notes"), {
      target: { value: "zzzzz" },
    });
    expect(screen.getByText("No notes match this search.")).toBeInTheDocument();
  });

  it("drops deleted persisted selections from recall setup before session start", async () => {
    const { labelsContext, notesContext, recallContext } =
      createDeterministicRecallTestContexts();
    const userId = "user-placeholder";
    notesContext.createNote(userId, {
      acronyms: [],
      body: "This note keeps recall setup available after the deletion.",
      labelIds: [],
      metaphors: [],
      title: "Remaining recall target",
    });
    const note = notesContext.createNote(userId, {
      acronyms: [],
      body: "This selection should disappear when the note disappears.",
      labelIds: [],
      metaphors: [],
      title: "Deleted recall target",
    });

    await renderRecallSelection({
      labelsContext,
      notesContext,
      recallContext,
    });

    selectRecallableNote(
      "Deleted recall target",
      "This selection should disappear when the note disappears.",
    );

    let recallControls = within(
      screen.getByLabelText("Recall selection controls"),
    );
    expect(recallControls.getByText("1 note selected")).toBeInTheDocument();
    expect(
      recallControls.getByRole("button", { name: "Start recall" }),
    ).toBeEnabled();

    act(() => {
      notesContext.deleteNote(userId, note.id);
    });

    recallControls = within(screen.getByLabelText("Recall selection controls"));
    expect(recallControls.getByText("0 notes selected")).toBeInTheDocument();
    expect(
      recallControls.getByRole("button", { name: "Start recall" }),
    ).toBeDisabled();
    expect(
      within(screen.getByRole("region", { name: "Selected notes" })).getByText(
        "No notes selected yet.",
      ),
    ).toBeInTheDocument();
    expect(recallContext.getSnapshot()).toBeNull();
  });

  it("keeps selected notes across filter changes and limits search results to the active filter", async () => {
    const { labelsContext, notesContext, recallContext } =
      createDeterministicRecallTestContexts();
    const userId = "user-placeholder";
    const science = labelsContext.createLabel({ name: "Science", userId });
    const weakNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "Weak note body",
      labelIds: [science.id],
      metaphors: [],
      title: "Weak circuits",
    });
    const strongNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "Strong note body",
      labelIds: [science.id],
      metaphors: [],
      title: "Strong memory",
    });

    const weakSession = recallContext.startFlashCardSession({
      noteIds: [weakNote.id],
      userId,
    });
    recallContext.revealFlashCardAnswer({
      sessionId: weakSession.id,
      userId,
    });
    recallContext.rateFlashCardAnswer({
      rating: "partial",
      sessionId: weakSession.id,
      userId,
    });

    const strongSession = recallContext.startFlashCardSession({
      noteIds: [strongNote.id],
      userId,
    });
    recallContext.revealFlashCardAnswer({
      sessionId: strongSession.id,
      userId,
    });
    recallContext.rateFlashCardAnswer({
      rating: "nailed",
      sessionId: strongSession.id,
      userId,
    });

    await renderRecallSelection({
      labelsContext,
      notesContext,
      recallContext,
    });

    fireEvent.click(screen.getByRole("button", { name: "Weak notes (1)" }));

    const availableNotes = within(
      screen.getByRole("region", { name: "Available notes" }),
    );
    expect(availableNotes.getByText("Weak circuits")).toBeInTheDocument();
    expect(availableNotes.queryByText("Strong memory")).toBeNull();

    fireEvent.click(
      availableNotes.getByRole("button", {
        name: "Select Weak circuits",
      }),
    );
    expect(
      within(screen.getByRole("region", { name: "Selected notes" })).getByText(
        "Weak circuits",
      ),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search notes"), {
      target: { value: "Strong memory" },
    });

    expect(screen.getByText("No notes found")).toBeInTheDocument();
    expect(
      screen.queryByRole("option", {
        name: /Strong memory Prompt/,
      }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "All notes (2)" }));

    expect(
      within(screen.getByRole("region", { name: "Selected notes" })).getByText(
        "Weak circuits",
      ),
    ).toBeInTheDocument();
  });

  it("shows filter-specific empty states for Due now and Weak notes", async () => {
    const { notesContext, recallContext } =
      createDeterministicRecallTestContexts();
    const userId = "user-placeholder";
    const strongNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "Strong note body",
      labelIds: [],
      metaphors: [],
      title: "Strong memory",
    });

    const strongSession = recallContext.startFlashCardSession({
      noteIds: [strongNote.id],
      userId,
    });
    recallContext.revealFlashCardAnswer({
      sessionId: strongSession.id,
      userId,
    });
    recallContext.rateFlashCardAnswer({
      rating: "nailed",
      sessionId: strongSession.id,
      userId,
    });

    await renderRecallSelection({
      notesContext,
      recallContext,
    });

    fireEvent.click(screen.getByRole("button", { name: "Weak notes (0)" }));
    expect(
      within(screen.getByRole("region", { name: "Available notes" })).getByText(
        "No weak notes yet.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Due now (0)" }));
    expect(
      within(screen.getByRole("region", { name: "Available notes" })).getByText(
        "No notes are due right now.",
      ),
    ).toBeInTheDocument();
  });

  it("restores an active RecallSession after a reload for the same user", async () => {
    const notesKeyPrefix = `test-notes-recall-reload-${Math.random().toString(36).slice(2)}`;
    const recallKeyPrefix = `test-recall-reload-${Math.random().toString(36).slice(2)}`;
    const userId = "user-recall-reload";
    const session = {
      user: {
        displayName: "Casey Recall Reload",
        email: "casey.recall.reload@example.com",
        id: userId,
        interfaceLanguage: "en",
        studyLanguage: "en",
      },
    } satisfies AppSessionSnapshot;
    const firstNotesContext = createAppNotesContext({
      keyPrefix: notesKeyPrefix,
      storage: window.localStorage,
    });
    const firstRecallContext = createAppRecallContext({
      keyPrefix: recallKeyPrefix,
      notes: firstNotesContext,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage: window.localStorage,
    });

    firstNotesContext.createNote(userId, {
      acronyms: [{ description: "ARS means Active recall session." }],
      body: "This revealed answer should survive the reload.",
      labelIds: [],
      metaphors: [
        {
          description:
            "Sticky card: like reopening the same study card after a refresh.",
        },
      ],
      title: "Reloaded recall prompt",
    });

    const firstRender = await renderRecallSelection({
      notesContext: firstNotesContext,
      recallContext: firstRecallContext,
      session,
    });

    selectRecallableNote(
      "Reloaded recall prompt",
      "This revealed answer should survive the reload.",
    );
    await startSelectedRecallSession();

    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    expect(
      await screen.findByText(
        "This revealed answer should survive the reload.",
      ),
    ).toBeInTheDocument();

    firstRender.unmount();

    const reloadedNotesContext = createAppNotesContext({
      keyPrefix: notesKeyPrefix,
      storage: window.localStorage,
    });
    const reloadedRecallContext = createAppRecallContext({
      keyPrefix: recallKeyPrefix,
      notes: reloadedNotesContext,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage: window.localStorage,
    });

    renderRoute("/recall/session", {
      notesContext: reloadedNotesContext,
      recallContext: reloadedRecallContext,
      session,
    });

    expect(
      await screen.findByRole("heading", { name: "Recall session" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This revealed answer should survive the reload."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Sticky card: like reopening the same study card after a refresh.",
      ),
    ).toBeInTheDocument();
    expect(reloadedRecallContext.getSnapshot()).toMatchObject({
      isAnswerRevealed: true,
      notes: [{ title: "Reloaded recall prompt" }],
      userId,
    });
  });

  it("shows a structural Recall / Session breadcrumb for an active recall session", async () => {
    const { labelsContext, notesContext, recallContext } =
      createLearningLoopTestContexts({
        shuffleNotes: (sessionNotes) => [...sessionNotes],
      });
    const userId = "user-jordan";
    const note = notesContext.createNote(userId, {
      acronyms: [],
      body: "Session progress should stay out of the breadcrumb.",
      labelIds: [],
      metaphors: [],
      title: "Recall session route",
    });

    recallContext.startFlashCardSession({
      noteIds: [note.id],
      userId,
    });

    renderRoute("/recall/session", {
      labelsContext,
      notesContext,
      recallContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Recall session" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Search recall sessions" }),
    ).toBeNull();

    const breadcrumb = screen.getByRole("navigation", {
      name: "Workspace breadcrumb",
    });

    expect(
      within(breadcrumb).getByRole("link", { name: "Recall" }),
    ).toHaveAttribute("href", "/recall");
    expect(within(breadcrumb).getByText("Session")).toBeInTheDocument();
    expect(
      within(breadcrumb).queryByText("Completed 0 of 1 questions"),
    ).toBeNull();
    expect(screen.getByText("Completed 0 of 1 questions")).toBeInTheDocument();
  });

  it("redirects direct recall session visits without an active session back to recall", async () => {
    const { router } = renderRoute("/recall/session");

    expect(
      await screen.findByRole("heading", { level: 3, name: "Practice" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
    expect(
      screen.queryByRole("heading", { name: "Recall session" }),
    ).toBeNull();
  });

  it("returns completed recall sessions to /recall and opens the new result", async () => {
    const { labelsContext, notesContext, recallContext } =
      createDeterministicRecallTestContexts();
    const userId = "user-placeholder";
    const science = labelsContext.createLabel({
      name: "Science",
      userId,
    });
    const note = createRecallNote(notesContext, userId, {
      body: "Completed sessions should return to Recall recent results.",
      labelIds: [science.id],
      title: "Spacing effect",
    });

    const { router } = await renderRecallSelection({
      labelsContext,
      notesContext,
      recallContext,
    });

    selectRecallableNote(
      "Spacing effect",
      "Completed sessions should return to Recall recent results.",
    );
    await startSelectedRecallSession();

    expect(router.state.location.pathname).toBe("/recall/session");

    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Nailed it" }));

    await expectReturnedToRecall(router);
    await openRecallResultsSection();
    const selectedResult = getSelectedSessionResultRegion();
    const questionReview = within(selectedResult).getByRole("region", {
      name: "Prompt review",
    });
    expect(
      within(selectedResult).getByText("1 attempted question"),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getByText("Nailed 1 · Partial 0 · Missed 0"),
    ).toBeInTheDocument();
    expect(
      within(questionReview).getByRole("heading", {
        name: "Spacing effect",
      }),
    ).toBeInTheDocument();
    expect(recallContext.listSessionResults({ userId })).toMatchObject([
      {
        attempts: [{ noteId: note.id, rating: "nailed" }],
        notes: [{ id: note.id, title: "Spacing effect" }],
      },
    ]);
  });

  it("captures typed recall attempts and shows them in the saved result review", async () => {
    const { labelsContext, notesContext, recallContext } =
      createDeterministicRecallTestContexts();
    const userId = "user-placeholder";
    const note = createRecallNote(notesContext, userId, {
      body: "Synapses strengthen when neurons fire together repeatedly.",
      title: "Hebbian learning",
    });

    const { router } = await renderRecallSelection({
      labelsContext,
      notesContext,
      recallContext,
    });

    selectRecallableNote(
      "Hebbian learning",
      "Synapses strengthen when neurons fire together repeatedly.",
    );
    await startSelectedRecallSession();

    fireEvent.change(screen.getByLabelText("What do you remember?"), {
      target: {
        value: "Cells that fire together wire together.",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Partly recalled" }));

    await expectReturnedToRecall(router);
    await openRecallResultsSection();
    const selectedResult = getSelectedSessionResultRegion();
    const questionReview = within(selectedResult).getByRole("region", {
      name: "Prompt review",
    });

    expect(
      within(questionReview).getByText(
        "Your attempt: Cells that fire together wire together.",
      ),
    ).toBeInTheDocument();
    expect(recallContext.listSessionResults({ userId })).toMatchObject([
      {
        attempts: [
          {
            noteId: note.id,
            rating: "partial",
            text: "Cells that fire together wire together.",
          },
        ],
        questions: [
          {
            noteId: note.id,
            selfRating: "partial",
            typedAnswer: "Cells that fire together wire together.",
          },
        ],
      },
    ]);
  });

  it("hides recall answers until reveal, then shows the full note and rating guidance", async () => {
    const { labelsContext, notesContext, recallContext } =
      createDeterministicRecallTestContexts();
    const userId = "user-placeholder";
    const note = notesContext.createNote(userId, {
      acronyms: [
        {
          description: "CRR means cue, routine, reward.",
        },
      ],
      body: "Habit loops reinforce repeated behavior through stable triggers.",
      labelIds: [],
      metaphors: [
        {
          description:
            "Behavior groove: a groove gets easier to follow each time it is used.",
        },
      ],
      title: "Habit loops",
    });

    await renderRecallSelection({
      labelsContext,
      notesContext,
      recallContext,
    });

    selectRecallableNote(
      "Habit loops",
      "Habit loops reinforce repeated behavior through stable triggers.",
    );
    await startSelectedRecallSession();

    expect(
      screen.queryByText(
        "Habit loops reinforce repeated behavior through stable triggers.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Metaphors")).not.toBeInTheDocument();
    expect(screen.queryByText("Behavior groove")).not.toBeInTheDocument();
    expect(screen.queryByText("Acronyms")).not.toBeInTheDocument();
    expect(screen.queryByText("CRR")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", {
        name: "Note snapshot",
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Show note snapshot for Habit loops",
      }),
    );
    expect(
      screen.queryByText(
        "Habit loops reinforce repeated behavior through stable triggers.",
      ),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));

    expect(
      screen.getAllByText(
        "Habit loops reinforce repeated behavior through stable triggers.",
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Metaphors").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        "Behavior groove: a groove gets easier to follow each time it is used.",
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Acronyms").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("CRR means cue, routine, reward.").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Could not recall it.")).toBeInTheDocument();
    expect(screen.getByText("Some gaps remained.")).toBeInTheDocument();
    expect(screen.getByText("Recalled it clearly.")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Show note snapshot for Habit loops",
      }),
    );
    const snapshot = screen.getByRole("region", {
      name: "Note snapshot",
    });
    expect(
      within(snapshot).getByText(
        "Habit loops reinforce repeated behavior through stable triggers.",
      ),
    ).toBeInTheDocument();
    expect(
      within(snapshot).getByText(
        "Behavior groove: a groove gets easier to follow each time it is used.",
      ),
    ).toBeInTheDocument();
    expect(
      within(snapshot).getByText("CRR means cue, routine, reward."),
    ).toBeInTheDocument();
    expect(recallContext.getSnapshot()?.questions[0]?.isAnswerRevealed).toBe(
      true,
    );
    expect(recallContext.getSnapshot()?.questions[0]?.noteId).toBe(note.id);
  });

  it("moves keyboard focus through prompt, reveal, rating, and next prompt", async () => {
    const { labelsContext, notesContext, recallContext } =
      createDeterministicRecallTestContexts();
    const userId = "user-placeholder";
    notesContext.createNote(userId, {
      acronyms: [],
      body: "First note body",
      labelIds: [],
      metaphors: [],
      title: "First note",
    });
    notesContext.createNote(userId, {
      acronyms: [],
      body: "Second note body",
      labelIds: [],
      metaphors: [],
      title: "Second note",
    });

    await renderRecallSelection({
      labelsContext,
      notesContext,
      recallContext,
    });

    selectRecallableNote("First note", "First note body");
    selectRecallableNote("Second note", "Second note body");
    await startSelectedRecallSession();

    const firstPrompt = screen.getByRole("button", {
      name: "Show note snapshot for First note",
    });
    expect(firstPrompt).toHaveFocus();

    const revealButton = screen.getByRole("button", { name: "Reveal answer" });
    fireEvent.click(revealButton);

    const missedButton = screen.getByRole("button", { name: "Missed it" });
    expect(missedButton).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Nailed it" }));

    const secondPrompt = screen.getByRole("button", {
      name: "Show note snapshot for Second note",
    });
    expect(secondPrompt).toHaveFocus();
  });

  it("announces recall progress and question state with accessible names and visible text", async () => {
    const { labelsContext, notesContext, recallContext } =
      createDeterministicRecallTestContexts();
    const userId = "user-placeholder";

    notesContext.createNote(userId, {
      acronyms: [],
      body: "First note body",
      labelIds: [],
      metaphors: [],
      title: "First note",
    });
    notesContext.createNote(userId, {
      acronyms: [],
      body: "Second note body",
      labelIds: [],
      metaphors: [],
      title: "Second note",
    });

    await renderRecallSelection({
      labelsContext,
      notesContext,
      recallContext,
    });

    selectRecallableNote("First note", "First note body");
    selectRecallableNote("Second note", "Second note body");
    await startSelectedRecallSession();

    expect(
      screen.getByRole("progressbar", {
        name: "Recall progress",
      }),
    ).toHaveAttribute(
      "aria-valuetext",
      "Question 1 of 2. Completed 0 of 2 questions.",
    );

    const sessionQuestions = screen.getByRole("list", {
      name: "Session questions",
    });
    const currentQuestion = within(sessionQuestions).getByRole("button", {
      name: "Question 1 of 2. First note. Current prompt.",
    });

    expect(within(currentQuestion).getByText("Current")).toBeInTheDocument();

    fireEvent.click(currentQuestion);

    const selectedQuestion = within(sessionQuestions).getByRole("button", {
      name: "Question 1 of 2. First note. Current prompt. Snapshot open.",
    });

    expect(
      within(selectedQuestion).getByText("Snapshot open"),
    ).toBeInTheDocument();
  });

  it("returns completed recall sessions to the newest selected result when older results already exist", async () => {
    vi.useFakeTimers();

    const { labelsContext, notesContext, recallContext } =
      createLearningLoopTestContexts({
        shuffleNotes: (sessionNotes) => [...sessionNotes],
      });
    const userId = "user-placeholder";
    const olderNote = createRecallNote(notesContext, userId, {
      body: "Older result should not stay selected after a new completion.",
      title: "Older spacing note",
    });
    const newerExistingNote = createRecallNote(notesContext, userId, {
      body: "Existing newest result should be replaced by the just-finished one.",
      title: "Existing newest note",
    });
    createRecallNote(notesContext, userId, {
      body: "Fresh completion should be selected on return to Recall.",
      title: "Returned newest note",
    });

    for (const [timestamp, noteId, rating] of [
      ["2026-04-01T09:00:00.000Z", olderNote.id, "missed"],
      ["2026-04-02T09:00:00.000Z", newerExistingNote.id, "partial"],
    ] as const) {
      completeRecallSessionAt({
        noteId,
        rating,
        recallContext,
        timestamp,
        userId,
      });
    }

    vi.setSystemTime(new Date("2026-04-03T09:00:00.000Z"));
    vi.useRealTimers();

    const { router } = renderRoute("/recall?section=results", {
      labelsContext,
      notesContext,
      recallContext,
    });

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Results",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Open review" })[1]);

    const selectedOlderResult = getSelectedSessionResultRegion();
    const olderQuestionReview = within(selectedOlderResult).getByRole(
      "region",
      {
        name: "Prompt review",
      },
    );
    expect(
      within(olderQuestionReview).getByRole("heading", {
        name: "Older spacing note",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Start Recall" }));
    expect(
      await screen.findByRole("heading", { level: 3, name: "Recall setup" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall/select");

    selectRecallableNote(
      "Returned newest note",
      "Fresh completion should be selected on return to Recall.",
    );
    await startSelectedRecallSession();

    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Nailed it" }));

    await expectReturnedToRecall(router);
    await openRecallResultsSection();
    const selectedReturnedResult = getSelectedSessionResultRegion();
    const returnedQuestionReview = within(selectedReturnedResult).getByRole(
      "region",
      {
        name: "Prompt review",
      },
    );
    expect(
      within(returnedQuestionReview).getByRole("heading", {
        name: "Returned newest note",
      }),
    ).toBeInTheDocument();
    expect(
      within(selectedReturnedResult).queryByText("Older spacing note"),
    ).toBeNull();
  });

  it("selects the newest result when a fresh SessionResult is added after an older result was selected", async () => {
    vi.useFakeTimers();

    const { labelsContext, notesContext, recallContext } =
      createLearningLoopTestContexts({
        shuffleNotes: (sessionNotes) => [...sessionNotes],
      });
    const userId = "user-placeholder";
    const olderNote = createRecallNote(notesContext, userId, {
      body: "Older result starts selected after manual switch.",
      title: "Earlier note",
    });
    const newerExistingNote = createRecallNote(notesContext, userId, {
      body: "This is the existing newest result before the fresh completion.",
      title: "Current newest note",
    });
    const freshNote = createRecallNote(notesContext, userId, {
      body: "Fresh result should take selection when it lands at the top.",
      title: "Fresh result note",
    });

    for (const [timestamp, noteId, rating] of [
      ["2026-04-01T09:00:00.000Z", olderNote.id, "missed"],
      ["2026-04-02T09:00:00.000Z", newerExistingNote.id, "partial"],
    ] as const) {
      completeRecallSessionAt({
        noteId,
        rating,
        recallContext,
        timestamp,
        userId,
      });
    }

    vi.useRealTimers();

    renderRoute("/recall?section=results", {
      labelsContext,
      notesContext,
      recallContext,
    });

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Results",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Open review" })[1]);

    const selectedOlderResult = getSelectedSessionResultRegion();
    expect(
      within(
        within(selectedOlderResult).getByRole("region", {
          name: "Prompt review",
        }),
      ).getByRole("heading", {
        name: "Earlier note",
      }),
    ).toBeInTheDocument();

    const session = recallContext.startFlashCardSession({
      noteIds: [freshNote.id],
      userId,
    });
    recallContext.revealFlashCardAnswer({
      sessionId: session.id,
      userId,
    });
    recallContext.rateFlashCardAnswer({
      rating: "nailed",
      sessionId: session.id,
      userId,
    });

    const selectedFreshResult = getSelectedSessionResultRegion();
    expect(
      await within(
        within(selectedFreshResult).getByRole("region", {
          name: "Prompt review",
        }),
      ).findByRole("heading", {
        name: "Fresh result note",
      }),
    ).toBeInTheDocument();
    expect(within(selectedFreshResult).queryByText("Earlier note")).toBeNull();
  });

  it("returns attempted early-ended recall sessions to /recall and opens the new result", async () => {
    const { labelsContext, notesContext, recallContext } =
      createDeterministicRecallTestContexts();
    const userId = "user-placeholder";
    const firstNote = createRecallNote(notesContext, userId, {
      body: "Attempted sessions should persist when ended early.",
      title: "Retrieval strength",
    });
    createRecallNote(notesContext, userId, {
      body: "A second prompt keeps the session active after one rating.",
      title: "Desirable difficulty",
    });

    const { router } = await renderRecallSelection({
      labelsContext,
      notesContext,
      recallContext,
    });

    selectRecallableNote(
      "Retrieval strength",
      "Attempted sessions should persist when ended early.",
    );
    selectRecallableNote(
      "Desirable difficulty",
      "A second prompt keeps the session active after one rating.",
    );
    await startSelectedRecallSession();

    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Partly recalled" }));
    fireEvent.click(screen.getByRole("button", { name: "End session" }));

    await expectReturnedToRecall(router);
    await openRecallResultsSection();
    const selectedResult = getSelectedSessionResultRegion();
    const questionReview = within(selectedResult).getByRole("region", {
      name: "Prompt review",
    });
    expect(
      within(selectedResult).getByText("1 attempted question"),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getByText("Nailed 0 · Partial 1 · Missed 0"),
    ).toBeInTheDocument();
    expect(
      within(questionReview).getByRole("heading", {
        name: "Retrieval strength",
      }),
    ).toBeInTheDocument();
    expect(recallContext.listSessionResults({ userId })).toMatchObject([
      {
        attempts: [{ noteId: firstNote.id, rating: "partial" }],
        notes: [
          { title: "Retrieval strength" },
          { title: "Desirable difficulty" },
        ],
      },
    ]);
  });

  it("returns zero-attempt recall sessions to /recall without creating a recent result", async () => {
    const { labelsContext, notesContext, recallContext } =
      createDeterministicRecallTestContexts();
    const userId = "user-placeholder";

    createRecallNote(notesContext, userId, {
      body: "Zero-attempt sessions should keep discard behavior.",
      title: "Testing cue",
    });

    const { router } = await renderRecallSelection({
      labelsContext,
      notesContext,
      recallContext,
    });

    selectRecallableNote(
      "Testing cue",
      "Zero-attempt sessions should keep discard behavior.",
    );
    await startSelectedRecallSession();

    fireEvent.click(screen.getByRole("button", { name: "End session" }));

    await expectReturnedToRecall(router);
    await openRecallResultsSection();
    expect(screen.getByText("No results yet")).toBeInTheDocument();
    expect(recallContext.listSessionResults({ userId })).toHaveLength(0);
  });

  it("shows a true empty results state with a recall CTA", async () => {
    const { labelsContext, notesContext } = createLearningLoopTestContexts();
    const userId = "user-placeholder";

    createRecallNote(notesContext, userId, {
      body: "A note exists, but recall results do not.",
      title: "Fresh note",
    });

    renderRoute("/recall?section=results", {
      labelsContext,
      notesContext,
    });

    expect(
      await screen.findByRole("heading", { name: "No results yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Complete a recall session to build reviewable results.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start Recall" })).toHaveAttribute(
      "href",
      "/recall/select",
    );
    expect(
      screen.queryByText(
        "No session results yet. Complete at least one attempted recall session to build history.",
      ),
    ).toBeNull();
  });

  it("shows /recall as the canonical results workspace with newest result selected by default", async () => {
    vi.useFakeTimers();

    const { labelsContext, notesContext, recallContext } =
      createLearningLoopTestContexts({
        shuffleNotes: (sessionNotes) => [...sessionNotes],
      });
    const userId = "user-placeholder";
    const science = labelsContext.createLabel({
      name: "Science",
      userId,
    });
    const firstNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "Stored snapshots should stay inside full results review.",
      labelIds: [science.id],
      metaphors: [],
      title: "Testing effect",
    });
    const secondNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "Newest results should open directly in the detail pane.",
      labelIds: [science.id],
      metaphors: [],
      title: "Spacing effect",
    });

    for (const [timestamp, noteId, rating] of [
      ["2026-04-01T09:00:00.000Z", firstNote.id, "nailed"],
      ["2026-04-02T09:00:00.000Z", secondNote.id, "partial"],
    ] as const) {
      vi.setSystemTime(new Date(timestamp));
      const session = recallContext.startFlashCardSession({
        noteIds: [noteId],
        userId,
      });

      recallContext.revealFlashCardAnswer({
        sessionId: session.id,
        userId,
      });
      recallContext.rateFlashCardAnswer({
        rating,
        sessionId: session.id,
        userId,
      });
    }

    vi.useRealTimers();

    renderRoute("/recall?section=results", {
      labelsContext,
      notesContext,
      recallContext,
    });

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Results",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start Recall" })).toHaveAttribute(
      "href",
      "/recall/select",
    );

    const resultsList = screen.getByRole("region", {
      name: "Review list",
    });
    const selectedResult = screen.getByRole("region", {
      name: "Selected review",
    });

    const sessionButtons = within(resultsList).getAllByRole("button", {
      name: "Open review",
    });

    expect(sessionButtons).toHaveLength(2);
    expect(sessionButtons[0]).toHaveAttribute("aria-pressed", "true");
    expect(sessionButtons[1]).toHaveAttribute("aria-pressed", "false");
    expect(
      within(sessionButtons[0]).getByText("1 note practiced"),
    ).toBeInTheDocument();
    expect(
      within(sessionButtons[0]).getByText("Nailed 0 · Partial 1 · Missed 0"),
    ).toBeInTheDocument();
    const questionReview = within(selectedResult).getByRole("region", {
      name: "Prompt review",
    });
    expect(
      within(questionReview).getByRole("heading", {
        name: "Spacing effect",
      }),
    ).toBeInTheDocument();
    expect(
      within(questionReview).getByText(
        "Newest results should open directly in the detail pane.",
      ),
    ).toBeInTheDocument();
    expect(
      within(questionReview).getByText("Rating: Partly recalled"),
    ).toBeInTheDocument();
    expect(within(selectedResult).queryByText("Testing effect")).toBeNull();
  });

  it("shows persisted session results with stored note snapshots", async () => {
    const { labelsContext, notesContext, recallContext } =
      createDeterministicRecallTestContexts();
    const userId = "user-placeholder";
    const science = labelsContext.createLabel({
      name: "Alpha Science",
      userId,
    });
    const note = notesContext.createNote(userId, {
      acronyms: [],
      body: "Original study snapshot",
      labelIds: [science.id],
      metaphors: [],
      title: "Original prompt",
    });

    const session = recallContext.startFlashCardSession({
      noteIds: [note.id],
      userId,
    });

    recallContext.revealFlashCardAnswer({
      sessionId: session.id,
      userId,
    });
    recallContext.rateFlashCardAnswer({
      rating: "nailed",
      sessionId: session.id,
      userId,
    });

    notesContext.updateNote(userId, note.id, {
      acronyms: [],
      body: "Edited live note",
      labelIds: [science.id],
      metaphors: [],
      title: "Edited live prompt",
    });

    cleanup();

    renderRoute("/recall?section=results", {
      labelsContext,
      notesContext,
      recallContext,
    });

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Results",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Open review" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 attempted question/)).toHaveLength(1);
    expect(screen.getAllByText(/1 note practiced/)).toHaveLength(2);
    expect(
      within(getSelectedSessionResultRegion()).getByText(
        "Nailed 1 · Partial 0 · Missed 0",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open review" }));

    const selectedResult = getSelectedSessionResultRegion();
    const questionReview = within(selectedResult).getByRole("region", {
      name: "Prompt review",
    });
    expect(
      within(questionReview).getByRole("heading", {
        name: "Original prompt",
      }),
    ).toBeInTheDocument();
    expect(
      within(questionReview).getByText("Original study snapshot"),
    ).toBeInTheDocument();
    expect(
      within(questionReview).getByText("Rating: Nailed it"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Edited live note")).toBeNull();
  });

  it("shows read-only selected SessionResult details with stored note snapshot summaries", async () => {
    const { labelsContext, notesContext, recallContext } =
      createDeterministicRecallTestContexts();
    const userId = "user-placeholder";
    const science = labelsContext.createLabel({
      name: "Alpha Science",
      userId,
    });
    const promptedNote = notesContext.createNote(userId, {
      acronyms: [{ description: "LTP means long term potentiation." }],
      body: "Original study snapshot",
      labelIds: [science.id],
      metaphors: [
        {
          description: "Wiring path: neurons that wire together stay together.",
        },
      ],
      title: "Original prompt",
    });
    const weakNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "Weak note snapshot",
      labelIds: [],
      metaphors: [],
      title: "Weak prompt",
    });
    const unattemptedNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "Stored but not attempted in this session",
      labelIds: [],
      metaphors: [],
      title: "Second stored prompt",
    });

    const session = recallContext.startFlashCardSession({
      noteIds: [promptedNote.id, weakNote.id, unattemptedNote.id],
      userId,
    });

    recallContext.revealFlashCardAnswer({
      sessionId: session.id,
      userId,
    });
    recallContext.rateFlashCardAnswer({
      rating: "nailed",
      sessionId: session.id,
      userId,
    });
    recallContext.revealFlashCardAnswer({
      sessionId: session.id,
      userId,
    });
    recallContext.rateFlashCardAnswer({
      rating: "partial",
      sessionId: session.id,
      userId,
    });
    recallContext.endFlashCardSession({
      sessionId: session.id,
      userId,
    });

    notesContext.updateNote(userId, promptedNote.id, {
      acronyms: [{ description: "LEA means Live edited acronym." }],
      body: "Edited live note",
      labelIds: [science.id],
      metaphors: [],
      title: "Edited live prompt",
    });

    renderRoute("/recall?section=results", {
      labelsContext,
      notesContext,
      recallContext,
    });

    const selectedResult = await screen.findByRole("region", {
      name: "Selected review",
    });

    expect(
      within(selectedResult).getByRole("heading", {
        level: 4,
        name: "Session details",
      }),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getByText("Mode: Recall"),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getByText("2 attempted questions"),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getByText("3 questions in session"),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getByText("3 notes practiced"),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getByText("Nailed 1 · Partial 1 · Missed 0"),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getByRole("heading", {
        level: 4,
        name: "Weak notes",
      }),
    ).toBeInTheDocument();
    expect(
      within(
        within(selectedResult).getByRole("heading", {
          level: 4,
          name: "Weak notes",
        }).parentElement as HTMLElement,
      ).getByText("Weak prompt · Partly recalled"),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getByText("Partly recalled"),
    ).toBeInTheDocument();

    expect(
      within(selectedResult).getByRole("heading", {
        level: 4,
        name: "Prompt review",
      }),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getByRole("heading", {
        level: 4,
        name: "Stored note snapshots",
      }),
    ).toBeInTheDocument();
    const snapshotSummary = within(selectedResult).getByRole("region", {
      name: "Stored note snapshots",
    });
    expect(
      within(snapshotSummary).getByText("Original study snapshot"),
    ).toBeInTheDocument();
    expect(
      within(snapshotSummary).getByText("Weak note snapshot"),
    ).toBeInTheDocument();
    expect(
      within(snapshotSummary).getByText(
        "Stored but not attempted in this session",
      ),
    ).toBeInTheDocument();
    expect(
      within(snapshotSummary).getByText(
        /1 acronym\s+·\s+1 metaphor\s+·\s+1 label/,
      ),
    ).toBeInTheDocument();
    expect(within(selectedResult).queryByText("Edited live note")).toBeNull();
    expect(
      within(selectedResult).queryByRole("button", { name: /edit/i }),
    ).toBeNull();
    expect(
      within(selectedResult).queryByRole("button", { name: /delete/i }),
    ).toBeNull();
  });

  it("starts a weak-note follow-up recall from results with weak notes preselected", async () => {
    const { labelsContext, notesContext, recallContext } =
      createDeterministicRecallTestContexts();
    const userId = "user-placeholder";
    const strongNote = createRecallNote(notesContext, userId, {
      body: "Strong note snapshot",
      title: "Strong prompt",
    });
    const partialNote = createRecallNote(notesContext, userId, {
      body: "Partial note snapshot",
      title: "Partial prompt",
    });
    const missedNote = createRecallNote(notesContext, userId, {
      body: "Missed note snapshot",
      title: "Missed prompt",
    });

    const session = recallContext.startFlashCardSession({
      noteIds: [strongNote.id, partialNote.id, missedNote.id],
      userId,
    });

    rateFlashCardAnswers({
      ratings: ["nailed", "partial", "missed"],
      recallContext,
      sessionId: session.id,
      userId,
    });

    const { router } = renderRoute("/recall?section=results", {
      labelsContext,
      notesContext,
      recallContext,
    });

    const selectedResult = await screen.findByRole("region", {
      name: "Selected review",
    });

    fireEvent.click(
      within(selectedResult).getByRole("link", {
        name: "Practice weak notes",
      }),
    );

    expect(
      await screen.findByRole("heading", { level: 3, name: "Recall setup" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall/select");

    const summary = screen.getByRole("region", { name: "Session summary" });
    expect(within(summary).getByText("2 selected")).toBeInTheDocument();
    expect(within(summary).getByText("Weak-note review")).toBeInTheDocument();

    const selectedNotes = screen.getByRole("region", {
      name: "Selected notes",
    });
    expect(
      within(selectedNotes).getByText("Missed prompt"),
    ).toBeInTheDocument();
    expect(
      within(selectedNotes).getByText("Partial prompt"),
    ).toBeInTheDocument();
    expect(within(selectedNotes).queryByText("Strong prompt")).toBeNull();

    expect(
      screen.getByRole("button", { name: "Weak notes (2)" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a start-next-recall action when results have no weak notes", async () => {
    const { labelsContext, notesContext, recallContext } =
      createDeterministicRecallTestContexts();
    const userId = "user-placeholder";
    const strongNote = createRecallNote(notesContext, userId, {
      body: "Strong note snapshot",
      title: "Strong prompt",
    });

    const session = recallContext.startFlashCardSession({
      noteIds: [strongNote.id],
      userId,
    });

    rateFlashCardAnswers({
      ratings: ["nailed"],
      recallContext,
      sessionId: session.id,
      userId,
    });

    renderRoute("/recall?section=results", {
      labelsContext,
      notesContext,
      recallContext,
    });

    const selectedResult = await screen.findByRole("region", {
      name: "Selected review",
    });

    expect(
      within(selectedResult).queryByRole("link", {
        name: "Practice weak notes",
      }),
    ).toBeNull();
    expect(
      within(selectedResult).getByRole("link", {
        name: "Start another recall",
      }),
    ).toHaveAttribute("href", "/recall/select");
    expect(
      within(selectedResult).getByText(
        "This session left no weak notes. Pick the next notes to keep the loop going.",
      ),
    ).toBeInTheDocument();
  });

  it("switches the selected result without changing the route", async () => {
    vi.useFakeTimers();

    let sessionCounter = 0;
    const { labelsContext, notesContext, recallContext } =
      createLearningLoopTestContexts({
        crypto: {
          randomUUID: () =>
            `session-by-note-ui-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
        },
        shuffleNotes: (sessionNotes) => [...sessionNotes],
      });
    const userId = "user-placeholder";
    const science = labelsContext.createLabel({
      name: "Alpha Science",
      userId,
    });
    const neuralNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "Neural pathways original snapshot",
      labelIds: [science.id],
      metaphors: [],
      title: "Neural pathways",
    });
    const retrievalNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "Retrieval practice snapshot",
      labelIds: [],
      metaphors: [],
      title: "Retrieval practice",
    });

    for (const [timestamp, noteId, rating] of [
      ["2026-04-01T09:00:00.000Z", neuralNote.id, "missed"],
      ["2026-04-02T09:00:00.000Z", retrievalNote.id, "partial"],
    ] as const) {
      vi.setSystemTime(new Date(timestamp));
      const session = recallContext.startFlashCardSession({
        noteIds: [noteId],
        userId,
      });
      recallContext.revealFlashCardAnswer({ sessionId: session.id, userId });
      recallContext.rateFlashCardAnswer({
        rating,
        sessionId: session.id,
        userId,
      });
    }

    vi.useRealTimers();

    const { router } = renderRoute("/recall?section=results", {
      labelsContext,
      notesContext,
      recallContext,
    });

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Results",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Open review" }).length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: "Open review" })[1]);

    const resultsPane = screen.getByRole("region", {
      name: "Selected review",
    });
    const questionReview = within(resultsPane).getByRole("region", {
      name: "Prompt review",
    });

    expect(
      within(questionReview).getByRole("heading", {
        name: "Neural pathways",
      }),
    ).toBeInTheDocument();
    expect(
      within(questionReview).getByText("Neural pathways original snapshot"),
    ).toBeInTheDocument();
    expect(
      within(questionReview).getByText("Rating: Missed it"),
    ).toBeInTheDocument();
    expect(
      within(resultsPane).queryByText("Retrieval practice snapshot"),
    ).toBeNull();
    expect(router.state.location.pathname).toBe("/recall");
  });

  it("keeps secondary label filtering on recall results", async () => {
    vi.useFakeTimers();

    let sessionCounter = 0;
    const { labelsContext, notesContext, recallContext } =
      createLearningLoopTestContexts({
        crypto: {
          randomUUID: () =>
            `session-label-filter-ui-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
        },
        shuffleNotes: (sessionNotes) => [...sessionNotes],
      });
    const userId = "user-placeholder";
    const science = labelsContext.createLabel({
      name: "Science",
      userId,
    });
    const history = labelsContext.createLabel({
      name: "History",
      userId,
    });
    const unmatched = labelsContext.createLabel({
      name: "Unmatched",
      userId,
    });
    const scienceNote = createRecallNote(notesContext, userId, {
      body: "Science snapshot",
      labelIds: [science.id],
      title: "Science result",
    });
    const historyNote = createRecallNote(notesContext, userId, {
      body: "History snapshot",
      labelIds: [history.id],
      title: "History result",
    });

    for (const [timestamp, noteId] of [
      ["2026-04-01T09:00:00.000Z", scienceNote.id],
      ["2026-04-02T09:00:00.000Z", historyNote.id],
    ] as const) {
      createCompletedRecallSession(recallContext, {
        noteId,
        rating: "partial",
        timestamp,
        userId,
      });
    }

    vi.useRealTimers();

    renderRoute("/recall?section=results", {
      labelsContext,
      notesContext,
      recallContext,
    });

    expect(
      await screen.findByRole("heading", { level: 3, name: "Results" }),
    ).toBeInTheDocument();

    const resultsList = screen.getByRole("region", {
      name: "Review list",
    });
    const labelFilter = screen.getByLabelText("Filter results by label");

    function getQuestionReview() {
      return within(
        screen.getByRole("region", {
          name: "Selected review",
        }),
      ).getByRole("region", {
        name: "Prompt review",
      });
    }

    expect(
      within(resultsList).getAllByRole("button", { name: "Open review" }),
    ).toHaveLength(2);
    expect(
      within(getQuestionReview()).getByText("History result"),
    ).toBeInTheDocument();

    fireEvent.change(labelFilter, {
      target: { value: science.id },
    });

    expect(
      within(resultsList).getAllByRole("button", { name: "Open review" }),
    ).toHaveLength(1);
    expect(
      within(getQuestionReview()).getByText("Science result"),
    ).toBeInTheDocument();

    fireEvent.change(labelFilter, {
      target: { value: unmatched.id },
    });

    expect(
      within(resultsList).getByText("No results match this label yet."),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("region", {
          name: "Selected review",
        }),
      ).getByText(
        "Complete a recall session to review stored note snapshots and prompt ratings.",
      ),
    ).toBeInTheDocument();

    fireEvent.change(labelFilter, {
      target: { value: "" },
    });

    const restoredButtons = within(resultsList).getAllByRole("button", {
      name: "Open review",
    });
    expect(restoredButtons).toHaveLength(2);
    expect(restoredButtons[0]).toHaveAttribute("aria-pressed", "true");
    expect(
      within(getQuestionReview()).getByText("History result"),
    ).toBeInTheDocument();
  });

  it("keeps deleted persisted labels available for results filtering after refresh", async () => {
    vi.useFakeTimers();

    const labelsKeyPrefix = `test-labels-recall-persisted-filter-${Math.random().toString(36).slice(2)}`;
    const notesKeyPrefix = `test-notes-recall-persisted-filter-${Math.random().toString(36).slice(2)}`;
    const recallKeyPrefix = `test-recall-persisted-filter-${Math.random().toString(36).slice(2)}`;
    let sessionCounter = 0;
    const userId = "user-placeholder";
    const labelsContext = createAppLabelsContext({
      keyPrefix: labelsKeyPrefix,
      storage: window.localStorage,
    });
    const notesContext = createAppNotesContext({
      getOwnedLabelIdsForUser: (ownerId) =>
        labelsContext.getLabelsForUser(ownerId).map((label) => label.id),
      keyPrefix: notesKeyPrefix,
      storage: window.localStorage,
    });
    const recallContext = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          `session-persisted-filter-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      getLabelsForUser: (ownerId) => labelsContext.getLabelsForUser(ownerId),
      keyPrefix: recallKeyPrefix,
      notes: notesContext,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage: window.localStorage,
    });
    const science = labelsContext.createLabel({
      name: "Science",
      userId,
    });
    const history = labelsContext.createLabel({
      name: "History",
      userId,
    });
    const scienceNote = createRecallNote(notesContext, userId, {
      body: "Science snapshot",
      labelIds: [science.id],
      title: "Science result",
    });
    const historyNote = createRecallNote(notesContext, userId, {
      body: "History snapshot",
      labelIds: [history.id],
      title: "History result",
    });

    for (const [timestamp, noteId] of [
      ["2026-04-01T09:00:00.000Z", scienceNote.id],
      ["2026-04-02T09:00:00.000Z", historyNote.id],
    ] as const) {
      createCompletedRecallSession(recallContext, {
        noteId,
        rating: "partial",
        timestamp,
        userId,
      });
    }

    labelsContext.deleteLabel({
      labelId: science.id,
      userId,
    });
    cleanup();

    const reloadedLabelsContext = createAppLabelsContext({
      keyPrefix: labelsKeyPrefix,
      storage: window.localStorage,
    });
    const reloadedNotesContext = createAppNotesContext({
      getOwnedLabelIdsForUser: (ownerId) =>
        reloadedLabelsContext
          .getLabelsForUser(ownerId)
          .map((label) => label.id),
      keyPrefix: notesKeyPrefix,
      storage: window.localStorage,
    });
    const reloadedRecallContext = createAppRecallContext({
      getLabelsForUser: (ownerId) =>
        reloadedLabelsContext.getLabelsForUser(ownerId),
      keyPrefix: recallKeyPrefix,
      notes: reloadedNotesContext,
      storage: window.localStorage,
    });

    vi.useRealTimers();

    renderRoute("/recall?section=results", {
      labelsContext: reloadedLabelsContext,
      notesContext: reloadedNotesContext,
      recallContext: reloadedRecallContext,
    });

    expect(
      await screen.findByRole("heading", { level: 3, name: "Results" }),
    ).toBeInTheDocument();

    const labelFilter = screen.getByLabelText("Filter results by label");
    const resultsList = screen.getByRole("region", {
      name: "Review list",
    });

    expect(
      within(labelFilter).getByRole("option", { name: "Science" }),
    ).toBeInTheDocument();

    fireEvent.change(labelFilter, {
      target: { value: science.id },
    });

    expect(
      within(resultsList).getAllByRole("button", { name: "Open review" }),
    ).toHaveLength(1);
    expect(
      within(
        within(getSelectedSessionResultRegion()).getByRole("region", {
          name: "Prompt review",
        }),
      ).getByRole("heading", {
        name: "Science result",
      }),
    ).toBeInTheDocument();
  });

  it("shows recall search matches in the header and selects a session from them", async () => {
    vi.useFakeTimers();

    let sessionCounter = 0;
    const { labelsContext, notesContext, recallContext } =
      createLearningLoopTestContexts({
        crypto: {
          randomUUID: () =>
            `session-search-ui-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
        },
        shuffleNotes: (sessionNotes) => [...sessionNotes],
      });
    const userId = "user-placeholder";
    const scienceNote = createRecallNote(notesContext, userId, {
      body: "Science snapshot",
      labelIds: [],
      title: "Science result",
    });
    const historyNote = createRecallNote(notesContext, userId, {
      body: "History snapshot",
      labelIds: [],
      title: "History result",
    });

    for (const [timestamp, noteId] of [
      ["2026-04-01T09:00:00.000Z", scienceNote.id],
      ["2026-04-02T09:00:00.000Z", historyNote.id],
    ] as const) {
      createCompletedRecallSession(recallContext, {
        noteId,
        rating: "partial",
        timestamp,
        userId,
      });
    }

    vi.useRealTimers();

    const { router } = renderRoute("/recall?section=results", {
      labelsContext,
      notesContext,
      recallContext,
    });

    expect(
      await screen.findByRole("heading", { level: 3, name: "Results" }),
    ).toBeInTheDocument();

    const search = screen.getByRole("combobox", {
      name: "Search recall sessions",
    });
    const resultsList = screen.getByRole("region", {
      name: "Review list",
    });

    fireEvent.change(search, {
      target: { value: "Science" },
    });

    const searchResults = screen.getByRole("listbox", {
      name: "Recall search results",
    });

    expect(
      within(searchResults).getByText("Science result"),
    ).toBeInTheDocument();
    expect(within(searchResults).getByText("Prompt")).toBeInTheDocument();
    expect(
      within(resultsList).getAllByRole("button", { name: "Open review" }),
    ).toHaveLength(1);

    fireEvent.click(
      within(searchResults).getByRole("option", { name: /Science result/i }),
    );

    expect(search).toHaveValue("");
    expect(
      screen.queryByRole("listbox", { name: "Recall search results" }),
    ).toBeNull();
    expect(router.state.location.pathname).toBe("/recall");
    expect(
      within(
        within(
          screen.getByRole("region", {
            name: "Selected review",
          }),
        ).getByRole("region", {
          name: "Prompt review",
        }),
      ).getByText("Science snapshot"),
    ).toBeInTheDocument();
  });
});
