import { useRouteContext } from "@tanstack/react-router";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { isModifiedKeyShortcut } from "../../../lib/keyboard";
import type { AppLabel } from "../../labels/domain/labels";
import { formatSearchMatchLabel } from "../domain/learner-copy";
import { useNotesWorkspace } from "../domain/notes-workspace";
import { listRecallResultLabels } from "../domain/recall-result-labels";
import {
  type RecallSessionSearchResult,
  searchRecallSessionResults,
} from "../domain/recall-session-search";

const recallSearchListboxId = "recall-results-search-results";
const RECALL_RESULT_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatRecallResultDate(value: string) {
  return RECALL_RESULT_DATE_FORMATTER.format(new Date(value));
}

function getRecallSearchResultOptionId(sessionId: string) {
  return `recall-results-search-option-${sessionId}`;
}

function getRecallSearchResultLabel(result: RecallSessionSearchResult) {
  return `${result.matchedNoteTitle} ${formatSearchMatchLabel(result.matchChip)} Completed ${formatRecallResultDate(result.sessionResult.completedAt)}`;
}

export function RecallResultsSearch({
  userId,
}: Readonly<{
  userId: string | null;
}>) {
  const labelsContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.labels,
  });
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
  });
  const {
    selectedRecallLabelId,
    selectedRecallSearchQuery,
    selectRecallSearchQuery,
    selectRecallSession,
  } = useNotesWorkspace();
  const [currentLabels, setCurrentLabels] = useState<AppLabel[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchRootRef = useRef<HTMLFormElement | null>(null);

  useSyncExternalStore(
    recallContext.subscribe,
    recallContext.getSessionResultsSnapshot,
    recallContext.getSessionResultsSnapshot,
  );

  useEffect(() => {
    function syncAvailableLabels() {
      if (userId === null) {
        setCurrentLabels([]);
        return;
      }

      setCurrentLabels(labelsContext.getLabelsForUser(userId));
    }

    syncAvailableLabels();

    return labelsContext.subscribe(syncAvailableLabels);
  }, [labelsContext, userId]);

  const selectedLabelFilter =
    selectedRecallLabelId.length === 0 ? undefined : selectedRecallLabelId;
  const allSessionResults =
    userId === null ? [] : recallContext.listSessionResults({ userId });
  const sessionResults =
    userId === null
      ? []
      : recallContext.listSessionResults({
          labelId: selectedLabelFilter,
          userId,
        });
  const availableLabels = listRecallResultLabels({
    currentLabels,
    sessionResults: allSessionResults,
  });
  const searchResults = searchRecallSessionResults({
    labels: availableLabels,
    query: selectedRecallSearchQuery,
    sessionResults,
  });
  const hasSearchQuery = selectedRecallSearchQuery.trim().length > 0;
  const isSearchListboxOpen =
    hasSearchQuery && isSearchOpen && searchResults.length > 0;
  const activeSearchResult = searchResults[activeSearchResultIndex];
  const activeSearchOptionId =
    isSearchListboxOpen && activeSearchResult !== undefined
      ? getRecallSearchResultOptionId(activeSearchResult.sessionResult.id)
      : undefined;
  let searchResultsContent: ReactNode = null;

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

  function resetSearchNavigationState() {
    selectRecallSearchQuery("");
    setIsSearchOpen(false);
    setActiveSearchResultIndex(0);
  }

  function handleSelectSearchResult(result: RecallSessionSearchResult) {
    selectRecallSession(result.sessionResult.id);
    resetSearchNavigationState();
  }

  function handleSelectActiveSearchResult() {
    const result = searchResults[activeSearchResultIndex];

    if (result !== undefined) {
      handleSelectSearchResult(result);
    }
  }

  function handleSearchChange(value: string) {
    selectRecallSearchQuery(value);
    setActiveSearchResultIndex(0);
    setIsSearchOpen(value.trim().length > 0);
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

  if (hasSearchQuery && isSearchOpen) {
    if (searchResults.length === 0) {
      searchResultsContent = (
        <p className="notes-search__empty" role="status">
          No matching sessions
        </p>
      );
    } else {
      searchResultsContent = (
        <div
          aria-label="Recall search results"
          className="notes-search__results"
          id={recallSearchListboxId}
          role="listbox"
        >
          {searchResults.map((result, index) => (
            <button
              aria-label={getRecallSearchResultLabel(result)}
              aria-selected={index === activeSearchResultIndex}
              className="notes-search__option"
              id={getRecallSearchResultOptionId(result.sessionResult.id)}
              key={result.sessionResult.id}
              onClick={() => handleSelectSearchResult(result)}
              role="option"
              tabIndex={-1}
              type="button"
            >
              <span className="notes-search__option-title">
                <strong>{result.matchedNoteTitle}</strong>
                <span className="notes-search__match-chip">
                  {formatSearchMatchLabel(result.matchChip)}
                </span>
              </span>
              <span>{`Completed ${formatRecallResultDate(result.sessionResult.completedAt)}`}</span>
            </button>
          ))}
        </div>
      );
    }
  }

  return (
    <form
      className="notes-search recall-results-search"
      onPointerDown={handleSearchPointerDown}
      onSubmit={handleSearchSubmit}
      ref={searchRootRef}
    >
      <span className="notes-search__icon" aria-hidden="true">
        <SearchIcon />
      </span>
      <label className="sr-only" htmlFor="recall-results-search">
        Search recall sessions
      </label>
      <input
        aria-activedescendant={activeSearchOptionId}
        aria-controls={recallSearchListboxId}
        aria-expanded={isSearchListboxOpen}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        autoComplete="off"
        id="recall-results-search"
        name="search"
        onChange={(event) => handleSearchChange(event.target.value)}
        onFocus={() => {
          if (hasSearchQuery) {
            setActiveSearchResultIndex(0);
            setIsSearchOpen(true);
          }
        }}
        onKeyDown={handleSearchKeyDown}
        placeholder="Search sessions"
        ref={searchInputRef}
        role="combobox"
        type="search"
        value={selectedRecallSearchQuery}
      />
      <kbd>Cmd K</kbd>
      {searchResultsContent}
    </form>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 4.5 4.5" />
    </svg>
  );
}
