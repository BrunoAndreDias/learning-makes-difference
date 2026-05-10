// @vitest-environment jsdom

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

async function _expectRowActionsMenuToBeClosed(label: string) {
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
        "This will remove the label from 2 Study Notes. 1 child label will stay available and become a top-level label if it has no other parent.",
      ),
    ).toBeInTheDocument();
    expect(
      within(deleteModal).getByText("Study Notes will not be deleted."),
    ).toBeInTheDocument();
    const cancelButton = within(deleteModal).getByRole("button", {
      name: "Cancel",
    });
    const deleteButton = within(deleteModal).getByRole("button", {
      name: "Delete label",
    });
    expect(cancelButton).toHaveClass("notes-action-secondary");
    expect(deleteButton).toHaveClass("notes-action-danger");
    expect(
      cancelButton.compareDocumentPosition(deleteButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(cancelButton);

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
      screen.getByText("Create your first label to group related Study Notes."),
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
