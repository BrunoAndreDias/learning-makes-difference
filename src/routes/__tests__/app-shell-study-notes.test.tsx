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
const studyNoteMemoryAidsGuidance =
  "Optional. Add one only when it would make this answer easier to recall.";
const studyNotePromptGuidance =
  "Ask why, how, when it works, when it does not, or what a worked example shows.";
const studyNotePromptPlaceholder =
  "Why does this work? How would I use it? What example proves it?";
const studyNoteReferenceExplanationGuidance =
  "Worked examples belong here as source material.";

type DeterministicRecallTestContexts = ReturnType<
  typeof createDeterministicRecallTestContexts
>;

type StudyNoteSnapshotInput = {
  expectedAnswer: string;
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
      labelIds: [],
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
        "Practice targets with reference explanations underneath.",
      ),
    ).toHaveClass("page-header__description");
    expect(
      screen.queryByRole("navigation", { name: "Breadcrumb" }),
    ).not.toBeInTheDocument();

    const catalog = screen.getByRole("complementary", {
      name: "Study Notes catalog",
    });
    const catalogHeading = within(catalog).getByRole("heading", { level: 2 });
    expect(catalogHeading).toHaveTextContent("Study Notes");
    expect(
      within(catalog).getByText("1", {
        selector: ".study-notes-list-heading__count",
      }),
    ).toBeInTheDocument();
    expect(
      within(catalog).queryByText("Study Notes", {
        selector: ".section-label",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(catalog).queryByText("1 Study Notes"),
    ).not.toBeInTheDocument();
    const newStudyNoteButton = within(catalog).getByRole("button", {
      name: "New Study Note",
    });
    expect(newStudyNoteButton).toHaveTextContent("New");
    expect(newStudyNoteButton.closest(".notes-list-panel__header")).not.toBe(
      null,
    );
    const studyNoteActions = within(catalog).getByRole("group", {
      name: "Study Note actions",
    });
    expect(
      within(studyNoteActions).getByRole("button", { name: "Save" }),
    ).toBeDisabled();
    expect(
      within(studyNoteActions).getByRole("button", {
        name: "Delete Study Note",
      }),
    ).toHaveTextContent("Delete");
    expect(
      within(studyNoteActions).queryByRole("button", {
        name: "New Study Note",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(catalog).queryByRole("button", {
        name: "Add Study Note from this explanation",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(catalog).getByRole("navigation", { name: "Study Notes list" }),
    ).toBeInTheDocument();
    expect(
      within(catalog).getByRole("button", { name: "Retrieval practice" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(catalog).getByRole("button", { name: "Retrieval practice" }),
    ).not.toHaveTextContent("Retrieval practice source");
    expect(screen.getByRole("button", { name: "Start Focus" })).toHaveClass(
      "notes-action-primary",
    );

    const editor = screen.getByRole("form", {
      name: "Study Note editor surface",
    });
    expect(editor).toHaveAttribute("id", "study-note-editor-form");
    const promptHeader = editor.querySelector(".notes-editor__header");
    expect(promptHeader).toBeInstanceOf(HTMLElement);
    expect(
      within(promptHeader as HTMLElement).getByLabelText("Prompt"),
    ).toBeInTheDocument();
    expect(
      within(promptHeader as HTMLElement).queryByRole("button"),
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
    expect(noteTitleField).toHaveClass("floating-textarea__control");
    expect(noteTitleField.closest("label")).toHaveClass(
      "study-notes-editor__source-title",
    );
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
    expect(screen.getByPlaceholderText("Metaphor")).toHaveAccessibleName(
      "Metaphor",
    );
    expect(screen.getByPlaceholderText("Acronym")).toHaveAccessibleName(
      "Acronym",
    );
    expect(screen.getByPlaceholderText("Note title")).toHaveAccessibleName(
      "Note title",
    );
    expect(screen.getByPlaceholderText("Explanation")).toHaveAccessibleName(
      "Explanation",
    );
    expect(
      screen.queryByRole("heading", { level: 2, name: "Memory hooks" }),
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
      expect(screen.getByLabelText("Prompt")).toHaveValue("New Study Note"),
    );
    expect(
      screen.getByPlaceholderText(studyNoteExpectedAnswerPlaceholder),
    ).toHaveValue("");
    expect(screen.getByPlaceholderText("Explanation")).toHaveValue("");
    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "What should I recall first?" },
    });
    expect(saveButton).toBeEnabled();
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

    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
    await waitFor(() => expect(saveButton).toBeDisabled());
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

  it("guides self-explanation and worked examples without requiring memory aids", async () => {
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

    expect(screen.getByText(studyNotePromptGuidance)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(studyNotePromptPlaceholder),
    ).toHaveAccessibleName("Prompt");
    expect(
      screen.getByPlaceholderText(studyNoteExpectedAnswerPlaceholder),
    ).toHaveAccessibleName("Expected answer");
    expect(screen.getByText(studyNoteMemoryAidsGuidance)).toBeInTheDocument();
    expect(
      screen.getByText(studyNoteReferenceExplanationGuidance),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "Why does retrieval before review improve memory?" },
    });
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: {
        value:
          "It forces a retrieval attempt, exposes gaps, and makes feedback more useful.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
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
    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Explanation"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
    expect(screen.getByText("Add expected answer")).toBeInTheDocument();
    expect(screen.queryByText("Due for Recall")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: " " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

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

    expect(
      await screen.findByRole("region", {
        name: "Memory aid support descriptions",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Memory aids")).toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
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
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
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

  it("saves shared source edits without confirmation and confirms last-link deletion", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";

    const firstStudyNote = studyNotesContext.createStudyNote(userId, {
      sourceBody: "One source can support several practice targets.",
      sourceTitle: "Shared practice source",
    });
    studyNotesContext.createStudyNoteFromSource(userId, {
      sourceNoteId: firstStudyNote.sourceNoteId,
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

    expect(
      await screen.findAllByRole("button", { name: "Shared practice source" }),
    ).toHaveLength(2);
    const initialSharedSourceMessage =
      "Editing this explanation updates 2 sibling Study Notes: Shared practice source and Shared practice source.";
    expect(screen.getByText(initialSharedSourceMessage)).toBeInTheDocument();

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "What can share a source?" },
    });
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: { value: "Several Study Notes." },
    });
    fireEvent.change(screen.getByLabelText("Explanation"), {
      target: { value: "Edited source for sibling Study Notes." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Explanation")).toHaveValue(
      "Edited source for sibling Study Notes.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete Study Note" }));

    const catalog = screen.getByRole("complementary", {
      name: "Study Notes catalog",
    });
    const studyNotesList = within(catalog).getByRole("navigation", {
      name: "Study Notes list",
    });
    expect(within(studyNotesList).getAllByRole("button")).toHaveLength(1);
    expect(
      screen.queryByText(
        /^Editing this explanation updates \d+ sibling Study Notes:/,
      ),
    ).not.toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();

    confirmSpy.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Delete Study Note" }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith(
      "Delete this last Study Note and its reference explanation?",
    );
    expect(within(studyNotesList).getAllByRole("button")).toHaveLength(1);

    confirmSpy.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete Study Note" }));

    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(
      within(studyNotesList).queryByRole("button"),
    ).not.toBeInTheDocument();

    confirmSpy.mockRestore();
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
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
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

    expect(firstRow).toHaveTextContent("Not recalled yet");
    expect(firstRow).toHaveTextContent("Due for Recall");
    expect(secondRow).toHaveTextContent("Not recalled yet");
    expect(secondRow).toHaveTextContent("Due for Recall");

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

    expect(updatedFirstRow).toHaveTextContent("Last score: Hard");
    expect(updatedFirstRow).toHaveTextContent("Needs practice");
    expect(updatedFirstRow).not.toHaveTextContent("Due for Recall");
    expect(updatedFirstRow).not.toHaveTextContent("Weak");
    expect(unchangedSecondRow).toHaveTextContent("Not recalled yet");
    expect(unchangedSecondRow).toHaveTextContent("Due for Recall");
    expect(unchangedSecondRow).not.toHaveTextContent("Last score: Hard");
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
        "Tighten the expected answer so this recall target names the reason, steps, limits, or one example more precisely.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open Recall Today" }),
    ).toHaveAttribute("href", "/recall");
    expect(screen.queryByText("Error log")).not.toBeInTheDocument();
  });

  it("starts Interleaved Recall from a successful related Study Note recommendation", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-interleaved-recall";
    const anchorBase = contexts.studyNotesContext.createStudyNote(userId, {
      sourceBody: "Shared source for interleaving.",
      sourceTitle: "Interleaved source",
    });
    const anchor = updateStudyNoteSnapshot(contexts, {
      expectedAnswer: "Anchor expected answer.",
      prompt: "Anchor prompt",
      sourceBody: "Shared source for interleaving.",
      sourceTitle: "Interleaved source",
      studyNoteId: anchorBase.id,
      userId,
    });
    const siblingOne = updateStudyNoteSnapshot(contexts, {
      expectedAnswer: "Sibling expected answer 1.",
      prompt: "Sibling prompt 1",
      sourceBody: "Shared source for interleaving.",
      sourceTitle: "Interleaved source",
      studyNoteId: contexts.studyNotesContext.createStudyNoteFromSource(
        userId,
        {
          sourceNoteId: anchorBase.sourceNoteId,
        },
      ).id,
      userId,
    });
    const siblingTwo = updateStudyNoteSnapshot(contexts, {
      expectedAnswer: "Sibling expected answer 2.",
      prompt: "Sibling prompt 2",
      sourceBody: "Shared source for interleaving.",
      sourceTitle: "Interleaved source",
      studyNoteId: contexts.studyNotesContext.createStudyNoteFromSource(
        userId,
        {
          sourceNoteId: anchorBase.sourceNoteId,
        },
      ).id,
      userId,
    });
    const siblingThree = updateStudyNoteSnapshot(contexts, {
      expectedAnswer: "Sibling expected answer 3.",
      prompt: "Sibling prompt 3",
      sourceBody: "Shared source for interleaving.",
      sourceTitle: "Interleaved source",
      studyNoteId: contexts.studyNotesContext.createStudyNoteFromSource(
        userId,
        {
          sourceNoteId: anchorBase.sourceNoteId,
        },
      ).id,
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

  it("creates a sibling Study Note from Practice Repair on the same source", async () => {
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
    expect(
      allStudyNotes.every(
        (studyNote) =>
          studyNote.sourceNoteId === originalStudyNote.sourceNoteId,
      ),
    ).toBe(true);

    const promptField = screen.getByLabelText("Prompt");
    expect(promptField).toHaveValue("Sibling repair source");
    expect(screen.getByLabelText("Expected answer")).toHaveValue(
      "Shared source body for sibling repair.",
    );
  });
});
