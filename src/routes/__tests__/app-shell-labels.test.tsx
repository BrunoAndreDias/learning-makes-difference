// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  type AppLabel,
  createAppLabelsContext,
} from "../../modules/labels/label-management/labels";
import {
  type AppPersistentLabelsService,
  createPersistentLabelsContext,
  createReadonlyLabelsContext,
} from "../../modules/labels/persistent-labels";
import { createAppNotesContext, listNotesForUser } from "../../modules/notes";
import {
  createRouteTestSessionContext,
  renderRoute,
  TEST_PILOT_REGISTRATION_CODE,
} from "./app-shell-test-support";

const TEST_USER_ID = "user-placeholder";

function createStorageKey(scope: string) {
  return `${scope}-${Math.random().toString(36).slice(2)}`;
}

function createLabelsRouteContexts(scope: string) {
  const labelsContext = createAppLabelsContext({
    keyPrefix: createStorageKey(`labels-${scope}`),
    storage: window.localStorage,
  });
  const notesContext = createAppNotesContext({
    getOwnedLabelIdsForUser: (ownedUserId) =>
      labelsContext.getLabelsForUser(ownedUserId).map((label) => label.id),
    keyPrefix: createStorageKey(`notes-${scope}`),
    storage: window.localStorage,
  });

  return {
    labelsContext,
    notesContext,
    userId: TEST_USER_ID,
  };
}

function getLabelRow(labelsTable: HTMLElement, label: string) {
  const labelButton = within(labelsTable).getByRole("button", {
    name: label,
  });
  const labelRow = labelButton.closest("tr");

  if (labelRow === null) {
    throw new Error(`${label} row is missing.`);
  }

  return labelRow;
}

async function openDeleteDialogFromRow(label: string) {
  const labelsTable = await screen.findByRole("table", {
    name: "Labels list",
  });
  const labelRow = getLabelRow(labelsTable, label);

  fireEvent.click(
    within(labelRow).getByRole("button", {
      name: `Row actions for ${label}`,
    }),
  );
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Delete label" }),
  );

  return screen.findByRole("dialog", {
    name: `Delete “${label}”?`,
  });
}

async function expectDialogToBeClosed(name: string) {
  await waitFor(() => {
    expect(screen.queryByRole("dialog", { name })).not.toBeInTheDocument();
  });
}

async function expectRowActionsMenuToBeClosed(label: string) {
  await waitFor(() => {
    expect(
      screen.queryByRole("menu", { name: `Row actions for ${label}` }),
    ).not.toBeInTheDocument();
  });
}

function expectLabelRowToContain(label: string, text: string) {
  const labelsTable = screen.getByRole("table", { name: "Labels list" });
  const labelRow = getLabelRow(labelsTable, label);

  expect(within(labelRow).getByText(text)).toBeInTheDocument();
}

function requireTestLabel(labelsById: Map<string, AppLabel>, labelId: string) {
  const label = labelsById.get(labelId);

  if (label === undefined) {
    throw new Error("Missing label.");
  }

  return label;
}

