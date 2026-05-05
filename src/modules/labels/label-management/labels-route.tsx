import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { formatCount } from "../../../lib/format-count";
import { isModifiedKeyShortcut } from "../../../lib/keyboard";
import type { AppSessionSnapshot } from "../../access/session/session";
import { FocusSessionStartControl } from "../../focus";
import { listNotesForUser } from "../../notes";
import { normalizeLabelParentIds } from "../label-graph";
import { type AppLabel, AppLabelError } from "./labels";
import {
  type DerivedLabelRow,
  deriveDuplicateLabelName,
  deriveLabelRows,
  deriveLabelsSummary,
  deriveSelectableParentOptions,
  deriveVisibleLabelRows,
  type LabelsFilterValue,
  type LabelsSortValue,
  parseLabelsFilterValue,
} from "./labels-management-view";

export const Route = createFileRoute("/_protected/labels")({
  component: LabelsPage,
});

type LabelWriteInput = {
  name: string;
  parentIds: string[];
};

type LabelRowActionsMenuProps = Readonly<{
  isOpen: boolean;
  label: string;
  menuId: string;
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onToggle: () => void;
}>;

type PendingDeleteDraft = Readonly<{
  childCount: number;
  id: string;
  label: string;
  noteCount: number;
}>;

type DeleteLabelDialogProps = Readonly<{
  descriptionId: string;
  draft: PendingDeleteDraft;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  titleId: string;
}>;

type FocusRestoreRef = {
  current: HTMLElement | null;
};

type CountColumnSortValue = Extract<
  LabelsSortValue,
  "children-desc" | "notes-desc"
>;

function formatParentNames(parentNames: readonly string[]) {
  if (parentNames.length === 0) {
    return "—";
  }

  return parentNames.join(", ");
}

function addParentId(parentIds: string[], parentId: string) {
  if (parentIds.includes(parentId)) {
    return parentIds;
  }

  return normalizeLabelParentIds([...parentIds, parentId]);
}

function removeParentId(parentIds: readonly string[], parentId: string) {
  return parentIds.filter((candidateId) => candidateId !== parentId);
}

function parentIdsMatch(left: readonly string[], right: readonly string[]) {
  const normalizedLeft = normalizeLabelParentIds(left);
  const normalizedRight = normalizeLabelParentIds(right);

  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every(
      (parentId, index) => parentId === normalizedRight[index],
    )
  );
}

function sortRowsByLabel(rows: readonly DerivedLabelRow[]) {
  return [...rows].sort((left, right) => left.label.localeCompare(right.label));
}

function getRowsByIds(
  rows: readonly DerivedLabelRow[],
  rowIds: readonly string[],
) {
  const rowById = new Map(rows.map((row) => [row.id, row]));

  return sortRowsByLabel(
    rowIds
      .map((rowId) => rowById.get(rowId))
      .filter((row): row is DerivedLabelRow => row !== undefined),
  );
}

function getColumnSortButtonLabel(input: {
  columnLabel: "Children" | "Notes";
  isActive: boolean;
}) {
  if (input.isActive) {
    return `Clear ${input.columnLabel.toLowerCase()} sort`;
  }

  return `Sort by ${input.columnLabel.toLowerCase()}, high to low`;
}

function getChildRows(input: {
  labelId: string;
  labels: readonly AppLabel[];
  rows: readonly DerivedLabelRow[];
}) {
  const childIds = input.labels
    .filter((labelRecord) => labelRecord.parentIds.includes(input.labelId))
    .map((labelRecord) => labelRecord.id);

  return getRowsByIds(input.rows, childIds);
}

function formatEditUsageSummary(input: {
  childCount: number;
  label: string;
  noteCount: number;
}) {
  return `${input.label} · used in ${formatCount(input.noteCount, "note")} · ${formatCount(input.childCount, "child label")}`;
}

function formatPreviewLabelName(labelName: string) {
  const trimmedName = labelName.trim();

  if (trimmedName.length === 0) {
    return "New label";
  }

  return `${trimmedName.slice(0, 1).toUpperCase()}${trimmedName.slice(1)}`;
}

function formatCreatePreview(input: {
  labelName: string;
  parentNames: readonly string[];
}) {
  const labelName = formatPreviewLabelName(input.labelName);

  if (input.parentNames.length === 0) {
    return `${labelName} will be created as a top-level label.`;
  }

  return `${input.parentNames.join(" / ")} / ${labelName}`;
}

function formatDeleteImpactSummary(input: {
  childCount: number;
  noteCount: number;
}) {
  const notesImpact = formatCount(input.noteCount, "note");

  if (input.childCount === 0) {
    return `This will remove the label from ${notesImpact}.`;
  }

  const childImpact = formatCount(input.childCount, "child label");
  const childRelationshipImpact =
    input.childCount === 1
      ? "will stay available and become a top-level label if it has no other parent"
      : "will stay available and become top-level labels if they have no other parent";

  return `This will remove the label from ${notesImpact}. ${childImpact} ${childRelationshipImpact}.`;
}

function getActiveFocusRestoreTarget() {
  const activeElement = document.activeElement;

  if (!(activeElement instanceof HTMLElement)) {
    return null;
  }

  if (
    activeElement === document.body ||
    activeElement === document.documentElement
  ) {
    return null;
  }

  return activeElement;
}

function restoreFocusIfAvailable(element: HTMLElement | null) {
  if (element?.isConnected !== true) {
    return;
  }

  element.focus();
}

