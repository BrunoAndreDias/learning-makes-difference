import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

import {
  addNoteEditorAcronym,
  addNoteEditorMetaphor,
  createInitialNoteEditorState,
  discardNoteEditorChanges,
  isNoteEditorDirty,
  markNoteEditorSaved,
  type NoteEditorDraft,
  type NoteEditorState,
  type NoteEditorTransitionTarget,
  removeNoteEditorAcronym,
  removeNoteEditorMetaphor,
  startNewNoteDraft,
  syncNoteEditorWithNotes,
  toggleNoteEditorLabel,
  updateNoteEditorAcronym,
  updateNoteEditorDraftField,
  updateNoteEditorMetaphor,
} from "./note-editor";
import type { AppAcronym, AppMetaphor, AppNote } from "./notes";
import {
  activateNotesWorkspaceNote,
  cancelPendingNotesWorkspaceTransition,
  discardPendingNotesWorkspaceTransition,
  hasPendingNotesWorkspaceTransition,
  type NotesWorkspaceActivationResult,
  type NotesWorkspaceDiscardResult,
  type NotesWorkspaceState,
} from "./notes-workspace-state";

type NotesWorkspaceContextValue = {
  activeNoteId: string | null;
  addEditorAcronym: () => void;
  addEditorMetaphor: () => void;
  cancelPendingWorkspaceTransition: () => void;
  clearPendingSearchJump: () => void;
  discardEditorChanges: (notes: readonly AppNote[]) => void;
  discardPendingWorkspaceTransition: (
    notes: readonly AppNote[],
  ) => NotesWorkspaceDiscardResult;
  editorFocusRequestNonce: number;
  hasPendingWorkspaceTransition: boolean;
  hasUnsavedNoteChanges: boolean;
  markEditorSaved: (note: AppNote) => void;
  noteEditor: NoteEditorState;
  pendingSearchJump: NotesWorkspaceActivationResult["completedSearchJump"];
  selectedRecallLabelId: string;
  selectedRecallSessionId: string | null;
  removeEditorAcronym: (index: number) => void;
  removeEditorMetaphor: (index: number) => void;
  requestEditorFocus: () => void;
  activateNoteTarget: (
    target: NoteEditorTransitionTarget,
    notes: readonly AppNote[],
  ) => NotesWorkspaceActivationResult;
  startNewNoteDraft: () => void;
  selectRecallLabel: (labelId: string) => void;
  selectRecallSession: (sessionId: string | null) => void;
  syncEditorWithNotes: (notes: readonly AppNote[]) => void;
  toggleEditorLabel: (labelId: string, checked: boolean) => void;
  updateEditorAcronym: <K extends keyof AppAcronym>(
    index: number,
    field: K,
    value: AppAcronym[K],
  ) => void;
  updateEditorDraftField: <K extends keyof NoteEditorDraft>(
    field: K,
    value: NoteEditorDraft[K],
  ) => void;
  updateEditorMetaphor: <K extends keyof AppMetaphor>(
    index: number,
    field: K,
    value: AppMetaphor[K],
  ) => void;
};

const NotesWorkspaceContext = createContext<NotesWorkspaceContextValue | null>(
  null,
);

