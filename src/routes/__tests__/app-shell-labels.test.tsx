// @vitest-environment jsdom

import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createAppLabelsContext } from "../../modules/labels/label-management/labels";
import {
  createPersistentLabelsContext,
  createReadonlyLabelsContext,
} from "../../modules/labels/persistent-labels";
import { createAppNotesContext } from "../../modules/notes";
import {
  createRouteTestSessionContext,
  renderRoute,
  TEST_PILOT_REGISTRATION_CODE,
} from "./app-shell-test-support";

describe("authenticated app shell", () => {
  it("renders compact header, rules popover, and derived labels table controls", async () => {
    const userId = "user-placeholder";
    const labelsContext = createAppLabelsContext({
      keyPrefix: `labels-compact-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const notesContext = createAppNotesContext({
      getOwnedLabelIdsForUser: (ownedUserId) =>
        labelsContext.getLabelsForUser(ownedUserId).map((label) => label.id),
      keyPrefix: `notes-compact-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    const science = labelsContext.createLabel({
      name: "Science",
      userId,
    });
    const biology = labelsContext.createLabel({
      name: "Biology",
      userId,
    });
    const chemistry = labelsContext.createLabel({
      name: "Chemistry",
      userId,
    });
    labelsContext.createLabel({
      name: "Dormant",
      userId,
    });

    labelsContext.addParent({
      labelId: biology.id,
      parentId: science.id,
      userId,
    });
    labelsContext.addParent({
      labelId: chemistry.id,
      parentId: science.id,
      userId,
    });

    notesContext.createNote(userId, {
      acronyms: [],
      body: "science note 1",
      labelIds: [science.id],
      metaphors: [],
      title: "Science note 1",
    });
    notesContext.createNote(userId, {
      acronyms: [],
      body: "science note 2",
      labelIds: [science.id],
      metaphors: [],
      title: "Science note 2",
    });
    notesContext.createNote(userId, {
      acronyms: [],
      body: "biology note",
      labelIds: [biology.id],
      metaphors: [],
      title: "Biology note",
    });
    notesContext.createNote(userId, {
      acronyms: [],
      body: "chemistry note",
      labelIds: [chemistry.id],
      metaphors: [],
      title: "Chemistry note",
    });

    renderRoute("/labels", { labelsContext, notesContext });

    expect(
      await screen.findByRole("heading", { level: 3, name: "Labels" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Organize notes with reusable topics."),
    ).toBeInTheDocument();
    expect(screen.getByText("4 labels")).toBeInTheDocument();
    expect(screen.getByText("2 top-level")).toBeInTheDocument();
    expect(screen.getByText("2 relationships")).toBeInTheDocument();
    expect(screen.getByText("1 unused")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Label rules" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "New label" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Label rules" }));
    expect(
      await screen.findByText("Labels can have more than one parent."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Circular relationships are blocked automatically."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Deleting a label never deletes notes."),
    ).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText("Search labels...");
    expect(searchInput).toBeInTheDocument();
    expect(screen.getByLabelText("Filter labels")).toBeInTheDocument();
    expect(screen.getByLabelText("Sort labels")).toBeInTheDocument();

    const labelsTable = screen.getByRole("table", { name: "Labels list" });
    expect(
      within(labelsTable).getByRole("columnheader", { name: "Label" }),
    ).toBeInTheDocument();
    expect(
      within(labelsTable).getByRole("columnheader", { name: "Parents" }),
    ).toBeInTheDocument();
    expect(
      within(labelsTable).getByRole("columnheader", { name: "Children" }),
    ).toBeInTheDocument();
    expect(
      within(labelsTable).getByRole("columnheader", { name: "Notes" }),
    ).toBeInTheDocument();
    expect(
      within(labelsTable).getByRole("columnheader", { name: "Row actions" }),
    ).toBeInTheDocument();

    const biologyRow = within(labelsTable).getByRole("row", {
      name: /Biology/i,
    });
    expect(within(biologyRow).getByText("Science")).toBeInTheDocument();
    expect(within(biologyRow).getByText("0")).toBeInTheDocument();
    expect(within(biologyRow).getByText("1")).toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: { value: "chem" },
    });
    expect(within(labelsTable).getByText("Chemistry")).toBeInTheDocument();
    expect(within(labelsTable).queryByText("Biology")).not.toBeInTheDocument();
    fireEvent.change(searchInput, {
      target: { value: "" },
    });

    fireEvent.change(screen.getByLabelText("Filter labels"), {
      target: { value: "top-level" },
    });
    expect(within(labelsTable).getByText("Science")).toBeInTheDocument();
    expect(within(labelsTable).queryByText("Biology")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter labels"), {
      target: { value: "unused" },
    });
    expect(within(labelsTable).getByText("Dormant")).toBeInTheDocument();
    expect(within(labelsTable).queryByText("Science")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter labels"), {
      target: { value: "all" },
    });
    fireEvent.change(screen.getByLabelText("Sort labels"), {
      target: { value: "children-desc" },
    });

    const bodyRows = within(labelsTable).getAllByRole("row").slice(1);
    expect(within(bodyRows[0]).getByText("Science")).toBeInTheDocument();
  });

  it("loads labels from the persistent labels service on route entry", async () => {
    const sessionContext = createRouteTestSessionContext();

    await sessionContext.register({
      displayName: "Casey Learner",
      email: "casey@example.com",
      password: "correct horse battery staple",
      pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
    });

    const persistentLabelsContext = createPersistentLabelsContext({
      service: {
        addParent: async ({ labelId, parentId }) => ({
          id: labelId,
          name: "Biology",
          parentIds: [parentId],
        }),
        createLabel: async ({ name }) => ({
          id: "label-created",
          name,
          parentIds: [],
        }),
        deleteLabel: async () => undefined,
        listLabels: async () => [
          {
            id: "label-science",
            name: "Science",
            parentIds: [],
          },
        ],
        removeParent: async ({ labelId }) => ({
          id: labelId,
          name: "Science",
          parentIds: [],
        }),
        renameLabel: async ({ labelId, name }) => ({
          id: labelId,
          name,
          parentIds: [],
        }),
      },
    });

    renderRoute("/labels", {
      labelsContext: createReadonlyLabelsContext(persistentLabelsContext),
      persistentLabelsContext,
      sessionContext,
    });

    expect(await screen.findByText("Science")).toBeInTheDocument();
  });
});
