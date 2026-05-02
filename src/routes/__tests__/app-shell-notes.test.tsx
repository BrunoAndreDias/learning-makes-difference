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
  createAppSessionContext,
  createCompletedRecallSession,
  createDeterministicRecallTestContexts,
  createLearningLoopTestContexts,
  createRecallNote,
  expectReturnedToRecall,
  getSelectedSessionResultRegion,
  listNotesForUser,
  openAccountMenu,
  renderRecallSelection,
  renderRoute,
  selectRecallableNote,
  startSelectedRecallSession,
} from "./app-shell-test-support";

describe("authenticated app shell", () => {
  it("keeps the discard dialog focused when a mobile sidebar note change is guarded", async () => {
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
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    const bodyEditor = await screen.findByDisplayValue(
      "Current note has work in progress.",
    );
    const sidebar = screen.getByRole("complementary", {
      name: "Notes workspace",
    });
    const notesList = within(sidebar).getByRole("navigation", {
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

  it("renders the notes list inside the app sidebar for the notes workspace", async () => {
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
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary", {
      name: "Notes workspace",
    });
    const notesNavigation = within(sidebar).getByRole("navigation", {
      name: "Notes list",
    });
    const notesLinks = within(notesNavigation).getAllByRole("button", {
      name: /^(Neural pathways|Second note)$/,
    });

    expect(
      within(sidebar).getByRole("button", { name: "New note" }),
    ).toBeInTheDocument();
    expect(notesLinks).toHaveLength(2);
    expect(notesLinks[0]).toHaveTextContent("Neural pathways");
    expect(notesLinks[1]).toHaveTextContent("Second note");
    expect(notesLinks[0]).toHaveAttribute("aria-current", "page");
    expect(
      within(notesNavigation).getAllByRole("button", {
        name: /^Delete (Neural pathways|Second note)$/,
      }),
    ).toHaveLength(2);
    const shellHeader = screen.getByLabelText("Notes workspace toolbar");

    expect(
      within(shellHeader).getByRole("combobox", { name: "Search notes" }),
    ).toBeInTheDocument();
    expect(within(shellHeader).getByText("2 notes")).toBeInTheDocument();

    expect(screen.getByLabelText("Note editor surface")).toBeInTheDocument();
    expect(screen.queryByLabelText("Notes catalog")).not.toBeInTheDocument();
    expect(screen.getAllByText("Biology").length).toBeGreaterThan(0);
    expect(firstNote.title).toBe("Neural pathways");
  });

  it("lets an authenticated user delete notes from the sidebar notes list", async () => {
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
      body: "This note can be removed from the sidebar list.",
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
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
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
        name: "Delete Disposable note",
      }),
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

  it("renders every note in the sidebar notes list without a fixed item cap", async () => {
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
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    const notesNavigation = within(
      screen.getByRole("complementary", { name: "Notes workspace" }),
    ).getByRole("navigation", {
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

  it("uses the app sidebar collapse as the only notes list visibility control", async () => {
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
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary", {
      name: "Notes workspace",
    });
    const notesList = within(sidebar).getByRole("navigation", {
      name: "Notes list",
    });
    const collapseSidebarButton = within(sidebar).getByRole("button", {
      name: "Collapse sidebar",
    });

    expect(notesList).toBeVisible();
    fireEvent.click(
      within(sidebar).getByRole("button", { name: "Spaced repetition" }),
    );
    expect(
      screen.getByDisplayValue(
        "Repeated review strengthens long-term retention.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Hide notes catalog" }),
    ).not.toBeInTheDocument();

    fireEvent.click(collapseSidebarButton);

    expect(sidebar).not.toBeVisible();
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
    expect(
      within(sidebar).getByRole("navigation", { name: "Notes list" }),
    ).toBeVisible();
    expect(
      within(sidebar).getByRole("button", { name: "Retrieval practice" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("keeps account utilities at the top of the sidebar while long notes stay reachable", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const longTitle =
      "Very long note title that should still stay reachable from the notes sidebar navigation";

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
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary", {
      name: "Notes workspace",
    });
    const notesList = within(sidebar).getByRole("navigation", {
      name: "Notes list",
    });
    const accountMenuButton = within(sidebar).getByRole("button", {
      name: /Jordan Alexandria Review Coordinator .* account menu/,
    });

    expect(
      within(sidebar).getByRole("navigation", { name: "App sections" }),
    ).toBeInTheDocument();
    expect(
      within(notesList).getByRole("button", { name: longTitle }),
    ).toBeInTheDocument();
    expect(sidebar).toContainElement(accountMenuButton);
    expect(
      Boolean(
        accountMenuButton.compareDocumentPosition(notesList) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
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
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No notes yet")).toBeInTheDocument();
    expect(screen.getByLabelText("Title").closest("header")).toContainElement(
      screen.getByRole("button", { name: "Create note" }),
    );
    expect(
      within(
        screen.getByRole("complementary", { name: "Notes workspace" }),
      ).getByRole("button", { name: "New note" }),
    ).toBeDisabled();

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
        screen.getByRole("complementary", { name: "Notes workspace" }),
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
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByDisplayValue("Spaced repetition"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Body"), {
      target: {
        value:
          "Reviewing at expanding intervals improves recall over long spans.",
      },
    });

    const saveButton = screen.getByRole("button", { name: "Save changes" });
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
      screen.queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();
  });

  it("opens notes search results without live-filtering the stable sidebar notes list", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    notesContext.createNote("user-jordan", {
      acronyms: [
        {
          expansion: "Long-Term Potentiation",
          shortForm: "LTP",
        },
      ],
      body: "Repeated activation strengthens the pathway.",
      labelIds: [],
      metaphors: [
        {
          explanation:
            "It is like cutting a groove into a sled track so the next pass follows more easily.",
          title: "Sled track",
        },
      ],
      title: "Synaptic plasticity",
    });
    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Short-term storage supports active reasoning.",
      labelIds: [],
      metaphors: [],
      title: "Working memory",
    });
    notesContext.createNote("user-casey", {
      acronyms: [
        {
          expansion: "Long-Term Potentiation",
          shortForm: "LTP",
        },
      ],
      body: "This note belongs to another account.",
      labelIds: [],
      metaphors: [],
      title: "Hidden note",
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    const searchInput = screen.getByRole("combobox", {
      name: "Search notes",
    });
    const notesList = within(
      screen.getByRole("navigation", { name: "Notes list" }),
    );

    expect(searchInput).toHaveAttribute("placeholder", "Search notes");
    expect(
      screen.queryByLabelText("Notes search results"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Short-term storage supports active reasoning."),
    ).toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: { value: "sled track" },
    });

    expect(
      within(screen.getByLabelText("Notes search results")).getByRole(
        "option",
        { name: /Synaptic plasticity/ },
      ),
    ).toBeInTheDocument();
    expect(
      notesList.getByRole("button", { name: "Working memory" }),
    ).toBeInTheDocument();
    expect(
      notesList.getByRole("button", { name: "Synaptic plasticity" }),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Short-term storage supports active reasoning."),
    ).toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: { value: "long-term potentiation" },
    });

    expect(
      within(screen.getByLabelText("Notes search results")).getByRole(
        "option",
        { name: /Synaptic plasticity/ },
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Hidden note/ }),
    ).not.toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: { value: "missing concept" },
    });

    expect(screen.getByText("No notes found")).toBeInTheDocument();
    expect(
      notesList.getByRole("button", { name: "Working memory" }),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Short-term storage supports active reasoning."),
    ).toBeInTheDocument();
  });

  it("shows ranked notes search results with match chips and updated dates", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    notesContext.createNote("user-jordan", {
      acronyms: [
        {
          expansion: "Priority Cue",
          shortForm: "PC",
        },
      ],
      body: "Mnemonic content only.",
      labelIds: [],
      metaphors: [],
      title: "Acronym result",
    });
    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Visual memory aid only.",
      labelIds: [],
      metaphors: [
        {
          explanation: "A priority cue acts like a lighthouse.",
          title: "Lighthouse",
        },
      ],
      title: "Metaphor result",
    });
    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "This body contains a priority cue.",
      labelIds: [],
      metaphors: [],
      title: "Body result",
    });
    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "This body also contains a priority cue.",
      labelIds: [],
      metaphors: [
        {
          explanation: "Priority cue also appears here.",
          title: "Duplicate attached match",
        },
      ],
      title: "Priority cue title result",
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("combobox", {
        name: "Search notes",
      }),
      {
        target: { value: "priority cue" },
      },
    );

    const resultButtons = within(
      screen.getByLabelText("Notes search results"),
    ).getAllByRole("option");

    expect(resultButtons).toHaveLength(4);
    expect(resultButtons.map((button) => button.textContent)).toEqual([
      expect.stringMatching(/^Priority cue title resultTitleUpdated /),
      expect.stringMatching(
        /^Body resultBodyThis body contains a priority cue\.Updated /,
      ),
      expect.stringMatching(
        /^Metaphor resultMetaphorLighthouse A priority cue acts like a lighthouse\.Updated /,
      ),
      expect.stringMatching(/^Acronym resultAcronymPC Priority CueUpdated /),
    ]);
  });

  it("supports keyboard, shortcut, mobile submit, and accessible notes search combobox behavior", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Older spaced retrieval cue.",
      labelIds: [],
      metaphors: [],
      title: "Older retrieval",
    });
    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Newer spaced retrieval cue.",
      labelIds: [],
      metaphors: [],
      title: "Newer retrieval",
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    const searchInput = screen.getByRole("combobox", {
      name: "Search notes",
    });

    expect(searchInput).toHaveAttribute("autocomplete", "off");

    fireEvent.pointerDown(screen.getByText("Cmd K"));
    expect(searchInput).toHaveFocus();

    searchInput.blur();
    fireEvent.pointerDown(searchInput.closest("form") as HTMLFormElement);
    expect(searchInput).toHaveFocus();

    fireEvent.change(searchInput, {
      target: { value: "spaced retrieval cue" },
    });

    searchInput.blur();
    fireEvent.pointerDown(
      searchInput
        .closest("form")
        ?.querySelector(".notes-search__icon svg") as SVGElement,
    );
    expect(searchInput).not.toHaveFocus();

    fireEvent.pointerDown(screen.getByText("Cmd K"));
    expect(searchInput).toHaveFocus();
    expect(searchInput).toHaveProperty("selectionStart", 0);
    expect(searchInput).toHaveProperty(
      "selectionEnd",
      "spaced retrieval cue".length,
    );

    const listbox = screen.getByRole("listbox", {
      name: "Notes search results",
    });
    const options = within(listbox).getAllByRole("option");

    expect(searchInput).toHaveAttribute("aria-expanded", "true");
    expect(searchInput).toHaveAttribute("aria-activedescendant", options[0].id);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[0]).toHaveAccessibleName(
      expect.stringMatching(
        /Newer retrieval Body Newer spaced retrieval cue\. Updated /,
      ),
    );

    fireEvent.keyDown(searchInput, { key: "ArrowDown" });
    expect(searchInput).toHaveAttribute("aria-activedescendant", options[1].id);
    expect(options[1]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(searchInput, { key: "Escape" });
    expect(searchInput).toHaveValue("spaced retrieval cue");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Newer spaced retrieval cue."),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(searchInput).toHaveFocus();
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByLabelText("Note editor surface"));
    expect(searchInput).toHaveValue("spaced retrieval cue");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    fireEvent.submit(searchInput.closest("form") as HTMLFormElement);
    expect(searchInput).toHaveValue("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Newer spaced retrieval cue."),
    ).toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: { value: "spaced retrieval cue" },
    });
    fireEvent.keyDown(searchInput, { key: "ArrowDown" });
    fireEvent.keyDown(searchInput, { key: "Enter" });

    expect(searchInput).toHaveValue("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Older spaced retrieval cue."),
    ).toBeInTheDocument();
  });

  it("jumps to and temporarily selects matched content from a chosen search result", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "The selected phrase appears here.",
      labelIds: [],
      metaphors: [],
      title: "Older target note",
    });
    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Current note stays visible until the search result is chosen.",
      labelIds: [],
      metaphors: [],
      title: "Current note",
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByDisplayValue(
        "Current note stays visible until the search result is chosen.",
      ),
    ).toBeInTheDocument();

    vi.useFakeTimers();

    const searchInput = screen.getByRole("combobox", {
      name: "Search notes",
    });

    fireEvent.change(searchInput, {
      target: { value: "selected phrase" },
    });

    fireEvent.click(
      within(screen.getByLabelText("Notes search results")).getByRole(
        "option",
        { name: /Older target note/ },
      ),
    );

    const bodyEditor = screen.getByDisplayValue(
      "The selected phrase appears here.",
    );

    expect(searchInput).toHaveValue("");
    expect(
      screen.queryByLabelText("Notes search results"),
    ).not.toBeInTheDocument();
    expect(bodyEditor).toHaveFocus();
    expect(bodyEditor).toHaveProperty("selectionStart", 4);
    expect(bodyEditor).toHaveProperty("selectionEnd", 19);
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(bodyEditor).toHaveFocus();
    expect(bodyEditor).toHaveProperty("selectionStart", 19);
    expect(bodyEditor).toHaveProperty("selectionEnd", 19);
  });

  it("syncs the sidebar active note and reveals it after selecting a search result", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "The search phrase appears in this older note.",
      labelIds: [],
      metaphors: [],
      title: "Older target note",
    });
    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "This note stays selected before searching.",
      labelIds: [],
      metaphors: [],
      title: "Current note",
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByDisplayValue(
        "This note stays selected before searching.",
      ),
    ).toBeInTheDocument();

    const notesList = within(
      screen.getByRole("navigation", { name: "Notes list" }),
    );
    const currentSidebarNote = notesList.getByRole("button", {
      name: "Current note",
    });
    const targetSidebarNote = notesList.getByRole("button", {
      name: "Older target note",
    });
    const scrollIntoView = vi.mocked(HTMLElement.prototype.scrollIntoView);

    expect(currentSidebarNote).toHaveAttribute("aria-current", "page");
    expect(targetSidebarNote).not.toHaveAttribute("aria-current");

    scrollIntoView.mockClear();

    fireEvent.change(screen.getByRole("combobox", { name: "Search notes" }), {
      target: { value: "search phrase" },
    });
    fireEvent.click(
      within(screen.getByLabelText("Notes search results")).getByRole(
        "option",
        {
          name: /Older target note/,
        },
      ),
    );

    expect(
      await screen.findByDisplayValue(
        "The search phrase appears in this older note.",
      ),
    ).toBeInTheDocument();
    expect(targetSidebarNote).toHaveAttribute("aria-current", "page");
    expect(currentSidebarNote).not.toHaveAttribute("aria-current");
    expect(scrollIntoView).toHaveBeenCalled();
    expect(scrollIntoView.mock.contexts).toContain(targetSidebarNote);
  });

  it("guards search navigation when the current note has unsaved edits", async () => {
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
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    const bodyEditor = await screen.findByDisplayValue(
      "Current note has work in progress.",
    );
    fireEvent.change(bodyEditor, {
      target: { value: "Current note has unsaved work in progress." },
    });

    const searchInput = screen.getByRole("combobox", {
      name: "Search notes",
    });

    fireEvent.change(searchInput, {
      target: { value: "protected phrase" },
    });

    const searchResults = screen.getByLabelText("Notes search results");
    fireEvent.click(
      within(searchResults).getByRole("option", {
        name: /Older protected note/,
      }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "Discard unsaved changes?",
    });
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Discard changes" }),
    ).toBeInTheDocument();
    expect(within(dialog).getAllByRole("button")).toHaveLength(2);
    expect(searchInput).toHaveValue("protected phrase");
    expect(screen.getByLabelText("Notes search results")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Current note has unsaved work in progress."),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(
      screen.queryByRole("dialog", { name: "Discard unsaved changes?" }),
    ).not.toBeInTheDocument();
    expect(searchInput).toHaveValue("protected phrase");
    expect(screen.getByLabelText("Notes search results")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Current note has unsaved work in progress."),
    ).toBeInTheDocument();

    vi.useFakeTimers();

    fireEvent.click(
      within(screen.getByLabelText("Notes search results")).getByRole(
        "option",
        {
          name: /Older protected note/,
        },
      ),
    );
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "Discard unsaved changes?" }),
      ).getByRole("button", { name: "Discard changes" }),
    );

    const targetEditor = screen.getByDisplayValue(
      "The protected phrase appears here.",
    );

    expect(searchInput).toHaveValue("");
    expect(
      screen.queryByLabelText("Notes search results"),
    ).not.toBeInTheDocument();
    expect(targetEditor).toHaveFocus();
    expect(targetEditor).toHaveProperty("selectionStart", 4);
    expect(targetEditor).toHaveProperty("selectionEnd", 20);
  });

  it("assigns and removes owned labels from a note inside the notes workspace", async () => {
    const labelsContext = createAppLabelsContext({
      keyPrefix: `test-labels-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";

    labelsContext.createLabel({
      name: "Biology",
      userId,
    });
    labelsContext.createLabel({
      name: "Science",
      userId,
    });

    renderRoute("/notes", {
      labelsContext,
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
    expect(screen.getByText("No labels yet")).toBeInTheDocument();
    expect(screen.queryByText("Assign labels")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Cell respiration" },
    });
    fireEvent.change(screen.getByLabelText("Body"), {
      target: {
        value:
          "Cells convert glucose into usable energy through staged reactions.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add label" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Science" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Biology" }));
    fireEvent.submit(screen.getByRole("form", { name: "Note editor" }));

    const currentLabels = await screen.findByLabelText("Current labels");
    const assignedLabels =
      within(currentLabels).getByLabelText("Assigned labels");

    expect(within(assignedLabels).getByText("Science")).toBeInTheDocument();
    expect(within(assignedLabels).getByText("Biology")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Biology" }));
    fireEvent.submit(screen.getByRole("form", { name: "Note editor" }));

    expect(within(assignedLabels).getByText("Science")).toBeInTheDocument();
    expect(
      within(assignedLabels).queryByText("Biology"),
    ).not.toBeInTheDocument();
  });

  it("manages note metaphors inside the note workflow", async () => {
    renderRoute("/notes", {
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    const memoryHooks = screen.getByLabelText("Memory hooks");
    expect(
      within(memoryHooks).getByText(
        "Memory hooks turn a note into something easier to remember during recall.",
      ),
    ).toBeInTheDocument();
    expect(
      within(memoryHooks).getByRole("button", { name: "Create a hook" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Action potentials" },
    });
    fireEvent.change(screen.getByLabelText("Body"), {
      target: {
        value: "Neurons fire once membrane voltage crosses threshold.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add metaphor" }));

    expect(screen.getAllByLabelText("Metaphor editor")).toHaveLength(1);

    fireEvent.change(screen.getAllByLabelText("Metaphor title")[0], {
      target: { value: "Domino line" },
    });
    fireEvent.change(screen.getAllByLabelText("Metaphor explanation")[0], {
      target: {
        value:
          "Crossing threshold is like tipping the first domino so the whole line falls.",
      },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Note editor" }));

    expect(await screen.findByDisplayValue("Domino line")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        "Crossing threshold is like tipping the first domino so the whole line falls.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add metaphor" }));

    expect(screen.getAllByLabelText("Metaphor editor")).toHaveLength(2);
    expect(within(memoryHooks).getAllByText("Metaphor")).toHaveLength(2);
    expect(within(memoryHooks).getByText("Domino line")).toBeInTheDocument();
    expect(
      within(memoryHooks).getAllByText(
        "Crossing threshold is like tipping the first domino so the whole line falls.",
      ),
    ).toHaveLength(2);

    fireEvent.change(screen.getAllByLabelText("Metaphor explanation")[0], {
      target: {
        value:
          "Crossing threshold is like tipping the first domino and committing the whole chain.",
      },
    });
    fireEvent.change(screen.getAllByLabelText("Metaphor title")[1], {
      target: { value: "Fuse" },
    });
    fireEvent.change(screen.getAllByLabelText("Metaphor explanation")[1], {
      target: {
        value: "Threshold acts like lighting a fuse that runs to completion.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove metaphor 2" }));
    expect(
      screen.getByRole("dialog", { name: "Remove memory hook?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Remove Metaphor: Fuse? This cannot be undone."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep hook" }));
    expect(
      screen.queryByRole("dialog", { name: "Remove memory hook?" }),
    ).toBeNull();
    expect(screen.getByDisplayValue("Fuse")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove metaphor 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove hook" }));
    fireEvent.submit(screen.getByRole("form", { name: "Note editor" }));

    expect(await screen.findByDisplayValue("Domino line")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        "Crossing threshold is like tipping the first domino and committing the whole chain.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Fuse")).not.toBeInTheDocument();
  });

  it("manages note acronyms inside the note workflow", async () => {
    renderRoute("/notes", {
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Order of operations" },
    });
    fireEvent.change(screen.getByLabelText("Body"), {
      target: {
        value: "Acronyms help preserve the order of arithmetic steps.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add acronym" }));

    expect(screen.getAllByLabelText("Acronym editor")).toHaveLength(1);

    fireEvent.change(screen.getAllByLabelText("Acronym")[0], {
      target: { value: "PEMDAS" },
    });
    fireEvent.change(screen.getAllByLabelText("Acronym expansion")[0], {
      target: {
        value:
          "Parentheses, Exponents, Multiplication, Division, Addition, Subtraction.",
      },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Note editor" }));

    expect(await screen.findByDisplayValue("PEMDAS")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        "Parentheses, Exponents, Multiplication, Division, Addition, Subtraction.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add acronym" }));

    expect(screen.getAllByLabelText("Acronym editor")).toHaveLength(2);

    fireEvent.change(screen.getAllByLabelText("Acronym expansion")[0], {
      target: {
        value:
          "Parentheses, Exponents, Multiplication, Division, Addition, Subtraction",
      },
    });
    fireEvent.change(screen.getAllByLabelText("Acronym")[1], {
      target: { value: "BODMAS" },
    });
    fireEvent.change(screen.getAllByLabelText("Acronym expansion")[1], {
      target: {
        value:
          "Brackets, Orders, Division, Multiplication, Addition, Subtraction",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove acronym 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove hook" }));
    fireEvent.submit(screen.getByRole("form", { name: "Note editor" }));

    expect(await screen.findByDisplayValue("PEMDAS")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        "Parentheses, Exponents, Multiplication, Division, Addition, Subtraction",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByDisplayValue("BODMAS")).not.toBeInTheDocument();
  });
});