function restoreFocusAndClearRef(focusRef: FocusRestoreRef) {
  restoreFocusIfAvailable(focusRef.current);
  focusRef.current = null;
}

function LabelsPage() {
  const labels = useRouteContext({
    from: "/_protected/labels",
    select: (context) => context.labels,
  });
  const notes = useRouteContext({
    from: "/_protected/labels",
    select: (context) => context.notes,
  });
  const persistentLabelsContext = useRouteContext({
    from: "/_protected/labels",
    select: (context) => context.persistentLabels,
  });
  const persistentNotesContext = useRouteContext({
    from: "/_protected/labels",
    select: (context) => context.persistentNotes,
  });
  const focus = useRouteContext({
    from: "/_protected/labels",
    select: (context) => context.focus,
  });
  const persistentFocus = useRouteContext({
    from: "/_protected/labels",
    select: (context) => context.persistentFocus,
  });
  const session = useRouteContext({
    from: "/_protected/labels",
    select: (context) => context.session,
  });

  const sessionSnapshot = useSyncExternalStore<AppSessionSnapshot>(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const notesSnapshot = useSyncExternalStore(
    notes.subscribe,
    notes.getSnapshot,
    notes.getSnapshot,
  );
  useSyncExternalStore(focus.subscribe, focus.getSnapshot, focus.getSnapshot);
  const currentUserId = sessionSnapshot.user?.id ?? null;
  const activeFocusSession =
    currentUserId === null
      ? null
      : focus.getActiveSession({ userId: currentUserId });

  const [labelRecords, setLabelRecords] = useState<AppLabel[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterValue, setFilterValue] = useState<LabelsFilterValue>("all");
  const [sortValue, setSortValue] = useState<LabelsSortValue>("name-asc");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isCreateDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createParentSearchQuery, setCreateParentSearchQuery] = useState("");
  const [createParentIds, setCreateParentIds] = useState<string[]>([]);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editParentSearchQuery, setEditParentSearchQuery] = useState("");
  const [editParentIds, setEditParentIds] = useState<string[]>([]);
  const [pendingDeleteDraft, setPendingDeleteDraft] =
    useState<PendingDeleteDraft | null>(null);
  const [openRowActionsLabelId, setOpenRowActionsLabelId] = useState<
    string | null
  >(null);

  const createDrawerDescriptionId = useId();
  const createDrawerTitleId = useId();
  const editDrawerDescriptionId = useId();
  const editDrawerTitleId = useId();
  const deleteDialogDescriptionId = useId();
  const deleteDialogTitleId = useId();
  const createInputId = useId();
  const createParentSearchInputId = useId();
  const editInputId = useId();
  const editParentSearchInputId = useId();
  const feedbackMessageId = useId();
  const filterSelectId = useId();
  const searchInputId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const createDrawerTriggerRef = useRef<HTMLElement | null>(null);
  const editDrawerTriggerRef = useRef<HTMLElement | null>(null);
  const deleteDialogTriggerRef = useRef<HTMLElement | null>(null);

  const noteRecords = useMemo(() => {
    return listNotesForUser(notesSnapshot, currentUserId);
  }, [notesSnapshot, currentUserId]);

  useEffect(() => {
    function syncLabelRecords() {
      if (currentUserId === null) {
        setLabelRecords([]);
        return;
      }

      setLabelRecords(labels.getLabelsForUser(currentUserId));
    }

    syncLabelRecords();

    return labels.subscribe(syncLabelRecords);
  }, [currentUserId, labels]);

  useEffect(() => {
    function handleGlobalSearchShortcut(event: KeyboardEvent) {
      if (!isModifiedKeyShortcut(event, "k")) {
        return;
      }

      event.preventDefault();
      searchInputRef.current?.focus();
    }

    window.addEventListener("keydown", handleGlobalSearchShortcut);

    return () => {
      window.removeEventListener("keydown", handleGlobalSearchShortcut);
    };
  }, []);

  const handleError = useCallback((error: unknown) => {
    if (error instanceof AppLabelError) {
      setFeedbackMessage(error.message);
      return;
    }

    setFeedbackMessage("Label update failed. Try again.");
  }, []);

  useEffect(() => {
    if (persistentLabelsContext === undefined) {
      return;
    }

    void persistentLabelsContext
      .refresh(currentUserId)
      .catch((error: unknown) => {
        handleError(error);
      });
  }, [currentUserId, handleError, persistentLabelsContext]);

  useEffect(() => {
    if (persistentNotesContext === undefined) {
      return;
    }

    void persistentNotesContext.refresh(currentUserId).catch(() => {
      setFeedbackMessage("Notes refresh failed. Try again.");
    });
  }, [currentUserId, persistentNotesContext]);

  useEffect(() => {
    if (!isCreateDrawerOpen) {
      return;
    }

    createInputRef.current?.focus();
  }, [isCreateDrawerOpen]);

  useEffect(() => {
    if (editingLabelId === null) {
      return;
    }

    editInputRef.current?.focus();
  }, [editingLabelId]);

  useEffect(() => {
    if (openRowActionsLabelId === null) {
      return;
    }

    function handleDocumentMouseDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      if (target.closest("[data-row-actions-menu]") !== null) {
        return;
      }

      setOpenRowActionsLabelId(null);
    }

    document.addEventListener("mousedown", handleDocumentMouseDown);

    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, [openRowActionsLabelId]);

  async function runLabelAction(action: () => void | Promise<void>) {
    try {
      await action();
      setFeedbackMessage(null);
    } catch (error) {
      handleError(error);
    }
  }

  async function createLabelRecord(input: LabelWriteInput) {
    if (currentUserId === null) {
      return;
    }

    if (persistentLabelsContext === undefined) {
      labels.createLabel({
        ...input,
        userId: currentUserId,
      });
      return;
    }

    await persistentLabelsContext.createLabel(currentUserId, input);
  }

  async function handleCreateLabel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (currentUserId === null) {
      return;
    }

    await runLabelAction(async () => {
      await createLabelRecord({
        name: createName,
        parentIds: createParentIds,
      });
      resetCreateDraft("");
      setCreateDrawerOpen(false);
    });
  }

  async function deleteLabel(labelId: string) {
    if (currentUserId === null) {
      return;
    }

    await runLabelAction(async () => {
      if (persistentLabelsContext === undefined) {
        labels.deleteLabel({
          labelId,
          userId: currentUserId,
        });
        return;
      }

      await persistentLabelsContext.deleteLabel(currentUserId, labelId);
    });
  }

  async function updateLabel(input: {
    labelId: string;
    name: string;
    parentIds: string[];
  }) {
    if (currentUserId === null) {
      return;
    }

    await runLabelAction(async () => {
      if (persistentLabelsContext === undefined) {
        labels.updateLabel({
          ...input,
          userId: currentUserId,
        });
        return;
      }

      await persistentLabelsContext.updateLabel(currentUserId, input);
    });
  }

  async function duplicateLabel(labelId: string) {
    if (currentUserId === null) {
      return;
    }

    const labelToDuplicate = labelRecords.find((label) => label.id === labelId);

    if (labelToDuplicate === undefined) {
      return;
    }

    const duplicateName = deriveDuplicateLabelName({
      existingLabelNames: labelRecords.map((label) => label.name),
      sourceLabelName: labelToDuplicate.name,
    });

    await runLabelAction(async () => {
      await createLabelRecord({
        name: duplicateName,
        parentIds: labelToDuplicate.parentIds,
      });
    });
  }

  function handleFilterChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextFilterValue = parseLabelsFilterValue(event.target.value);

    if (nextFilterValue !== null) {
      setFilterValue(nextFilterValue);
    }
  }

  function openDeleteDialog(row: DerivedLabelRow) {
    closeRowActionsMenu();
    deleteDialogTriggerRef.current = getActiveFocusRestoreTarget();
    setPendingDeleteDraft({
      childCount: row.childCount,
      id: row.id,
      label: row.label,
      noteCount: row.directNoteCount,
    });
  }

  function closeDeleteDialog() {
    setPendingDeleteDraft(null);
    restoreFocusAndClearRef(deleteDialogTriggerRef);
  }

  async function handleConfirmDelete() {
    if (pendingDeleteDraft === null) {
      return;
    }

    const labelId = pendingDeleteDraft.id;

    closeDeleteDialog();
    await deleteLabel(labelId);

    if (editingLabelId === labelId) {
      closeEditDrawer();
    }
  }

  function closeRowActionsMenu() {
    setOpenRowActionsLabelId(null);
  }

  function toggleRowActionsMenu(rowId: string) {
    setOpenRowActionsLabelId((currentRowId) =>
      currentRowId === rowId ? null : rowId,
    );
  }

  function resetCreateDraft(nextName: string) {
    setCreateName(nextName);
    setCreateParentIds([]);
    setCreateParentSearchQuery("");
  }

  function openCreateDrawerWithName(
    name: string,
    triggerElement: HTMLElement | null = getActiveFocusRestoreTarget(),
  ) {
    closeRowActionsMenu();
    createDrawerTriggerRef.current = triggerElement;
    resetCreateDraft(name);
    setCreateDrawerOpen(true);
  }

  function openEmptyCreateDrawer(
    triggerElement: HTMLElement | null = getActiveFocusRestoreTarget(),
  ) {
    openCreateDrawerWithName("", triggerElement);
  }

  function closeCreateDrawer() {
    resetCreateDraft("");
    setCreateDrawerOpen(false);
    restoreFocusAndClearRef(createDrawerTriggerRef);
  }

  function resetEditDraft() {
    setEditingLabelId(null);
    setEditName("");
    setEditParentIds([]);
    setEditParentSearchQuery("");
  }

  function closeEditDrawer() {
    resetEditDraft();
    restoreFocusAndClearRef(editDrawerTriggerRef);
  }

  function openEditDrawer(
    labelId: string,
    triggerElement: HTMLElement | null = getActiveFocusRestoreTarget(),
  ) {
    const label = labelRecords.find((candidate) => candidate.id === labelId);

    if (label === undefined) {
      return;
    }

    editDrawerTriggerRef.current = triggerElement;
    closeRowActionsMenu();
    setEditingLabelId(label.id);
    setEditName(label.name);
    setEditParentIds(normalizeLabelParentIds(label.parentIds));
    setEditParentSearchQuery("");
  }

  function handleCreateDrawerKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      closeCreateDrawer();
    }
  }

  function handleEditDrawerKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      closeEditDrawer();
    }
  }

  function handleCountColumnSort(nextSortValue: CountColumnSortValue) {
    setSortValue((currentSortValue) =>
      currentSortValue === nextSortValue ? "name-asc" : nextSortValue,
    );
  }

  function addCreateParent(parentId: string) {
    setCreateParentIds((currentParentIds) =>
      addParentId(currentParentIds, parentId),
    );
    setCreateParentSearchQuery("");
  }

  function removeCreateParent(parentId: string) {
    setCreateParentIds((currentParentIds) =>
      removeParentId(currentParentIds, parentId),
    );
  }

  function addEditParent(parentId: string) {
    setEditParentIds((currentParentIds) =>
      addParentId(currentParentIds, parentId),
    );
    setEditParentSearchQuery("");
  }

  function removeEditParent(parentId: string) {
    setEditParentIds((currentParentIds) =>
      removeParentId(currentParentIds, parentId),
    );
  }

  const derivedRows = useMemo(() => {
    return deriveLabelRows({
      labels: labelRecords,
      notes: noteRecords,
    });
  }, [labelRecords, noteRecords]);
  const summary = useMemo(() => {
    return deriveLabelsSummary(derivedRows);
  }, [derivedRows]);
  const visibleRows = useMemo(() => {
    return deriveVisibleLabelRows({
      filterValue,
      rows: derivedRows,
      searchQuery,
      sortValue,
    });
  }, [derivedRows, filterValue, searchQuery, sortValue]);
  const createParentOptions = useMemo(() => {
    return deriveSelectableParentOptions({
      rows: derivedRows,
      searchQuery: createParentSearchQuery,
      selectedParentIds: createParentIds,
    });
  }, [createParentIds, createParentSearchQuery, derivedRows]);
  const selectedCreateParentRows = useMemo(() => {
    return getRowsByIds(derivedRows, createParentIds);
  }, [createParentIds, derivedRows]);
  const editingLabelRecord = useMemo(() => {
    if (editingLabelId === null) {
      return null;
    }

    return (
      labelRecords.find((labelRecord) => labelRecord.id === editingLabelId) ??
      null
    );
  }, [editingLabelId, labelRecords]);
  const editingRow = useMemo(() => {
    if (editingLabelId === null) {
      return null;
    }

    return derivedRows.find((row) => row.id === editingLabelId) ?? null;
  }, [derivedRows, editingLabelId]);
  const editChildRows = useMemo(() => {
    if (editingLabelId === null) {
      return [];
    }

    return getChildRows({
      labelId: editingLabelId,
      labels: labelRecords,
      rows: derivedRows,
    });
  }, [derivedRows, editingLabelId, labelRecords]);
  const editBlockedParentIds = useMemo(() => {
    if (editingLabelId === null || currentUserId === null) {
      return [];
    }

    try {
      return normalizeLabelParentIds([
        editingLabelId,
        ...labels.getDescendantIds({
          labelId: editingLabelId,
          userId: currentUserId,
        }),
      ]);
    } catch {
      return [editingLabelId];
    }
  }, [currentUserId, editingLabelId, labels]);
  const editParentOptions = useMemo(() => {
    return deriveSelectableParentOptions({
      blockedParentIds: editBlockedParentIds,
      rows: derivedRows,
      searchQuery: editParentSearchQuery,
      selectedParentIds: editParentIds,
    });
  }, [derivedRows, editBlockedParentIds, editParentIds, editParentSearchQuery]);
  const selectedEditParentRows = useMemo(() => {
    return getRowsByIds(derivedRows, editParentIds);
  }, [derivedRows, editParentIds]);

  const hasLabels = summary.totalCount > 0;
  const normalizedSearchQuery = searchQuery.trim();
  const hasSearchQuery = normalizedSearchQuery.length > 0;
  const createNameIsValid = createName.trim().length > 0;
  const editNameIsValid = editName.trim().length > 0;
  const editDraftParentIds = useMemo(() => {
    return normalizeLabelParentIds(editParentIds);
  }, [editParentIds]);
  const editParentsAreDirty =
    editingLabelRecord !== null &&
    !parentIdsMatch(editingLabelRecord.parentIds, editParentIds);
  const editNameIsDirty =
    editingLabelRecord !== null && editName.trim() !== editingLabelRecord.name;
  const editIsDirty = editNameIsDirty || editParentsAreDirty;
  const canSaveEdit =
    editingLabelRecord !== null && editNameIsValid && editIsDirty;
  const isEditDrawerOpen = editingLabelId !== null;
  const createRelationshipPreview = formatCreatePreview({
    labelName: createName,
    parentNames: selectedCreateParentRows.map((row) => row.label),
  });
  const editUsageSummary =
    editingRow === null
      ? ""
      : formatEditUsageSummary({
          childCount: editingRow.childCount,
          label: editingRow.label,
          noteCount: editingRow.directNoteCount,
        });
  const summaryLabelsText = formatCount(summary.totalCount, "label");
  const summaryTopLevelText = `${summary.topLevelCount} top-level`;
  const summaryRelationshipsText = formatCount(
    summary.relationshipCount,
    "relationship",
  );
  const summaryUnusedText = formatCount(summary.unusedCount, "unused");

  async function handleEditLabel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (editingLabelId === null) {
      return;
    }

    await updateLabel({
      labelId: editingLabelId,
      name: editName,
      parentIds: editDraftParentIds,
    });
    closeEditDrawer();
  }

  return (
    <section className="labels-page" aria-labelledby="labels-route-heading">
      <header className="labels-management-header">
        <div className="labels-management-header__copy recall-surface__header">
          <div className="notes-editor__title-stack">
            <h3 id="labels-route-heading">Labels</h3>
            <p className="muted notes-editor__meta">
              Organize notes with reusable topics.
            </p>
          </div>
          {hasLabels ? (
            <section
              aria-label="Labels summary"
              className="labels-management-header__summary"
            >
              <div className="labels-management-header__summary-metrics">
                <span>{summaryLabelsText}</span>
                <span aria-hidden="true">·</span>
                <span>{summaryTopLevelText}</span>
                <span aria-hidden="true">·</span>
                <span>{summaryRelationshipsText}</span>
                <span aria-hidden="true">·</span>
                <span>{summaryUnusedText}</span>
              </div>
              <p className="labels-management-header__rules-note">
                Rules: multiple parents allowed, cycles blocked, deleting labels
                keeps notes.
              </p>
            </section>
          ) : null}
        </div>

        <div className="labels-management-header__actions">
          <FocusSessionStartControl
            activeFocusSession={activeFocusSession}
            actionButtonClassName="notes-action notes-action-primary"
            focus={focus}
            persistentFocus={persistentFocus}
            userId={currentUserId}
          />
          <button
            className="notes-action notes-action-primary"
            onClick={(event) => openEmptyCreateDrawer(event.currentTarget)}
            type="button"
          >
            New label
          </button>
        </div>
      </header>

      {feedbackMessage !== null ? (
        <p
          aria-label="Label management feedback"
          className="labels-feedback"
          id={feedbackMessageId}
          role="alert"
        >
          {feedbackMessage}
        </p>
      ) : null}

      {hasLabels ? (
        <section className="labels-toolbar" aria-label="Labels toolbar">
          <div className="labels-toolbar__search labels-input-with-icon">
            <SearchIcon />
            <label className="sr-only" htmlFor={searchInputId}>
              Search labels
            </label>
            <input
              autoComplete="off"
              id={searchInputId}
              name="search"
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearchQuery("");
                }
              }}
              placeholder="Search labels..."
              ref={searchInputRef}
              type="search"
              value={searchQuery}
            />
          </div>

          <label
            className="labels-field labels-field--control"
            htmlFor={filterSelectId}
          >
            <span className="sr-only">Filter labels</span>
            <select
              id={filterSelectId}
              onChange={handleFilterChange}
              value={filterValue}
            >
              <option value="all">All labels</option>
              <option value="top-level">Top-level</option>
              <option value="unused">Unused</option>
            </select>
          </label>
        </section>
      ) : null}

      <section
        className={`labels-table-shell shell-panel${
          hasLabels ? "" : " labels-table-shell--empty"
        }`}
      >
        {!hasLabels ? (
          <article className="labels-empty-state">
            <div className="labels-empty-state__icon" aria-hidden="true">
              <LabelTagIcon />
            </div>
            <h4>No labels yet</h4>
            <p className="muted">
              Create your first label to group related notes.
            </p>
            <button
              className="notes-action notes-action-primary"
              onClick={(event) => openEmptyCreateDrawer(event.currentTarget)}
              type="button"
            >
              New label
            </button>
          </article>
        ) : visibleRows.length === 0 ? (
          <article className="labels-empty-state labels-empty-state--search">
            <div className="labels-table-shell__state-header">
              Search results
            </div>
            <div className="labels-empty-state__content">
              <div className="labels-empty-state__icon" aria-hidden="true">
                <SearchIcon />
              </div>
              {hasSearchQuery ? (
                <h4>{`No label found for “${normalizedSearchQuery}”`}</h4>
              ) : (
                <h4>No labels match the current filters.</h4>
              )}
              <p className="muted">
                Create it now or clear the search to see all labels.
              </p>
              {hasSearchQuery ? (
                <button
                  className="notes-action notes-action-primary"
                  onClick={(event) =>
                    openCreateDrawerWithName(
                      normalizedSearchQuery,
                      event.currentTarget,
                    )
                  }
                  type="button"
                >
                  {`Create “${normalizedSearchQuery}”`}
                </button>
              ) : null}
            </div>
          </article>
        ) : (
          <div className="labels-table-scroll" data-labels-table-scroll="">
            <table aria-label="Labels list" className="labels-table">
              <thead>
                <tr>
                  <th
                    aria-sort={
                      sortValue === "name-asc" ? "ascending" : undefined
                    }
                    scope="col"
                  >
                    Label
                  </th>
                  <th scope="col">Parents</th>
                  <th
                    aria-sort={
                      sortValue === "children-desc" ? "descending" : undefined
                    }
                    scope="col"
                  >
                    <button
                      aria-label={getColumnSortButtonLabel({
                        columnLabel: "Children",
                        isActive: sortValue === "children-desc",
                      })}
                      className={`labels-table-sort-button${
                        sortValue === "children-desc"
                          ? " labels-table-sort-button--active"
                          : ""
                      }`}
                      onClick={() => handleCountColumnSort("children-desc")}
                      type="button"
                    >
                      <span>Children</span>
                      <SortDescendingIcon />
                    </button>
                  </th>
                  <th
                    aria-sort={
                      sortValue === "notes-desc" ? "descending" : undefined
                    }
                    scope="col"
                  >
                    <button
                      aria-label={getColumnSortButtonLabel({
                        columnLabel: "Notes",
                        isActive: sortValue === "notes-desc",
                      })}
                      className={`labels-table-sort-button${
                        sortValue === "notes-desc"
                          ? " labels-table-sort-button--active"
                          : ""
                      }`}
                      onClick={() => handleCountColumnSort("notes-desc")}
                      type="button"
                    >
                      <span>Notes</span>
                      <SortDescendingIcon />
                    </button>
                  </th>
                  <th scope="col">
                    <span className="sr-only">Row actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr
                    className={`labels-table__row${
                      openRowActionsLabelId === row.id
                        ? " labels-table__row--active"
                        : ""
                    }`}
                    key={row.id}
                    onClick={(event) =>
                      openEditDrawer(row.id, event.currentTarget)
                    }
                  >
                    <td className="labels-table__label-cell">
                      <button
                        className="labels-table__label-trigger"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditDrawer(row.id, event.currentTarget);
                        }}
                        type="button"
                      >
                        <LabelTagIcon />
                        <span>{row.label}</span>
                      </button>
                    </td>
                    <td>{formatParentNames(row.parentNames)}</td>
                    <td>
                      <span className="labels-count-badge">
                        {row.childCount}
                      </span>
                    </td>
                    <td>
                      <span className="labels-count-badge">
                        {row.directNoteCount}
                      </span>
                    </td>
                    <td>
                      <LabelRowActionsMenu
                        isOpen={openRowActionsLabelId === row.id}
                        label={row.label}
                        menuId={`labels-row-actions-menu-${row.id}`}
                        onClose={closeRowActionsMenu}
                        onDelete={() => openDeleteDialog(row)}
                        onDuplicate={() => {
                          void duplicateLabel(row.id);
                        }}
                        onEdit={() => openEditDrawer(row.id)}
                        onToggle={() => toggleRowActionsMenu(row.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isCreateDrawerOpen || isEditDrawerOpen ? (
        <div
          aria-hidden="true"
          className="labels-drawer-overlay"
          onClick={() => {
            if (isCreateDrawerOpen) {
              closeCreateDrawer();
              return;
            }

            closeEditDrawer();
          }}
        />
      ) : null}
      {isCreateDrawerOpen ? (
        <aside
          aria-describedby={createDrawerDescriptionId}
          aria-labelledby={createDrawerTitleId}
          aria-modal="true"
          className="labels-create-drawer labels-drawer shell-panel"
          onKeyDown={handleCreateDrawerKeyDown}
          role="dialog"
        >
          <header className="labels-create-drawer__header">
            <div>
              <h4 id={createDrawerTitleId}>New label</h4>
              <p className="muted" id={createDrawerDescriptionId}>
                Create a reusable topic for notes.
              </p>
            </div>
            <button
              aria-label="Close new label drawer"
              className="labels-icon-button"
              onClick={closeCreateDrawer}
              type="button"
            >
              <CloseIcon />
            </button>
          </header>

          <form
            aria-label="Create label form"
            className="labels-create-drawer__form"
            onSubmit={handleCreateLabel}
          >
            <div className="labels-create-drawer__body">
              <label className="labels-field" htmlFor={createInputId}>
                <span>Label name</span>
                <input
                  id={createInputId}
                  name="newLabelName"
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder="Example: Fitness"
                  ref={createInputRef}
                  required
                  type="text"
                  value={createName}
                />
              </label>

              <label
                className="labels-field"
                htmlFor={createParentSearchInputId}
              >
                <span>Parent labels</span>
                <input
                  aria-label="Search parent labels"
                  id={createParentSearchInputId}
                  name="searchParentLabels"
                  onChange={(event) =>
                    setCreateParentSearchQuery(event.target.value)
                  }
                  placeholder="Search parent labels..."
                  type="search"
                  value={createParentSearchQuery}
                />
              </label>

              {createParentSearchQuery.trim().length > 0 ? (
                <ul
                  aria-label="Parent label options"
                  className="labels-parent-options"
                >
                  {createParentOptions.length === 0 ? (
                    <li className="labels-parent-options__empty muted">
                      No matching parent labels.
                    </li>
                  ) : (
                    createParentOptions.map((option) => {
                      const noteCountLabel = formatCount(
                        option.directNoteCount,
                        "note",
                      );

                      return (
                        <li key={option.id}>
                          <button
                            aria-label={`${option.label} (${noteCountLabel})`}
                            className="labels-parent-option"
                            onClick={() => addCreateParent(option.id)}
                            type="button"
                          >
                            <span className="labels-parent-option__label">
                              <LabelTagIcon />
                              <span>{option.label}</span>
                            </span>
                            <span className="muted">{noteCountLabel}</span>
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              ) : null}

              <section className="labels-selected-parents">
                <p className="labels-drawer-section-title">Selected parents</p>
                {selectedCreateParentRows.length === 0 ? (
                  <p className="muted">No parent selected</p>
                ) : (
                  <ul aria-label="Selected parent labels" className="tag-row">
                    {selectedCreateParentRows.map((parentRow) => (
                      <li className="tag" key={parentRow.id}>
                        <span>{parentRow.label}</span>
                        <button
                          aria-label={`Remove ${parentRow.label}`}
                          className="labels-chip-remove"
                          onClick={() => removeCreateParent(parentRow.id)}
                          type="button"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section
                aria-label="Relationship preview"
                className="labels-preview-card"
              >
                <p className="labels-drawer-section-title">Preview</p>
                <p>{createRelationshipPreview}</p>
              </section>
            </div>

            <footer className="labels-create-drawer__footer">
              <button
                className="notes-action"
                onClick={closeCreateDrawer}
                type="button"
              >
                Cancel
              </button>
              <button
                className="notes-action notes-action-primary"
                disabled={!createNameIsValid}
                type="submit"
              >
                Create label
              </button>
            </footer>
          </form>
        </aside>
      ) : null}
      {isEditDrawerOpen && editingLabelRecord !== null ? (
        <aside
          aria-describedby={editDrawerDescriptionId}
          aria-labelledby={editDrawerTitleId}
          aria-modal="true"
          className="labels-create-drawer labels-drawer shell-panel"
          onKeyDown={handleEditDrawerKeyDown}
          role="dialog"
        >
          <header className="labels-create-drawer__header">
            <div>
              <h4 id={editDrawerTitleId}>Edit label</h4>
              <p className="muted" id={editDrawerDescriptionId}>
                {editUsageSummary}
              </p>
            </div>
            <button
              aria-label="Close edit label drawer"
              className="labels-icon-button"
              onClick={closeEditDrawer}
              type="button"
            >
              <CloseIcon />
            </button>
          </header>

          <form
            aria-label="Edit label form"
            className="labels-create-drawer__form"
            onSubmit={handleEditLabel}
          >
            <div className="labels-create-drawer__body">
              <label className="labels-field" htmlFor={editInputId}>
                <span>Label name</span>
                <input
                  id={editInputId}
                  name="editLabelName"
                  onChange={(event) => setEditName(event.target.value)}
                  placeholder="Example: Fitness"
                  ref={editInputRef}
                  required
                  type="text"
                  value={editName}
                />
              </label>

              <label className="labels-field" htmlFor={editParentSearchInputId}>
                <span>Parent labels</span>
                <input
                  aria-label="Search parent labels"
                  id={editParentSearchInputId}
                  name="searchParentLabelsForEdit"
                  onChange={(event) =>
                    setEditParentSearchQuery(event.target.value)
                  }
                  placeholder="Search parent labels..."
                  type="search"
                  value={editParentSearchQuery}
                />
              </label>

              {editParentSearchQuery.trim().length > 0 ? (
                <ul
                  aria-label="Parent label options"
                  className="labels-parent-options"
                >
                  {editParentOptions.length === 0 ? (
                    <li className="labels-parent-options__empty muted">
                      No matching parent labels.
                    </li>
                  ) : (
                    editParentOptions.map((option) => {
                      const noteCountLabel = formatCount(
                        option.directNoteCount,
                        "note",
                      );

                      return (
                        <li key={option.id}>
                          <button
                            aria-label={`${option.label} (${noteCountLabel})`}
                            className="labels-parent-option"
                            onClick={() => addEditParent(option.id)}
                            type="button"
                          >
                            <span className="labels-parent-option__label">
                              <LabelTagIcon />
                              <span>{option.label}</span>
                            </span>
                            <span className="muted">{noteCountLabel}</span>
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              ) : null}

              <section className="labels-selected-parents">
                <p className="labels-drawer-section-title">Selected parents</p>
                {selectedEditParentRows.length === 0 ? (
                  <p className="muted">No parent selected</p>
                ) : (
                  <ul aria-label="Selected parent labels" className="tag-row">
                    {selectedEditParentRows.map((parentRow) => (
                      <li className="tag" key={parentRow.id}>
                        <span>{parentRow.label}</span>
                        <button
                          aria-label={`Remove ${parentRow.label}`}
                          className="labels-chip-remove"
                          onClick={() => removeEditParent(parentRow.id)}
                          type="button"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section
                aria-label="Child labels"
                className="labels-preview-card labels-child-labels"
              >
                <p className="labels-drawer-section-title">Child labels</p>
                {editChildRows.length === 0 ? (
                  <p className="muted">No child labels</p>
                ) : (
                  <ul aria-label="Child labels">
                    {editChildRows.map((childRow) => (
                      <li key={childRow.id}>
                        <span className="labels-parent-option__label">
                          <LabelTagIcon />
                          <span>{childRow.label}</span>
                        </span>
                        <span className="muted">
                          {formatCount(childRow.directNoteCount, "note")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-label="Danger zone" className="labels-danger-zone">
                <p className="labels-drawer-section-title">Danger zone</p>
                <div className="labels-danger-zone__panel">
                  <div>
                    <p>Delete this label</p>
                    <p className="muted">
                      Notes will stay available. Relationships will be removed.
                    </p>
                  </div>
                  <button
                    aria-label="Delete label"
                    className="notes-action notes-action-danger"
                    onClick={() => {
                      if (editingRow !== null) {
                        openDeleteDialog(editingRow);
                      }
                    }}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </section>
            </div>

            <footer className="labels-create-drawer__footer">
              <button
                className="notes-action"
                onClick={closeEditDrawer}
                type="button"
              >
                Cancel
              </button>
              <button
                className="notes-action notes-action-primary"
                disabled={!canSaveEdit}
                type="submit"
              >
                Save changes
              </button>
            </footer>
          </form>
        </aside>
      ) : null}
      {pendingDeleteDraft !== null ? (
        <DeleteLabelDialog
          descriptionId={deleteDialogDescriptionId}
          draft={pendingDeleteDraft}
          onClose={closeDeleteDialog}
          onConfirm={handleConfirmDelete}
          titleId={deleteDialogTitleId}
        />
      ) : null}
    </section>
  );
}

function DeleteLabelDialog({
  descriptionId,
  draft,
  onClose,
  onConfirm,
  titleId,
}: DeleteLabelDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      onClose();
    }
  }

  return (
    <div className="labels-delete-dialog" role="presentation">
      <button
        aria-label="Close delete confirmation"
        className="labels-delete-dialog__backdrop"
        onClick={onClose}
        type="button"
      />
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="labels-delete-dialog__panel shell-panel"
        onKeyDown={handleKeyDown}
        role="dialog"
      >
        <div className="labels-delete-dialog__heading">
          <span className="labels-delete-dialog__warning" aria-hidden="true">
            <TrashIcon />
          </span>
          <div>
            <h4 id={titleId}>{`Delete “${draft.label}”?`}</h4>
            <p id={descriptionId}>{formatDeleteImpactSummary(draft)}</p>
          </div>
        </div>
        <div className="labels-delete-dialog__body">
          <div className="labels-delete-dialog__safety-note">
            <p>Notes will not be deleted.</p>
            <p>Only the label and its relationships are removed.</p>
          </div>
        </div>
        <div className="labels-delete-dialog__actions">
          <button
            className="notes-action"
            onClick={onClose}
            ref={cancelButtonRef}
            type="button"
          >
            Cancel
          </button>
          <button
            className="notes-action notes-action-danger"
            onClick={() => {
              void onConfirm();
            }}
            type="button"
          >
            Delete label
          </button>
        </div>
      </div>
    </div>
  );
}

function LabelRowActionsMenu({
  isOpen,
  label,
  menuId,
  onClose,
  onDelete,
  onDuplicate,
  onEdit,
  onToggle,
}: LabelRowActionsMenuProps) {
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const menuPopoverRef = useRef<HTMLDivElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const [menuDirection, setMenuDirection] = useState<"down" | "up">("down");

  const updateMenuDirection = useCallback(() => {
    if (!isOpen) {
      return;
    }

    const triggerButton = triggerButtonRef.current;
    const menuPopover = menuPopoverRef.current;

    if (triggerButton === null || menuPopover === null) {
      return;
    }

    const triggerRect = triggerButton.getBoundingClientRect();
    const popoverHeight =
      menuPopover.offsetHeight || menuPopover.getBoundingClientRect().height;
    const shellElement = menuContainerRef.current?.closest(
      "[data-labels-table-scroll]",
    );
    const shellRect =
      shellElement instanceof HTMLElement
        ? shellElement.getBoundingClientRect()
        : null;
    const topBoundary = shellRect?.top ?? 0;
    const bottomBoundary = shellRect?.bottom ?? window.innerHeight;
    const spaceAbove = triggerRect.top - topBoundary;
    const spaceBelow = bottomBoundary - triggerRect.bottom;
    const minimumGap = 12;
    const shouldOpenUpward =
      spaceBelow < popoverHeight + minimumGap && spaceAbove > spaceBelow;

    setMenuDirection(shouldOpenUpward ? "up" : "down");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setMenuDirection("down");
      return;
    }

    updateMenuDirection();

    const menuContainer = menuContainerRef.current;
    const shellElement = menuContainer?.closest("[data-labels-table-scroll]");
    const handleLayoutChange = () => {
      updateMenuDirection();
    };

    window.addEventListener("resize", handleLayoutChange);
    window.addEventListener("scroll", handleLayoutChange, true);

    if (shellElement instanceof HTMLElement) {
      shellElement.addEventListener("scroll", handleLayoutChange);
    }

    return () => {
      window.removeEventListener("resize", handleLayoutChange);
      window.removeEventListener("scroll", handleLayoutChange, true);

      if (shellElement instanceof HTMLElement) {
        shellElement.removeEventListener("scroll", handleLayoutChange);
      }
    };
  }, [isOpen, updateMenuDirection]);

  function closeMenuAndRestoreFocus() {
    triggerButtonRef.current?.focus();
    onClose();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenuAndRestoreFocus();
    }
  }

  function runMenuAction(action: () => void) {
    closeMenuAndRestoreFocus();
    action();
  }

  return (
    <div
      className={`labels-row-menu${
        isOpen && menuDirection === "up" ? " labels-row-menu--open-upward" : ""
      }`}
      data-row-actions-menu=""
      ref={menuContainerRef}
    >
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Row actions for ${label}`}
        className="notes-icon-button labels-row-menu__trigger"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        onKeyDown={handleKeyDown}
        ref={triggerButtonRef}
        type="button"
      >
        <RowActionsIcon />
      </button>
      {isOpen ? (
        <div
          aria-label={`Row actions for ${label}`}
          className="labels-row-menu__popover shell-panel"
          id={menuId}
          onClick={(event) => {
            event.stopPropagation();
          }}
          onKeyDown={handleKeyDown}
          ref={menuPopoverRef}
          role="menu"
        >
          <button
            className="labels-row-menu__item"
            onClick={() => runMenuAction(onEdit)}
            role="menuitem"
            type="button"
          >
            <EditIcon />
            <span>Edit label</span>
          </button>
          <button
            className="labels-row-menu__item"
            onClick={() => runMenuAction(onDuplicate)}
            role="menuitem"
            type="button"
          >
            <PlusIcon />
            <span>Duplicate</span>
          </button>
          <button
            className="labels-row-menu__item labels-row-menu__item--danger"
            onClick={() => runMenuAction(onDelete)}
            role="menuitem"
            type="button"
          >
            <TrashIcon />
            <span>Delete label</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function RowActionsIcon() {
  return (
    <svg
      aria-hidden="true"
      className="labels-row-menu__icon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="labels-inline-icon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function SortDescendingIcon() {
  return (
    <svg
      aria-hidden="true"
      className="labels-inline-icon labels-table-sort-button__icon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M12 5v14" />
      <path d="m7 14 5 5 5-5" />
      <path d="M5 7h6" />
      <path d="M5 11h4" />
    </svg>
  );
}

function LabelTagIcon() {
  return (
    <svg
      aria-hidden="true"
      className="labels-tag-icon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M20 12 12 20H5V13L13 5h5l2 2z" />
      <circle cx="15" cy="9" r="1.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="labels-inline-icon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      aria-hidden="true"
      className="labels-inline-icon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="m15 5 4 4" />
      <path d="M5 19h4L19 9l-4-4L5 15z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      className="labels-inline-icon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      className="labels-inline-icon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 14h10l1-14" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}
