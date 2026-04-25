import { createFileRoute } from "@tanstack/react-router";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { AppLabel } from "../lib/labels";
import {
  type AppAcronym,
  type AppMetaphor,
  type AppNote,
  AppNotesError,
  type AppStoredNote,
  listNotesForUser,
} from "../lib/notes";
import {
  type AppNoteSearchResult,
  searchNoteResults,
} from "../lib/notes-search";
import {
  cancelGuardedNotesSearchNavigation,
  discardGuardedNotesSearchNavigation,
  planNotesSearchNavigation,
  resolveNotesSearchTargetElement,
} from "../lib/notes-search-navigation";
import type { AppSessionSnapshot } from "../lib/session";

export const Route = createFileRoute("/_protected/notes")({
  component: NotesWorkspace,
});

type NoteMetaphorEditor = AppMetaphor & {
  key: string;
};

type NoteAcronymEditor = AppAcronym & {
  key: string;
};

type NoteEditorState = {
  acronyms: NoteAcronymEditor[];
  body: string;
  labelIds: string[];
  metaphors: NoteMetaphorEditor[];
  title: string;
};

const emptyEditorState: NoteEditorState = {
  acronyms: [],
  body: "",
  labelIds: [],
  metaphors: [],
  title: "",
};

const labelPickerPanelId = "note-label-picker-panel";
const notesCatalogPanelId = "notes-catalog-panel";
const notesSearchListboxId = "notes-search-results";
const noteEditorFormId = "note-editor-form";

function createEditorKey(): string {
  return globalThis.crypto.randomUUID();
}

function createNoteMetaphorEditor(
  metaphor: AppMetaphor = {
    explanation: "",
    title: "",
  },
): NoteMetaphorEditor {
  return {
    ...metaphor,
    key: createEditorKey(),
  };
}

function createNoteAcronymEditor(
  acronym: AppAcronym = {
    expansion: "",
    shortForm: "",
  },
): NoteAcronymEditor {
  return {
    ...acronym,
    key: createEditorKey(),
  };
}

function toStoredMetaphor(metaphor: NoteMetaphorEditor): AppMetaphor {
  return {
    explanation: metaphor.explanation,
    title: metaphor.title,
  };
}

function toStoredAcronym(acronym: NoteAcronymEditor): AppAcronym {
  return {
    expansion: acronym.expansion,
    shortForm: acronym.shortForm,
  };
}

function getEditorState(note: AppNote | null): NoteEditorState {
  if (note === null) {
    return emptyEditorState;
  }

  return {
    acronyms: note.acronyms.map((acronym) => createNoteAcronymEditor(acronym)),
    body: note.body,
    labelIds: note.labelIds,
    metaphors: note.metaphors.map((metaphor) =>
      createNoteMetaphorEditor(metaphor),
    ),
    title: note.title,
  };
}

function haveSameItems<T>(
  left: readonly T[],
  right: readonly T[],
  areEqual: (leftItem: T, rightItem: T) => boolean,
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((leftItem, index) => {
    const rightItem = right[index];

    if (rightItem === undefined) {
      return false;
    }

    return areEqual(leftItem, rightItem);
  });
}

function haveSameLabelIds(left: string[], right: string[]): boolean {
  return haveSameItems(left, right, (leftLabelId, rightLabelId) => {
    return leftLabelId === rightLabelId;
  });
}

function haveSameMetaphors(left: AppMetaphor[], right: AppMetaphor[]): boolean {
  return haveSameItems(left, right, (leftMetaphor, rightMetaphor) => {
    return (
      leftMetaphor.title === rightMetaphor.title &&
      leftMetaphor.explanation === rightMetaphor.explanation
    );
  });
}

function haveSameAcronyms(left: AppAcronym[], right: AppAcronym[]): boolean {
  return haveSameItems(left, right, (leftAcronym, rightAcronym) => {
    return (
      leftAcronym.shortForm === rightAcronym.shortForm &&
      leftAcronym.expansion === rightAcronym.expansion
    );
  });
}

function isSameEditorState(
  left: NoteEditorState,
  right: NoteEditorState,
): boolean {
  return (
    left.title === right.title &&
    left.body === right.body &&
    haveSameLabelIds(left.labelIds, right.labelIds) &&
    haveSameMetaphors(left.metaphors, right.metaphors) &&
    haveSameAcronyms(left.acronyms, right.acronyms)
  );
}

function formatNoteDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatCompactNoteDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function getWordCount(body: string): number {
  return body.trim() === "" ? 0 : body.trim().split(/\s+/).length;
}

function truncateNoteId(noteId: string): string {
  return noteId.length <= 12 ? noteId : `${noteId.slice(0, 8)}...`;
}

function getSearchResultOptionId(noteId: string): string {
  return `notes-search-option-${noteId}`;
}

function getSearchResultLabel(result: AppNoteSearchResult): string {
  return `${result.note.title} ${result.matchChip} Updated ${formatNoteDate(result.note.updatedAt)}`;
}

function getNoteDetailsSummary(
  selectedNote: AppNote | null,
  wordCount: number,
): string {
  const wordCountLabel = `${wordCount} ${wordCount === 1 ? "word" : "words"}`;

  if (selectedNote === null) {
    return `Draft - ${wordCountLabel}`;
  }

  return `Updated ${formatCompactNoteDate(selectedNote.updatedAt)} - ${wordCountLabel}`;
}

function NotesWorkspace() {
  const notesContext = Route.useRouteContext({
    select: (context) => context.notes,
  });
  const sessionContext = Route.useRouteContext({
    select: (context) => context.session,
  });
  const labelsContext = Route.useRouteContext({
    select: (context) => context.labels,
  });
  const notesSnapshot = useSyncExternalStore<readonly AppStoredNote[]>(
    notesContext.subscribe,
    notesContext.getSnapshot,
    notesContext.getSnapshot,
  );
  const sessionSnapshot = useSyncExternalStore<AppSessionSnapshot>(
    sessionContext.subscribe,
    sessionContext.getSnapshot,
    sessionContext.getSnapshot,
  );
  const userId = sessionSnapshot.user?.id ?? null;
  const notes = listNotesForUser(notesSnapshot, userId);
  const [searchQuery, setSearchQuery] = useState("");
  const searchResults = searchNoteResults(notes, searchQuery);
  const hasSearchQuery = searchQuery.trim().length > 0;
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchRootRef = useRef<HTMLFormElement>(null);
  const [availableLabels, setAvailableLabels] = useState<AppLabel[]>([]);
  const firstNoteId = notes[0]?.id ?? null;
  const [isCreatingNew, setIsCreatingNew] = useState(notes.length === 0);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    firstNoteId,
  );
  const [editorState, setEditorState] = useState<NoteEditorState>(() =>
    getEditorState(notes[0] ?? null),
  );
  const [pendingSearchJump, setPendingSearchJump] =
    useState<AppNoteSearchResult | null>(null);
  const [guardedSearchResult, setGuardedSearchResult] =
    useState<AppNoteSearchResult | null>(null);
  const [isNotesCatalogCollapsed, setIsNotesCatalogCollapsed] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const metaphorTitleRefs = useRef<(HTMLInputElement | null)[]>([]);
  const metaphorExplanationRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const acronymShortFormRefs = useRef<(HTMLInputElement | null)[]>([]);
  const acronymExpansionRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const searchSelectionTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const unsavedSearchDialogRef = useRef<HTMLDivElement>(null);
  const unsavedSearchCancelRef = useRef<HTMLButtonElement>(null);
  const unsavedSearchDiscardRef = useRef<HTMLButtonElement>(null);
  const collapseCatalogButtonRef = useRef<HTMLButtonElement>(null);
  const reopenCatalogButtonRef = useRef<HTMLButtonElement>(null);
  const previousCatalogCollapsedRef = useRef(isNotesCatalogCollapsed);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLabelPickerOpen, setIsLabelPickerOpen] = useState(false);
  const selectedNote =
    isCreatingNew || selectedNoteId === null
      ? null
      : (notes.find((note) => note.id === selectedNoteId) ?? null);
  const isCreating = selectedNote === null;
  const selectedNoteStillExists =
    selectedNoteId !== null && notes.some((note) => note.id === selectedNoteId);

  useEffect(() => {
    function syncLabels() {
      if (userId === null) {
        setAvailableLabels([]);
        return;
      }

      setAvailableLabels(labelsContext.getLabelsForUser(userId));
    }

    syncLabels();

    return labelsContext.subscribe(syncLabels);
  }, [labelsContext, userId]);

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

      if (unsavedSearchDialogRef.current?.contains(target)) {
        return;
      }

      setIsSearchOpen(false);
    }

    document.addEventListener("mousedown", handleDocumentMouseDown);

    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, []);

  useEffect(() => {
    if (firstNoteId === null) {
      setIsCreatingNew(true);
      setSelectedNoteId(null);
      return;
    }

    if (isCreatingNew) {
      return;
    }

    if (selectedNoteStillExists) {
      return;
    }

    setSelectedNoteId(firstNoteId);
  }, [firstNoteId, isCreatingNew, selectedNoteStillExists]);

  useEffect(() => {
    const currentUserNotesSnapshot =
      userId === null
        ? []
        : notesSnapshot.filter((note) => note.userId === userId);
    const nextSelectedNote =
      isCreatingNew || selectedNoteId === null
        ? null
        : (currentUserNotesSnapshot.find(
            (note) => note.id === selectedNoteId,
          ) ?? null);
    const nextEditorState = getEditorState(nextSelectedNote);

    setEditorState((currentState) => {
      if (nextSelectedNote === null) {
        return isSameEditorState(currentState, emptyEditorState)
          ? currentState
          : emptyEditorState;
      }

      if (isSameEditorState(currentState, nextEditorState)) {
        return currentState;
      }

      return nextEditorState;
    });
  }, [isCreatingNew, notesSnapshot, selectedNoteId, userId]);

  useEffect(() => {
    return () => {
      if (searchSelectionTimeoutRef.current !== null) {
        clearTimeout(searchSelectionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (previousCatalogCollapsedRef.current === isNotesCatalogCollapsed) {
      return;
    }

    previousCatalogCollapsedRef.current = isNotesCatalogCollapsed;

    if (isNotesCatalogCollapsed) {
      reopenCatalogButtonRef.current?.focus();
      return;
    }

    collapseCatalogButtonRef.current?.focus();
  }, [isNotesCatalogCollapsed]);

  useEffect(() => {
    if (guardedSearchResult === null) {
      return;
    }

    unsavedSearchCancelRef.current?.focus();
  }, [guardedSearchResult]);

  useEffect(() => {
    if (pendingSearchJump === null) {
      return;
    }

    if (
      selectedNote === null ||
      selectedNote.id !== pendingSearchJump.note.id ||
      !isSameEditorState(editorState, getEditorState(selectedNote))
    ) {
      return;
    }

    if (searchSelectionTimeoutRef.current !== null) {
      clearTimeout(searchSelectionTimeoutRef.current);
      searchSelectionTimeoutRef.current = null;
    }

    const targetElement = resolveNotesSearchTargetElement(
      {
        acronymExpansions: acronymExpansionRefs.current,
        acronymShortForms: acronymShortFormRefs.current,
        body: bodyTextareaRef.current,
        metaphorExplanations: metaphorExplanationRefs.current,
        metaphorTitles: metaphorTitleRefs.current,
        title: titleInputRef.current,
      },
      pendingSearchJump,
    );

    if (targetElement === null) {
      setPendingSearchJump(null);
      return;
    }

    const selectionEnd = pendingSearchJump.target.match.end;

    targetElement.scrollIntoView({ block: "center", inline: "nearest" });
    targetElement.focus();
    targetElement.setSelectionRange(
      pendingSearchJump.target.match.start,
      selectionEnd,
    );

    searchSelectionTimeoutRef.current = setTimeout(() => {
      targetElement.focus();
      targetElement.setSelectionRange(selectionEnd, selectionEnd);
      searchSelectionTimeoutRef.current = null;
    }, 3000);
    setPendingSearchJump(null);
  }, [editorState, pendingSearchJump, selectedNote]);

  function handleEditorChange<K extends keyof NoteEditorState>(
    field: K,
    value: NoteEditorState[K],
  ) {
    setEditorState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  }

  function handleLabelToggle(labelId: string, checked: boolean) {
    setEditorState((currentState) => {
      if (checked) {
        return {
          ...currentState,
          labelIds: [...new Set([...currentState.labelIds, labelId])],
        };
      }

      return {
        ...currentState,
        labelIds: currentState.labelIds.filter(
          (candidateId) => candidateId !== labelId,
        ),
      };
    });
  }

  function handleAddMetaphor() {
    setEditorState((currentState) => ({
      ...currentState,
      metaphors: [...currentState.metaphors, createNoteMetaphorEditor()],
    }));
  }

  function handleAddAcronym() {
    setEditorState((currentState) => ({
      ...currentState,
      acronyms: [...currentState.acronyms, createNoteAcronymEditor()],
    }));
  }

  function handleMetaphorChange<K extends keyof AppMetaphor>(
    index: number,
    field: K,
    value: AppMetaphor[K],
  ) {
    setEditorState((currentState) => ({
      ...currentState,
      metaphors: currentState.metaphors.map((metaphor, metaphorIndex) => {
        if (metaphorIndex !== index) {
          return metaphor;
        }

        return {
          ...metaphor,
          [field]: value,
        };
      }),
    }));
  }

  function handleAcronymChange<K extends keyof AppAcronym>(
    index: number,
    field: K,
    value: AppAcronym[K],
  ) {
    setEditorState((currentState) => ({
      ...currentState,
      acronyms: currentState.acronyms.map((acronym, acronymIndex) => {
        if (acronymIndex !== index) {
          return acronym;
        }

        return {
          ...acronym,
          [field]: value,
        };
      }),
    }));
  }

  function handleRemoveMetaphor(index: number) {
    setEditorState((currentState) => ({
      ...currentState,
      metaphors: currentState.metaphors.filter(
        (_, metaphorIndex) => metaphorIndex !== index,
      ),
    }));
  }

  function handleRemoveAcronym(index: number) {
    setEditorState((currentState) => ({
      ...currentState,
      acronyms: currentState.acronyms.filter(
        (_, acronymIndex) => acronymIndex !== index,
      ),
    }));
  }

  function handleNewNote() {
    setErrorMessage(null);
    setIsCreatingNew(true);
    setSelectedNoteId(null);
  }

  function handleSelectNote(note: AppNote) {
    setErrorMessage(null);
    setIsCreatingNew(false);
    setSelectedNoteId(note.id);
  }

  function completeSearchResultNavigation(result: AppNoteSearchResult) {
    setErrorMessage(null);
    setGuardedSearchResult(null);
    setPendingSearchJump(result);
    setSearchQuery("");
    setIsCreatingNew(false);
    setSelectedNoteId(result.note.id);
    setIsSearchOpen(false);
    setActiveSearchResultIndex(0);
  }

  function hasUnsavedEditorChanges() {
    if (selectedNote === null) {
      return !isSameEditorState(editorState, emptyEditorState);
    }

    return !isSameEditorState(editorState, getEditorState(selectedNote));
  }

  function handleSelectSearchResult(result: AppNoteSearchResult) {
    setErrorMessage(null);

    const navigationPlan = planNotesSearchNavigation({
      hasUnsavedChanges: hasUnsavedEditorChanges(),
      result,
    });

    if (navigationPlan.type === "guard") {
      setGuardedSearchResult(navigationPlan.guardedResult);
      return;
    }

    completeSearchResultNavigation(navigationPlan.result);
  }

  function handleCancelGuardedSearchNavigation() {
    const navigationPlan = cancelGuardedNotesSearchNavigation();

    if (navigationPlan.type === "cancel") {
      setGuardedSearchResult(null);
      searchInputRef.current?.focus();
    }
  }

  function handleDiscardGuardedSearchNavigation() {
    const navigationPlan =
      discardGuardedNotesSearchNavigation(guardedSearchResult);

    if (navigationPlan.type === "idle") {
      return;
    }

    completeSearchResultNavigation(navigationPlan.result);
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    setActiveSearchResultIndex(0);
    setIsSearchOpen(value.trim().length > 0);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isSearchOpen || searchResults.length === 0) {
      if (event.key === "Escape") {
        setIsSearchOpen(false);
      }

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
      const result = searchResults[activeSearchResultIndex];

      if (result !== undefined) {
        handleSelectSearchResult(result);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsSearchOpen(false);
    }
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = searchResults[activeSearchResultIndex];

    if (result !== undefined) {
      handleSelectSearchResult(result);
    }
  }

  function handleUnsavedSearchDialogKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      handleCancelGuardedSearchNavigation();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const cancelButton = unsavedSearchCancelRef.current;
    const discardButton = unsavedSearchDiscardRef.current;

    if (cancelButton === null || discardButton === null) {
      return;
    }

    if (event.shiftKey && document.activeElement === cancelButton) {
      event.preventDefault();
      discardButton.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === discardButton) {
      event.preventDefault();
      cancelButton.focus();
    }
  }

  function handleCopyNoteId() {
    if (selectedNote === null) {
      return;
    }

    const clipboard = navigator.clipboard;

    if (clipboard === undefined) {
      return;
    }

    void clipboard.writeText(selectedNote.id).catch(() => undefined);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      if (selectedNote === null) {
        const createdNote = notesContext.createNote(userId, {
          acronyms: editorState.acronyms.map(toStoredAcronym),
          body: editorState.body,
          labelIds: editorState.labelIds,
          metaphors: editorState.metaphors.map(toStoredMetaphor),
          title: editorState.title,
        });

        setIsCreatingNew(false);
        setSelectedNoteId(createdNote.id);
        return;
      }

      notesContext.updateNote(userId, selectedNote.id, {
        acronyms: editorState.acronyms.map(toStoredAcronym),
        body: editorState.body,
        labelIds: editorState.labelIds,
        metaphors: editorState.metaphors.map(toStoredMetaphor),
        title: editorState.title,
      });
    } catch (error) {
      if (error instanceof AppNotesError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    }
  }

  const selectedLabels = availableLabels.filter((label) =>
    editorState.labelIds.includes(label.id),
  );
  const noteCountLabel = `${notes.length} ${notes.length === 1 ? "note" : "notes"}`;
  const selectedLabelCount = `${selectedLabels.length} ${
    selectedLabels.length === 1 ? "label" : "labels"
  }`;
  const workspaceModeLabel = isCreating ? "Draft mode" : "Editing note";
  const wordCount = getWordCount(editorState.body);
  const compactDetailsLabel = getNoteDetailsSummary(selectedNote, wordCount);
  const hasUnsavedChanges = hasUnsavedEditorChanges();
  const selectedNoteUpdatedLabel =
    selectedNote === null
      ? "Unsaved draft"
      : `Updated ${formatNoteDate(selectedNote.updatedAt)}`;
  const selectedNoteCreatedLabel =
    selectedNote === null
      ? "Created after save"
      : `Created ${formatNoteDate(selectedNote.createdAt)}`;
  const isSearchListboxOpen =
    hasSearchQuery && isSearchOpen && searchResults.length > 0;
  const activeSearchResult = searchResults[activeSearchResultIndex];
  const activeSearchOptionId =
    isSearchListboxOpen && activeSearchResult !== undefined
      ? getSearchResultOptionId(activeSearchResult.note.id)
      : undefined;
  let labelPickerContent: ReactNode = null;

  if (isLabelPickerOpen) {
    if (availableLabels.length === 0) {
      labelPickerContent = <p className="muted">No labels available</p>;
    } else {
      labelPickerContent = (
        <fieldset className="notes-labels">
          <legend>Available labels</legend>
          <div className="notes-labels__options">
            {availableLabels.map((label) => (
              <label className="notes-labels__option" key={label.id}>
                <input
                  checked={editorState.labelIds.includes(label.id)}
                  onChange={(event) =>
                    handleLabelToggle(label.id, event.target.checked)
                  }
                  type="checkbox"
                />
                <span>{label.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      );
    }
  }

  let searchResultsContent: ReactNode = null;

  if (hasSearchQuery && isSearchOpen) {
    if (searchResults.length === 0) {
      searchResultsContent = (
        <p className="notes-search__empty" role="status">
          No notes found
        </p>
      );
    } else {
      searchResultsContent = (
        <div
          aria-label="Notes search results"
          className="notes-search__results"
          id={notesSearchListboxId}
          role="listbox"
        >
          {searchResults.map((result, index) => (
            <button
              aria-label={getSearchResultLabel(result)}
              aria-selected={index === activeSearchResultIndex}
              className="notes-search__option"
              id={getSearchResultOptionId(result.note.id)}
              key={result.note.id}
              onClick={() => handleSelectSearchResult(result)}
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
          ))}
        </div>
      );
    }
  }

  return (
    <section className="notes-workspace">
      <section
        aria-label="Notes workspace toolbar"
        className="notes-workspace__toolbar"
      >
        <p className="sr-only">Study workspace</p>
        <button className="sr-only" onClick={handleNewNote} type="button">
          New note
        </button>
        <span className="sr-only">{noteCountLabel}</span>
        <form
          className="notes-search"
          onSubmit={handleSearchSubmit}
          ref={searchRootRef}
        >
          <span className="notes-search__icon" aria-hidden="true">
            <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
              <circle cx="10.5" cy="10.5" r="6" />
              <path d="m15 15 4.5 4.5" />
            </svg>
          </span>
          <label className="sr-only" htmlFor="notes-search">
            Search notes
          </label>
          <input
            aria-activedescendant={activeSearchOptionId}
            aria-controls={notesSearchListboxId}
            aria-expanded={isSearchListboxOpen}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            autoComplete="off"
            id="notes-search"
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
          {searchResultsContent}
        </form>
      </section>

      <section className="notes-mobile-summary" aria-label="Workspace summary">
        <h3>Notes workspace</h3>
        <div className="tag-row notes-workspace__tags">
          <span className="tag">{noteCountLabel}</span>
          <span className="tag">{selectedLabelCount}</span>
          <span className="tag">{workspaceModeLabel}</span>
        </div>
      </section>

      <div
        className="notes-layout"
        data-catalog-state={isNotesCatalogCollapsed ? "collapsed" : "expanded"}
      >
        {isNotesCatalogCollapsed ? (
          <button
            aria-controls={notesCatalogPanelId}
            aria-label="Reopen notes catalog"
            className="notes-catalog-reopen"
            ref={reopenCatalogButtonRef}
            onClick={() => setIsNotesCatalogCollapsed(false)}
            type="button"
          >
            Notes
          </button>
        ) : null}
        <article aria-label="Note editor surface" className="notes-editor">
          <header className="notes-editor__header">
            <div>
              <label className="notes-title-editor">
                <span className="sr-only">Title</span>
                <input
                  ref={titleInputRef}
                  name="title"
                  onChange={(event) =>
                    handleEditorChange("title", event.target.value)
                  }
                  placeholder="Name this note"
                  type="text"
                  value={editorState.title}
                />
              </label>
              <p className="muted">
                {selectedNoteCreatedLabel} <span aria-hidden="true">-</span>{" "}
                {selectedNoteUpdatedLabel}
              </p>
            </div>
            {!isCreating && hasUnsavedChanges ? (
              <button
                className="notes-action notes-action-primary"
                form={noteEditorFormId}
                type="submit"
              >
                Save changes
              </button>
            ) : null}
          </header>

          <form
            aria-label="Note editor"
            className="notes-form"
            id={noteEditorFormId}
            onSubmit={handleSubmit}
          >
            <div className="notes-form__primary">
              <label className="notes-form__field notes-form__body-field">
                <span className="sr-only">Body</span>
                <textarea
                  ref={bodyTextareaRef}
                  name="body"
                  onChange={(event) =>
                    handleEditorChange("body", event.target.value)
                  }
                  placeholder="Explain the concept in your own words"
                  rows={10}
                  value={editorState.body}
                />
              </label>
            </div>

            <aside className="notes-form__inspector" aria-label="Note metadata">
              <section
                aria-label="Current labels"
                className="notes-inspector-card"
              >
                <div className="notes-inspector-card__header">
                  <h4>Labels</h4>
                  <button
                    aria-expanded={isLabelPickerOpen}
                    aria-controls={labelPickerPanelId}
                    aria-label="Add label"
                    className="notes-inline-action"
                    onClick={() =>
                      setIsLabelPickerOpen(
                        (currentIsLabelPickerOpen) => !currentIsLabelPickerOpen,
                      )
                    }
                    type="button"
                  >
                    + Add
                  </button>
                </div>
                {selectedLabels.length === 0 ? (
                  <p className="muted">No labels yet</p>
                ) : (
                  <section aria-label="Assigned labels" className="tag-row">
                    {selectedLabels.map((label) => (
                      <span className="tag" key={label.id}>
                        {label.name}
                      </span>
                    ))}
                  </section>
                )}

                {labelPickerContent === null ? null : (
                  <div id={labelPickerPanelId}>{labelPickerContent}</div>
                )}
              </section>

              <section
                aria-label="Memory hooks"
                className="notes-memory-hooks notes-inspector-card"
              >
                <div className="notes-inspector-card__header">
                  <h4>Memory hooks</h4>
                  <div className="notes-inspector-card__actions">
                    <button
                      aria-label="Add metaphor"
                      className="notes-inline-action"
                      onClick={handleAddMetaphor}
                      type="button"
                    >
                      + Add metaphor
                    </button>
                    <button
                      aria-label="Add acronym"
                      className="notes-inline-action"
                      onClick={handleAddAcronym}
                      type="button"
                    >
                      + Add acronym
                    </button>
                  </div>
                </div>

                {editorState.metaphors.length === 0 &&
                editorState.acronyms.length === 0 ? (
                  <p className="muted">No hooks yet</p>
                ) : null}

                {editorState.metaphors.length === 0 ? null : (
                  <div className="notes-hook-group">
                    <h5>Metaphors</h5>
                    <div className="notes-metaphors__list">
                      {editorState.metaphors.map((metaphor, index) => (
                        <fieldset
                          aria-label="Metaphor editor"
                          className="notes-metaphor"
                          key={metaphor.key}
                        >
                          <legend>{`Metaphor ${index + 1}`}</legend>

                          <label className="notes-form__field">
                            <span>Metaphor title</span>
                            <input
                              aria-label="Metaphor title"
                              ref={(element) => {
                                metaphorTitleRefs.current[index] = element;
                              }}
                              onChange={(event) =>
                                handleMetaphorChange(
                                  index,
                                  "title",
                                  event.target.value,
                                )
                              }
                              placeholder="Battery, bridge, map..."
                              type="text"
                              value={metaphor.title}
                            />
                          </label>

                          <label className="notes-form__field">
                            <span>Metaphor explanation</span>
                            <textarea
                              aria-label="Metaphor explanation"
                              ref={(element) => {
                                metaphorExplanationRefs.current[index] =
                                  element;
                              }}
                              onChange={(event) =>
                                handleMetaphorChange(
                                  index,
                                  "explanation",
                                  event.target.value,
                                )
                              }
                              placeholder="Explain how the metaphor maps to the concept"
                              rows={4}
                              value={metaphor.explanation}
                            />
                          </label>

                          <div className="notes-metaphor__actions">
                            <button
                              className="notes-action"
                              onClick={() => handleRemoveMetaphor(index)}
                              type="button"
                            >
                              {`Remove metaphor ${index + 1}`}
                            </button>
                          </div>
                        </fieldset>
                      ))}
                    </div>
                  </div>
                )}

                {editorState.acronyms.length === 0 ? null : (
                  <div className="notes-hook-group">
                    <h5>Acronyms</h5>
                    <div className="notes-acronyms__list">
                      {editorState.acronyms.map((acronym, index) => (
                        <fieldset
                          aria-label="Acronym editor"
                          className="notes-acronym"
                          key={acronym.key}
                        >
                          <legend>{`Acronym ${index + 1}`}</legend>

                          <label className="notes-form__field">
                            <span>Acronym</span>
                            <input
                              aria-label="Acronym"
                              ref={(element) => {
                                acronymShortFormRefs.current[index] = element;
                              }}
                              onChange={(event) =>
                                handleAcronymChange(
                                  index,
                                  "shortForm",
                                  event.target.value,
                                )
                              }
                              placeholder="PEMDAS, FIFO, SMART..."
                              type="text"
                              value={acronym.shortForm}
                            />
                          </label>

                          <label className="notes-form__field">
                            <span>What it stands for</span>
                            <textarea
                              aria-label="Acronym expansion"
                              ref={(element) => {
                                acronymExpansionRefs.current[index] = element;
                              }}
                              onChange={(event) =>
                                handleAcronymChange(
                                  index,
                                  "expansion",
                                  event.target.value,
                                )
                              }
                              placeholder="Preserve what each letter stands for"
                              rows={4}
                              value={acronym.expansion}
                            />
                          </label>

                          <div className="notes-acronym__actions">
                            <button
                              className="notes-action"
                              onClick={() => handleRemoveAcronym(index)}
                              type="button"
                            >
                              {`Remove acronym ${index + 1}`}
                            </button>
                          </div>
                        </fieldset>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <details
                aria-label="Details"
                className="notes-details notes-inspector-card"
              >
                <summary>
                  <span>Details</span>
                  <span>{compactDetailsLabel}</span>
                </summary>

                <dl>
                  <div>
                    <dt>Created</dt>
                    <dd>
                      {selectedNote === null
                        ? "After save"
                        : formatNoteDate(selectedNote.createdAt)}
                    </dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>
                      {selectedNote === null
                        ? "Draft"
                        : formatNoteDate(selectedNote.updatedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt>Words</dt>
                    <dd>{wordCount}</dd>
                  </div>
                  <div>
                    <dt>Note ID</dt>
                    <dd>
                      {selectedNote === null ? (
                        "Unsaved"
                      ) : (
                        <span className="notes-id-copy">
                          <span>{truncateNoteId(selectedNote.id)}</span>
                          <button
                            className="notes-inline-action"
                            onClick={handleCopyNoteId}
                            type="button"
                          >
                            Copy
                          </button>
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
              </details>

              {errorMessage === null ? null : (
                <p className="auth-form__error" role="alert">
                  {errorMessage}
                </p>
              )}

              {isCreating ? (
                <div className="notes-editor__actions">
                  <button
                    className="notes-action notes-action-primary"
                    type="submit"
                  >
                    Create note
                  </button>
                </div>
              ) : null}
            </aside>
          </form>
        </article>

        <aside
          aria-label="Notes catalog"
          className="notes-list"
          hidden={isNotesCatalogCollapsed}
          id={notesCatalogPanelId}
        >
          <div className="notes-list__toolbar">
            <button
              className="notes-action notes-action-primary"
              onClick={handleNewNote}
              type="button"
            >
              + New Note
            </button>
            <button className="notes-action" type="button">
              Updated (Newest)
            </button>
            <button
              aria-label="List settings"
              className="notes-icon-button"
              type="button"
            >
              =
            </button>
            <button
              aria-label="More list actions"
              className="notes-icon-button"
              type="button"
            >
              ...
            </button>
            <button
              aria-controls={notesCatalogPanelId}
              aria-label="Collapse notes catalog"
              className="notes-icon-button"
              ref={collapseCatalogButtonRef}
              onClick={() => setIsNotesCatalogCollapsed(true)}
              type="button"
            >
              <span aria-hidden="true">-</span>
            </button>
          </div>

          {notes.length === 0 ? (
            <p className="muted">No notes yet</p>
          ) : (
            <ul className="notes-list__items">
              {notes.map((note) => {
                const isActive = note.id === selectedNote?.id;
                const noteLabels = availableLabels.filter((label) =>
                  note.labelIds.includes(label.id),
                );

                return (
                  <li key={note.id}>
                    <button
                      aria-pressed={isActive}
                      className="notes-list__item"
                      data-active={isActive}
                      onClick={() => handleSelectNote(note)}
                      type="button"
                    >
                      <strong>{note.title}</strong>
                      {noteLabels.length === 0 ? null : (
                        <span className="notes-list__item-tags">
                          {noteLabels.slice(0, 3).map((label) => (
                            <span className="tag" key={label.id}>
                              {label.name}
                            </span>
                          ))}
                        </span>
                      )}
                      <span>{`Updated ${formatNoteDate(note.updatedAt)}`}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
      {guardedSearchResult === null ? null : (
        <div
          aria-labelledby="notes-unsaved-search-title"
          aria-describedby="notes-unsaved-search-description"
          aria-modal="true"
          className="notes-unsaved-search-dialog"
          onKeyDown={handleUnsavedSearchDialogKeyDown}
          ref={unsavedSearchDialogRef}
          role="dialog"
        >
          <div className="notes-unsaved-search-dialog__panel">
            <h3 id="notes-unsaved-search-title">Discard unsaved changes?</h3>
            <p id="notes-unsaved-search-description">
              Search navigation will replace the current note editor state.
            </p>
            <div className="notes-unsaved-search-dialog__actions">
              <button
                className="notes-action"
                onClick={handleCancelGuardedSearchNavigation}
                ref={unsavedSearchCancelRef}
                type="button"
              >
                Cancel
              </button>
              <button
                className="notes-action notes-action-primary"
                onClick={handleDiscardGuardedSearchNavigation}
                ref={unsavedSearchDiscardRef}
                type="button"
              >
                Discard changes
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
