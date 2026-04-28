import {
  Outlet,
  useLocation,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { AppLabel } from "../../../features/labels/labels";
import type { AppSessionSnapshot } from "../../../features/session/session";
import {
  getNoteEditorSaveInput,
  getSelectedNote,
  type NoteEditorDraft,
} from "../domain/note-editor";
import {
  type AppNoteSearchResult,
  searchNoteResults,
} from "../domain/note-search";
import { resolveNotesSearchTargetElement } from "../domain/note-search-navigation";
import {
  type AppAcronym,
  type AppMetaphor,
  AppNotesError,
  type AppStoredNote,
  listNotesForUser,
} from "../domain/notes";
import { useNotesWorkspace } from "../domain/notes-workspace";
import { AppRecallError } from "../domain/recall";

const labelPickerPanelId = "note-label-picker-panel";
const notesSearchListboxId = "notes-search-results";
const noteEditorFormId = "note-editor-form";

function formatNoteDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getSearchResultOptionId(noteId: string): string {
  return `notes-search-option-${noteId}`;
}

function getSearchResultLabel(result: AppNoteSearchResult): string {
  return `${result.note.title} ${result.matchChip} Updated ${formatNoteDate(result.note.updatedAt)}`;
}

function formatRecallSelectionCount(count: number) {
  return `${count} ${count === 1 ? "note" : "notes"} selected`;
}

export function NotesWorkspace() {
  const location = useLocation();
  const notesContext = useRouteContext({
    from: "/_protected/notes",
    select: (context) => context.notes,
  });
  const sessionContext = useRouteContext({
    from: "/_protected/notes",
    select: (context) => context.session,
  });
  const recallContext = useRouteContext({
    from: "/_protected/notes",
    select: (context) => context.recall,
  });
  const labelsContext = useRouteContext({
    from: "/_protected/notes",
    select: (context) => context.labels,
  });
  const navigate = useNavigate();
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
  const {
    activateNoteTarget,
    addEditorAcronym,
    addEditorMetaphor,
    cancelPendingWorkspaceTransition,
    clearPendingSearchJump,
    discardEditorChanges,
    discardPendingWorkspaceTransition,
    enterRecallSelection,
    editorFocusRequestNonce,
    hasPendingWorkspaceTransition,
    hasUnsavedNoteChanges,
    markEditorSaved,
    noteEditor,
    pendingSearchJump,
    recallSelection,
    removeEditorAcronym,
    removeEditorMetaphor,
    syncEditorWithNotes,
    toggleEditorLabel,
    updateEditorAcronym,
    updateEditorDraftField,
    updateEditorMetaphor,
  } = useNotesWorkspace();
  const [searchQuery, setSearchQuery] = useState("");
  const searchResults = searchNoteResults(notes, searchQuery);
  const hasSearchQuery = searchQuery.trim().length > 0;
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchRootRef = useRef<HTMLFormElement>(null);
  const [availableLabels, setAvailableLabels] = useState<AppLabel[]>([]);
  const editorState = noteEditor.draft;
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLabelPickerOpen, setIsLabelPickerOpen] = useState(false);
  const [bodyFraction, setBodyFraction] = useState(0.62);
  const noteFormRef = useRef<HTMLFormElement>(null);
  const isInspectorHidden = bodyFraction >= 0.88;
  const selectedNote = getSelectedNote(noteEditor, notes);
  const isCreating = selectedNote === null;
  const editorIdentity =
    noteEditor.mode === "draft" ? "draft" : noteEditor.selectedNoteId;
  const previousEditorIdentityRef = useRef(editorIdentity);

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
    syncEditorWithNotes(notes);
  }, [notes, syncEditorWithNotes]);

  useEffect(() => {
    if (previousEditorIdentityRef.current === editorIdentity) {
      return;
    }

    previousEditorIdentityRef.current = editorIdentity;
    setErrorMessage(null);
  }, [editorIdentity]);

  useEffect(() => {
    return () => {
      if (searchSelectionTimeoutRef.current !== null) {
        clearTimeout(searchSelectionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!hasPendingWorkspaceTransition) {
      return;
    }

    unsavedSearchCancelRef.current?.focus();
  }, [hasPendingWorkspaceTransition]);

  useEffect(() => {
    if (pendingSearchJump === null) {
      return;
    }

    if (
      selectedNote === null ||
      selectedNote.id !== pendingSearchJump.note.id ||
      hasUnsavedNoteChanges
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
      clearPendingSearchJump();
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
    clearPendingSearchJump();
  }, [
    clearPendingSearchJump,
    hasUnsavedNoteChanges,
    pendingSearchJump,
    selectedNote,
  ]);

  useEffect(() => {
    if (editorFocusRequestNonce === 0 || hasPendingWorkspaceTransition) {
      return;
    }

    titleInputRef.current?.focus();
  }, [editorFocusRequestNonce, hasPendingWorkspaceTransition]);

  function handleEditorChange<K extends keyof NoteEditorDraft>(
    field: K,
    value: NoteEditorDraft[K],
  ) {
    updateEditorDraftField(field, value);
  }

  function handleLabelToggle(labelId: string, checked: boolean) {
    toggleEditorLabel(labelId, checked);
  }

  function handleAddMetaphor() {
    addEditorMetaphor();
  }

  function handleAddAcronym() {
    addEditorAcronym();
  }

  function handleMetaphorChange<K extends keyof AppMetaphor>(
    index: number,
    field: K,
    value: AppMetaphor[K],
  ) {
    updateEditorMetaphor(index, field, value);
  }

  function handleAcronymChange<K extends keyof AppAcronym>(
    index: number,
    field: K,
    value: AppAcronym[K],
  ) {
    updateEditorAcronym(index, field, value);
  }

  function handleRemoveMetaphor(index: number) {
    removeEditorMetaphor(index);
  }

  function handleRemoveAcronym(index: number) {
    removeEditorAcronym(index);
  }

  function resetSearchNavigationState() {
    setSearchQuery("");
    setIsSearchOpen(false);
    setActiveSearchResultIndex(0);
  }

  function handleSelectSearchResult(result: AppNoteSearchResult) {
    setErrorMessage(null);

    const transitionResult = activateNoteTarget(
      {
        result,
        type: "searchResult",
      },
      notes,
    );

    if (transitionResult.status !== "pending") {
      resetSearchNavigationState();
    }
  }

  function handleSelectActiveSearchResult() {
    const result = searchResults[activeSearchResultIndex];

    if (result !== undefined) {
      handleSelectSearchResult(result);
    }
  }

  function handleCancelGuardedWorkspaceTransition() {
    cancelPendingWorkspaceTransition();
    searchInputRef.current?.focus();
  }

  async function handleDiscardGuardedWorkspaceTransition() {
    const transitionResult = discardPendingWorkspaceTransition(notes);

    if (transitionResult.completedSearchJump !== null) {
      resetSearchNavigationState();
    }

    if (transitionResult.status === "recallStart") {
      await startRecallSession(transitionResult.noteIds);
    }
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
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

  function handleUnsavedSearchDialogKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      handleCancelGuardedWorkspaceTransition();
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

  function handleBodyResizePointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const form = noteFormRef.current;

    if (form === null) {
      return;
    }

    event.preventDefault();
    const formRect = form.getBoundingClientRect();

    function handlePointerMove(moveEvent: PointerEvent) {
      const offset = moveEvent.clientX - formRect.left;
      const nextFraction = Math.min(
        0.95,
        Math.max(0.35, offset / formRect.width),
      );

      setBodyFraction(nextFraction);
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function handleBodyResizeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setBodyFraction((current) => Math.max(0.35, current - 0.04));
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      setBodyFraction((current) => Math.min(0.95, current + 0.04));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      if (selectedNote === null) {
        const createdNote = notesContext.createNote(userId, {
          ...getNoteEditorSaveInput(noteEditor),
        });

        markEditorSaved(createdNote);
        return;
      }

      const updatedNote = notesContext.updateNote(
        userId,
        selectedNote.id,
        getNoteEditorSaveInput(noteEditor),
      );

      markEditorSaved(updatedNote);
    } catch (error) {
      if (error instanceof AppNotesError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    }
  }

  async function startRecallSession(noteIds: readonly string[]) {
    if (userId === null) {
      return;
    }

    try {
      recallContext.startFlashCardSession({
        noteIds: [...noteIds],
        userId,
      });
      setErrorMessage(null);
      await navigate({ to: "/notes/recall" });
    } catch (error) {
      if (error instanceof AppRecallError) {
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
  const recallSelectionCountLabel = formatRecallSelectionCount(
    recallSelection.selectedCount,
  );
  const hasUnsavedChanges = hasUnsavedNoteChanges;
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

  if (location.pathname !== "/notes") {
    return <Outlet />;
  }

  return (
    <section
      aria-label="Notes workspace surface"
      className="notes-workspace"
      data-recall-selection-mode={recallSelection.isSelectingForRecall}
    >
      <section
        aria-label="Notes workspace toolbar"
        className="notes-workspace__toolbar"
      >
        <p className="sr-only">Study workspace</p>
        <span className="sr-only">{noteCountLabel}</span>
        <form
          className="notes-search"
          onPointerDown={handleSearchPointerDown}
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
        {recallSelection.isSelectingForRecall ? (
          <fieldset
            aria-label="Recall selection controls"
            className="notes-recall-selection-status"
          >
            <span
              className="notes-recall-selection-status__pulse"
              aria-hidden="true"
            />
            <strong>Selecting for recall</strong>
            <span className="tag">{recallSelectionCountLabel}</span>
            <span className="notes-recall-selection-status__hint">
              Tap notes in the sidebar to add them
            </span>
          </fieldset>
        ) : (
          <button
            className="notes-action notes-action-primary notes-recall-entry-action"
            onClick={enterRecallSelection}
            type="button"
          >
            Select for recall
          </button>
        )}
      </section>

      <section className="notes-mobile-summary" aria-label="Workspace summary">
        <h3>Notes workspace</h3>
        <div className="tag-row notes-workspace__tags">
          <span className="tag">{noteCountLabel}</span>
          <span className="tag">{selectedLabelCount}</span>
          <span className="tag">
            {recallSelection.isSelectingForRecall
              ? recallSelectionCountLabel
              : workspaceModeLabel}
          </span>
        </div>
      </section>

      <div className="notes-layout">
        <article aria-label="Note editor surface" className="notes-editor">
          <header className="notes-editor__header">
            <div className="notes-editor__title-stack">
              <label className="notes-title-editor">
                <span className="sr-only">Title</span>
                <input
                  form={noteEditorFormId}
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
              <p className="muted notes-editor__meta">
                {selectedNoteCreatedLabel} <span aria-hidden="true">-</span>{" "}
                {selectedNoteUpdatedLabel}
                {hasUnsavedChanges ? (
                  <>
                    {" "}
                    <span aria-hidden="true">·</span>{" "}
                    <button
                      className="notes-editor__discard"
                      onClick={() => discardEditorChanges(notes)}
                      type="button"
                    >
                      Discard changes
                    </button>
                  </>
                ) : null}
              </p>
              <section
                aria-label="Current labels"
                className="notes-editor__labels"
              >
                <div className="notes-editor__label-row">
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

                {labelPickerContent === null ? null : (
                  <div id={labelPickerPanelId}>{labelPickerContent}</div>
                )}
              </section>
            </div>
            {isCreating || hasUnsavedChanges ? (
              <button
                className="notes-action notes-action-primary"
                form={noteEditorFormId}
                type="submit"
              >
                {isCreating ? "Create note" : "Save changes"}
              </button>
            ) : null}
          </header>

          <form
            aria-label="Note editor"
            className="notes-form"
            data-inspector-hidden={isInspectorHidden ? "true" : undefined}
            id={noteEditorFormId}
            onSubmit={handleSubmit}
            ref={noteFormRef}
            style={{ "--notes-body-fraction": bodyFraction } as CSSProperties}
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

              {errorMessage === null ? null : (
                <p className="auth-form__error" role="alert">
                  {errorMessage}
                </p>
              )}
            </div>

            <hr
              aria-label="Resize note body"
              aria-orientation="vertical"
              aria-valuemax={95}
              aria-valuemin={35}
              aria-valuenow={Math.round(bodyFraction * 100)}
              className="notes-form__splitter"
              onKeyDown={handleBodyResizeKeyDown}
              onPointerDown={handleBodyResizePointerDown}
              tabIndex={0}
            />

            <aside
              aria-hidden={isInspectorHidden}
              aria-label="Memory hooks panel"
              className="notes-form__inspector"
            >
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
            </aside>
          </form>
        </article>
      </div>
      {hasPendingWorkspaceTransition ? (
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
              Navigation will replace the current note editor state.
            </p>
            <div className="notes-unsaved-search-dialog__actions">
              <button
                className="notes-action"
                onClick={handleCancelGuardedWorkspaceTransition}
                ref={unsavedSearchCancelRef}
                type="button"
              >
                Cancel
              </button>
              <button
                className="notes-action notes-action-primary"
                onClick={() => void handleDiscardGuardedWorkspaceTransition()}
                ref={unsavedSearchDiscardRef}
                type="button"
              >
                Discard changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
