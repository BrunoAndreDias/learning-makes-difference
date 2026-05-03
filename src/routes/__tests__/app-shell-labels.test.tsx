// @vitest-environment jsdom

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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

  it("opens the new label drawer and creates a label with searchable parents", async () => {
    const userId = "user-placeholder";
    const labelsContext = createAppLabelsContext({
      keyPrefix: `labels-drawer-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const notesContext = createAppNotesContext({
      getOwnedLabelIdsForUser: (ownedUserId) =>
        labelsContext.getLabelsForUser(ownedUserId).map((label) => label.id),
      keyPrefix: `notes-drawer-${Math.random().toString(36).slice(2)}`,
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

    renderRoute("/labels", { labelsContext, notesContext });

    const openDrawerButton = await screen.findByRole("button", {
      name: "New label",
    });

    fireEvent.click(openDrawerButton);
    const initialDrawer = await screen.findByRole("dialog", {
      name: "New label",
    });
    fireEvent.click(
      within(initialDrawer).getByRole("button", { name: "Cancel" }),
    );
    expect(
      screen.queryByRole("dialog", { name: "New label" }),
    ).not.toBeInTheDocument();

    fireEvent.click(openDrawerButton);
    const drawer = await screen.findByRole("dialog", { name: "New label" });
    expect(
      within(drawer).getByText("Create a reusable topic for notes."),
    ).toBeInTheDocument();

    const createButton = within(drawer).getByRole("button", {
      name: "Create label",
    });
    expect(createButton).toBeDisabled();

    const parentSearchInput = within(drawer).getByLabelText(
      "Search parent labels",
    );
    fireEvent.change(parentSearchInput, {
      target: { value: "sci" },
    });
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Science (2 notes)" }),
    );

    fireEvent.change(parentSearchInput, {
      target: { value: "bio" },
    });
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Biology (1 note)" }),
    );

    const selectedParents = within(drawer).getByRole("list", {
      name: "Selected parent labels",
    });
    expect(within(selectedParents).getByText("Science")).toBeInTheDocument();
    expect(within(selectedParents).getByText("Biology")).toBeInTheDocument();
    expect(
      within(drawer).getByText(
        "New label will have 2 parents: Biology, Science.",
      ),
    ).toBeInTheDocument();

    fireEvent.change(parentSearchInput, {
      target: { value: "sci" },
    });
    expect(
      within(drawer).queryByRole("button", { name: "Science (2 notes)" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(selectedParents).getByRole("button", { name: "Remove Biology" }),
    );
    expect(
      within(selectedParents).queryByText("Biology"),
    ).not.toBeInTheDocument();
    expect(
      within(drawer).getByText("New label will have 1 parent: Science."),
    ).toBeInTheDocument();

    fireEvent.change(within(drawer).getByLabelText("Label name"), {
      target: { value: "   Systems Biology   " },
    });
    expect(createButton).toBeEnabled();
    fireEvent.click(createButton);

    expect(
      await screen.findByRole("row", { name: /Systems Biology/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "New label" }),
    ).not.toBeInTheDocument();

    const labelsTable = screen.getByRole("table", { name: "Labels list" });
    const createdRow = within(labelsTable).getByRole("row", {
      name: /Systems Biology/i,
    });
    expect(within(createdRow).getByText("Science")).toBeInTheDocument();
    expect(within(createdRow).queryByText("Biology")).not.toBeInTheDocument();
  });

  it("opens edit label drawer and saves full parent set with name update", async () => {
    const userId = "user-placeholder";
    const labelsContext = createAppLabelsContext({
      keyPrefix: `labels-edit-drawer-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const notesContext = createAppNotesContext({
      getOwnedLabelIdsForUser: (ownedUserId) =>
        labelsContext.getLabelsForUser(ownedUserId).map((label) => label.id),
      keyPrefix: `notes-edit-drawer-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    const science = labelsContext.createLabel({
      name: "Science",
      userId,
    });
    const chemistry = labelsContext.createLabel({
      name: "Chemistry",
      userId,
    });
    const biology = labelsContext.createLabel({
      name: "Biology",
      parentIds: [science.id],
      userId,
    });
    labelsContext.createLabel({
      name: "Molecular Biology",
      parentIds: [biology.id],
      userId,
    });

    notesContext.createNote(userId, {
      acronyms: [],
      body: "biology note 1",
      labelIds: [biology.id],
      metaphors: [],
      title: "Biology note 1",
    });
    notesContext.createNote(userId, {
      acronyms: [],
      body: "biology note 2",
      labelIds: [biology.id],
      metaphors: [],
      title: "Biology note 2",
    });

    renderRoute("/labels", { labelsContext, notesContext });

    const labelsTable = await screen.findByRole("table", {
      name: "Labels list",
    });
    const biologyLabelButton = within(labelsTable).getByRole("button", {
      name: "Biology",
    });
    const biologyRow = biologyLabelButton.closest("tr");

    if (biologyRow === null) {
      throw new Error("Biology row is missing.");
    }

    fireEvent.click(biologyRow);
    const openedFromRow = await screen.findByRole("dialog", {
      name: "Edit label",
    });
    fireEvent.click(
      within(openedFromRow).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Edit label" }),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(biologyLabelButton);
    const openedFromLabel = await screen.findByRole("dialog", {
      name: "Edit label",
    });
    fireEvent.click(
      within(openedFromLabel).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Edit label" }),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(
      within(biologyRow).getByRole("button", { name: "Edit label" }),
    );

    const drawer = await screen.findByRole("dialog", { name: "Edit label" });
    expect(
      within(drawer).getByText("Biology · used in 2 notes · 1 child label"),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole("button", { name: "Save changes" }),
    ).toBeDisabled();
    expect(within(drawer).getByText("Danger zone")).toBeInTheDocument();
    expect(
      within(drawer).getByRole("button", { name: "Delete label" }),
    ).toBeInTheDocument();

    const selectedParents = within(drawer).getByRole("list", {
      name: "Selected parent labels",
    });
    expect(within(selectedParents).getByText("Science")).toBeInTheDocument();
    expect(
      within(drawer).getByText("Child labels: Molecular Biology."),
    ).toBeInTheDocument();

    const parentSearchInput = within(drawer).getByLabelText(
      "Search parent labels",
    );
    fireEvent.change(parentSearchInput, {
      target: { value: "chem" },
    });
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Chemistry (0 notes)" }),
    );
    fireEvent.click(
      within(selectedParents).getByRole("button", { name: "Remove Science" }),
    );
    fireEvent.change(within(drawer).getByLabelText("Label name"), {
      target: { value: "  Life Science  " },
    });

    const saveChangesButton = within(drawer).getByRole("button", {
      name: "Save changes",
    });
    expect(saveChangesButton).toBeEnabled();
    fireEvent.click(saveChangesButton);

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Edit label" }),
      ).not.toBeInTheDocument();
    });
    expect(
      await screen.findByRole("button", { name: "Life Science" }),
    ).toBeInTheDocument();
    expect(labelsContext.getLabelsForUser(userId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: biology.id,
          name: "Life Science",
          parentIds: [chemistry.id],
        }),
      ]),
    );
  });

  it("shows no-results quick-create and prefills drawer name from search", async () => {
    const userId = "user-placeholder";
    const labelsContext = createAppLabelsContext({
      keyPrefix: `labels-no-results-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const notesContext = createAppNotesContext({
      getOwnedLabelIdsForUser: (ownedUserId) =>
        labelsContext.getLabelsForUser(ownedUserId).map((label) => label.id),
      keyPrefix: `notes-no-results-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    labelsContext.createLabel({
      name: "Science",
      userId,
    });

    renderRoute("/labels", { labelsContext, notesContext });

    const searchInput = await screen.findByPlaceholderText("Search labels...");
    fireEvent.change(searchInput, {
      target: { value: "mobility" },
    });

    expect(
      screen.getByRole("heading", {
        level: 4,
        name: "No label found for 'mobility'",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Create it now or clear the search to see all labels."),
    ).toBeInTheDocument();

    const quickCreateButton = screen.getByRole("button", {
      name: "Create 'mobility'",
    });
    fireEvent.click(quickCreateButton);

    const drawer = await screen.findByRole("dialog", {
      name: "New label",
    });
    expect(within(drawer).getByLabelText("Label name")).toHaveValue("mobility");
  });

  it("shows minimal empty labels state without summary toolbar or table", async () => {
    const labelsContext = createAppLabelsContext({
      keyPrefix: `labels-empty-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const notesContext = createAppNotesContext({
      getOwnedLabelIdsForUser: (ownedUserId) =>
        labelsContext.getLabelsForUser(ownedUserId).map((label) => label.id),
      keyPrefix: `notes-empty-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    renderRoute("/labels", { labelsContext, notesContext });

    expect(
      await screen.findByRole("heading", { level: 4, name: "No labels yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Create your first label to group related notes."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "New label" }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("region", { name: "Labels summary" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Labels toolbar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: "Labels list" }),
    ).not.toBeInTheDocument();
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
        updateLabel: async ({ labelId, name, parentIds }) => ({
          id: labelId,
          name,
          parentIds,
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
