import {
  createFileRoute,
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
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { formatCount } from "../../../lib/format-count";
import { isModifiedKeyShortcut } from "../../../lib/keyboard";
import type { AppSessionSnapshot } from "../../access/domain/session";
import type { AppLabel } from "../../labels/domain/labels";
import { BreakIntervalOverlay } from "../components/break-interval-overlay";
import { FocusSessionStartControl } from "../components/focus-session-start-control";
import { AppFocusError, isBreakIntervalActive } from "../domain/focus";
import {
  deriveLearningStates,
  formatLearningStateRatingLabel,
  formatLearningStateStatusLabel,
  type LearningStateStatus,
  toNoteRecallHistories,
} from "../domain/learning-state";
import {
  getNoteEditorSaveInput,
  getSelectedNote,
  type NoteEditorDraft,
} from "../domain/note-editor";
import {
  type AppNoteSearchResult,
  formatNoteSearchResultPreview,
  searchNoteResults,
} from "../domain/note-search";
import { resolveNotesSearchTargetElement } from "../domain/note-search-navigation";
import {
  type AppAcronym,
  type AppMetaphor,
  type AppNote,
  AppNotesError,
  type AppStoredNote,
  listNotesForUser,
} from "../domain/notes";
import { useNotesWorkspace } from "../domain/notes-workspace";
import { AppRecallError } from "../domain/recall";

const labelPickerPanelId = "note-label-picker-panel";
const notesSearchListboxId = "notes-search-results";
const noteEditorFormId = "note-editor-form";
const minNoteBodyFraction = 0.35;
const maxNoteBodyFraction = 0.95;
const noteReviewThresholdMs = 30_000;
const NOTE_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export const Route = createFileRoute("/_protected/notes")({
  component: NotesWorkspace,
});

function formatNoteDate(value: string): string {
  return NOTE_DATE_FORMATTER.format(new Date(value));
}

function getSearchResultOptionId(noteId: string): string {
  return `notes-search-option-${noteId}`;
}

function getSearchResultLabel(result: AppNoteSearchResult): string {
  const preview = formatNoteSearchResultPreview(result);

  return `${result.note.title} ${result.matchChip}${preview === null ? "" : ` ${preview}`} Updated ${formatNoteDate(result.note.updatedAt)}`;
}

function formatHookCountLabel(count: number): string {
  return formatCount(count, "hook");
}

function getLearningStateSummary(status: LearningStateStatus) {
  switch (status) {
    case "unpracticed":
      return "This note has not been tested in recall yet.";
    case "weak":
      return "This note needs another recall pass soon.";
    case "ready_for_review":
      return "This note is due for another recall pass.";
    case "recently_nailed":
      return "This note was recalled well recently.";
  }
}

type PendingHookRemoval =
  | {
      index: number;
      kind: "acronym";
      label: string;
      title: string;
    }
  | {
      index: number;
      kind: "metaphor";
      label: string;
      title: string;
    };

function formatMetaphorCardTitle(metaphor: AppMetaphor, index: number): string {
  const title = metaphor.title.trim();

  return title.length > 0 ? title : `Untitled metaphor ${index + 1}`;
}

function formatAcronymCardTitle(acronym: AppAcronym, index: number): string {
  const shortForm = acronym.shortForm.trim();

  return shortForm.length > 0 ? shortForm : `Untitled acronym ${index + 1}`;
}

function formatMetaphorPreview(metaphor: AppMetaphor): string {
  const explanation = metaphor.explanation.trim();

  return explanation.length > 0
    ? explanation
    : "Add a metaphor that maps the concept to something easier to picture.";
}

function formatAcronymPreview(acronym: AppAcronym): string {
  const expansion = acronym.expansion.trim();

  return expansion.length > 0
    ? expansion
    : "Add what each letter stands for so the mnemonic stays useful later.";
}

export function NotesWorkspace() {
  const location = useLocation();
  const focusContext = useRouteContext({
    from: "/_protected/notes",
    select: (context) => context.focus,
  });
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
  });
  const notesContext = useRouteContext({
    from: "/_protected/notes",
    select: (context) => context.notes,
  });
  const sessionContext = useRouteContext({
    from: "/_protected/notes",
    select: (context) => context.session,
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
  const recallResultsSnapshot = useSyncExternalStore(
    recallContext.subscribe,
    recallContext.getSessionResultsSnapshot,
    recallContext.getSessionResultsSnapshot,
  );
  useSyncExternalStore(
    focusContext.subscribe,
    focusContext.getSnapshot,
    focusContext.getSnapshot,
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
    editorFocusRequestNonce,
    hasPendingWorkspaceTransition,
    hasUnsavedNoteChanges,
    markEditorSaved,
    noteEditor,
    pendingSearchJump,
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
  const bodyResizeAnimationFrameRef = useRef<number | null>(null);
  const searchSelectionTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const unsavedSearchDialogRef = useRef<HTMLDivElement>(null);
  const unsavedSearchCancelRef = useRef<HTMLButtonElement>(null);
  const unsavedSearchDiscardRef = useRef<HTMLButtonElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLabelPickerOpen, setIsLabelPickerOpen] = useState(false);
  const [bodyFraction, setBodyFraction] = useState(0.62);
  const [isBodyResizing, setIsBodyResizing] = useState(false);
  const [pendingHookRemoval, setPendingHookRemoval] =
    useState<PendingHookRemoval | null>(null);
  const noteFormRef = useRef<HTMLFormElement>(null);
  const isInspectorHidden = bodyFraction >= 0.88;
  const selectedNote = getSelectedNote(noteEditor, notes);
  const activeFocusSession =
    userId === null ? null : focusContext.getActiveSession({ userId });
  const isBreakActive = isBreakIntervalActive(activeFocusSession);
  const isCreating = selectedNote === null;
  const noteLearningStates = deriveLearningStates({
    histories:
      userId === null || recallResultsSnapshot.length === 0
        ? []
        : toNoteRecallHistories(recallContext.listAttemptsByNote({ userId })),
    notes,
  });
  const noteLearningStatesById = new Map(
    noteLearningStates.map((state) => [state.noteId, state]),
  );
  const selectedLearningState =
    selectedNote === null
      ? null
      : (noteLearningStatesById.get(selectedNote.id) ?? null);
  const editorIdentity =
    noteEditor.mode === "draft" ? "draft" : noteEditor.selectedNoteId;
  const previousEditorIdentityRef = useRef(editorIdentity);

  const getAttachedLabels = useCallback(
    (noteLabelIds: readonly string[]) => {
      const attachedLabelIds = new Set(noteLabelIds);

      return labelsContext
        .getLabelsForUser(userId ?? "")
        .filter((label) => attachedLabelIds.has(label.id));
    },
    [labelsContext, userId],
  );

  const captureNoteStudyActivity = useCallback(
    (note: AppNote) => {
      if (userId === null) {
        return;
      }

      focusContext.captureNoteStudyActivity({
        labels: getAttachedLabels(note.labelIds),
        note,
        userId,
      });
    },
    [focusContext, getAttachedLabels, userId],
  );

  const skipBreakInterval = useCallback(() => {
    if (userId === null) {
      return;
    }

    focusContext.startNextFocusInterval({
      userId,
    });
  }, [focusContext, userId]);

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
      if (bodyResizeAnimationFrameRef.current !== null) {
        cancelAnimationFrame(bodyResizeAnimationFrameRef.current);
      }

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

  useEffect(() => {
    if (userId === null || selectedNote === null) {
      return;
    }

    const currentUserId = userId;
    const selectedNoteId = selectedNote.id;
    let reviewTimer: ReturnType<typeof setTimeout> | null = null;

    function clearReviewTimer() {
      if (reviewTimer !== null) {
        clearTimeout(reviewTimer);
        reviewTimer = null;
      }
    }

    function scheduleReviewCapture() {
      clearReviewTimer();

      const activeFocusSession = focusContext.getActiveSession({
        userId: currentUserId,
      });

      if (
        activeFocusSession === null ||
        activeFocusSession.currentInterval !== "Focus" ||
        activeFocusSession.intervalState !== "Focus" ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      reviewTimer = setTimeout(() => {
        if (document.visibilityState !== "visible") {
          return;
        }

        const latestSelectedNote = listNotesForUser(
          notesContext.getSnapshot(),
          currentUserId,
        ).find((note) => note.id === selectedNoteId);

        if (latestSelectedNote !== undefined) {
          captureNoteStudyActivity(latestSelectedNote);
        }
      }, noteReviewThresholdMs);
    }

    function handleVisibilityChange() {
      scheduleReviewCapture();
    }

    scheduleReviewCapture();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearReviewTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    captureNoteStudyActivity,
    focusContext,
    notesContext,
    selectedNote,
    userId,
  ]);

  const syncBodyFractionFromTextarea = useCallback(() => {
    const textarea = bodyTextareaRef.current;
    const form = noteFormRef.current;

    if (textarea === null || form === null) {
      return;
    }

    if (bodyResizeAnimationFrameRef.current !== null) {
      cancelAnimationFrame(bodyResizeAnimationFrameRef.current);
    }

    bodyResizeAnimationFrameRef.current = requestAnimationFrame(() => {
      bodyResizeAnimationFrameRef.current = null;

      const formRect = form.getBoundingClientRect();
      const textareaRect = textarea.getBoundingClientRect();

      if (formRect.width <= 0 || textareaRect.width <= 0) {
        return;
      }

      const nextFraction = Math.min(
        maxNoteBodyFraction,
        Math.max(
          minNoteBodyFraction,
          (textareaRect.right - formRect.left) / formRect.width,
        ),
      );

      setBodyFraction((currentFraction) => {
        if (Math.abs(currentFraction - nextFraction) < 0.005) {
          return currentFraction;
        }

        return nextFraction;
      });
    });
  }, []);

  useEffect(() => {
    const textarea = bodyTextareaRef.current;

    if (textarea === null || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(syncBodyFractionFromTextarea);

    observer.observe(textarea);

    return () => {
      observer.disconnect();

      if (bodyResizeAnimationFrameRef.current !== null) {
        cancelAnimationFrame(bodyResizeAnimationFrameRef.current);
        bodyResizeAnimationFrameRef.current = null;
      }
    };
  }, [syncBodyFractionFromTextarea]);

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
    setPendingHookRemoval({
      index,
      kind: "metaphor",
      label: "Metaphor",
      title: formatMetaphorCardTitle(editorState.metaphors[index], index),
    });
  }

  function handleRemoveAcronym(index: number) {
    setPendingHookRemoval({
      index,
      kind: "acronym",
      label: "Acronym",
      title: formatAcronymCardTitle(editorState.acronyms[index], index),
    });
  }

  function handleCancelHookRemoval() {
    setPendingHookRemoval(null);
  }

  function handleConfirmHookRemoval() {
    if (pendingHookRemoval === null) {
      return;
    }

    if (pendingHookRemoval.kind === "metaphor") {
      removeEditorMetaphor(pendingHookRemoval.index);
    } else {
      removeEditorAcronym(pendingHookRemoval.index);
    }

    setPendingHookRemoval(null);
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

  function handleDiscardGuardedWorkspaceTransition() {
    const transitionResult = discardPendingWorkspaceTransition(notes);

    if (transitionResult.completedSearchJump !== null) {
      resetSearchNavigationState();
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
    event: ReactPointerEvent<HTMLHRElement>,
  ) {
    const form = noteFormRef.current;

    if (form === null) {
      return;
    }

    event.preventDefault();
    bodyTextareaRef.current?.style.removeProperty("width");
    const formRect = form.getBoundingClientRect();

    function handlePointerMove(moveEvent: PointerEvent) {
      const offset = moveEvent.clientX - formRect.left;
      const nextFraction = Math.min(
        maxNoteBodyFraction,
        Math.max(minNoteBodyFraction, offset / formRect.width),
      );

      setBodyFraction(nextFraction);
    }

    function handlePointerUp() {
      setIsBodyResizing(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    }

    setIsBodyResizing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }

  function handleBodyResizeKeyDown(event: KeyboardEvent<HTMLHRElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      bodyTextareaRef.current?.style.removeProperty("width");
      setBodyFraction((current) =>
        Math.max(minNoteBodyFraction, current - 0.04),
      );
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      bodyTextareaRef.current?.style.removeProperty("width");
      setBodyFraction((current) =>
        Math.min(maxNoteBodyFraction, current + 0.04),
      );
    }
  }

  function handleBodyTextareaPointerDown(
    event: ReactPointerEvent<HTMLTextAreaElement>,
  ) {
    const textareaRect = event.currentTarget.getBoundingClientRect();
    const isNearNativeResizeHandle =
      textareaRect.right - event.clientX <= 28 &&
      textareaRect.bottom - event.clientY <= 28;

    if (!isNearNativeResizeHandle) {
      return;
    }

    function handlePointerMove() {
      setIsBodyResizing(true);
      syncBodyFractionFromTextarea();
    }

    function handlePointerUp() {
      setIsBodyResizing(false);
      syncBodyFractionFromTextarea();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    }

    setIsBodyResizing(true);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      if (selectedNote === null) {
        const createdNote = notesContext.createNote(userId, {
          ...getNoteEditorSaveInput(noteEditor),
        });

        captureNoteStudyActivity(createdNote);
        markEditorSaved(createdNote);
        return;
      }

      const updatedNote = notesContext.updateNote(
        userId,
        selectedNote.id,
        getNoteEditorSaveInput(noteEditor),
      );

      captureNoteStudyActivity(updatedNote);
      markEditorSaved(updatedNote);
    } catch (error) {
      if (error instanceof AppNotesError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    }
  }

  async function handlePracticeThisNote() {
    if (userId === null || selectedNote === null) {
      return;
    }

    try {
      recallContext.startFlashCardSession({
        noteIds: [selectedNote.id],
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

  function handleFocusThisNote() {
    if (userId === null || selectedNote === null) {
      return;
    }

    try {
      focusContext.startFocusSession({
        userId,
      });
      captureNoteStudyActivity(selectedNote);
      setErrorMessage(null);
    } catch (error) {
      if (error instanceof AppFocusError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    }
  }

  const selectedLabels = availableLabels.filter((label) =>
    editorState.labelIds.includes(label.id),
  );
  const noteCountLabel = formatCount(notes.length, "note");
  const selectedLabelCount = formatCount(selectedLabels.length, "label");
  const workspaceModeLabel = isCreating ? "Draft mode" : "Editing note";
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
  const selectedLearningStateLabel =
    selectedLearningState === null
      ? null
      : formatLearningStateStatusLabel(selectedLearningState.status);
  const selectedLearningStateRating =
    selectedLearningState === null
      ? null
      : formatLearningStateRatingLabel(selectedLearningState.latestRating);
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
          {searchResults.map((result, index) => {
            const preview = formatNoteSearchResultPreview(result);

            return (
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
                {preview === null ? null : <span>{preview}</span>}
                <span>{`Updated ${formatNoteDate(result.note.updatedAt)}`}</span>
              </button>
            );
          })}
        </div>
      );
    }
  }

  if (location.pathname !== "/notes") {
    return <Outlet />;
  }

  return (
    <section aria-label="Notes workspace surface" className="notes-workspace">
      <section
        aria-label="Notes workspace toolbar"
        className="notes-workspace__toolbar"
      >
        <p className="sr-only">Study workspace</p>
        <span className="sr-only">{noteCountLabel}</span>
        <h3 className="sr-only">Notes workspace</h3>
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
        <div className="notes-workspace__toolbar-actions">
          <button
            className="notes-action notes-action-primary notes-recall-entry-action"
            onClick={() => void navigate({ to: "/recall/select" })}
            type="button"
          >
            Start Recall
          </button>
          <FocusSessionStartControl
            activeFocusSession={activeFocusSession}
            focus={focusContext}
            userId={userId}
          />
        </div>
      </section>

      <section className="notes-mobile-summary" aria-label="Workspace summary">
        <div className="tag-row notes-workspace__tags">
          <span className="tag">{noteCountLabel}</span>
          <span className="tag">{selectedLabelCount}</span>
          <span className="tag">{workspaceModeLabel}</span>
        </div>
      </section>

      <div className="notes-layout">
        <article aria-label="Note editor surface" className="notes-editor">
          <fieldset
            className="notes-editor__study-surface"
            disabled={isBreakActive}
          >
            <legend className="sr-only">Note study surface</legend>
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
                          (currentIsLabelPickerOpen) =>
                            !currentIsLabelPickerOpen,
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
                    onPointerDown={handleBodyTextareaPointerDown}
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
                aria-valuetext={`${Math.round(bodyFraction * 100)}% note body width`}
                aria-valuemax={95}
                aria-valuemin={35}
                aria-valuenow={Math.round(bodyFraction * 100)}
                className="notes-form__splitter"
                data-resizing={isBodyResizing ? "true" : undefined}
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
                  aria-label="Learning state"
                  className="notes-inspector-card"
                >
                  <div className="notes-inspector-card__header">
                    <h4>Learning state</h4>
                    {selectedLearningState === null ? null : (
                      <span className="tag">{selectedLearningStateLabel}</span>
                    )}
                  </div>

                  {selectedLearningState === null ? (
                    <p className="muted">
                      Save this note to track practice, review timing, and hook
                      support.
                    </p>
                  ) : (
                    <>
                      <p className="muted">
                        {getLearningStateSummary(selectedLearningState.status)}
                      </p>
                      <div className="notes-learning-state__tags tag-row">
                        <span className="tag">
                          {formatHookCountLabel(
                            selectedLearningState.hookCount,
                          )}
                        </span>
                        {selectedLearningState.practiced ? (
                          <span className="tag">Practiced</span>
                        ) : null}
                      </div>
                      <div className="notes-learning-state__details">
                        <p>
                          {`Latest rating: ${
                            selectedLearningStateRating ?? "Not practiced yet"
                          }`}
                        </p>
                        <p>
                          {`Last practiced: ${
                            selectedLearningState.lastPracticedAt === null
                              ? "Not practiced yet"
                              : formatNoteDate(
                                  selectedLearningState.lastPracticedAt,
                                )
                          }`}
                        </p>
                        <p>
                          {`Next review: ${
                            selectedLearningState.nextReviewAt === null
                              ? "Practice when ready"
                              : formatNoteDate(
                                  selectedLearningState.nextReviewAt,
                                )
                          }`}
                        </p>
                      </div>
                      <div className="notes-inspector-card__actions">
                        <button
                          className="notes-action notes-action-primary"
                          onClick={() => void handlePracticeThisNote()}
                          type="button"
                        >
                          Practice this note
                        </button>
                        {activeFocusSession === null ? (
                          <button
                            className="notes-action"
                            onClick={handleFocusThisNote}
                            type="button"
                          >
                            Focus on this note
                          </button>
                        ) : null}
                      </div>
                    </>
                  )}
                </section>
                <section
                  aria-label="Memory hooks"
                  className="notes-memory-hooks notes-inspector-card"
                >
                  <div className="notes-inspector-card__header">
                    <h4>Memory hooks</h4>
                    {editorState.metaphors.length === 0 &&
                    editorState.acronyms.length === 0 ? null : (
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
                    )}
                  </div>

                  {editorState.metaphors.length === 0 &&
                  editorState.acronyms.length === 0 ? (
                    <div className="notes-hook-empty-state">
                      <p className="muted">
                        Memory hooks turn a note into something easier to
                        remember during recall.
                      </p>
                      <div className="notes-inspector-card__actions">
                        <button
                          className="notes-action notes-action-primary"
                          onClick={handleAddMetaphor}
                          type="button"
                        >
                          Create a hook
                        </button>
                        <button
                          className="notes-action"
                          onClick={handleAddMetaphor}
                          type="button"
                        >
                          Add metaphor
                        </button>
                        <button
                          className="notes-action"
                          onClick={handleAddAcronym}
                          type="button"
                        >
                          Add acronym
                        </button>
                      </div>
                    </div>
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
                            <div className="notes-hook-card__summary">
                              <span className="tag">Metaphor</span>
                              <strong>
                                {formatMetaphorCardTitle(metaphor, index)}
                              </strong>
                              <p>{formatMetaphorPreview(metaphor)}</p>
                            </div>

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
                            <div className="notes-hook-card__summary">
                              <span className="tag">Acronym</span>
                              <strong>
                                {formatAcronymCardTitle(acronym, index)}
                              </strong>
                              <p>{formatAcronymPreview(acronym)}</p>
                            </div>

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
          </fieldset>
          {isBreakActive && userId !== null ? (
            <BreakIntervalOverlay onSkipBreak={skipBreakInterval} />
          ) : null}
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
      {pendingHookRemoval === null ? null : (
        <div
          aria-labelledby="notes-remove-hook-title"
          aria-describedby="notes-remove-hook-description"
          aria-modal="true"
          className="notes-unsaved-search-dialog"
          role="dialog"
        >
          <div className="notes-unsaved-search-dialog__panel">
            <h3 id="notes-remove-hook-title">Remove memory hook?</h3>
            <p id="notes-remove-hook-description">
              {`Remove ${pendingHookRemoval.label}: ${pendingHookRemoval.title}? This cannot be undone.`}
            </p>
            <div className="notes-unsaved-search-dialog__actions">
              <button
                className="notes-action"
                onClick={handleCancelHookRemoval}
                type="button"
              >
                Keep hook
              </button>
              <button
                className="notes-action notes-action-primary"
                onClick={handleConfirmHookRemoval}
                type="button"
              >
                Remove hook
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
