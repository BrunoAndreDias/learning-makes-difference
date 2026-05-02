import {
  createFileRoute,
  Link,
  Navigate,
  Outlet,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import {
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { formatCount } from "../../../lib/format-count";
import { isModifiedKeyShortcut } from "../../../lib/keyboard";
import type { AppSessionSnapshot } from "../../access/domain/session";
import type { AppLabel } from "../../labels/domain/labels";
import { AppFocusError } from "../domain/focus";
import { formatSearchMatchLabel } from "../domain/learner-copy";
import {
  type AppNoteSearchResult,
  formatNoteSearchResultPreview,
  searchNoteResults,
} from "../domain/note-search";
import { listNotesForUser } from "../domain/notes";
import { AppRecallError } from "../domain/recall";
import {
  deriveRecallSetupState,
  type RecallSetupAvailableEmptyState,
  type RecallSetupCandidate,
  type RecallSetupFilter,
  type RecallSetupFilterSummary,
  type RecallSetupSelectedSummary,
} from "../domain/recall-setup";

const NOTE_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const recallSelectionSearchListboxId = "recall-selection-search-results";

export const Route = createFileRoute("/_protected/recall")({
  component: RecallRouteShell,
  notFoundComponent: RecallRouteNotFoundRedirect,
});

function RecallRouteNotFoundRedirect() {
  return <Navigate to="/notes" />;
}

function formatNoteDate(value: string): string {
  return NOTE_DATE_FORMATTER.format(new Date(value));
}

function formatSelectedCount(count: number) {
  return `${formatCount(count, "note")} selected`;
}

function formatSummarySelectedCount(count: number) {
  return `${count} selected`;
}

function getSearchResultLabel(result: AppNoteSearchResult) {
  const preview = formatNoteSearchResultPreview(result);

  return `${result.note.title} ${formatSearchMatchLabel(result.matchChip)}${preview === null ? "" : ` ${preview}`} Updated ${formatNoteDate(result.note.updatedAt)}`;
}

function getRecallSelectionSearchResultOptionId(noteId: string, index: number) {
  return `recall-selection-search-option-${noteId}-${index}`;
}

function isSelectedFilter(
  currentFilter: RecallSetupFilter,
  candidateFilter: RecallSetupFilter,
) {
  if (currentFilter.kind !== candidateFilter.kind) {
    return false;
  }

  if (currentFilter.kind !== "label" || candidateFilter.kind !== "label") {
    return true;
  }

  return currentFilter.labelId === candidateFilter.labelId;
}

function getFilterButtonLabel(filterSummary: RecallSetupFilterSummary) {
  switch (filterSummary.kind) {
    case "all":
      return "All notes";
    case "due":
      return "Due now";
    case "recent":
      return "Recent notes";
    case "weak":
      return "Weak notes";
    case "label":
      return filterSummary.labelName;
  }
}

function getFilterButtonKey(filterSummary: RecallSetupFilterSummary) {
  return filterSummary.kind === "label"
    ? `${filterSummary.kind}-${filterSummary.labelId}`
    : filterSummary.kind;
}

function toFilter(summary: RecallSetupFilterSummary): RecallSetupFilter {
  if (summary.kind === "label") {
    return {
      kind: "label",
      labelId: summary.labelId,
    };
  }

  return {
    kind: summary.kind,
  };
}

function getAvailableNotesEmptyMessage({
  availableEmptyState,
  hasSearchQuery,
}: {
  availableEmptyState: RecallSetupAvailableEmptyState;
  hasSearchQuery: boolean;
}): string | null {
  switch (availableEmptyState) {
    case "no-search-matches":
      return "No notes match this search.";
    case "no-filter-matches":
      return hasSearchQuery
        ? "No notes match this search."
        : "No notes match this filter yet.";
    case "no-notes":
      return "No recallable notes yet.";
    case "none":
      return null;
  }
}

function EmptyRecallSelectionPage() {
  return (
    <section className="recall-workspace">
      <article className="recall-surface">
        <p className="section-label">Recall</p>
        <h3>No recallable notes yet</h3>
        <p>Create notes first, then come back to build a recall session.</p>
        <Link className="notes-action notes-action-primary" to="/notes">
          Go to Notes
        </Link>
      </article>
    </section>
  );
}

function RecallRouteShell() {
  return <Outlet />;
}

function RecallSelectionControls({
  hasActiveFocusSession,
  hasSelectedNotes,
  onStartFocus,
  startDisabledReason,
  onCancel,
  onStartRecall,
  selectedCountLabel,
}: {
  hasActiveFocusSession: boolean;
  hasSelectedNotes: boolean;
  onStartFocus: () => void;
  startDisabledReason: string | null;
  onCancel: () => void;
  onStartRecall: () => void;
  selectedCountLabel: string;
}) {
  return (
    <div>
      <fieldset
        aria-label="Recall selection controls"
        className="tag-row recall-selection-controls"
      >
        <span className="tag">{selectedCountLabel}</span>
        <button className="notes-action" onClick={onCancel} type="button">
          Cancel
        </button>
        {hasActiveFocusSession ? null : (
          <button
            className="notes-action"
            disabled={!hasSelectedNotes}
            onClick={onStartFocus}
            type="button"
          >
            Start focus for this session
          </button>
        )}
        <button
          aria-describedby={
            hasSelectedNotes ? undefined : "recall-start-disabled-reason"
          }
          className="notes-action notes-action-primary"
          disabled={!hasSelectedNotes}
          onClick={onStartRecall}
          type="button"
        >
          Start recall
        </button>
      </fieldset>
      {startDisabledReason !== null ? (
        <p className="muted" id="recall-start-disabled-reason">
          {startDisabledReason}
        </p>
      ) : null}
    </div>
  );
}

function RecallSelectionSearchResults({
  activeSearchResultIndex,
  isOpen,
  onToggleNote,
  searchResults,
  selectedNoteIds,
}: {
  activeSearchResultIndex: number;
  isOpen: boolean;
  onToggleNote: (noteId: string) => void;
  searchResults: AppNoteSearchResult[];
  selectedNoteIds: ReadonlySet<string>;
}) {
  if (!isOpen) {
    return null;
  }

  if (searchResults.length === 0) {
    return (
      <p className="notes-search__empty" role="status">
        No notes found
      </p>
    );
  }

  return (
    <div
      aria-label="Recall selection matches"
      className="notes-search__results recall-search-results"
      id={recallSelectionSearchListboxId}
      aria-multiselectable="true"
      role="listbox"
    >
      {searchResults.map((result, index) => {
        const isSelected = selectedNoteIds.has(result.note.id);
        const preview = formatNoteSearchResultPreview(result);

        return (
          <button
            aria-label={`${isSelected ? "Selected, " : ""}${getSearchResultLabel(result)}`}
            aria-selected={isSelected}
            className="notes-search__option"
            data-active={index === activeSearchResultIndex ? "true" : undefined}
            id={getRecallSelectionSearchResultOptionId(result.note.id, index)}
            key={`${result.note.id}-${result.matchChip}`}
            onClick={() => onToggleNote(result.note.id)}
            role="option"
            tabIndex={-1}
            type="button"
          >
            <span className="notes-search__option-title">
              <strong>{result.note.title}</strong>
              <span className="notes-search__match-chip">
                {formatSearchMatchLabel(result.matchChip)}
              </span>
            </span>
            {preview === null ? null : <span>{preview}</span>}
            <span>{`Updated ${formatNoteDate(result.note.updatedAt)}`}</span>
          </button>
        );
      })}
    </div>
  );
}

function RecallSelectionFilters({
  activeFilter,
  filterSummaries,
  onSelectFilter,
}: {
  activeFilter: RecallSetupFilter;
  filterSummaries: RecallSetupFilterSummary[];
  onSelectFilter: (filter: RecallSetupFilter) => void;
}) {
  return (
    <section aria-label="Recall setup filters" className="tag-row">
      {filterSummaries.map((filterSummary) => {
        const filter = toFilter(filterSummary);
        const label = getFilterButtonLabel(filterSummary);

        return (
          <button
            aria-pressed={isSelectedFilter(activeFilter, filter)}
            className="tag"
            key={getFilterButtonKey(filterSummary)}
            onClick={() => onSelectFilter(filter)}
            type="button"
          >
            {`${label} (${filterSummary.count})`}
          </button>
        );
      })}
    </section>
  );
}

function RecallSetupSummary({
  difficultyLabel,
  estimatedTimeLabel,
  practiceTypeLabel,
  selectedCount,
}: {
  difficultyLabel: string;
  estimatedTimeLabel: string;
  practiceTypeLabel: string;
  selectedCount: string;
}) {
  return (
    <section aria-label="Session summary" className="recall-panel">
      <div className="notes-list__header">
        <div className="stack">
          <p className="section-label">Setup</p>
          <h4>Session summary</h4>
          <p className="muted">
            One honest recall prompt per note. Rate yourself after reveal.
          </p>
        </div>
      </div>
      <div className="tag-row notes-editor__labels">
        <span className="tag">{selectedCount}</span>
        <span className="tag">{estimatedTimeLabel}</span>
        <span className="tag">{practiceTypeLabel}</span>
        <span className="tag">{difficultyLabel}</span>
      </div>
    </section>
  );
}

function SelectableRecallNotes({
  availableEmptyState,
  candidates,
  hasSearchQuery,
  onToggleNote,
}: {
  availableEmptyState: RecallSetupAvailableEmptyState;
  candidates: RecallSetupCandidate[];
  hasSearchQuery: boolean;
  onToggleNote: (noteId: string) => void;
}) {
  const emptyStateMessage = getAvailableNotesEmptyMessage({
    availableEmptyState,
    hasSearchQuery,
  });

  return (
    <section aria-label="Available notes" className="recall-panel notes-list">
      <div className="notes-list__header">
        <div className="stack">
          <p className="section-label">Available</p>
          <h4>Choose notes</h4>
          <p className="muted">
            Review what can go into this session. Selected notes stay in the
            setup tray.
          </p>
        </div>
        <span className="tag">{`${candidates.length} shown`}</span>
      </div>
      {emptyStateMessage !== null ? (
        <p className="notes-search__empty" role="status">
          {emptyStateMessage}
        </p>
      ) : (
        <ul aria-label="Recallable notes" className="notes-list__items">
          {candidates.map((candidate) => {
            const note = candidate.note;

            return (
              <li key={note.id}>
                <button
                  aria-label={`${candidate.isSelected ? "Remove" : "Select"} ${note.title}`}
                  aria-pressed={candidate.isSelected}
                  className="notes-list__item"
                  data-active={candidate.isSelected ? "true" : undefined}
                  onClick={() => onToggleNote(note.id)}
                  type="button"
                >
                  <span className="notes-search__option-title">
                    <strong>{note.title}</strong>
                    <span className="notes-search__match-chip">
                      {candidate.isSelected ? "Selected" : "Available"}
                    </span>
                  </span>
                  <span>{note.body}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function SelectedRecallNotes({
  onRemoveNote,
  selectedEmptyState,
  selectedNotes,
}: {
  onRemoveNote: (noteId: string) => void;
  selectedEmptyState: "none" | "no-selected-notes";
  selectedNotes: RecallSetupSelectedSummary[];
}) {
  return (
    <section aria-label="Selected notes" className="recall-panel notes-list">
      <div className="notes-list__header">
        <div className="stack">
          <p className="section-label">Selected</p>
          <h4>Review the session tray</h4>
          <p className="muted">
            Remove anything you do not want before you start.
          </p>
        </div>
        <span className="tag">{formatCount(selectedNotes.length, "note")}</span>
      </div>
      {selectedEmptyState === "no-selected-notes" ? (
        <p className="notes-search__empty" role="status">
          No notes selected yet.
        </p>
      ) : (
        <ul className="notes-list__items">
          {selectedNotes.map((note) => (
            <li key={note.id}>
              <div className="notes-list__item" data-active="true">
                <div className="stack">
                  <strong>{note.title}</strong>
                  <span>
                    {note.labelNames.length > 0
                      ? note.labelNames.join(", ")
                      : "No label"}
                  </span>
                </div>
                <button
                  aria-label={`Remove ${note.title} from recall setup`}
                  className="notes-action"
                  onClick={() => onRemoveNote(note.id)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function RecallSelectionPage() {
  const navigate = useNavigate();
  const focusContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.focus,
  });
  const labelsContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.labels,
  });
  const notesContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.notes,
  });
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
  });
  const sessionContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.session,
  });
  const sessionSnapshot = useSyncExternalStore<AppSessionSnapshot>(
    sessionContext.subscribe,
    sessionContext.getSnapshot,
    sessionContext.getSnapshot,
  );
  useSyncExternalStore(
    focusContext.subscribe,
    focusContext.getSnapshot,
    focusContext.getSnapshot,
  );
  const userId = sessionSnapshot.user?.id ?? null;
  const activeFocusSession =
    userId === null ? null : focusContext.getActiveSession({ userId });
  const notesSnapshot = useSyncExternalStore(
    notesContext.subscribe,
    notesContext.getSnapshot,
    notesContext.getSnapshot,
  );
  const notes = listNotesForUser(notesSnapshot, userId);
  const labels: readonly AppLabel[] =
    userId === null ? [] : labelsContext.getLabelsForUser(userId);
  const sessionResults =
    userId === null ? [] : recallContext.listSessionResults({ userId });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<RecallSetupFilter>({
    kind: "all",
  });
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchRootRef = useRef<HTMLFormElement | null>(null);
  const searchResults = searchNoteResults(notes, searchQuery);
  const setupState = deriveRecallSetupState({
    labels,
    notes,
    now: new Date().toISOString(),
    searchQuery,
    selectedFilter,
    selectedNoteIds,
    sessionResults,
  });
  const selectedCountLabel = formatSelectedCount(selectedNoteIds.length);
  const hasSearchQuery = searchQuery.trim().length > 0;
  const noteCountLabel = formatCount(notes.length, "note");
  const isSearchListboxOpen =
    hasSearchQuery && isSearchOpen && searchResults.length > 0;
  const activeSearchResult = searchResults[activeSearchResultIndex];
  const selectedNoteIdSet = new Set(selectedNoteIds);
  const activeSearchOptionId =
    isSearchListboxOpen && activeSearchResult !== undefined
      ? getRecallSelectionSearchResultOptionId(
          activeSearchResult.note.id,
          activeSearchResultIndex,
        )
      : undefined;

  useEffect(() => {
    if (searchResults.length === 0) {
      setActiveSearchResultIndex(0);
      return;
    }

    setActiveSearchResultIndex((currentIndex) =>
      Math.min(currentIndex, searchResults.length - 1),
    );
  }, [searchResults.length]);

  useEffect(() => {
    function handleDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (!isModifiedKeyShortcut(event, "k")) {
        return;
      }

      event.preventDefault();
      searchInputRef.current?.focus();

      const currentSearchValue = searchInputRef.current?.value ?? "";

      if (currentSearchValue.trim().length > 0) {
        setActiveSearchResultIndex(0);
        setIsSearchOpen(true);
      }
    }

    document.addEventListener("keydown", handleDocumentKeyDown);

    return () => {
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, []);

  useEffect(() => {
    function handleDocumentMouseDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (searchRootRef.current?.contains(target)) {
        return;
      }

      setIsSearchOpen(false);
    }

    document.addEventListener("mousedown", handleDocumentMouseDown);

    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, []);

  function toggleSelectedNote(noteId: string) {
    setSelectedNoteIds((currentNoteIds) =>
      currentNoteIds.includes(noteId)
        ? currentNoteIds.filter((currentNoteId) => currentNoteId !== noteId)
        : [...currentNoteIds, noteId],
    );
    setErrorMessage(null);
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    setActiveSearchResultIndex(0);
    setIsSearchOpen(value.trim().length > 0);
  }

  function resetSearchState() {
    setSearchQuery("");
    setIsSearchOpen(false);
    setActiveSearchResultIndex(0);
  }

  function handleSelectActiveSearchResult() {
    const result = searchResults[activeSearchResultIndex];

    if (result !== undefined) {
      toggleSelectedNote(result.note.id);
    }
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "Escape":
        setIsSearchOpen(false);
        return;
      case "ArrowDown":
        if (!isSearchOpen || searchResults.length === 0) {
          return;
        }

        event.preventDefault();
        setActiveSearchResultIndex(
          (currentIndex) => (currentIndex + 1) % searchResults.length,
        );
        return;
      case "ArrowUp":
        if (!isSearchOpen || searchResults.length === 0) {
          return;
        }

        event.preventDefault();
        setActiveSearchResultIndex(
          (currentIndex) =>
            (currentIndex - 1 + searchResults.length) % searchResults.length,
        );
        return;
      case "Enter":
        if (!isSearchOpen || searchResults.length === 0) {
          return;
        }

        event.preventDefault();
        handleSelectActiveSearchResult();
        return;
      default:
        return;
    }
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleSelectActiveSearchResult();
  }

  function handleSearchPointerDown(event: ReactPointerEvent<HTMLFormElement>) {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest(".notes-search__results")) {
      return;
    }

    if (target.closest(".notes-search__icon")) {
      return;
    }

    if (target !== searchInputRef.current) {
      event.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }

  async function handleCancel() {
    setSelectedNoteIds([]);
    setSelectedFilter({ kind: "all" });
    resetSearchState();
    setErrorMessage(null);
    await navigate({ to: "/recall" });
  }

  async function handleStartRecall() {
    if (userId === null || selectedNoteIds.length === 0) {
      return;
    }

    try {
      recallContext.startFlashCardSession({
        noteIds: selectedNoteIds,
        userId,
      });
      setErrorMessage(null);
      await navigate({ to: "/recall/session" });
    } catch (error) {
      if (error instanceof AppRecallError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    }
  }

  function handleStartFocus() {
    if (userId === null || selectedNoteIds.length === 0) {
      return;
    }

    try {
      focusContext.startFocusSession({
        userId,
      });
      setErrorMessage(null);
    } catch (error) {
      if (error instanceof AppFocusError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    }
  }

  if (notes.length === 0) {
    return <EmptyRecallSelectionPage />;
  }

  return (
    <section
      aria-label="Recall selection workspace"
      className="recall-workspace"
    >
      <article className="recall-surface">
        <header className="recall-surface__header">
          <div className="notes-editor__title-stack">
            <p className="section-label">Recall</p>
            <h3>Recall setup</h3>
            <p className="muted notes-editor__meta">
              Pick notes, review the setup, then start a focused recall session.
            </p>
            <div className="tag-row notes-editor__labels">
              <span className="tag">{noteCountLabel}</span>
              <span className="tag">{selectedCountLabel}</span>
            </div>
            <section
              aria-label="Recall selection toolbar"
              className="recall-selection-toolbar"
            >
              <form
                className="notes-search"
                onPointerDown={handleSearchPointerDown}
                onSubmit={handleSearchSubmit}
                ref={searchRootRef}
              >
                <span className="notes-search__icon" aria-hidden="true">
                  <SearchIcon />
                </span>
                <label className="sr-only" htmlFor="recall-selection-search">
                  Search notes
                </label>
                <input
                  aria-activedescendant={activeSearchOptionId}
                  aria-autocomplete="list"
                  aria-controls={recallSelectionSearchListboxId}
                  aria-expanded={isSearchListboxOpen}
                  aria-haspopup="listbox"
                  autoComplete="off"
                  id="recall-selection-search"
                  name="search"
                  onChange={(event) => handleSearchChange(event.target.value)}
                  onFocus={() => {
                    if (hasSearchQuery) {
                      setActiveSearchResultIndex(0);
                      setIsSearchOpen(true);
                    }
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search notes"
                  ref={searchInputRef}
                  role="combobox"
                  type="search"
                  value={searchQuery}
                />
                <kbd>Cmd K</kbd>
              </form>
              <RecallSelectionControls
                hasActiveFocusSession={activeFocusSession !== null}
                hasSelectedNotes={selectedNoteIds.length > 0}
                onCancel={() => void handleCancel()}
                onStartFocus={handleStartFocus}
                onStartRecall={() => void handleStartRecall()}
                selectedCountLabel={selectedCountLabel}
                startDisabledReason={setupState.summary.startDisabledReason}
              />
            </section>
          </div>
        </header>

        <RecallSelectionFilters
          activeFilter={selectedFilter}
          filterSummaries={setupState.filterSummaries}
          onSelectFilter={setSelectedFilter}
        />

        <RecallSetupSummary
          difficultyLabel={setupState.summary.difficultyLabel}
          estimatedTimeLabel={setupState.summary.estimatedTimeLabel}
          practiceTypeLabel={setupState.summary.practiceTypeLabel}
          selectedCount={formatSummarySelectedCount(
            setupState.summary.selectedCount,
          )}
        />

        <div className="recall-selection-layout">
          <article className="recall-panel">
            <div className="notes-list__header">
              <div className="stack">
                <p className="section-label">Search</p>
                <h4>Find recall targets</h4>
                <p className="muted">
                  Search titles, bodies, metaphors, and acronyms. Selecting a
                  match toggles the owning note.
                </p>
              </div>
            </div>

            <RecallSelectionSearchResults
              activeSearchResultIndex={activeSearchResultIndex}
              isOpen={hasSearchQuery && isSearchOpen}
              onToggleNote={toggleSelectedNote}
              searchResults={searchResults}
              selectedNoteIds={selectedNoteIdSet}
            />
          </article>

          <SelectableRecallNotes
            availableEmptyState={setupState.availableEmptyState}
            candidates={setupState.visibleCandidates}
            hasSearchQuery={hasSearchQuery}
            onToggleNote={toggleSelectedNote}
          />
          <SelectedRecallNotes
            onRemoveNote={toggleSelectedNote}
            selectedEmptyState={setupState.selectedEmptyState}
            selectedNotes={setupState.selectedSummaries}
          />
        </div>
      </article>

      {errorMessage !== null ? (
        <p className="auth-form__error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 4.5 4.5" />
    </svg>
  );
}