export function NotesWorkspaceProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [noteEditor, setNoteEditor] = useState(() =>
    createInitialNoteEditorState([]),
  );
  const [pendingSearchJump, setPendingSearchJump] =
    useState<NotesWorkspaceActivationResult["completedSearchJump"]>(null);
  const [editorFocusRequestNonce, setEditorFocusRequestNonce] = useState(0);
  const [selectedRecallLabelId, setSelectedRecallLabelId] = useState("");
  const [selectedRecallSessionId, setSelectedRecallSessionId] = useState<
    string | null
  >(null);
  const hasInitializedEditorRef = useRef(false);

  const getWorkspaceState = useCallback(
    (): NotesWorkspaceState => ({
      noteEditor,
    }),
    [noteEditor],
  );

  const applyWorkspaceState = useCallback((state: NotesWorkspaceState) => {
    setNoteEditor(state.noteEditor);
  }, []);

  const applyActivationResult = useCallback(
    (result: NotesWorkspaceActivationResult) => {
      applyWorkspaceState(result.state);

      if (result.completedSearchJump !== null) {
        setPendingSearchJump(result.completedSearchJump);
      }
    },
    [applyWorkspaceState],
  );

  const requestEditorFocus = useCallback(() => {
    setEditorFocusRequestNonce((currentValue) => currentValue + 1);
  }, []);

  const syncEditorWithNotes = useCallback((notes: readonly AppNote[]) => {
    setNoteEditor((currentState) => {
      if (!hasInitializedEditorRef.current) {
        hasInitializedEditorRef.current = true;
        return createInitialNoteEditorState(notes);
      }

      return syncNoteEditorWithNotes(currentState, notes);
    });
  }, []);

  const updateEditorDraft = useCallback(
    <K extends keyof NoteEditorDraft>(field: K, value: NoteEditorDraft[K]) => {
      setNoteEditor((currentState) =>
        updateNoteEditorDraftField(currentState, field, value),
      );
    },
    [],
  );

  const toggleEditorLabel = useCallback((labelId: string, checked: boolean) => {
    setNoteEditor((currentState) =>
      toggleNoteEditorLabel(currentState, labelId, checked),
    );
  }, []);

  const addEditorMetaphor = useCallback(() => {
    setNoteEditor((currentState) => addNoteEditorMetaphor(currentState));
  }, []);

  const removeEditorMetaphor = useCallback((index: number) => {
    setNoteEditor((currentState) =>
      removeNoteEditorMetaphor(currentState, index),
    );
  }, []);

  const updateEditorMetaphor = useCallback(
    <K extends keyof AppMetaphor>(
      index: number,
      field: K,
      value: AppMetaphor[K],
    ) => {
      setNoteEditor((currentState) =>
        updateNoteEditorMetaphor(currentState, index, field, value),
      );
    },
    [],
  );

  const addEditorAcronym = useCallback(() => {
    setNoteEditor((currentState) => addNoteEditorAcronym(currentState));
  }, []);

  const removeEditorAcronym = useCallback((index: number) => {
    setNoteEditor((currentState) =>
      removeNoteEditorAcronym(currentState, index),
    );
  }, []);

  const updateEditorAcronym = useCallback(
    <K extends keyof AppAcronym>(
      index: number,
      field: K,
      value: AppAcronym[K],
    ) => {
      setNoteEditor((currentState) =>
        updateNoteEditorAcronym(currentState, index, field, value),
      );
    },
    [],
  );

  const activateNoteTarget = useCallback(
    (target: NoteEditorTransitionTarget, notes: readonly AppNote[]) => {
      const result = activateNotesWorkspaceNote(
        getWorkspaceState(),
        target,
        notes,
      );

      applyActivationResult(result);

      return result;
    },
    [applyActivationResult, getWorkspaceState],
  );

  const cancelPendingWorkspaceTransition = useCallback(() => {
    applyWorkspaceState(
      cancelPendingNotesWorkspaceTransition(getWorkspaceState()),
    );
  }, [applyWorkspaceState, getWorkspaceState]);

  const discardPendingWorkspaceTransition = useCallback(
    (notes: readonly AppNote[]) => {
      const result = discardPendingNotesWorkspaceTransition(
        getWorkspaceState(),
        notes,
      );

      applyWorkspaceState(result.state);

      if (result.completedSearchJump !== null) {
        setPendingSearchJump(result.completedSearchJump);
      }

      return result;
    },
    [applyWorkspaceState, getWorkspaceState],
  );

  const startDraft = useCallback(() => {
    setNoteEditor(startNewNoteDraft());
  }, []);

  const discardEditorChanges = useCallback((notes: readonly AppNote[]) => {
    setNoteEditor((currentState) =>
      discardNoteEditorChanges(currentState, notes),
    );
  }, []);

  const markSaved = useCallback((note: AppNote) => {
    setNoteEditor(markNoteEditorSaved(note));
  }, []);

  const clearPendingSearchJump = useCallback(() => {
    setPendingSearchJump(null);
  }, []);

  const selectRecallLabel = useCallback((labelId: string) => {
    setSelectedRecallLabelId(labelId);
  }, []);

  const selectRecallSession = useCallback((sessionId: string | null) => {
    setSelectedRecallSessionId(sessionId);
  }, []);

  const value: NotesWorkspaceContextValue = {
    activeNoteId: noteEditor.selectedNoteId,
    activateNoteTarget,
    addEditorAcronym,
    addEditorMetaphor,
    cancelPendingWorkspaceTransition,
    clearPendingSearchJump,
    discardEditorChanges,
    discardPendingWorkspaceTransition,
    editorFocusRequestNonce,
    hasPendingWorkspaceTransition: hasPendingNotesWorkspaceTransition(
      getWorkspaceState(),
    ),
    hasUnsavedNoteChanges: isNoteEditorDirty(noteEditor),
    markEditorSaved: markSaved,
    noteEditor,
    pendingSearchJump,
    selectedRecallLabelId,
    selectedRecallSessionId,
    removeEditorAcronym,
    removeEditorMetaphor,
    requestEditorFocus,
    selectRecallLabel,
    selectRecallSession,
    startNewNoteDraft: startDraft,
    syncEditorWithNotes,
    toggleEditorLabel,
    updateEditorAcronym,
    updateEditorDraftField: updateEditorDraft,
    updateEditorMetaphor,
  };

  return (
    <NotesWorkspaceContext.Provider value={value}>
      {children}
    </NotesWorkspaceContext.Provider>
  );
}

export function useNotesWorkspace() {
  const context = useContext(NotesWorkspaceContext);

  if (context === null) {
    throw new Error("Notes workspace context is not available.");
  }

  return context;
}
