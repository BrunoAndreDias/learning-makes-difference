// @vitest-environment jsdom

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createAppFocusContext } from "../../modules/focus";
import {
  type AppLabel,
  createAppLabelsContext,
} from "../../modules/labels/label-management/labels";
import {
  type AppPersistentLabelsService,
  createPersistentLabelsContext,
  createReadonlyLabelsContext,
} from "../../modules/labels/persistent-labels";
import { createAppNotesContext } from "../../modules/notes";
import {
  createAppRecallContext,
  type RecallSelfRating,
  type SessionResult,
} from "../../modules/recall";
import { createAppStudyNotesContext } from "../../modules/study-notes";
import {
  type AppSessionSnapshot,
  createDeterministicRecallTestContexts,
  renderRoute,
} from "./app-shell-test-support";

function createUnusedPersistentLabelMutation() {
  return async () => {
    throw new Error("This persistent label mutation should not be called.");
  };
}

const studyNoteExpectedAnswerPlaceholder =
  "Explain the reason, steps, limits, and one example or non-example.";
const studyNoteMetaphorPlaceholder = "Compare it to something familiar.";
const studyNoteAcronymPlaceholder = "Initials that cue the answer.";
const studyNotePromptPlaceholder =
  "Why does this work? How would I use it? What example proves it?";

function getDisclosureDetails(region: HTMLElement) {
  const details = region.querySelector("details");

  if (!(details instanceof HTMLDetailsElement)) {
    throw new Error("Expected region to contain disclosure details.");
  }

  return details;
}

type DeterministicRecallTestContexts = ReturnType<
  typeof createDeterministicRecallTestContexts
>;

type StudyNoteSnapshotInput = {
  expectedAnswer: string;
  labelIds?: string[];
  prompt: string;
  sourceBody: string;
  sourceTitle: string;
};

function updateStudyNoteSnapshot(
  contexts: DeterministicRecallTestContexts,
  input: StudyNoteSnapshotInput & {
    studyNoteId: string;
    userId: string;
  },
) {
  return contexts.studyNotesContext.updateStudyNote(
    input.userId,
    input.studyNoteId,
    {
      acronyms: [],
      expectedAnswer: input.expectedAnswer,
      labelIds: input.labelIds ?? [],
      metaphors: [],
      prompt: input.prompt,
      sourceBody: input.sourceBody,
      sourceTitle: input.sourceTitle,
    },
  );
}

function createStudyNoteSnapshot(
  contexts: DeterministicRecallTestContexts,
  input: StudyNoteSnapshotInput & {
    userId: string;
  },
) {
  const studyNote = contexts.studyNotesContext.createStudyNote(input.userId, {
    sourceBody: input.sourceBody,
    sourceTitle: input.sourceTitle,
  });

  return updateStudyNoteSnapshot(contexts, {
    ...input,
    studyNoteId: studyNote.id,
  });
}

function createSiblingStudyNoteSnapshot(
  contexts: DeterministicRecallTestContexts,
  input: StudyNoteSnapshotInput & {
    sourceNoteId: string;
    userId: string;
  },
) {
  const studyNote = contexts.studyNotesContext.createStudyNoteFromSource(
    input.userId,
    {
      sourceNoteId: input.sourceNoteId,
    },
  );

  return updateStudyNoteSnapshot(contexts, {
    ...input,
    studyNoteId: studyNote.id,
  });
}

function completeStudyNoteRecall(
  contexts: DeterministicRecallTestContexts,
  input: {
    rating: RecallSelfRating;
    studyNoteId: string;
    userId: string;
  },
) {
  act(() => {
    const session = contexts.recallContext.startFlashCardSession({
      studyNoteIds: [input.studyNoteId],
      userId: input.userId,
    });

    contexts.recallContext.revealFlashCardAnswer({
      sessionId: session.id,
      userId: input.userId,
    });
    contexts.recallContext.rateFlashCardAnswer({
      rating: input.rating,
      sessionId: session.id,
      userId: input.userId,
    });
  });
}

function confirmStudyNotePracticeRepair(
  contexts: DeterministicRecallTestContexts,
  input: {
    correction: string;
    intent:
      | "add-memory-aid"
      | "create-sibling-study-note"
      | "split-study-note"
      | "tighten-expected-answer";
    studyNoteId: string;
    userId: string;
  },
): SessionResult {
  const result = contexts.recallContext.listSessionResults({
    userId: input.userId,
  })[0];
  const questionResultId = result?.questions[0]?.questionResultId;

  if (result === undefined || questionResultId === undefined) {
    throw new Error("Expected a stored weak-recall result with a question id.");
  }

  let updatedResult: SessionResult | null = null;

  act(() => {
    updatedResult = contexts.recallContext.confirmPracticeRepairEntry({
      correction: input.correction,
      intent: input.intent,
      reference: {
        questionIndex: 0,
        questionResultId,
        sessionResultId: result.id,
        studyNoteId: input.studyNoteId,
      },
      userId: input.userId,
    });
  });

  if (updatedResult === null) {
    throw new Error("Expected a confirmed Practice Repair result.");
  }

  return updatedResult;
}

function getConfirmedPracticeRepairReference(result: SessionResult) {
  const reference = result.questions[0]?.practiceRepairEntry?.reference;

  if (reference === undefined) {
    throw new Error(
      "Expected a confirmed Practice Repair reference in history.",
    );
  }

  return reference;
}

function renderStudyNotesRouteForUser(
  contexts: DeterministicRecallTestContexts,
  user: NonNullable<AppSessionSnapshot["user"]>,
) {
  renderRoute("/study-notes", {
    ...contexts,
    session: { user },
  });
}

function createTestPersistentLabelsService(
  initialLabels: readonly AppLabel[],
): AppPersistentLabelsService {
  return {
    addParent: vi.fn<AppPersistentLabelsService["addParent"]>(
      createUnusedPersistentLabelMutation(),
    ),
    createLabel: vi.fn<AppPersistentLabelsService["createLabel"]>(
      createUnusedPersistentLabelMutation(),
    ),
    deleteLabel: vi.fn<AppPersistentLabelsService["deleteLabel"]>(
      createUnusedPersistentLabelMutation(),
    ),
    listLabels: vi.fn<AppPersistentLabelsService["listLabels"]>(async () =>
      [...initialLabels].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
    ),
    removeParent: vi.fn<AppPersistentLabelsService["removeParent"]>(
      createUnusedPersistentLabelMutation(),
    ),
    renameLabel: vi.fn<AppPersistentLabelsService["renameLabel"]>(
      createUnusedPersistentLabelMutation(),
    ),
    updateLabel: vi.fn<AppPersistentLabelsService["updateLabel"]>(
      createUnusedPersistentLabelMutation(),
    ),
  };
}

