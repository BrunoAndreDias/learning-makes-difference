import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import {
  type ChangeEvent,
  type FormEvent,
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
import { listNotesForUser } from "../../notes";
import { type AppLabel, AppLabelError } from "./labels";
import {
  type DerivedLabelRow,
  deriveLabelRows,
  deriveLabelsSummary,
  deriveVisibleLabelRows,
  type LabelsFilterValue,
  type LabelsSortValue,
  parseLabelsFilterValue,
  parseLabelsSortValue,
} from "./labels-management-view";

export const Route = createFileRoute("/_protected/labels")({
  component: LabelsPage,
});

function formatParentNames(parentNames: readonly string[]) {
  if (parentNames.length === 0) {
    return "—";
  }

  return parentNames.join(", ");
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
  const currentUserId = sessionSnapshot.user?.id ?? null;

  const [labelRecords, setLabelRecords] = useState<AppLabel[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterValue, setFilterValue] = useState<LabelsFilterValue>("all");
  const [sortValue, setSortValue] = useState<LabelsSortValue>("name-asc");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isRulesOpen, setRulesOpen] = useState(false);
  const [isCreateFormOpen, setCreateFormOpen] = useState(false);
  const [createName, setCreateName] = useState("");

  const rulesPopoverId = useId();
  const createInputId = useId();
  const feedbackMessageId = useId();
  const filterSelectId = useId();
  const searchInputId = useId();
  const sortSelectId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

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
    if (!isCreateFormOpen) {
      return;
    }

    createInputRef.current?.focus();
  }, [isCreateFormOpen]);

  async function runLabelAction(action: () => void | Promise<void>) {
    try {
      await action();
      setFeedbackMessage(null);
    } catch (error) {
      handleError(error);
    }
  }

  async function handleCreateLabel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (currentUserId === null) {
      return;
    }

    await runLabelAction(async () => {
      if (persistentLabelsContext === undefined) {
        labels.createLabel({
          name: createName,
          userId: currentUserId,
        });
      } else {
        await persistentLabelsContext.createLabel(currentUserId, {
          name: createName,
        });
      }

      setCreateName("");
      setCreateFormOpen(false);
    });
  }

  async function renameLabel(labelId: string, name: string) {
    if (currentUserId === null) {
      return;
    }

    await runLabelAction(async () => {
      if (persistentLabelsContext === undefined) {
        labels.renameLabel({
          labelId,
          name,
          userId: currentUserId,
        });
        return;
      }

      await persistentLabelsContext.renameLabel(currentUserId, labelId, name);
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

  function handleFilterChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextFilterValue = parseLabelsFilterValue(event.target.value);

    if (nextFilterValue !== null) {
      setFilterValue(nextFilterValue);
    }
  }

  function handleSortChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextSortValue = parseLabelsSortValue(event.target.value);

    if (nextSortValue !== null) {
      setSortValue(nextSortValue);
    }
  }

  function handleRenameRow(row: DerivedLabelRow) {
    const nextName = window.prompt("Label name", row.label);

    if (nextName === null) {
      return;
    }

    void renameLabel(row.id, nextName);
  }

  function handleDeleteRow(row: DerivedLabelRow) {
    const isConfirmed = window.confirm(
      `Delete label "${row.label}"? Notes will not be deleted.`,
    );

    if (!isConfirmed) {
      return;
    }

    void deleteLabel(row.id);
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

  const hasLabels = summary.totalCount > 0;
  const summaryLabelsText = formatCount(summary.totalCount, "label");
  const summaryTopLevelText = `${summary.topLevelCount} top-level`;
  const summaryRelationshipsText = formatCount(
    summary.relationshipCount,
    "relationship",
  );
  const summaryUnusedText = formatCount(summary.unusedCount, "unused");

  return (
    <section className="labels-page" aria-labelledby="labels-route-heading">
      <header className="labels-management-header shell-panel">
        <div className="labels-management-header__copy">
          <h3 id="labels-route-heading">Labels</h3>
          <p className="muted">Organize notes with reusable topics.</p>
          <section
            aria-label="Labels summary"
            className="labels-management-header__summary tag-row"
          >
            <span className="tag">{summaryLabelsText}</span>
            <span className="tag">{summaryTopLevelText}</span>
            <span className="tag">{summaryRelationshipsText}</span>
            <span className="tag">{summaryUnusedText}</span>
          </section>
        </div>

        <div className="labels-management-header__actions">
          <div className="labels-rules-popover">
            <button
              aria-controls={rulesPopoverId}
              aria-expanded={isRulesOpen}
              className="labels-button"
              onClick={() => setRulesOpen((value) => !value)}
              type="button"
            >
              Label rules
            </button>
            {isRulesOpen ? (
              <article
                aria-label="Label rules"
                className="labels-rules-popover__content"
                id={rulesPopoverId}
              >
                <ul>
                  <li>Labels can have more than one parent.</li>
                  <li>Circular relationships are blocked automatically.</li>
                  <li>Deleting a label never deletes notes.</li>
                </ul>
              </article>
            ) : null}
          </div>

          {hasLabels ? (
            <button
              className="labels-button labels-button--primary"
              onClick={() => setCreateFormOpen(true)}
              type="button"
            >
              New label
            </button>
          ) : null}
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

      {isCreateFormOpen || !hasLabels ? (
        <article className="labels-create-inline shell-panel">
          <h4>{hasLabels ? "New label" : "No labels yet"}</h4>
          <p className="muted">
            {hasLabels
              ? "Create a reusable topic for notes."
              : "Create your first label to group related notes."}
          </p>
          <form
            aria-label="Create label form"
            className="labels-create-inline__form"
            onSubmit={handleCreateLabel}
          >
            <label className="labels-field" htmlFor={createInputId}>
              <span>Label name</span>
              <input
                id={createInputId}
                name="newLabelName"
                onChange={(event) => setCreateName(event.target.value)}
                placeholder="e.g. Biology"
                ref={createInputRef}
                required
                type="text"
                value={createName}
              />
            </label>
            <div className="labels-create-inline__actions">
              <button
                className="labels-button labels-button--primary"
                disabled={createName.trim().length === 0}
                type="submit"
              >
                Create label
              </button>
              {hasLabels ? (
                <button
                  className="labels-button"
                  onClick={() => {
                    setCreateFormOpen(false);
                    setCreateName("");
                  }}
                  type="button"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </article>
      ) : null}

      {hasLabels ? (
        <section
          className="labels-toolbar shell-panel"
          aria-label="Labels toolbar"
        >
          <div className="labels-toolbar__search">
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

          <label className="labels-field" htmlFor={filterSelectId}>
            <span>Filter labels</span>
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

          <label className="labels-field" htmlFor={sortSelectId}>
            <span>Sort labels</span>
            <select
              id={sortSelectId}
              onChange={handleSortChange}
              value={sortValue}
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="notes-desc">Notes (high-low)</option>
              <option value="children-desc">Children (high-low)</option>
            </select>
          </label>
        </section>
      ) : null}

      {hasLabels ? (
        <section className="labels-table-shell shell-panel">
          {visibleRows.length === 0 ? (
            <article className="labels-empty-card">
              <p className="section-label">No labels found</p>
              <h4>No label found for "{searchQuery.trim()}"</h4>
              <p className="muted">
                Create it now or clear the search to see all labels.
              </p>
            </article>
          ) : (
            <div className="labels-table-scroll">
              <table aria-label="Labels list" className="labels-table">
                <thead>
                  <tr>
                    <th scope="col">Label</th>
                    <th scope="col">Parents</th>
                    <th scope="col">Children</th>
                    <th scope="col">Notes</th>
                    <th scope="col">Row actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.id}>
                      <td className="labels-table__label-cell">{row.label}</td>
                      <td>{formatParentNames(row.parentNames)}</td>
                      <td>{row.childCount}</td>
                      <td>{row.directNoteCount}</td>
                      <td>
                        <div className="labels-table__actions">
                          <button
                            className="labels-button labels-button--inline"
                            onClick={() => handleRenameRow(row)}
                            type="button"
                          >
                            Edit label
                          </button>
                          <button
                            className="labels-button labels-button--inline labels-button--danger"
                            onClick={() => handleDeleteRow(row)}
                            type="button"
                          >
                            Delete label
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </section>
  );
}
