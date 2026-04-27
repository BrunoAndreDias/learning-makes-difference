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
  cancelNoteEditorTransition,
  createInitialNoteEditorState,
  discardAndApplyNoteEditorTransition,
  isNoteEditorDirty,
  markNoteEditorSaved,
  type NoteEditorDraft,
  type NoteEditorState,
  type NoteEditorTransitionResult,
  type NoteEditorTransitionTarget,
  removeNoteEditorAcronym,
  removeNoteEditorMetaphor,
  requestNoteEditorTransition,
  startNewNoteDraft,
  syncNoteEditorWithNotes,
  toggleNoteEditorLabel,
  updateNoteEditorAcronym,
  updateNoteEditorDraftField,
  updateNoteEditorMetaphor,
} from "./note-editor";
import type { AppAcronym, AppMetaphor, AppNote } from "./notes";
import {
  cancelRecallSelectionMode,
  completeRecallSelection as completeRecallSelectionState,
  createInitialRecallSelectionState,
  enterRecallSelectionMode,
  type RecallSelectionState,
  toggleRecallSelectionNote,
} from "./recall-selection";

export type NotesWorkspaceSidebarAction =
  | {
      nonce: number;
      type: "new";
    }
  | {
      nonce: number;
      noteId: string;
      type: "select";
    };

type NotesWorkspaceContextValue = {
  activeNoteId: string | null;
  addEditorAcronym: () => void;
  addEditorMetaphor: () => void;
  cancelRecallSelection: () => void;
  cancelEditorTransition: () => void;
  clearPendingSidebarAction: (nonce: number) => void;
  clearPendingSearchJump: () => void;
  completeRecallSelection: () => string[];
  discardPendingEditorTransition: (
    notes: readonly AppNote[],
  ) => NoteEditorTransitionResult;
  enterRecallSelection: () => void;
  editorFocusRequestNonce: number;
  hasUnsavedNoteChanges: boolean;
  markEditorSaved: (note: AppNote) => void;
  noteEditor: NoteEditorState;
  pendingSidebarAction: NotesWorkspaceSidebarAction | null;
  pendingSearchJump: NoteEditorTransitionResult["completedSearchJump"];
  recallSelection: RecallSelectionState;
  removeEditorAcronym: (index: number) => void;
  removeEditorMetaphor: (index: number) => void;
  requestEditorFocus: () => void;
  requestEditorTransition: (
    target: NoteEditorTransitionTarget,
    notes: readonly AppNote[],
  ) => NoteEditorTransitionResult;
  requestNewNote: () => void;
  requestSelectNote: (noteId: string) => void;
  startNewNoteDraft: () => void;
  syncEditorWithNotes: (notes: readonly AppNote[]) => void;
  toggleRecallSelection: (noteId: string) => void;
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
    useState<NoteEditorTransitionResult["completedSearchJump"]>(null);
  const [editorFocusRequestNonce, setEditorFocusRequestNonce] = useState(0);
  const [pendingSidebarAction, setPendingSidebarAction] =
    useState<NotesWorkspaceSidebarAction | null>(null);
  const [recallSelection, setRecallSelection] = useState(() =>
    createInitialRecallSelectionState(),
  );
  const actionNonceRef = useRef(0);
  const hasInitializedEditorRef = useRef(false);

  const applyEditorTransitionResult = useCallback(
    (result: NoteEditorTransitionResult) => {
      setNoteEditor(result.state);

      if (result.completedSearchJump !== null) {
        setPendingSearchJump(result.completedSearchJump);
      }
    },
    [],
  );

  const clearPendingSidebarAction = useCallback((nonce: number) => {
    setPendingSidebarAction((currentAction) => {
      if (currentAction?.nonce !== nonce) {
        return currentAction;
      }

      return null;
    });
  }, []);

  const requestNewNote = useCallback(() => {
    actionNonceRef.current += 1;
    setPendingSidebarAction({
      nonce: actionNonceRef.current,
      type: "new",
    });
  }, []);

  const requestSelectNote = useCallback((noteId: string) => {
    actionNonceRef.current += 1;
    setPendingSidebarAction({
      nonce: actionNonceRef.current,
      noteId,
      type: "select",
    });
  }, []);

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

  const requestEditorTransition = useCallback(
    (target: NoteEditorTransitionTarget, notes: readonly AppNote[]) => {
      const result = requestNoteEditorTransition(noteEditor, target, notes);

      applyEditorTransitionResult(result);

      return result;
    },
    [applyEditorTransitionResult, noteEditor],
  );

  const cancelEditorTransition = useCallback(() => {
    setNoteEditor((currentState) => cancelNoteEditorTransition(currentState));
  }, []);

  const discardPendingEditorTransition = useCallback(
    (notes: readonly AppNote[]) => {
      const result = discardAndApplyNoteEditorTransition(noteEditor, notes);

      applyEditorTransitionResult(result);

      return result;
    },
    [applyEditorTransitionResult, noteEditor],
  );

  const startDraft = useCallback(() => {
    setNoteEditor(startNewNoteDraft());
  }, []);

  const markSaved = useCallback((note: AppNote) => {
    setNoteEditor(markNoteEditorSaved(note));
  }, []);

  const clearPendingSearchJump = useCallback(() => {
    setPendingSearchJump(null);
  }, []);

  const enterRecallSelection = useCallback(() => {
    setRecallSelection((currentState) =>
      enterRecallSelectionMode(currentState),
    );
  }, []);

  const cancelRecallSelection = useCallback(() => {
    setRecallSelection(cancelRecallSelectionMode());
  }, []);

  const toggleRecallSelection = useCallback((noteId: string) => {
    setRecallSelection((currentState) =>
      toggleRecallSelectionNote(currentState, noteId),
    );
  }, []);

  const finishRecallSelection = useCallback(() => {
    const result = completeRecallSelectionState(recallSelection);

    setRecallSelection(result.state);

    return result.noteIds;
  }, [recallSelection]);

  const value: NotesWorkspaceContextValue = {
    activeNoteId: noteEditor.selectedNoteId,
    addEditorAcronym,
    addEditorMetaphor,
    cancelRecallSelection,
    cancelEditorTransition,
    clearPendingSidebarAction,
    clearPendingSearchJump,
    completeRecallSelection: finishRecallSelection,
    discardPendingEditorTransition,
    enterRecallSelection,
    editorFocusRequestNonce,
    hasUnsavedNoteChanges: isNoteEditorDirty(noteEditor),
    markEditorSaved: markSaved,
    noteEditor,
    pendingSidebarAction,
    pendingSearchJump,
    recallSelection,
    removeEditorAcronym,
    removeEditorMetaphor,
    requestEditorFocus,
    requestEditorTransition,
    requestNewNote,
    requestSelectNote,
    startNewNoteDraft: startDraft,
    syncEditorWithNotes,
    toggleRecallSelection,
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