describe("authenticated Study Notes workspace", () => {
  it("renders Study Notes as the primary workspace with source context below the Study Note fields", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";

    studyNotesContext.createStudyNote(userId, {
      acronyms: [{ description: "RP means Retrieval Practice." }],
      metaphors: [{ description: "A trail gets clearer with each walk." }],
      prompt: "Retrieval practice",
      sourceBody: "Testing retrieval strengthens durable recall.",
      sourceTitle: "Retrieval practice source",
    });

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    const pageHeading = await screen.findByRole("heading", {
      level: 1,
      name: "Study Notes",
    });
    expect(pageHeading).toHaveClass("page-header__title");
    expect(
      screen.queryByText("Workspace", {
        selector: ".study-notes-workspace *",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Your study notes and their recall schedules. Factual recall timing is tracked automatically.",
      ),
    ).toHaveClass("page-header__description");
    expect(
      screen.getByRole("navigation", { name: "Breadcrumb" }),
    ).toHaveTextContent("Study Notes/Recall Schedule");
    const newStudyNoteButton = screen.getByRole("button", {
      name: "New Study Note",
    });
    expect(newStudyNoteButton).toHaveClass("study-notes-new-note");
    expect(
      screen.getByRole("button", { name: "Start Recall Session" }),
    ).toHaveClass("study-notes-start-recall");

    const catalog = screen.getByRole("complementary", {
      name: "Study Notes catalog",
    });
    expect(
      within(catalog).getByPlaceholderText("Search notes"),
    ).toBeInTheDocument();
    expect(
      within(catalog).getByRole("combobox", {
        name: "Filter Study Notes by label",
      }),
    ).toBeInTheDocument();
    expect(within(catalog).getByText("1 notes")).toBeInTheDocument();
    expect(
      within(catalog).getByRole("button", { name: "Recently updated" }),
    ).toBeInTheDocument();
    expect(
      within(catalog).getByRole("navigation", { name: "Study Notes list" }),
    ).toBeInTheDocument();
    expect(
      within(catalog).getByRole("button", { name: "Retrieval practice" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(catalog).getByRole("button", { name: "Retrieval practice" }),
    ).not.toHaveTextContent("Retrieval practice source");
    expect(
      screen.queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Add Study Note from this explanation",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Delete Study Note",
      }),
    ).toBeInTheDocument();

    const editor = screen.getByRole("form", {
      name: "Study Note editor surface",
    });
    expect(editor).toHaveAttribute("id", "study-note-editor-form");
    expect(
      within(editor).getByRole("heading", {
        level: 2,
        name: "Retrieval practice",
      }),
    ).toBeInTheDocument();
    expect(
      within(editor).queryByRole("button", {
        name: "New Study Note",
      }),
    ).not.toBeInTheDocument();

    expect(screen.getByLabelText("Prompt")).toHaveValue("Retrieval practice");
    expect(screen.getByLabelText("Expected answer")).toHaveValue(
      "Testing retrieval strengthens durable recall.",
    );
    expect(screen.getByLabelText("Metaphor")).toHaveValue(
      "A trail gets clearer with each walk.",
    );
    expect(screen.getByLabelText("Acronym")).toHaveValue(
      "RP means Retrieval Practice.",
    );
    const noteTitleField = screen.getByLabelText("Note title");
    expect(noteTitleField).toBeInstanceOf(HTMLTextAreaElement);
    expect(noteTitleField.closest("label")).toHaveClass("study-notes-field");
    expect(noteTitleField).toHaveValue("Retrieval practice source");
    expect(screen.getByLabelText("Explanation")).toHaveValue(
      "Testing retrieval strengthens durable recall.",
    );
    expect(
      screen.getByPlaceholderText(studyNotePromptPlaceholder),
    ).toHaveAccessibleName("Prompt");
    expect(
      screen.getByPlaceholderText(studyNoteExpectedAnswerPlaceholder),
    ).toHaveAccessibleName("Expected answer");
    expect(
      screen.getByPlaceholderText(studyNoteMetaphorPlaceholder),
    ).toHaveAccessibleName("Metaphor");
    expect(
      screen.getByPlaceholderText(studyNoteAcronymPlaceholder),
    ).toHaveAccessibleName("Acronym");
    expect(screen.getByPlaceholderText("Note title")).toHaveAccessibleName(
      "Note title",
    );
    expect(screen.getByPlaceholderText("Explanation")).toHaveAccessibleName(
      "Explanation",
    );
    expect(
      screen.queryByRole("heading", { level: 2, name: "Memory hooks" }),
    ).not.toBeInTheDocument();
    const memoryAids = screen.getByRole("region", { name: "Memory aids" });
    expect(within(memoryAids).getByLabelText("Metaphor")).toHaveValue(
      "A trail gets clearer with each walk.",
    );
    expect(within(memoryAids).getByLabelText("Acronym")).toHaveValue(
      "RP means Retrieval Practice.",
    );
    expect(getDisclosureDetails(memoryAids)).toHaveAttribute("open");
    expect(screen.getByText("Reference explanation")).toBeInTheDocument();
    expect(
      getDisclosureDetails(
        screen.getByRole("region", { name: "Reference explanation" }),
      ),
    ).toHaveAttribute("open");
    const recallInsights = screen.getByRole("region", {
      name: "Recall insights",
    });
    expect(
      within(recallInsights).getByRole("heading", { level: 3, name: "New" }),
    ).toBeInTheDocument();
    expect(
      within(recallInsights).getByText("Not enough recall data yet."),
    ).toBeInTheDocument();
    expect(within(recallInsights).getByText("Next recall")).toBeInTheDocument();
    expect(within(recallInsights).getByText("Today")).toBeInTheDocument();
    expect(within(recallInsights).getByText("Last result")).toBeInTheDocument();
    expect(
      within(recallInsights).getByText("Suggested action"),
    ).toBeInTheDocument();
    expect(
      within(recallInsights).getByText("Review this note"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Recall schedule" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Learning state" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        level: 2,
        name: "Reference explanation",
      }),
    ).not.toBeInTheDocument();
  });

  it("loads persistent Labels on first direct Study Notes entry", async () => {
    const persistentLabelsService = createTestPersistentLabelsService([
      {
        id: "label-biology",
        name: "Biology",
        parentIds: [],
      },
    ]);
    const persistentLabelsContext = createPersistentLabelsContext({
      service: persistentLabelsService,
    });
    const labelsContext = createReadonlyLabelsContext(persistentLabelsContext);
    const studyNotesContext = createAppStudyNotesContext({
      getOwnedLabelIdsForUser: (ownerId) =>
        labelsContext.getLabelsForUser(ownerId).map((label) => label.id),
      keyPrefix: `test-study-notes-persistent-labels-${Math.random()
        .toString(36)
        .slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-direct-study-notes-labels";

    studyNotesContext.createStudyNote(userId, {
      sourceBody: "Labels should be ready on direct Study Notes entry.",
      sourceTitle: "Direct labels hydration",
    });

    renderRoute("/study-notes", {
      labelsContext,
      persistentLabelsContext,
      session: {
        user: {
          displayName: "Jordan Labels",
          email: "jordan.labels@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    expect(await screen.findByLabelText("Biology")).toBeInTheDocument();
    expect(screen.queryByText("No Labels yet.")).not.toBeInTheDocument();
    expect(persistentLabelsService.listLabels).toHaveBeenCalledOnce();
  });

  it("creates, edits, and saves a Study Note without rewriting source fields into Study Note fields", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "New Study Note" }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Prompt")).toHaveValue(""),
    );
    expect(
      screen.getByPlaceholderText(studyNoteExpectedAnswerPlaceholder),
    ).toHaveValue("");
    fireEvent.click(screen.getByText("Reference explanation"));
    expect(screen.getByPlaceholderText("Explanation")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "What should I recall first?" },
    });
    const saveButton = screen.getByRole("button", { name: "Save changes" });
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: { value: "Recall before reading." },
    });
    fireEvent.change(screen.getByLabelText("Metaphor"), {
      target: { value: "A spotlight on the exact recall target." },
    });
    fireEvent.change(screen.getByLabelText("Acronym"), {
      target: { value: "RBR means Recall Before Reading." },
    });
    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "Edited source title" },
    });
    fireEvent.change(screen.getByLabelText("Explanation"), {
      target: { value: "Edited source body." },
    });
    fireEvent.click(saveButton);

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved just now"),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull(),
    );
    expect(screen.getByLabelText("Prompt")).toHaveValue(
      "What should I recall first?",
    );
    expect(screen.getByLabelText("Expected answer")).toHaveValue(
      "Recall before reading.",
    );
    expect(screen.getByLabelText("Metaphor")).toHaveValue(
      "A spotlight on the exact recall target.",
    );
    expect(screen.getByLabelText("Acronym")).toHaveValue(
      "RBR means Recall Before Reading.",
    );
    expect(screen.getByLabelText("Note title")).toHaveValue(
      "Edited source title",
    );
    expect(screen.getByLabelText("Explanation")).toHaveValue(
      "Edited source body.",
    );
  });

  it("keeps the contextual save bar available for bottom-field edits and discard", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-save-bar-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-study-note-save-bar";

    studyNotesContext.createStudyNote(userId, {
      expectedAnswer: "Recall before rereading.",
      prompt: "What improves durable recall?",
      sourceBody: "Original source explanation.",
      sourceTitle: "Retrieval source",
    });

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Save Bar",
          email: "jordan.savebar@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    const editor = await screen.findByRole("form", {
      name: "Study Note editor surface",
    });
    expect(editor).toHaveAttribute("data-save-bar-visible", "false");

    fireEvent.change(screen.getByLabelText("Explanation"), {
      target: { value: "Edited from the bottom of the editor." },
    });

    expect(editor).toHaveAttribute("data-save-bar-visible", "true");
    expect(screen.getByText("You have unsaved changes.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(screen.getByLabelText("Explanation")).toHaveValue(
      "Original source explanation.",
    );
    expect(
      screen.queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();
    expect(editor).toHaveAttribute("data-save-bar-visible", "false");
  });

  it("keeps memory aids visible and raises a workspace save bar for their edits", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-memory-save-bar-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-study-note-memory-save-bar";

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Memory Bar",
          email: "jordan.memorybar@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "New Study Note" }),
    );

    const memoryAids = screen.getByRole("region", { name: "Memory aids" });
    expect(getDisclosureDetails(memoryAids)).not.toHaveAttribute("open");
    fireEvent.click(within(memoryAids).getByText("Memory aids"));
    expect(within(memoryAids).getByLabelText("Metaphor")).toHaveValue("");
    expect(within(memoryAids).getByLabelText("Acronym")).toHaveValue("");
    expect(
      screen.queryByRole("region", { name: "Unsaved Study Note changes" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "What makes recall durable?" },
    });
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: { value: "Testing yourself before review strengthens recall." },
    });
    fireEvent.change(within(memoryAids).getByLabelText("Metaphor"), {
      target: { value: "A trail that gets clearer with each walk." },
    });
    fireEvent.change(within(memoryAids).getByLabelText("Acronym"), {
      target: { value: "TBR means Test Before Review." },
    });

    const saveBar = screen.getByRole("region", {
      name: "Unsaved Study Note changes",
    });
    expect(saveBar).toHaveTextContent("You have unsaved changes.");
    expect(saveBar.closest("form")).toBeNull();
    expect(
      within(saveBar).getByRole("button", { name: "Discard changes" }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(saveBar).getByRole("button", { name: "Save changes" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved just now"),
    );
    expect(studyNotesContext.getSnapshot()[0]).toMatchObject({
      acronyms: [{ description: "TBR means Test Before Review." }],
      metaphors: [{ description: "A trail that gets clearer with each walk." }],
      prompt: "What makes recall durable?",
    });
  });

  it("guards Study Note switching and can discard or save before switching", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-switch-guard-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-study-note-switch-guard";
    const first = studyNotesContext.createStudyNote(userId, {
      expectedAnswer: "First answer.",
      prompt: "First Study Note",
      sourceBody: "First source.",
      sourceTitle: "First source",
    });
    const second = studyNotesContext.createStudyNote(userId, {
      expectedAnswer: "Second answer.",
      prompt: "Second Study Note",
      sourceBody: "Second source.",
      sourceTitle: "Second source",
    });

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Switch",
          email: "jordan.switch@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "First Study Note" }),
    );
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "Unsaved first prompt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Second Study Note" }));

    expect(
      screen.getByText("Save or discard changes before switching Study Notes"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "First Study Note" }),
    ).toHaveAttribute("aria-current", "page");

    fireEvent.click(screen.getByRole("button", { name: "Stay" }));
    expect(screen.getByText("You have unsaved changes.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Second Study Note" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard and switch" }));

    expect(screen.getByLabelText("Prompt")).toHaveValue("Second Study Note");
    expect(studyNotesContext.getSnapshot()).toContainEqual(
      expect.objectContaining({
        id: first.id,
        prompt: "First Study Note",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "First Study Note" }));
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: { value: "Saved before switching." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Second Study Note" }));
    fireEvent.click(screen.getByRole("button", { name: "Save and switch" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Prompt")).toHaveValue("Second Study Note"),
    );
    expect(studyNotesContext.getSnapshot()).toContainEqual(
      expect.objectContaining({
        expectedAnswer: "Saved before switching.",
        id: first.id,
      }),
    );
    expect(studyNotesContext.getSnapshot()).toContainEqual(
      expect.objectContaining({
        id: second.id,
        prompt: "Second Study Note",
      }),
    );
  });

  it("abandons a new unsaved Study Note draft on discard", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-new-discard-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-study-note-new-discard";

    studyNotesContext.createStudyNote(userId, {
      expectedAnswer: "Existing answer.",
      prompt: "Existing Study Note",
      sourceBody: "Existing source.",
      sourceTitle: "Existing source",
    });

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan New Discard",
          email: "jordan.new.discard@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "New Study Note" }),
    );
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "Temporary draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(
      screen.getByRole("dialog", { name: "Discard this new Study Note?" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByLabelText("Prompt")).toHaveValue("Temporary draft");

    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Prompt")).toHaveValue(
        "Existing Study Note",
      ),
    );
    expect(studyNotesContext.getSnapshot()).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();
  });

  it("keeps optional support sections quiet until the user edits their fields", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-guidance-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-study-guidance";

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Guidance",
          email: "jordan.guidance@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "New Study Note" }),
    );

    expect(
      screen.getByPlaceholderText(studyNotePromptPlaceholder),
    ).toHaveAccessibleName("Prompt");
    expect(
      screen.getByPlaceholderText(studyNoteExpectedAnswerPlaceholder),
    ).toHaveAccessibleName("Expected answer");
    const memoryAids = screen.getByRole("region", { name: "Memory aids" });
    expect(getDisclosureDetails(memoryAids)).not.toHaveAttribute("open");
    fireEvent.click(within(memoryAids).getByText("Memory aids"));
    expect(
      within(memoryAids).queryByText(
        "Optional. Add one only when it would make this answer easier to recall.",
      ),
    ).not.toBeInTheDocument();
    expect(
      within(memoryAids).getByPlaceholderText(studyNoteMetaphorPlaceholder),
    ).toHaveAccessibleName("Metaphor");
    expect(
      within(memoryAids).getByPlaceholderText(studyNoteAcronymPlaceholder),
    ).toHaveAccessibleName("Acronym");
    expect(
      getDisclosureDetails(
        screen.getByRole("region", { name: "Reference explanation" }),
      ),
    ).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("Reference explanation"));
    expect(
      screen.queryByText("Worked examples belong here as source material."),
    ).not.toBeInTheDocument();
    expect(
      getDisclosureDetails(
        screen.getByRole("region", { name: "Reference explanation" }),
      ),
    ).toHaveAttribute("open");

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "Why does retrieval before review improve memory?" },
    });
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: {
        value:
          "It forces a retrieval attempt, exposes gaps, and makes feedback more useful.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved just now"),
    );
    expect(studyNotesContext.getSnapshot()[0]).toMatchObject({
      acronyms: [],
      expectedAnswer:
        "It forces a retrieval attempt, exposes gaps, and makes feedback more useful.",
      metaphors: [],
      prompt: "Why does retrieval before review improve memory?",
    });
  });

  it("saves incomplete Study Notes with completion copy and blocks blank prompts", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "New Study Note" }),
    );
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "What needs an answer later?" },
    });
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: { value: " " },
    });
    fireEvent.click(screen.getByText("Reference explanation"));
    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Explanation"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved just now"),
    );
    const incompleteRecallInsights = screen.getByRole("region", {
      name: "Recall insights",
    });
    expect(
      within(incompleteRecallInsights).getByRole("heading", {
        level: 3,
        name: "New",
      }),
    ).toBeInTheDocument();
    expect(
      within(incompleteRecallInsights).getByText(
        "Complete the note to enable recall.",
      ),
    ).toBeInTheDocument();
    expect(
      within(incompleteRecallInsights).getByText("Add expected answer"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Due for Recall")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: " " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Prompt is required.",
    );
  });

  it("presents Metaphor and Acronym under Memory aids without a duplicate title", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-memory-aids-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";

    studyNotesContext.createStudyNote(userId, {
      expectedAnswer: "Testing retrieval strengthens durable recall.",
      prompt: "What strengthens durable recall?",
      sourceBody: "Testing retrieval strengthens durable recall.",
      sourceTitle: "Retrieval practice",
    });

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    const memoryAids = await screen.findByRole("region", {
      name: "Memory aids",
    });
    expect(getDisclosureDetails(memoryAids)).not.toHaveAttribute("open");
    fireEvent.click(within(memoryAids).getByText("Memory aids"));
    expect(within(memoryAids).getByLabelText("Metaphor")).toBeInTheDocument();
    expect(within(memoryAids).getByLabelText("Acronym")).toBeInTheDocument();
    expect(
      getDisclosureDetails(
        await screen.findByRole("region", {
          name: "Reference explanation",
        }),
      ),
    ).toHaveAttribute("open");
    expect(
      screen.queryByRole("heading", {
        level: 2,
        name: "Support descriptions",
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Memory hooks")).toBeNull();
  });

  it("keeps blank source Note titles blank while using the Study Note prompt in the catalog", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "New Study Note" }),
    );
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "Oldest fallback prompt" },
    });
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: { value: "Recall answer." },
    });
    fireEvent.click(screen.getByText("Reference explanation"));
    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved just now"),
    );
    expect(screen.getByLabelText("Note title")).toHaveValue("");
    expect(screen.getByLabelText("Note title")).toHaveAttribute(
      "placeholder",
      "Note title",
    );
    expect(
      screen.getByRole("button", { name: "Oldest fallback prompt" }),
    ).toHaveTextContent("Oldest fallback prompt");
    expect(studyNotesContext.getSnapshot()[0]?.source.title).toBe("");
  });

  it("captures saved Study Note work as Focus activity with source Note and Label context", async () => {
    const storage = window.localStorage;
    const keySuffix = Math.random().toString(36).slice(2);
    const labelsContext = createAppLabelsContext({
      keyPrefix: `test-study-notes-focus-labels-${keySuffix}`,
      storage,
    });
    const studyNotesContext = createAppStudyNotesContext({
      getOwnedLabelIdsForUser: (ownerId) =>
        labelsContext.getLabelsForUser(ownerId).map((label) => label.id),
      keyPrefix: `test-study-notes-focus-study-notes-${keySuffix}`,
      storage,
    });
    const focusContext = createAppFocusContext({
      keyPrefix: `test-study-notes-focus-focus-${keySuffix}`,
      storage,
    });
    const userId = "user-study-notes-focus";
    const biology = labelsContext.createLabel({ name: "Biology", userId });
    const studyNote = studyNotesContext.createStudyNote(userId, {
      labelIds: [biology.id],
      sourceBody: "Cell respiration source context.",
      sourceTitle: "Cell respiration",
    });

    focusContext.startFocusSession({
      focusIntervalMinutes: 25,
      userId,
    });

    renderRoute("/study-notes", {
      focusContext,
      labelsContext,
      session: {
        user: {
          displayName: "Jordan Focus",
          email: "jordan.focus@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    fireEvent.change(await screen.findByLabelText("Prompt"), {
      target: { value: "What molecule stores transferable energy?" },
    });
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: { value: "ATP stores transferable energy." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved just now"),
    );
    expect(focusContext.getActiveSession({ userId })?.targets).toMatchObject([
      {
        kind: "StudyNote",
        labels: [{ id: biology.id, name: "Biology" }],
        sourceNote: {
          body: "Cell respiration source context.",
          id: studyNote.sourceNoteId,
          title: "Cell respiration",
        },
        studyNote: {
          expectedAnswer: "ATP stores transferable energy.",
          id: studyNote.id,
          labelIds: [biology.id],
          prompt: "What molecule stores transferable energy?",
          sourceNoteId: studyNote.sourceNoteId,
        },
      },
    ]);
  });

  it("collapses empty reference material and detaches legacy shared source edits", async () => {
    const storage = window.localStorage;
    const keyPrefix = `test-study-notes-${Math.random().toString(36).slice(2)}`;
    storage.setItem(
      `${keyPrefix}:records`,
      JSON.stringify([
        {
          acronyms: [],
          createdAt: "2025-01-01T00:00:00.000Z",
          expectedAnswer: "First answer.",
          id: "study-one",
          labelIds: [],
          metaphors: [],
          prompt: "Quem é o rei de PT?",
          source: {
            body: "",
            id: "source-shared",
            title: "",
            updatedAt: "2025-01-01T00:00:00.000Z",
          },
          sourceNoteId: "source-shared",
          updatedAt: "2025-01-01T00:00:02.000Z",
          userId: "user-jordan",
        },
        {
          acronyms: [],
          createdAt: "2025-01-01T00:00:01.000Z",
          expectedAnswer: "Second answer.",
          id: "study-two",
          labelIds: [],
          metaphors: [],
          prompt: "Workout PPL",
          source: {
            body: "",
            id: "source-shared",
            title: "",
            updatedAt: "2025-01-01T00:00:00.000Z",
          },
          sourceNoteId: "source-shared",
          updatedAt: "2025-01-01T00:00:01.000Z",
          userId: "user-jordan",
        },
      ]),
    );
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix,
      storage,
    });
    const userId = "user-jordan";

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    expect(await screen.findByLabelText("Prompt")).toHaveValue(
      "Quem é o rei de PT?",
    );
    expect(
      screen.queryByText(/^Editing this explanation updates/),
    ).not.toBeInTheDocument();
    const referenceExplanation = screen.getByRole("region", {
      name: "Reference explanation",
    });
    expect(getDisclosureDetails(referenceExplanation)).not.toHaveAttribute(
      "open",
    );

    fireEvent.click(
      within(referenceExplanation).getByText("Reference explanation"),
    );
    fireEvent.change(screen.getByLabelText("Explanation"), {
      target: { value: "Only the selected Study Note source." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved just now"),
    );

    const listedStudyNotes = studyNotesContext.getSnapshot();
    expect(
      listedStudyNotes.find((studyNote) => studyNote.id === "study-one"),
    ).toMatchObject({
      source: {
        body: "Only the selected Study Note source.",
      },
      sourceNoteId: expect.not.stringMatching(/^source-shared$/),
    });
    expect(
      listedStudyNotes.find((studyNote) => studyNote.id === "study-two"),
    ).toMatchObject({
      source: {
        body: "",
      },
      sourceNoteId: "source-shared",
    });
    expect(
      await screen.findAllByRole("button", {
        name: /Quem é o rei de PT\?|Workout PPL/,
      }),
    ).toHaveLength(2);
  });

  it("assigns, removes, and filters labels on Study Notes instead of source Notes", async () => {
    const labelsContext = createAppLabelsContext({
      keyPrefix: `test-labels-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const studyNotesContext = createAppStudyNotesContext({
      getOwnedLabelIdsForUser: (ownerId) =>
        labelsContext.getLabelsForUser(ownerId).map((label) => label.id),
      keyPrefix: `test-study-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";
    const biology = labelsContext.createLabel({
      name: "Biology",
      userId,
    });
    const history = labelsContext.createLabel({
      name: "History",
      userId,
    });
    const first = studyNotesContext.createStudyNote(userId, {
      labelIds: [biology.id],
      sourceBody: "Shared source context.",
      sourceTitle: "Biology recall",
    });
    studyNotesContext.createStudyNote(userId, {
      labelIds: [history.id],
      sourceBody: "Shared source context.",
      sourceTitle: "History recall",
    });

    renderRoute("/study-notes", {
      labelsContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    fireEvent.change(
      await screen.findByLabelText("Filter Study Notes by label"),
      {
        target: { value: biology.id },
      },
    );

    const catalog = screen.getByRole("complementary", {
      name: "Study Notes catalog",
    });
    expect(
      within(catalog).getByRole("button", { name: "Biology recall" }),
    ).toBeInTheDocument();
    expect(
      within(catalog).queryByRole("button", { name: "History recall" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Biology"));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved just now"),
    );
    expect(studyNotesContext.getSnapshot()).toContainEqual(
      expect.objectContaining({
        id: first.id,
        labelIds: [],
        source: expect.objectContaining({
          title: "Biology recall",
        }),
      }),
    );
    expect(
      within(catalog).queryByRole("button", { name: "Biology recall" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter Study Notes by label"), {
      target: { value: "" },
    });
    expect(
      within(catalog).getByRole("button", { name: "Biology recall" }),
    ).toBeInTheDocument();
  });

  it("updates Study Note-owned Learning State, Due for Recall, and Needs practice copy", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const notesContext = createAppNotesContext({
      keyPrefix: `test-source-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    let sessionCounter = 0;
    const recallContext = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          `study-note-learning-state-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: `test-recall-${Math.random().toString(36).slice(2)}`,
      notes: notesContext,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage: window.localStorage,
      studyNotes: studyNotesContext,
    });
    const userId = "user-jordan";
    const first = studyNotesContext.createStudyNote(userId, {
      sourceBody: "Shared source context.",
      sourceTitle: "Shared source",
    });
    const second = studyNotesContext.createStudyNoteFromSource(userId, {
      sourceNoteId: first.sourceNoteId,
    });
    const updatedFirst = studyNotesContext.updateStudyNote(userId, first.id, {
      acronyms: [],
      expectedAnswer: "First expected answer.",
      labelIds: [],
      metaphors: [],
      prompt: "First recall target",
      sourceBody: "Shared source context.",
      sourceTitle: "Shared source",
    });
    studyNotesContext.updateStudyNote(userId, second.id, {
      acronyms: [],
      expectedAnswer: "Second expected answer.",
      labelIds: [],
      metaphors: [],
      prompt: "Second recall target",
      sourceBody: "Shared source context.",
      sourceTitle: "Shared source",
    });

    renderRoute("/study-notes", {
      notesContext,
      recallContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    const catalog = await screen.findByRole("complementary", {
      name: "Study Notes catalog",
    });
    const firstRow = within(catalog).getByRole("button", {
      name: "First recall target",
    });
    const secondRow = within(catalog).getByRole("button", {
      name: "Second recall target",
    });

    expect(firstRow).toHaveTextContent("Recall today");
    expect(secondRow).toHaveTextContent("Recall today");

    act(() => {
      const session = recallContext.startFlashCardSession({
        studyNoteIds: [updatedFirst.id],
        userId,
      });
      recallContext.revealFlashCardAnswer({ sessionId: session.id, userId });
      recallContext.rateFlashCardAnswer({
        rating: "hard",
        sessionId: session.id,
        userId,
      });
    });

    const updatedFirstRow = within(catalog).getByRole("button", {
      name: "First recall target",
    });
    const unchangedSecondRow = within(catalog).getByRole("button", {
      name: "Second recall target",
    });

    expect(updatedFirstRow).toHaveTextContent("Needs practice");
    expect(updatedFirstRow).not.toHaveTextContent("Recall today");
    expect(updatedFirstRow).not.toHaveTextContent("Weak");
    expect(unchangedSecondRow).toHaveTextContent("Recall today");
    expect(unchangedSecondRow).not.toHaveTextContent("Needs practice");
  });

  it("shows Practice Repair guidance for Study Notes with weak recall evidence", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-practice-repair";
    const studyNote = createStudyNoteSnapshot(contexts, {
      expectedAnswer: "Clearer expected answer.",
      prompt: "Why does this still feel shaky?",
      sourceBody:
        "Broad source context that still needs a clearer recall target.",
      sourceTitle: "Repair source",
      userId,
    });

    renderStudyNotesRouteForUser(contexts, {
      displayName: "Jordan Repair",
      email: "jordan.repair@example.com",
      id: userId,
      userLanguage: "en",
    });

    completeStudyNoteRecall(contexts, {
      rating: "hard",
      studyNoteId: studyNote.id,
      userId,
    });

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Practice Repair",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Tighten the expected answer: name the reason, steps, limit, or one example.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open Recall Today" }),
    ).toHaveAttribute("href", "/recall");
    expect(screen.queryByText("Error log")).not.toBeInTheDocument();
  });

  it("shows active Practice Repair entries in the editor, lets the user edit the correction, and removes completed entries from active planning work", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-active-practice-repair";
    const studyNote = createStudyNoteSnapshot(contexts, {
      expectedAnswer: "Clearer expected answer.",
      prompt: "Why does this still feel shaky?",
      sourceBody:
        "Broad source context that still needs a clearer recall target.",
      sourceTitle: "Repair source",
      userId,
    });

    completeStudyNoteRecall(contexts, {
      rating: "hard",
      studyNoteId: studyNote.id,
      userId,
    });
    const confirmedResult = confirmStudyNotePracticeRepair(contexts, {
      correction: "State the specific molecule.",
      intent: "tighten-expected-answer",
      studyNoteId: studyNote.id,
      userId,
    });
    const confirmedReference =
      getConfirmedPracticeRepairReference(confirmedResult);

    renderStudyNotesRouteForUser(contexts, {
      displayName: "Jordan Active Repair",
      email: "jordan.active.repair@example.com",
      id: userId,
      userLanguage: "en",
    });

    const activePracticeRepair = await screen.findByRole("region", {
      name: "Active Practice Repair",
    });
    const activeEntry = within(activePracticeRepair).getByRole("article", {
      name: "Tighten expected answer",
    });

    expect(within(activeEntry).getByLabelText("Correction")).toHaveValue(
      "State the specific molecule.",
    );

    fireEvent.change(within(activeEntry).getByLabelText("Correction"), {
      target: {
        value: "State ATP and explain that it stores transferable energy.",
      },
    });
    fireEvent.click(
      within(activeEntry).getByRole("button", { name: "Save correction" }),
    );

    expect(
      contexts.recallContext.listActivePracticeRepairEntriesForStudyNote({
        studyNoteId: studyNote.id,
        userId,
      }),
    ).toMatchObject([
      {
        correction: "State ATP and explain that it stores transferable energy.",
        intent: "tighten-expected-answer",
      },
    ]);

    fireEvent.click(
      within(activeEntry).getByRole("button", { name: "Mark complete" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("article", { name: "Tighten expected answer" }),
      ).toBeNull(),
    );
    expect(
      contexts.recallContext.listActivePracticeRepairEntriesForStudyNote({
        studyNoteId: studyNote.id,
        userId,
      }),
    ).toHaveLength(0);
    expect(
      contexts.recallContext.listPracticeRepairEntriesForQuestion({
        reference: confirmedReference,
        userId,
      })[0],
    ).toMatchObject({
      correction: "State ATP and explain that it stores transferable energy.",
      lifecycle: {
        completedAt: expect.any(String),
      },
    });
  });

  it("shows Results-origin snapshot context for active Practice Repair entries, keeps editor-side creation unavailable, and allows dismissal", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-active-practice-repair-origin";
    const studyNote = createStudyNoteSnapshot(contexts, {
      expectedAnswer: "Clearer expected answer.",
      prompt: "Why does this still feel shaky?",
      sourceBody:
        "Broad source context that still needs a clearer recall target.",
      sourceTitle: "Repair source",
      userId,
    });

    completeStudyNoteRecall(contexts, {
      rating: "hard",
      studyNoteId: studyNote.id,
      userId,
    });
    const confirmedResult = confirmStudyNotePracticeRepair(contexts, {
      correction: "State the specific molecule.",
      intent: "tighten-expected-answer",
      studyNoteId: studyNote.id,
      userId,
    });
    const confirmedReference =
      getConfirmedPracticeRepairReference(confirmedResult);

    updateStudyNoteSnapshot(contexts, {
      expectedAnswer: "Live expected answer changed later.",
      prompt: "Live prompt changed later.",
      sourceBody: "Live source body changed later.",
      sourceTitle: "Live source changed later.",
      studyNoteId: studyNote.id,
      userId,
    });

    renderStudyNotesRouteForUser(contexts, {
      displayName: "Jordan Origin Repair",
      email: "jordan.origin.repair@example.com",
      id: userId,
      userLanguage: "en",
    });

    const activePracticeRepair = await screen.findByRole("region", {
      name: "Active Practice Repair",
    });
    const activeEntry = within(activePracticeRepair).getByRole("article", {
      name: "Tighten expected answer",
    });

    expect(within(activeEntry).getByText("Results origin")).toBeInTheDocument();
    expect(
      within(activeEntry).getByText("Why does this still feel shaky?"),
    ).toBeInTheDocument();
    expect(within(activeEntry).getByText("Repair source")).toBeInTheDocument();
    expect(within(activeEntry).getByText("Hard (2/5)")).toBeInTheDocument();
    expect(
      within(activeEntry).queryByText("Live prompt changed later."),
    ).toBeNull();
    expect(
      within(activeEntry).queryByText("Live source changed later."),
    ).toBeNull();

    expect(
      screen.queryByRole("button", { name: "Confirm Practice Repair" }),
    ).toBeNull();
    expect(screen.queryByLabelText("Practice Repair intent")).toBeNull();

    fireEvent.click(
      within(activeEntry).getByRole("button", { name: "Dismiss" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("article", { name: "Tighten expected answer" }),
      ).toBeNull(),
    );
    expect(
      contexts.recallContext.listActivePracticeRepairEntriesForStudyNote({
        studyNoteId: studyNote.id,
        userId,
      }),
    ).toHaveLength(0);
    expect(
      contexts.recallContext.listPracticeRepairEntriesForQuestion({
        reference: confirmedReference,
        userId,
      })[0],
    ).toMatchObject({
      lifecycle: {
        dismissedAt: expect.any(String),
      },
    });
  });

  it("starts Interleaved Recall from a successful related Study Note recommendation", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-interleaved-recall";
    const interleavedLabel = contexts.labelsContext.createLabel({
      name: "Interleaved",
      userId,
    });
    const sharedSourceInput = {
      sourceBody: "Shared source for interleaving.",
      sourceTitle: "Interleaved source",
    } satisfies Pick<StudyNoteSnapshotInput, "sourceBody" | "sourceTitle">;
    const anchor = createStudyNoteSnapshot(contexts, {
      ...sharedSourceInput,
      expectedAnswer: "Anchor expected answer.",
      labelIds: [interleavedLabel.id],
      prompt: "Anchor prompt",
      userId,
    });
    const siblingOne = createSiblingStudyNoteSnapshot(contexts, {
      ...sharedSourceInput,
      expectedAnswer: "Sibling expected answer 1.",
      labelIds: [interleavedLabel.id],
      prompt: "Sibling prompt 1",
      sourceNoteId: anchor.sourceNoteId,
      userId,
    });
    const siblingTwo = createSiblingStudyNoteSnapshot(contexts, {
      ...sharedSourceInput,
      expectedAnswer: "Sibling expected answer 2.",
      labelIds: [interleavedLabel.id],
      prompt: "Sibling prompt 2",
      sourceNoteId: anchor.sourceNoteId,
      userId,
    });
    const siblingThree = createSiblingStudyNoteSnapshot(contexts, {
      ...sharedSourceInput,
      expectedAnswer: "Sibling expected answer 3.",
      labelIds: [interleavedLabel.id],
      prompt: "Sibling prompt 3",
      sourceNoteId: anchor.sourceNoteId,
      userId,
    });

    [anchor, siblingOne, siblingTwo, siblingThree].forEach((studyNote) => {
      completeStudyNoteRecall(contexts, {
        rating: "good",
        studyNoteId: studyNote.id,
        userId,
      });
      completeStudyNoteRecall(contexts, {
        rating: "easy",
        studyNoteId: studyNote.id,
        userId,
      });
    });

    const { router } = renderRoute("/study-notes", {
      ...contexts,
      session: {
        user: {
          displayName: "Jordan Interleaved",
          email: "jordan.interleaved@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Anchor prompt",
      }),
    );

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Interleaved Recall",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Start Interleaved Recall" }),
    );

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Recall session",
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall/session");
    expect(
      contexts.recallContext.getSnapshot()?.notes.map((note) => note.title),
    ).toEqual(
      expect.arrayContaining([
        "Anchor prompt",
        "Sibling prompt 1",
        "Sibling prompt 2",
        "Sibling prompt 3",
      ]),
    );
    expect(contexts.recallContext.getSnapshot()?.notes).toHaveLength(4);
    expect(screen.queryByText("Anchor expected answer.")).toBeNull();
  });

  it("creates a sibling Study Note from Practice Repair with the same source material", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-practice-repair-sibling";
    const originalStudyNote = contexts.studyNotesContext.createStudyNote(
      userId,
      {
        sourceBody: "Shared source body for sibling repair.",
        sourceTitle: "Sibling repair source",
      },
    );
    const updatedStudyNote = updateStudyNoteSnapshot(contexts, {
      expectedAnswer: "Original expected answer.",
      prompt: "Original prompt",
      sourceBody: "Shared source body for sibling repair.",
      sourceTitle: "Sibling repair source",
      studyNoteId: originalStudyNote.id,
      userId,
    });

    renderStudyNotesRouteForUser(contexts, {
      displayName: "Jordan Sibling Repair",
      email: "jordan.sibling.repair@example.com",
      id: userId,
      userLanguage: "en",
    });

    completeStudyNoteRecall(contexts, {
      rating: "forgot",
      studyNoteId: updatedStudyNote.id,
      userId,
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Create sibling Study Note",
      }),
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Prompt")).toHaveValue(
        "Sibling repair source",
      ),
    );

    const allStudyNotes = contexts.studyNotesContext.getSnapshot();
    expect(allStudyNotes).toHaveLength(2);
    const sourceNoteIds = allStudyNotes.map(
      (studyNote) => studyNote.sourceNoteId,
    );
    expect(sourceNoteIds).toContain(originalStudyNote.sourceNoteId);
    expect(new Set(sourceNoteIds)).toEqual(
      new Set([originalStudyNote.sourceNoteId]),
    );

    const promptField = screen.getByLabelText("Prompt");
    expect(promptField).toHaveValue("Sibling repair source");
    expect(screen.getByLabelText("Expected answer")).toHaveValue(
      "Shared source body for sibling repair.",
    );
  });

  it("completes an active create-sibling Practice Repair from the entry action and records the created sibling", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-practice-repair-active-sibling";
    const studyNote = createStudyNoteSnapshot(contexts, {
      expectedAnswer: "Original expected answer.",
      prompt: "Original prompt",
      sourceBody: "Shared source body for sibling repair.",
      sourceTitle: "Sibling repair source",
      userId,
    });

    completeStudyNoteRecall(contexts, {
      rating: "forgot",
      studyNoteId: studyNote.id,
      userId,
    });
    const confirmedResult = confirmStudyNotePracticeRepair(contexts, {
      correction: "Create a sibling Study Note for the transport detail.",
      intent: "create-sibling-study-note",
      studyNoteId: studyNote.id,
      userId,
    });
    const confirmedReference =
      getConfirmedPracticeRepairReference(confirmedResult);

    renderStudyNotesRouteForUser(contexts, {
      displayName: "Jordan Active Sibling Repair",
      email: "jordan.active.sibling.repair@example.com",
      id: userId,
      userLanguage: "en",
    });

    const activePracticeRepair = await screen.findByRole("region", {
      name: "Active Practice Repair",
    });
    const activeEntry = within(activePracticeRepair).getByRole("article", {
      name: "Create sibling Study Note",
    });

    fireEvent.click(
      within(activeEntry).getByRole("button", {
        name: "Create sibling Study Note",
      }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("article", { name: "Create sibling Study Note" }),
      ).toBeNull(),
    );
    expect(await screen.findByLabelText("Prompt")).toHaveValue(
      "Sibling repair source",
    );
    expect(screen.getByLabelText("Expected answer")).toHaveValue(
      "Shared source body for sibling repair.",
    );

    const allStudyNotes = contexts.studyNotesContext.getSnapshot();
    expect(allStudyNotes).toHaveLength(2);
    expect(new Set(allStudyNotes.map((note) => note.sourceNoteId))).toEqual(
      new Set([studyNote.sourceNoteId]),
    );

    expect(
      contexts.recallContext.listPracticeRepairEntriesForQuestion({
        reference: confirmedReference,
        userId,
      })[0],
    ).toMatchObject({
      intentMetadata: {
        createdStudyNoteId: expect.any(String),
      },
      lifecycle: {
        completedAt: expect.any(String),
      },
    });
  });

  it("completes an active add-memory-aid Practice Repair after the user chooses an Acronym and saves it", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-practice-repair-active-memory-aid";
    const studyNote = createStudyNoteSnapshot(contexts, {
      expectedAnswer: "Original expected answer.",
      prompt: "Original prompt",
      sourceBody: "Shared source body for memory-aid repair.",
      sourceTitle: "Memory-aid repair source",
      userId,
    });

    completeStudyNoteRecall(contexts, {
      rating: "hard",
      studyNoteId: studyNote.id,
      userId,
    });
    const confirmedResult = confirmStudyNotePracticeRepair(contexts, {
      correction: "Add an acronym for the transport steps.",
      intent: "add-memory-aid",
      studyNoteId: studyNote.id,
      userId,
    });
    const confirmedReference =
      getConfirmedPracticeRepairReference(confirmedResult);

    renderStudyNotesRouteForUser(contexts, {
      displayName: "Jordan Active Memory Aid Repair",
      email: "jordan.active.memory.aid.repair@example.com",
      id: userId,
      userLanguage: "en",
    });

    const activePracticeRepair = await screen.findByRole("region", {
      name: "Active Practice Repair",
    });
    const activeEntry = within(activePracticeRepair).getByRole("article", {
      name: "Add memory aid",
    });

    fireEvent.click(
      within(activeEntry).getByRole("button", {
        name: "Add Acronym",
      }),
    );
    fireEvent.change(screen.getByLabelText("Acronym"), {
      target: {
        value: "ATP keeps the transfer pathway in order.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("article", { name: "Add memory aid" }),
      ).toBeNull(),
    );
    expect(screen.getByLabelText("Acronym")).toHaveValue(
      "ATP keeps the transfer pathway in order.",
    );

    expect(
      contexts.recallContext.listPracticeRepairEntriesForQuestion({
        reference: confirmedReference,
        userId,
      })[0],
    ).toMatchObject({
      intentMetadata: {
        memoryAidId: expect.any(String),
        memoryAidKind: "Acronym",
      },
      lifecycle: {
        completedAt: expect.any(String),
      },
    });
  });
});