function createTestPersistentLabelsService(initialLabels: readonly AppLabel[]) {
  const labelsById = new Map(
    initialLabels.map((label) => [label.id, label] as const),
  );
  const persistentService: AppPersistentLabelsService = {
    addParent: vi.fn<AppPersistentLabelsService["addParent"]>(
      async ({ labelId, parentId }) => {
        const label = requireTestLabel(labelsById, labelId);
        const nextLabel = {
          ...label,
          parentIds: [...new Set([...label.parentIds, parentId])].sort(),
        };

        labelsById.set(labelId, nextLabel);

        return nextLabel;
      },
    ),
    createLabel: vi.fn<AppPersistentLabelsService["createLabel"]>(
      async ({ name, parentIds }) => {
        const createdLabel = {
          id: "label-created",
          name,
          parentIds: [...new Set(parentIds ?? [])].sort(),
        };

        labelsById.set(createdLabel.id, createdLabel);

        return createdLabel;
      },
    ),
    deleteLabel: vi.fn<AppPersistentLabelsService["deleteLabel"]>(
      async ({ labelId }) => {
        labelsById.delete(labelId);
      },
    ),
    listLabels: vi.fn<AppPersistentLabelsService["listLabels"]>(async () =>
      [...labelsById.values()].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
    ),
    removeParent: vi.fn<AppPersistentLabelsService["removeParent"]>(
      async ({ labelId, parentId }) => {
        const label = requireTestLabel(labelsById, labelId);
        const nextLabel = {
          ...label,
          parentIds: label.parentIds.filter(
            (candidateId) => candidateId !== parentId,
          ),
        };

        labelsById.set(labelId, nextLabel);

        return nextLabel;
      },
    ),
    renameLabel: vi.fn<AppPersistentLabelsService["renameLabel"]>(
      async ({ labelId, name }) => {
        const label = requireTestLabel(labelsById, labelId);
        const nextLabel = {
          ...label,
          name,
        };

        labelsById.set(labelId, nextLabel);

        return nextLabel;
      },
    ),
    updateLabel: vi.fn<AppPersistentLabelsService["updateLabel"]>(
      async ({ labelId, name, parentIds }) => {
        const label = requireTestLabel(labelsById, labelId);
        const nextLabel = {
          ...label,
          name,
          parentIds: [...new Set(parentIds)].sort(),
        };

        labelsById.set(labelId, nextLabel);

        return nextLabel;
      },
    ),
  };

  return persistentService;
}

