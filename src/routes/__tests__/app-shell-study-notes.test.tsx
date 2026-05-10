// @vitest-environment jsdom

import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createAppFocusContext } from "../../modules/focus";
import { createAppLabelsContext } from "../../modules/labels/label-management/labels";
import { createAppStudyNotesContext } from "../../modules/study-notes";
import { renderRoute } from "./app-shell-test-support";

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
    expect(screen.getByLabelText("Source title")).toHaveValue(
      "Retrieval practice",
    );
    expect(screen.getByLabelText("Source body")).toHaveValue(
      "Testing retrieval strengthens durable recall.",
    );
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
    fireEvent.change(screen.getByLabelText("Source title"), {
      target: { value: "Edited source title" },
    });
    fireEvent.change(screen.getByLabelText("Source body"), {
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
    expect(screen.getByLabelText("Source title")).toHaveValue(
      "Edited source title",
    );
    expect(screen.getByLabelText("Source body")).toHaveValue(
      "Edited source body.",
    );
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
        name: "Add Study Note from this source",
      }),
    );

    expect(
      screen.getAllByRole("button", { name: "Shared practice source" }),
    ).toHaveLength(2);
    expect(
      screen.getByText("Shared source: 2 Study Notes"),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "What can share a source?" },
    });
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: { value: "Several Study Notes." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
    expect(screen.getByLabelText("Source body")).toHaveValue(
      "One source can support several practice targets.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete Study Note" }));

    const catalog = screen.getByRole("complementary", {
      name: "Study Notes catalog",
    });
    expect(within(catalog).getAllByRole("button")).toHaveLength(1);
    expect(
      screen.queryByText("Shared source: 2 Study Notes"),
    ).not.toBeInTheDocument();

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Delete Study Note" }));

    expect(confirmSpy).toHaveBeenCalledWith(
      "Delete this last Study Note and its source Note?",
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
});
