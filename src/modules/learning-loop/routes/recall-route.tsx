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

import type { AppSessionSnapshot } from "../../access/domain/session";
import {
  type AppNoteSearchResult,
  filterNotesByQuery,
  searchNoteResults,
} from "../domain/note-search";
import { type AppNote, listNotesForUser } from "../domain/notes";
import { AppRecallError } from "../domain/recall";

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
  return `${count} ${count === 1 ? "note" : "notes"} selected`;
}

function getSearchResultLabel(result: AppNoteSearchResult) {
  return `${result.note.title} ${result.matchChip} Updated ${formatNoteDate(result.note.updatedAt)}`;
}

function getRecallSelectionSearchResultOptionId(noteId: string, index: number) {
  return `recall-selection-search-option-${noteId}-${index}`;
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
  hasSelectedNotes,
  onCancel,
  onStartRecall,
  selectedCountLabel,
}: {
  hasSelectedNotes: boolean;
  onCancel: () => void;
  onStartRecall: () => void;
  selectedCountLabel: string;
}) {
  return (
    <fieldset
      aria-label="Recall selection controls"
      className="tag-row recall-selection-controls"
    >
      <span className="tag">{selectedCountLabel}</span>
      <button className="notes-action" onClick={onCancel} type="button">
        Cancel
      </button>
      <button
        className="notes-action notes-action-primary"
        disabled={!hasSelectedNotes}
        onClick={onStartRecall}
        type="button"
      >
        Start recall
      </button>
    </fieldset>
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
                {result.matchChip}
              </span>
            </span>
            <span>{`Updated ${formatNoteDate(result.note.updatedAt)}`}</span>
          </button>
        );
      })}
    </div>
  );
}

function SelectableRecallNotes({
  filteredNotes,
  onToggleNote,
  selectedNoteIds,
}: {
  filteredNotes: AppNote[];
  onToggleNote: (noteId: string) => void;
  selectedNoteIds: ReadonlySet<string>;
}) {
  return (
    <article className="recall-panel notes-list">
      <div className="notes-list__header">
        <div className="stack">
          <p className="section-label">Notes</p>
          <h4>Selectable notes</h4>
        </div>
        <span className="tag">{`${filteredNotes.length} shown`}</span>
      </div>
      <ul aria-label="Recallable notes" className="notes-list__items">
        {filteredNotes.map((note) => {
          const isSelected = selectedNoteIds.has(note.id);

          return (
            <li key={note.id}>
              <button
                aria-pressed={isSelected}
                className="notes-list__item"
                data-active={isSelected ? "true" : undefined}
                onClick={() => onToggleNote(note.id)}
                type="button"
              >
                <strong>{note.title}</strong>
                <span>{note.body}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export function RecallSelectionPage() {
  const navigate = useNavigate();
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
  const notesSnapshot = useSyncExternalStore(
    notesContext.subscribe,
    notesContext.getSnapshot,
    notesContext.getSnapshot,
  );
  const userId = sessionSnapshot.user?.id ?? null;
  const notes = listNotesForUser(notesSnapshot, userId);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchRootRef = useRef<HTMLFormElement | null>(null);
  const filteredNotes = filterNotesByQuery(notes, searchQuery);
  const searchResults = searchNoteResults(notes, searchQuery);
  const selectedCountLabel = formatSelectedCount(selectedNoteIds.length);
  const hasSearchQuery = searchQuery.trim().length > 0;
  const selectedNoteIdSet = new Set(selectedNoteIds);
  const noteCountLabel = `${notes.length} ${notes.length === 1 ? "note" : "notes"}`;
  const isSearchListboxOpen =
    hasSearchQuery && isSearchOpen && searchResults.length > 0;
  const activeSearchResult = searchResults[activeSearchResultIndex];
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
      if (event.key.toLocaleLowerCase() !== "k") {
        return;
      }

      if (!event.metaKey && !event.ctrlKey) {
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
    if (event.key === "Escape") {
      setIsSearchOpen(false);
      return;
    }

    if (!isSearchOpen || searchResults.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSearchResultIndex(
        (currentIndex) => (currentIndex + 1) % searchResults.length,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSearchResultIndex(
        (currentIndex) =>
          (currentIndex - 1 + searchResults.length) % searchResults.length,
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      handleSelectActiveSearchResult();
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
            <h3>Select Notes</h3>
            <p className="muted notes-editor__meta">
              Search recallable notes, toggle the ones you want, then start a
              focused session.
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
                hasSelectedNotes={selectedNoteIds.length > 0}
                onCancel={() => void handleCancel()}
                onStartRecall={() => void handleStartRecall()}
                selectedCountLabel={selectedCountLabel}
              />
            </section>
          </div>
        </header>

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
            filteredNotes={filteredNotes}
            onToggleNote={toggleSelectedNote}
            selectedNoteIds={selectedNoteIdSet}
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