describe("authenticated app shell", () => {
  it("keeps the labels search icon from overlapping placeholder text", () => {
    const css = readFileSync(
      join(process.cwd(), "src/modules/labels/labels.css"),
      "utf8",
    );
    const sharedInputRuleIndex = css.indexOf(
      ".labels-field input,\n.labels-field select,\n.labels-toolbar__search input",
    );
    const iconPaddingRuleIndex = css.lastIndexOf(
      ".labels-input-with-icon input {\n  padding-left: 3rem;\n}",
    );

    expect(sharedInputRuleIndex).toBeGreaterThan(-1);
    expect(iconPaddingRuleIndex).toBeGreaterThan(sharedInputRuleIndex);
  });

  it("keeps the labels table header sticky inside the list shell", () => {
    const css = readFileSync(
      join(process.cwd(), "src/modules/labels/labels.css"),
      "utf8",
    );

    expect(css).toContain(".labels-table th {\n  position: sticky;\n  top: 0;");
  });

  it("keeps label row dividers inset and avoids whole-row hover fills", () => {
    const css = readFileSync(
      join(process.cwd(), "src/modules/labels/labels.css"),
      "utf8",
    );

    expect(css).toContain(
      ".labels-table__row td::after {\n  position: absolute;\n  right: 0;",
    );
    expect(css).toContain(
      ".labels-table__row td:first-child::after {\n  left: 0.85rem;",
    );
    expect(css).toContain(
      ".labels-table__row td:last-child::after {\n  right: 0.85rem;",
    );
    expect(css).toContain(
      ".labels-table__row--active td::before {\n  position: absolute;\n  top: 0.5rem;",
    );
    expect(css).toContain(
      ".labels-table__row--active td:first-child::before {\n  left: 0.85rem;",
    );
    expect(css).toContain(
      ".labels-table__row--active td:last-child::before {\n  right: 0.85rem;",
    );
    expect(css).not.toContain(
      ".labels-table tbody tr:last-child td {\n  border-bottom: 0;",
    );
    expect(css).not.toContain(".labels-table__row:hover td");
  });

  it("renders compact header, small rules note, and derived labels table controls", async () => {
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
      screen.getByText(
        "Rules: multiple parents allowed, cycles blocked, deleting labels keeps notes.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Label rules" }),
    ).not.toBeInTheDocument();
    const startFocusButton = screen.getByRole("button", {
      name: "Start Focus",
    });
    const newLabelButton = screen.getByRole("button", { name: "New label" });
    expect(startFocusButton).toHaveClass(
      "notes-action",
      "notes-action-primary",
    );
    expect(newLabelButton).toHaveClass("notes-action", "notes-action-primary");

    const searchInput = screen.getByPlaceholderText("Search labels...");
    expect(searchInput).toBeInTheDocument();
    expect(screen.getByLabelText("Filter labels")).toBeInTheDocument();
    expect(screen.queryByLabelText("Sort labels")).not.toBeInTheDocument();

    const labelsTable = screen.getByRole("table", { name: "Labels list" });
    const labelHeader = within(labelsTable).getByRole("columnheader", {
      name: "Label",
    });
    const childrenHeader = within(labelsTable).getByRole("columnheader", {
      name: /Children/i,
    });
    const notesHeader = within(labelsTable).getByRole("columnheader", {
      name: /Notes/i,
    });

    expect(labelHeader).toBeInTheDocument();
    expect(
      within(labelsTable).getByRole("columnheader", { name: "Parents" }),
    ).toBeInTheDocument();
    expect(childrenHeader).toBeInTheDocument();
    expect(notesHeader).toBeInTheDocument();
    expect(
      within(labelsTable).getByRole("columnheader", { name: "Row actions" }),
    ).toBeInTheDocument();
    expect(labelHeader).toHaveAttribute("aria-sort", "ascending");
    expect(
      within(childrenHeader).getByRole("button", {
        name: "Sort by children, high to low",
      }),
    ).toBeInTheDocument();
    expect(
      within(notesHeader).getByRole("button", {
        name: "Sort by notes, high to low",
      }),
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
    fireEvent.click(
      within(childrenHeader).getByRole("button", {
        name: "Sort by children, high to low",
      }),
    );

    let bodyRows = within(labelsTable).getAllByRole("row").slice(1);
    expect(within(bodyRows[0]).getByText("Science")).toBeInTheDocument();
    expect(childrenHeader).toHaveAttribute("aria-sort", "descending");
    expect(labelHeader).not.toHaveAttribute("aria-sort");

    fireEvent.click(
      within(notesHeader).getByRole("button", {
        name: "Sort by notes, high to low",
      }),
    );

    bodyRows = within(labelsTable).getAllByRole("row").slice(1);
    expect(within(bodyRows[0]).getByText("Science")).toBeInTheDocument();
    expect(notesHeader).toHaveAttribute("aria-sort", "descending");
    expect(childrenHeader).not.toHaveAttribute("aria-sort");
  });

  it("shows a static rules note without a rules toggle control", async () => {
    const { labelsContext, notesContext, userId } =
      createLabelsRouteContexts("rules-region-a11y");

    labelsContext.createLabel({
      name: "Science",
      userId,
    });

    renderRoute("/labels", { labelsContext, notesContext });

    await screen.findByRole("heading", { level: 3, name: "Labels" });
    expect(
      screen.getByText(
        "Rules: multiple parents allowed, cycles blocked, deleting labels keeps notes.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Label rules" }),
    ).not.toBeInTheDocument();
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
      within(drawer).getByText("Biology / Science / New label"),
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
    expect(within(drawer).getByText("Science / New label")).toBeInTheDocument();

    fireEvent.change(within(drawer).getByLabelText("Label name"), {
      target: { value: "   Systems Biology   " },
    });
    expect(
      within(drawer).getByText("Science / Systems Biology"),
    ).toBeInTheDocument();
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

  it("returns focus to new label trigger when create drawer closes with escape", async () => {
    const { labelsContext, notesContext, userId } = createLabelsRouteContexts(
      "create-drawer-focus",
    );

    labelsContext.createLabel({
      name: "Science",
      userId,
    });

    renderRoute("/labels", { labelsContext, notesContext });

    const newLabelButton = await screen.findByRole("button", {
      name: "New label",
    });

    fireEvent.click(newLabelButton);
    const drawer = await screen.findByRole("dialog", { name: "New label" });
    expect(within(drawer).getByLabelText("Label name")).toHaveFocus();

    fireEvent.keyDown(drawer, { key: "Escape" });
    await expectDialogToBeClosed("New label");
    expect(newLabelButton).toHaveFocus();
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
    await expectDialogToBeClosed("Edit label");

    fireEvent.click(biologyLabelButton);
    const openedFromLabel = await screen.findByRole("dialog", {
      name: "Edit label",
    });
    fireEvent.click(
      within(openedFromLabel).getByRole("button", { name: "Cancel" }),
    );
    await expectDialogToBeClosed("Edit label");

    fireEvent.click(
      within(biologyRow).getByRole("button", {
        name: "Row actions for Biology",
      }),
    );
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Edit label" }),
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
    const childLabels = within(drawer).getByRole("list", {
      name: "Child labels",
    });
    expect(
      within(childLabels).getByText("Molecular Biology"),
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

    await expectDialogToBeClosed("Edit label");
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

  it("returns focus to label trigger when edit drawer closes with escape", async () => {
    const { labelsContext, notesContext, userId } =
      createLabelsRouteContexts("edit-drawer-focus");

    labelsContext.createLabel({
      name: "Biology",
      userId,
    });

    renderRoute("/labels", { labelsContext, notesContext });

    const labelButton = await screen.findByRole("button", { name: "Biology" });
    fireEvent.click(labelButton);

    const drawer = await screen.findByRole("dialog", { name: "Edit label" });
    expect(within(drawer).getByLabelText("Label name")).toHaveFocus();

    fireEvent.keyDown(drawer, { key: "Escape" });
    await expectDialogToBeClosed("Edit label");
    expect(labelButton).toHaveFocus();
  });

  it("renders row overflow actions menu and duplicates label with parent-only copy", async () => {
    const userId = "user-placeholder";
    const labelsContext = createAppLabelsContext({
      keyPrefix: `labels-row-menu-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const notesContext = createAppNotesContext({
      getOwnedLabelIdsForUser: (ownedUserId) =>
        labelsContext.getLabelsForUser(ownedUserId).map((label) => label.id),
      keyPrefix: `notes-row-menu-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    const science = labelsContext.createLabel({
      name: "Science",
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
      body: "biology note",
      labelIds: [biology.id],
      metaphors: [],
      title: "Biology note",
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

    const biologyMenuButton = within(biologyRow).getByRole("button", {
      name: "Row actions for Biology",
    });

    fireEvent.click(biologyMenuButton);
    const rowMenu = await screen.findByRole("menu", {
      name: "Row actions for Biology",
    });
    expect(
      within(rowMenu).getByRole("menuitem", { name: "Edit label" }),
    ).toBeInTheDocument();
    expect(
      within(rowMenu).getByRole("menuitem", { name: "Duplicate" }),
    ).toBeInTheDocument();
    expect(
      within(rowMenu).getByRole("menuitem", { name: "Delete label" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(rowMenu, { key: "Escape" });
    await expectRowActionsMenuToBeClosed("Biology");

    fireEvent.click(biologyMenuButton);
    await screen.findByRole("menu", { name: "Row actions for Biology" });
    fireEvent.mouseDown(
      screen.getByRole("heading", { level: 3, name: "Labels" }),
    );
    await expectRowActionsMenuToBeClosed("Biology");

    fireEvent.click(biologyMenuButton);
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Edit label" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Edit label" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("menu", { name: "Row actions for Biology" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(biologyMenuButton);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Duplicate" }));

    await expectRowActionsMenuToBeClosed("Biology");

    const duplicateRow = await screen.findByRole("row", {
      name: /Biology \(copy\)/i,
    });
    expect(within(duplicateRow).getByText("Science")).toBeInTheDocument();
    expect(within(duplicateRow).getAllByText("0")).toHaveLength(2);
  });

  it("returns focus to the row actions trigger when the menu closes with escape", async () => {
    const { labelsContext, notesContext, userId } =
      createLabelsRouteContexts("row-menu-focus");

    labelsContext.createLabel({
      name: "Biology",
      userId,
    });

    renderRoute("/labels", { labelsContext, notesContext });

    const labelsTable = await screen.findByRole("table", {
      name: "Labels list",
    });
    const labelRow = getLabelRow(labelsTable, "Biology");
    const menuTrigger = within(labelRow).getByRole("button", {
      name: "Row actions for Biology",
    });

    fireEvent.click(menuTrigger);
    const menu = await screen.findByRole("menu", {
      name: "Row actions for Biology",
    });
    const editMenuItem = within(menu).getByRole("menuitem", {
      name: "Edit label",
    });
    editMenuItem.focus();
    expect(editMenuItem).toHaveFocus();

    fireEvent.keyDown(editMenuItem, { key: "Escape" });
    await expectRowActionsMenuToBeClosed("Biology");
    expect(menuTrigger).toHaveFocus();
  });

  it("opens a delete confirmation modal from row actions with impact copy and cancel", async () => {
    const { labelsContext, notesContext, userId } =
      createLabelsRouteContexts("delete-modal");

    const science = labelsContext.createLabel({
      name: "Science",
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

    const deleteModal = await openDeleteDialogFromRow("Biology");

    expect(
      within(deleteModal).getByText(
        "This will remove the label from 2 notes. 1 child label will stay available and become a top-level label if it has no other parent.",
      ),
    ).toBeInTheDocument();
    expect(
      within(deleteModal).getByText("Notes will not be deleted."),
    ).toBeInTheDocument();

    fireEvent.click(
      within(deleteModal).getByRole("button", { name: "Cancel" }),
    );

    await expectDialogToBeClosed("Delete “Biology”?");
    expect(screen.getByRole("button", { name: "Biology" })).toBeInTheDocument();
  });

  it("closes delete confirmation modal with escape and restores focus to row actions trigger", async () => {
    const { labelsContext, notesContext, userId } =
      createLabelsRouteContexts("delete-modal-focus");

    labelsContext.createLabel({
      name: "Biology",
      userId,
    });

    renderRoute("/labels", { labelsContext, notesContext });

    const labelsTable = await screen.findByRole("table", {
      name: "Labels list",
    });
    const labelRow = getLabelRow(labelsTable, "Biology");
    const menuTrigger = within(labelRow).getByRole("button", {
      name: "Row actions for Biology",
    });

    fireEvent.click(menuTrigger);
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Delete label" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Delete “Biology”?",
    });
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Escape" });
    await expectDialogToBeClosed("Delete “Biology”?");
    expect(menuTrigger).toHaveFocus();
  });

  it("confirms delete from edit drawer danger zone and preserves notes with child cleanup", async () => {
    const { labelsContext, notesContext, userId } =
      createLabelsRouteContexts("delete-confirm");

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
    labelsContext.createLabel({
      name: "Applied Science",
      parentIds: [biology.id, chemistry.id],
      userId,
    });
    notesContext.createNote(userId, {
      acronyms: [],
      body: "biology and chemistry note",
      labelIds: [biology.id, chemistry.id],
      metaphors: [],
      title: "Biology and chemistry note",
    });
    notesContext.createNote(userId, {
      acronyms: [],
      body: "biology only note",
      labelIds: [biology.id],
      metaphors: [],
      title: "Biology only note",
    });

    renderRoute("/labels", { labelsContext, notesContext });

    fireEvent.click(await screen.findByRole("button", { name: "Biology" }));

    const drawer = await screen.findByRole("dialog", { name: "Edit label" });
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Delete label" }),
    );

    const deleteModal = await screen.findByRole("dialog", {
      name: "Delete “Biology”?",
    });
    fireEvent.click(
      within(deleteModal).getByRole("button", {
        name: "Delete label",
      }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Delete “Biology”?" }),
      ).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Edit label" }),
      ).not.toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: "Biology" }),
    ).not.toBeInTheDocument();

    expectLabelRowToContain("Applied Science", "Chemistry");
    expectLabelRowToContain("Molecular Biology", "—");

    const notesAfterDelete = listNotesForUser(
      notesContext.getSnapshot(),
      userId,
    );
    const biologyAndChemistryNote = notesAfterDelete.find(
      (note) => note.title === "Biology and chemistry note",
    );
    const biologyOnlyNote = notesAfterDelete.find(
      (note) => note.title === "Biology only note",
    );

    expect(notesAfterDelete).toHaveLength(2);
    expect(biologyAndChemistryNote).toMatchObject({
      labelIds: [chemistry.id],
    });
    expect(biologyOnlyNote).toMatchObject({
      labelIds: [],
    });
  });

  it("confirms delete in persistent labels context and cleans snapshot parent links", async () => {
    const persistentService = createTestPersistentLabelsService([
      {
        id: "label-science",
        name: "Science",
        parentIds: [],
      },
      {
        id: "label-chemistry",
        name: "Chemistry",
        parentIds: [],
      },
      {
        id: "label-biology",
        name: "Biology",
        parentIds: ["label-science"],
      },
      {
        id: "label-applied-science",
        name: "Applied Science",
        parentIds: ["label-biology", "label-chemistry"],
      },
      {
        id: "label-molecular-biology",
        name: "Molecular Biology",
        parentIds: ["label-biology"],
      },
    ]);
    const persistentLabelsContext = createPersistentLabelsContext({
      service: persistentService,
    });
    const labelsContext = createReadonlyLabelsContext(persistentLabelsContext);
    const notesContext = createAppNotesContext({
      getOwnedLabelIdsForUser: (ownedUserId) =>
        labelsContext.getLabelsForUser(ownedUserId).map((label) => label.id),
      keyPrefix: createStorageKey("notes-persistent-delete"),
      storage: window.localStorage,
    });

    renderRoute("/labels", {
      labelsContext,
      notesContext,
      persistentLabelsContext,
    });

    const deleteModal = await openDeleteDialogFromRow("Biology");
    fireEvent.click(
      within(deleteModal).getByRole("button", {
        name: "Delete label",
      }),
    );

    await waitFor(() => {
      expect(persistentService.deleteLabel).toHaveBeenCalledWith({
        labelId: "label-biology",
      });
    });
    expect(
      screen.queryByRole("button", { name: "Biology" }),
    ).not.toBeInTheDocument();

    expectLabelRowToContain("Applied Science", "Chemistry");
    expectLabelRowToContain("Molecular Biology", "—");
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
        name: "No label found for “mobility”",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Create it now or clear the search to see all labels."),
    ).toBeInTheDocument();

    const quickCreateButton = screen.getByRole("button", {
      name: "Create “mobility”",
    });
    fireEvent.click(quickCreateButton);

    const drawer = await screen.findByRole("dialog", {
      name: "New label",
    });
    expect(within(drawer).getByLabelText("Label name")).toHaveValue("mobility");
    expect(
      within(drawer).getByText(
        "Mobility will be created as a top-level label.",
      ),
    ).toBeInTheDocument();
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
    expect(screen.getAllByRole("button", { name: "New label" })).toHaveLength(
      2,
    );

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

  it("duplicates labels through persistent context with parent-only snapshot copy", async () => {
    const labelsById = new Map([
      [
        "label-science",
        {
          id: "label-science",
          name: "Science",
          parentIds: [] as string[],
        },
      ],
      [
        "label-biology",
        {
          id: "label-biology",
          name: "Biology",
          parentIds: ["label-science"],
        },
      ],
      [
        "label-molecular-biology",
        {
          id: "label-molecular-biology",
          name: "Molecular Biology",
          parentIds: ["label-biology"],
        },
      ],
    ]);
    let duplicateIndex = 0;
    const persistentService: AppPersistentLabelsService = {
      addParent: vi.fn(async ({ labelId, parentId }) => {
        const label = labelsById.get(labelId);

        if (label === undefined) {
          throw new Error("Missing label.");
        }

        const nextLabel = {
          ...label,
          parentIds: [...new Set([...label.parentIds, parentId])].sort(),
        };

        labelsById.set(labelId, nextLabel);

        return nextLabel;
      }),
      createLabel: vi.fn(
        async ({ name, parentIds }: { name: string; parentIds?: string[] }) => {
          const normalizedParentIds = [
            ...new Set<string>(parentIds ?? []),
          ].sort();
          duplicateIndex += 1;
          const createdLabel = {
            id: `label-duplicate-${duplicateIndex}`,
            name,
            parentIds: normalizedParentIds,
          };

          labelsById.set(createdLabel.id, createdLabel);

          return createdLabel;
        },
      ),
      deleteLabel: vi.fn(async ({ labelId }) => {
        labelsById.delete(labelId);
      }),
      listLabels: vi.fn(async () =>
        [...labelsById.values()].sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      ),
      removeParent: vi.fn(async ({ labelId, parentId }) => {
        const label = labelsById.get(labelId);

        if (label === undefined) {
          throw new Error("Missing label.");
        }

        const nextLabel = {
          ...label,
          parentIds: label.parentIds.filter(
            (candidateId) => candidateId !== parentId,
          ),
        };

        labelsById.set(labelId, nextLabel);

        return nextLabel;
      }),
      renameLabel: vi.fn(async ({ labelId, name }) => {
        const label = labelsById.get(labelId);

        if (label === undefined) {
          throw new Error("Missing label.");
        }

        const nextLabel = {
          ...label,
          name,
        };

        labelsById.set(labelId, nextLabel);

        return nextLabel;
      }),
      updateLabel: vi.fn(
        async ({
          labelId,
          name,
          parentIds,
        }: {
          labelId: string;
          name: string;
          parentIds: string[];
        }) => {
          const label = labelsById.get(labelId);

          if (label === undefined) {
            throw new Error("Missing label.");
          }

          const nextLabel = {
            ...label,
            name,
            parentIds: [...new Set<string>(parentIds)].sort(),
          };

          labelsById.set(labelId, nextLabel);

          return nextLabel;
        },
      ),
    };
    const persistentLabelsContext = createPersistentLabelsContext({
      service: persistentService,
    });
    const labelsContext = createReadonlyLabelsContext(persistentLabelsContext);
    const notesContext = createAppNotesContext({
      getOwnedLabelIdsForUser: (ownedUserId) =>
        labelsContext.getLabelsForUser(ownedUserId).map((label) => label.id),
      keyPrefix: `notes-persistent-duplicate-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    renderRoute("/labels", {
      labelsContext,
      notesContext,
      persistentLabelsContext,
    });

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

    fireEvent.click(
      within(biologyRow).getByRole("button", {
        name: "Row actions for Biology",
      }),
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Duplicate" }));

    await waitFor(() => {
      expect(persistentService.createLabel).toHaveBeenCalledWith({
        name: "Biology (copy)",
        parentIds: ["label-science"],
      });
    });

    const duplicateRow = await screen.findByRole("row", {
      name: /Biology \(copy\)/i,
    });
    const molecularRow = screen.getByRole("row", {
      name: /Molecular Biology/i,
    });

    expect(within(duplicateRow).getByText("Science")).toBeInTheDocument();
    expect(within(duplicateRow).getAllByText("0")).toHaveLength(2);
    expect(within(molecularRow).getByText("Biology")).toBeInTheDocument();
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
