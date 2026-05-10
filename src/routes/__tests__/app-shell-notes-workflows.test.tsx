// @vitest-environment jsdom

import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  createAppFocusContext,
  createAppLabelsContext,
  createAppNotesContext,
  listNotesForUser,
  renderRoute,
} from "./app-shell-test-support";

describe("authenticated app shell", () => {
  it("filters the in-page notes list while keeping the selected note editor stable", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    notesContext.createNote("user-jordan", {
      acronyms: [
        {
          description: "LTP stands for Long-Term Potentiation.",
        },
      ],
      body: "Repeated activation strengthens the pathway.",
      labelIds: [],
      metaphors: [
        {
          description:
            "Sled track: it is like cutting a groove into a sled track so the next pass follows more easily.",
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
          description: "LTP stands for Long-Term Potentiation.",
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
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
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
      notesList.queryByRole("button", { name: "Working memory" }),
    ).not.toBeInTheDocument();
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
      notesList.queryByRole("button", { name: "Working memory" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Short-term storage supports active reasoning."),
    ).toBeInTheDocument();
  });

  it("keeps the notes list, editor, and inspector as direct workspace columns", async () => {
    renderRoute("/notes", {
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

    const workspaceSurface = screen.getByLabelText("Notes workspace surface");
    const notesLayout = workspaceSurface.querySelector(".notes-layout");
    const notesCatalog = screen.getByLabelText("Notes catalog");
    const noteEditorSurface = screen.getByLabelText("Note editor surface");
    const noteForm = screen.getByLabelText("Note editor");
    const memoryHooksPanel = screen.getByLabelText("Memory hooks panel");
    const memoryHooks = screen.getByLabelText("Memory hooks");
    const layoutColumns =
      notesLayout === null ? [] : Array.from(notesLayout.children);

    expect(layoutColumns).toEqual([
      notesCatalog,
      noteEditorSurface,
      memoryHooksPanel,
    ]);
    expect(noteEditorSurface).not.toContainElement(memoryHooksPanel);
    expect(noteForm).not.toContainElement(memoryHooks);
    expect(screen.queryByLabelText("Learning state")).not.toBeInTheDocument();
  });

  it("resizes the note body against the full editor layout", async () => {
    const originalSetPointerCapture = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "setPointerCapture",
    );
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    });
    const getBoundingClientRect = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function getElementRect(this: Element) {
        const width =
          this instanceof HTMLFormElement
            ? 620
            : this instanceof HTMLHRElement
              ? 20
              : 1000;

        return {
          bottom: 100,
          height: 100,
          left: 0,
          right: width,
          top: 0,
          width,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        };
      });

    try {
      renderRoute("/notes", {
        session: {
          user: {
            displayName: "Jordan Review",
            email: "jordan@example.com",
            id: "user-jordan",
            userLanguage: "en",
          },
        },
      });

      const splitter = await screen.findByLabelText("Resize note body");

      fireEvent.pointerDown(splitter, { clientX: 620, pointerId: 1 });
      fireEvent.pointerMove(window, { clientX: 500 });

      expect(splitter).toHaveAttribute("aria-valuenow", "50");
      expect(splitter).toHaveAttribute("aria-valuetext", "50% note body width");
    } finally {
      getBoundingClientRect.mockRestore();

      if (originalSetPointerCapture === undefined) {
        Reflect.deleteProperty(HTMLElement.prototype, "setPointerCapture");
      } else {
        Object.defineProperty(
          HTMLElement.prototype,
          "setPointerCapture",
          originalSetPointerCapture,
        );
      }
    }
  });

  it("shows ranked notes search results with match chips and updated dates", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    notesContext.createNote("user-jordan", {
      acronyms: [
        {
          description: "PC means Priority Cue.",
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
          description: "Lighthouse: a priority cue acts like a lighthouse.",
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
          description:
            "Duplicate attached match: Priority cue also appears here.",
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
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
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
        /^Metaphor resultMetaphorLighthouse: a priority cue acts like a lighthouse\.Updated /,
      ),
      expect.stringMatching(
        /^Acronym resultAcronymPC means Priority Cue\.Updated /,
      ),
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
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
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
          userLanguage: "en",
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
          userLanguage: "en",
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
    const updatedTargetNote = notesList.getByRole("button", {
      name: "Older target note",
    });
    const updatedCurrentNote = notesList.getByRole("button", {
      name: "Current note",
    });

    expect(updatedTargetNote).toHaveAttribute("aria-current", "page");
    expect(updatedCurrentNote).not.toHaveAttribute("aria-current");
    expect(scrollIntoView).toHaveBeenCalled();
    expect(scrollIntoView.mock.contexts).toContain(updatedTargetNote);
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
          userLanguage: "en",
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

  it("saves label picker changes when the picker save action is clicked", async () => {
    const labelsContext = createAppLabelsContext({
      keyPrefix: `test-labels-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";
    const notesContext = createAppNotesContext({
      getOwnedLabelIdsForUser: (currentUserId) =>
        labelsContext.getLabelsForUser(currentUserId).map((label) => label.id),
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const note = notesContext.createNote(userId, {
      acronyms: [],
      body: "Cells convert glucose into usable energy through staged reactions.",
      labelIds: [],
      metaphors: [],
      title: "Cell respiration",
    });

    const biology = labelsContext.createLabel({
      name: "Biology",
      userId,
    });
    labelsContext.createLabel({
      name: "Science",
      userId,
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
    expect(await screen.findByDisplayValue("Cell respiration")).toBeVisible();
    const titleHeader = screen.getByLabelText("Title").closest("header");

    expect(titleHeader).not.toBeNull();
    expect(screen.getByText("No labels yet")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add label" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Assign labels" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Biology" }),
    ).not.toBeInTheDocument();
    expect(
      (titleHeader as HTMLElement).querySelector(".notes-editor__save-inline"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Assign labels" }));
    fireEvent.change(await screen.findByLabelText("Search existing labels"), {
      target: { value: "bio" },
    });

    expect(screen.getByRole("checkbox", { name: "Biology" })).toBeVisible();
    expect(
      screen.queryByRole("checkbox", { name: "Science" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Biology" }));

    expect(screen.getByText("No labels yet")).toBeInTheDocument();
    expect(
      (titleHeader as HTMLElement).querySelector(".notes-editor__save-inline"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Assign labels" })).getByRole(
        "button",
        { name: "Save" },
      ),
    );

    const currentLabels = await screen.findByLabelText("Current labels");
    const assignedLabels =
      within(currentLabels).getByLabelText("Assigned labels");

    expect(within(assignedLabels).getByText("Biology")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Search existing labels"),
    ).not.toBeInTheDocument();
    expect(
      (titleHeader as HTMLElement).querySelector(".notes-editor__save-inline"),
    ).not.toBeInTheDocument();
    expect(listNotesForUser(notesContext.getSnapshot(), userId)).toEqual([
      expect.objectContaining({
        id: note.id,
        labelIds: [biology.id],
      }),
    ]);
  });

  it("cancels picker-session label changes without dirtying the note draft", async () => {
    const labelsContext = createAppLabelsContext({
      keyPrefix: `test-labels-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";
    const notesContext = createAppNotesContext({
      getOwnedLabelIdsForUser: (currentUserId) =>
        labelsContext.getLabelsForUser(currentUserId).map((label) => label.id),
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const science = labelsContext.createLabel({
      name: "Science",
      userId,
    });

    labelsContext.createLabel({
      name: "Biology",
      userId,
    });
    notesContext.createNote(userId, {
      acronyms: [],
      body: "A note with one saved label already attached.",
      labelIds: [science.id],
      metaphors: [],
      title: "Saved label note",
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
    expect(await screen.findByDisplayValue("Saved label note")).toBeVisible();
    const titleHeader = screen.getByLabelText("Title").closest("header");

    expect(titleHeader).not.toBeNull();

    const currentLabels = screen.getByLabelText("Current labels");
    const assignedLabels =
      within(currentLabels).getByLabelText("Assigned labels");

    expect(within(assignedLabels).getByText("Science")).toBeInTheDocument();
    expect(
      within(assignedLabels).queryByText("Biology"),
    ).not.toBeInTheDocument();
    expect(
      (titleHeader as HTMLElement).querySelector(".notes-editor__save-inline"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Assign labels" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Biology" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Science" }));

    expect(within(assignedLabels).getByText("Science")).toBeInTheDocument();
    expect(
      within(assignedLabels).queryByText("Biology"),
    ).not.toBeInTheDocument();
    expect(
      (titleHeader as HTMLElement).querySelector(".notes-editor__save-inline"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.queryByLabelText("Search existing labels"),
    ).not.toBeInTheDocument();
    expect(within(assignedLabels).getByText("Science")).toBeInTheDocument();
    expect(
      within(assignedLabels).queryByText("Biology"),
    ).not.toBeInTheDocument();
    expect(
      (titleHeader as HTMLElement).querySelector(".notes-editor__save-inline"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Assign labels" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Biology" }));
    fireEvent.pointerDown(document.body);

    expect(
      screen.queryByLabelText("Search existing labels"),
    ).not.toBeInTheDocument();
    expect(within(assignedLabels).getByText("Science")).toBeInTheDocument();
    expect(
      within(assignedLabels).queryByText("Biology"),
    ).not.toBeInTheDocument();
    expect(
      (titleHeader as HTMLElement).querySelector(".notes-editor__save-inline"),
    ).not.toBeInTheDocument();
    expect(listNotesForUser(notesContext.getSnapshot(), userId)).toEqual([
      expect.objectContaining({
        labelIds: [science.id],
      }),
    ]);
  });

  it("removes an assigned label chip from the draft and persists it only after saving the note", async () => {
    const labelsContext = createAppLabelsContext({
      keyPrefix: `test-labels-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";
    const notesContext = createAppNotesContext({
      getOwnedLabelIdsForUser: (currentUserId) =>
        labelsContext.getLabelsForUser(currentUserId).map((label) => label.id),
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const biology = labelsContext.createLabel({
      name: "Biology",
      userId,
    });
    const science = labelsContext.createLabel({
      name: "Science",
      userId,
    });
    const note = notesContext.createNote(userId, {
      acronyms: [],
      body: "Study how label removals behave in a note draft.",
      labelIds: [biology.id, science.id],
      metaphors: [],
      title: "Label removal note",
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
    expect(await screen.findByDisplayValue("Label removal note")).toBeVisible();

    const currentLabels = screen.getByLabelText("Current labels");
    const assignedLabels =
      within(currentLabels).getByLabelText("Assigned labels");

    expect(within(assignedLabels).getByText("Biology")).toBeInTheDocument();
    expect(within(assignedLabels).getByText("Science")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(assignedLabels).getByRole("button", {
        name: "Remove Biology label",
      }),
    );

    expect(
      within(assignedLabels).queryByText("Biology"),
    ).not.toBeInTheDocument();
    expect(within(assignedLabels).getByText("Science")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeVisible();
    expect(listNotesForUser(notesContext.getSnapshot(), userId)).toEqual([
      expect.objectContaining({
        id: note.id,
        labelIds: [biology.id, science.id],
      }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(listNotesForUser(notesContext.getSnapshot(), userId)).toEqual([
      expect.objectContaining({
        id: note.id,
        labelIds: [science.id],
      }),
    ]);
  });

  it("restores a directly removed label chip when note changes are discarded", async () => {
    const labelsContext = createAppLabelsContext({
      keyPrefix: `test-labels-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";
    const notesContext = createAppNotesContext({
      getOwnedLabelIdsForUser: (currentUserId) =>
        labelsContext.getLabelsForUser(currentUserId).map((label) => label.id),
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const science = labelsContext.createLabel({
      name: "Science",
      userId,
    });

    notesContext.createNote(userId, {
      acronyms: [],
      body: "Discarding should restore removed label chips.",
      labelIds: [science.id],
      metaphors: [],
      title: "Discard label removal note",
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
      await screen.findByDisplayValue("Discard label removal note"),
    ).toBeVisible();

    const currentLabels = screen.getByLabelText("Current labels");
    const assignedLabels =
      within(currentLabels).getByLabelText("Assigned labels");

    expect(within(assignedLabels).getByText("Science")).toBeInTheDocument();

    fireEvent.click(
      within(assignedLabels).getByRole("button", {
        name: "Remove Science label",
      }),
    );

    expect(
      within(currentLabels).queryByLabelText("Assigned labels"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("No labels yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    const restoredAssignedLabels =
      within(currentLabels).getByLabelText("Assigned labels");

    expect(
      within(restoredAssignedLabels).getByText("Science"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();
    expect(listNotesForUser(notesContext.getSnapshot(), userId)).toEqual([
      expect.objectContaining({
        labelIds: [science.id],
      }),
    ]);
  });

  it("shows a no-labels picker empty state with guarded navigation to labels", async () => {
    const labelsContext = createAppLabelsContext({
      keyPrefix: `test-labels-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";
    const notesContext = createAppNotesContext({
      getOwnedLabelIdsForUser: (currentUserId) =>
        labelsContext.getLabelsForUser(currentUserId).map((label) => label.id),
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    notesContext.createNote(userId, {
      acronyms: [],
      body: "A note body without any labels in the workspace.",
      labelIds: [],
      metaphors: [],
      title: "Unlabeled note",
    });

    const { router } = renderRoute("/notes", {
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

    fireEvent.change(
      await screen.findByDisplayValue(
        "A note body without any labels in the workspace.",
      ),
      {
        target: {
          value: "A note body without any labels and with unsaved edits.",
        },
      },
    );

    fireEvent.click(screen.getByRole("button", { name: "Assign labels" }));

    const labelPicker = await screen.findByRole("dialog", {
      name: "Assign labels",
    });

    expect(await screen.findByText("No labels available")).toBeInTheDocument();
    expect(
      within(labelPicker).getByRole("button", { name: "Open Labels" }),
    ).toBeInTheDocument();
    expect(
      within(labelPicker).queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();
    expect(
      within(labelPicker).queryByLabelText("Search existing labels"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(labelPicker).getByRole("button", { name: "Open Labels" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Discard unsaved changes?",
    });

    expect(router.state.location.pathname).toBe("/notes");
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Discard changes" }),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(
      screen.queryByRole("dialog", { name: "Discard unsaved changes?" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("No labels available")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/notes");

    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Assign labels" })).getByRole(
        "button",
        { name: "Open Labels" },
      ),
    );
    fireEvent.click(
      within(
        await screen.findByRole("dialog", {
          name: "Discard unsaved changes?",
        }),
      ).getByRole("button", { name: "Discard changes" }),
    );

    expect(
      await screen.findByRole("heading", { level: 2, name: "Labels" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/labels");
  });

  it("disables memory hooks for drafts and preserves per-tab hook drafts after saving", async () => {
    renderRoute("/notes", {
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

    const memoryHooks = screen.getByLabelText("Memory hooks");
    expect(
      within(memoryHooks).getByText("Save the note first"),
    ).toBeInTheDocument();
    expect(
      within(memoryHooks).getByText(
        "Memory hooks are attached to saved notes.",
      ),
    ).toBeInTheDocument();
    expect(
      within(memoryHooks).queryByRole("tab", { name: "Metaphor" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Learning state")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Action potentials" },
    });
    fireEvent.change(screen.getByLabelText("Body"), {
      target: {
        value: "Neurons fire once membrane voltage crosses threshold.",
      },
    });

    expect(screen.getByRole("button", { name: "Create note" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Create note" }));

    expect(
      await screen.findByRole("tab", {
        name: "Metaphor",
        selected: true,
      }),
    ).toBeInTheDocument();
    expect(
      within(memoryHooks).getByRole("tab", {
        name: "Acronym",
        selected: false,
      }),
    ).toBeInTheDocument();
    expect(
      within(memoryHooks).getByText(
        "The metaphor helps you connect the concept to a vivid mental image.",
      ),
    ).toBeInTheDocument();

    const metaphorDescription = screen.getByLabelText("Your metaphor");

    expect(
      within(memoryHooks).queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();

    fireEvent.change(metaphorDescription, {
      target: {
        value:
          "Domino line: crossing threshold is like tipping the first domino so the whole line falls.",
      },
    });

    expect(
      screen.getByDisplayValue(
        "Domino line: crossing threshold is like tipping the first domino so the whole line falls.",
      ),
    ).toBeInTheDocument();
    expect(
      within(memoryHooks).getByRole("button", { name: "Save" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("tab", { name: "Acronym" }));

    expect(
      within(memoryHooks).getByRole("tab", {
        name: "Acronym",
        selected: true,
      }),
    ).toBeInTheDocument();
    expect(
      within(memoryHooks).getByText(
        "The acronym helps you remember the concept through a compact cue.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByDisplayValue(
        "Domino line: crossing threshold is like tipping the first domino so the whole line falls.",
      ),
    ).not.toBeInTheDocument();

    const acronymDescription = screen.getByLabelText("Your acronym");

    expect(
      within(memoryHooks).queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();

    fireEvent.change(acronymDescription, {
      target: {
        value: "ATP means Action Threshold Propagation.",
      },
    });

    expect(
      screen.getByDisplayValue("ATP means Action Threshold Propagation."),
    ).toBeInTheDocument();
    expect(
      within(memoryHooks).getByRole("button", { name: "Save" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("tab", { name: "Metaphor" }));

    expect(
      within(memoryHooks).getByRole("tab", {
        name: "Metaphor",
        selected: true,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        "Domino line: crossing threshold is like tipping the first domino so the whole line falls.",
      ),
    ).toBeInTheDocument();
  });

  it("defaults memory hooks to Metaphors on load and when the note changes", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";

    notesContext.createNote(userId, {
      acronyms: [
        {
          description: "FNS means First Note Shortcut.",
        },
      ],
      body: "First note body",
      labelIds: [],
      metaphors: [
        {
          description: "First note metaphor",
        },
      ],
      title: "First note",
    });
    notesContext.createNote(userId, {
      acronyms: [
        {
          description: "SNS means Second Note Shortcut.",
        },
      ],
      body: "Second note body",
      labelIds: [],
      metaphors: [
        {
          description: "Second note metaphor",
        },
      ],
      title: "Second note",
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

    const memoryHooks = screen.getByLabelText("Memory hooks");

    expect(
      within(memoryHooks).getByRole("tab", {
        name: "Metaphor",
        selected: true,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Second note metaphor"),
    ).toBeInTheDocument();
    expect(
      screen.queryByDisplayValue("SNS means Second Note Shortcut."),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Acronym" }));
    expect(
      await screen.findByDisplayValue("SNS means Second Note Shortcut."),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Acronym" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "First note" }));

    expect(
      await screen.findByDisplayValue("First note metaphor"),
    ).toBeInTheDocument();
    expect(
      within(memoryHooks).getByRole("tab", {
        name: "Metaphor",
        selected: true,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByDisplayValue("FNS means First Note Shortcut."),
    ).not.toBeInTheDocument();
  });

  it("saves and discards single-entry memory hook edits for an existing note", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";

    notesContext.createNote(userId, {
      acronyms: [
        {
          description: "MAP means Memory Anchor Phrase.",
        },
      ],
      body: "Stable note body.",
      labelIds: [],
      metaphors: [
        {
          description: "Original lighthouse metaphor.",
        },
      ],
      title: "Hook edits note",
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
      await screen.findByDisplayValue("Original lighthouse metaphor."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Your metaphor"), {
      target: {
        value: "Updated bridge metaphor.",
      },
    });

    const metaphorEditor = screen.getByRole("group", {
      name: "Metaphor editor",
    });

    expect(
      within(metaphorEditor).getByRole("button", { name: "Save" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Discard" })).toBeVisible();

    fireEvent.click(
      within(metaphorEditor).getByRole("button", { name: "Save" }),
    );

    expect(
      await screen.findByDisplayValue("Updated bridge metaphor."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Discard" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Acronym" }));
    expect(
      await screen.findByDisplayValue("MAP means Memory Anchor Phrase."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Your acronym"), {
      target: {
        value: "MAP means Memory Access Prompt.",
      },
    });
    expect(screen.getByRole("button", { name: "Discard" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(
      await screen.findByDisplayValue("MAP means Memory Anchor Phrase."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Discard" }),
    ).not.toBeInTheDocument();
    expect(listNotesForUser(notesContext.getSnapshot(), userId)).toEqual([
      expect.objectContaining({
        acronyms: [
          {
            description: "MAP means Memory Anchor Phrase.",
          },
        ],
        metaphors: [
          {
            description: "Updated bridge metaphor.",
          },
        ],
        title: "Hook edits note",
      }),
    ]);
  });

  it("starts focus from the header without interrupting note editing", async () => {
    const focusContext = createAppFocusContext({
      keyPrefix: `test-focus-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-note-focus";

    notesContext.createNote(userId, {
      acronyms: [],
      body: "Original note body.",
      labelIds: [],
      metaphors: [],
      title: "Contextual focus note",
    });

    const { router } = renderRoute("/notes", {
      focusContext,
      notesContext,
      session: {
        user: {
          displayName: "Casey Context",
          email: "casey.context@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
    });

    const bodyEditor = await screen.findByDisplayValue("Original note body.");

    fireEvent.change(bodyEditor, {
      target: { value: "Original note body with unsaved focus edits." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Start Focus" }));

    expect(router.state.location.pathname).toBe("/notes");
    expect(
      screen.getByDisplayValue("Original note body with unsaved focus edits."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Discard unsaved changes?" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: /End focus/ }),
    ).toBeInTheDocument();
    expect(focusContext.getActiveSession({ userId })).toMatchObject({
      currentInterval: "Focus",
      intervalState: "Focus",
    });
  });
});
