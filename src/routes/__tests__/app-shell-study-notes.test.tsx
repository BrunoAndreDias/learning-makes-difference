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
import { createAppRecallContext } from "../../modules/recall";
import { createAppStudyNotesContext } from "../../modules/study-notes";
import { renderRoute } from "./app-shell-test-support";

function createUnusedPersistentLabelMutation() {
  return async () => {
    throw new Error("This persistent label mutation should not be called.");
  };
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
      await screen.findByRole("heading", { level: 1, name: "Study Notes" }),
    ).toBeInTheDocument();

    const catalog = screen.getByRole("complementary", {
      name: "Study Notes catalog",
    });
    expect(
      within(catalog).getByRole("navigation", { name: "Study Notes list" }),
    ).toBeInTheDocument();
    expect(
      within(catalog).getByRole("button", { name: "Retrieval practice" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Start Focus" })).toHaveClass(
      "notes-action-primary",
    );

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
    expect(screen.getByLabelText("Explanation title")).toHaveValue(
      "Retrieval practice",
    );
    expect(screen.getByLabelText("Explanation")).toHaveValue(
      "Testing retrieval strengthens durable recall.",
    );
    expect(screen.getByPlaceholderText("Prompt")).toHaveAccessibleName(
      "Prompt",
    );
    expect(screen.getByPlaceholderText("Expected answer")).toHaveAccessibleName(
      "Expected answer",
    );
    expect(screen.getByPlaceholderText("Metaphor")).toHaveAccessibleName(
      "Metaphor",
    );
    expect(screen.getByPlaceholderText("Acronym")).toHaveAccessibleName(
      "Acronym",
    );
    expect(screen.getByPlaceholderText("Untitled source")).toHaveAccessibleName(
      "Explanation title",
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
    expect(screen.getByPlaceholderText("Expected answer")).toHaveValue("");
    expect(screen.getByPlaceholderText("Explanation")).toHaveValue("");

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "What should I recall first?" },
    });
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: { value: "Recall before reading." },
    });
    fireEvent.change(screen.getByLabelText("Metaphor"), {
      target: { value: "A spotlight on the exact recall target." },
    });
    fireEvent.change(screen.getByLabelText("Acronym"), {
      target: { value: "RBR means Recall Before Reading." },
    });
    fireEvent.change(screen.getByLabelText("Explanation title"), {
      target: { value: "Edited source title" },
    });
    fireEvent.change(screen.getByLabelText("Explanation"), {
      target: { value: "Edited source body." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
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
    expect(screen.getByLabelText("Explanation title")).toHaveValue(
      "Edited source title",
    );
    expect(screen.getByLabelText("Explanation")).toHaveValue(
      "Edited source body.",
    );
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
    fireEvent.change(screen.getByLabelText("Explanation title"), {
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

  it("keeps blank source Note titles blank while showing the oldest Study Note prompt as the source display name", async () => {
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
    fireEvent.change(screen.getByLabelText("Explanation title"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
    expect(screen.getByLabelText("Explanation title")).toHaveValue("");
    expect(screen.getByLabelText("Explanation title")).toHaveAttribute(
      "placeholder",
      "Untitled source",
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

  it("adds Study Notes from a shared source and confirms last-link deletion", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";

    studyNotesContext.createStudyNote(userId, {
      sourceBody: "One source can support several practice targets.",
      sourceTitle: "Shared practice source",
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

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Add Study Note from this explanation",
      }),
    );

    expect(
      screen.getAllByRole("button", { name: "Shared practice source" }),
    ).toHaveLength(2);
    expect(
      screen.getByText("Shared explanation: 2 Study Notes"),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "What can share a source?" },
    });
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: { value: "Several Study Notes." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
    expect(screen.getByLabelText("Explanation")).toHaveValue(
      "One source can support several practice targets.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete Study Note" }));

    const catalog = screen.getByRole("complementary", {
      name: "Study Notes catalog",
    });
    expect(within(catalog).getAllByRole("button")).toHaveLength(1);
    expect(
      screen.queryByText("Shared explanation: 2 Study Notes"),
    ).not.toBeInTheDocument();

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Delete Study Note" }));

    expect(confirmSpy).toHaveBeenCalledWith(
      "Delete this last Study Note and its reference explanation?",
    );
    expect(within(catalog).getAllByRole("button")).toHaveLength(1);

    confirmSpy.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete Study Note" }));

    expect(within(catalog).queryByRole("button")).not.toBeInTheDocument();

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
    expect(updatedFirstRow).toHaveTextContent("Due for Recall");
    expect(updatedFirstRow).not.toHaveTextContent("Weak");
    expect(unchangedSecondRow).toHaveTextContent("Not recalled yet");
    expect(unchangedSecondRow).toHaveTextContent("Due for Recall");
    expect(unchangedSecondRow).not.toHaveTextContent("Last score: Hard");
  });
});
