import {
  createContext,
  type ReactNode,
  useCallback,
  useState,
} from "react";

import type {
  NoteEditorDraft,
  NoteEditorState,
  NoteEditorTransitionTarget,
} from "./note-editor";
import type { AppAcronym, AppMetaphor, AppNote } from "./notes";
import {
  applyNotesWorkspaceInteractionEvent,
  createInitialNotesWorkspaceInteractionState,
  hasPendingNotesWorkspaceInteractionTransition,
  hasUnsavedNotesWorkspaceInteractionChanges,
  type NotesWorkspaceActivationResult,
  type NotesWorkspaceDiscardResult,
  type NotesWorkspaceInteractionResult,
  type NotesWorkspaceInteractionState,
  type NotesWorkspaceSaveInstruction,
} from "./notes-workspace-interaction";

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
  markEditorSaved: (note: AppNote) => NotesWorkspaceInteractionResult;
  noteEditor: NoteEditorState;
  pendingSearchJump: NotesWorkspaceActivationResult["completedSearchJump"];
  selectedRecallLabelId: string;
  selectedRecallSearchQuery: string;
  selectedRecallSessionId: string | null;
  removeEditorAcronym: (index: number) => void;
  removeEditorMetaphor: (index: number) => void;
  requestEditorFocus: () => void;
  requestEditorSave: () => NotesWorkspaceSaveInstruction | null;
  activateNoteTarget: (
    target: NoteEditorTransitionTarget,
    notes: readonly AppNote[],
  ) => NotesWorkspaceActivationResult;
  startNewNoteDraft: () => void;
  selectRecallLabel: (labelId: string) => void;
  selectRecallSearchQuery: (query: string) => void;
  selectRecallSession: (sessionId: string | null) => void;
  syncEditorWithNotes: (notes: readonly AppNote[]) => void;
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
  const [interactionState, setInteractionState] = useState(() =>
    createInitialNotesWorkspaceInteractionState(),
  );
  const [selectedRecallLabelId, setSelectedRecallLabelId] = useState("");
  const [selectedRecallSearchQuery, setSelectedRecallSearchQuery] =
    useState("");
  const [selectedRecallSessionId, setSelectedRecallSessionId] = useState<
    string | null
  >(null);
  const noteEditor = interactionState.noteEditor;

  const applyInteractionResult = useCallback(
    <TResult extends NotesWorkspaceInteractionResult>(result: TResult) => {
      setInteractionState(result.state);

      return result;
    },
    [],
  );

  const getInteractionState = useCallback(
    (): NotesWorkspaceInteractionState => interactionState,
    [interactionState],
  );

  const syncEditorWithNotes = useCallback((notes: readonly AppNote[]) => {
    setInteractionState(
      (currentState) =>
        applyNotesWorkspaceInteractionEvent(currentState, {
          notes,
          type: "notesSynced",
        }).state,
    );
  }, []);

  const updateEditorDraft = useCallback(
    <K extends keyof NoteEditorDraft>(field: K, value: NoteEditorDraft[K]) => {
      setInteractionState(
        (currentState) =>
          applyNotesWorkspaceInteractionEvent(currentState, {
            field,
            type: "editorDraftFieldChanged",
            value,
          }).state,
      );
    },
    [],
  );

  const addEditorMetaphor = useCallback(() => {
    setInteractionState(
      (currentState) =>
        applyNotesWorkspaceInteractionEvent(currentState, {
          type: "editorMetaphorAdded",
        }).state,
    );
  }, []);

  const removeEditorMetaphor = useCallback((index: number) => {
    setInteractionState(
      (currentState) =>
        applyNotesWorkspaceInteractionEvent(currentState, {
          index,
          type: "editorMetaphorRemoved",
        }).state,
    );
  }, []);

  const updateEditorMetaphor = useCallback(
    <K extends keyof AppMetaphor>(
      index: number,
      field: K,
      value: AppMetaphor[K],
    ) => {
      setInteractionState(
        (currentState) =>
          applyNotesWorkspaceInteractionEvent(currentState, {
            field,
            index,
            type: "editorMetaphorChanged",
            value,
          }).state,
      );
    },
    [],
  );

  const addEditorAcronym = useCallback(() => {
    setInteractionState(
      (currentState) =>
        applyNotesWorkspaceInteractionEvent(currentState, {
          type: "editorAcronymAdded",
        }).state,
    );
  }, []);

  const removeEditorAcronym = useCallback((index: number) => {
    setInteractionState(
      (currentState) =>
        applyNotesWorkspaceInteractionEvent(currentState, {
          index,
          type: "editorAcronymRemoved",
        }).state,
    );
  }, []);

  const updateEditorAcronym = useCallback(
    <K extends keyof AppAcronym>(
      index: number,
      field: K,
      value: AppAcronym[K],
    ) => {
      setInteractionState(
        (currentState) =>
          applyNotesWorkspaceInteractionEvent(currentState, {
            field,
            index,
            type: "editorAcronymChanged",
            value,
          }).state,
      );
    },
    [],
  );

  const activateNoteTarget = useCallback(
    (target: NoteEditorTransitionTarget, notes: readonly AppNote[]) => {
      const result = applyNotesWorkspaceInteractionEvent(
        getInteractionState(),
        {
          notes,
          target,
          type: "noteTargetActivated",
        },
      );

      return applyInteractionResult(result);
    },
    [applyInteractionResult, getInteractionState],
  );

  const cancelPendingWorkspaceTransition = useCallback(() => {
    applyInteractionResult(
      applyNotesWorkspaceInteractionEvent(getInteractionState(), {
        type: "pendingTransitionCanceled",
      }),
    );
  }, [applyInteractionResult, getInteractionState]);

  const discardPendingWorkspaceTransition = useCallback(
    (notes: readonly AppNote[]) => {
      const result = applyNotesWorkspaceInteractionEvent(
        getInteractionState(),
        {
          notes,
          type: "pendingTransitionDiscarded",
        },
      );

      return applyInteractionResult(result);
    },
    [applyInteractionResult, getInteractionState],
  );

  const startDraft = useCallback(() => {
    applyInteractionResult(
      applyNotesWorkspaceInteractionEvent(getInteractionState(), {
        type: "newNoteDraftStarted",
      }),
    );
  }, [applyInteractionResult, getInteractionState]);

  const discardEditorChanges = useCallback(
    (notes: readonly AppNote[]) => {
      applyInteractionResult(
        applyNotesWorkspaceInteractionEvent(getInteractionState(), {
          notes,
          type: "editorChangesDiscarded",
        }),
      );
    },
    [applyInteractionResult, getInteractionState],
  );

  const markSaved = useCallback(
    (note: AppNote) => {
      return applyInteractionResult(
        applyNotesWorkspaceInteractionEvent(getInteractionState(), {
          note,
          type: "noteSaved",
        }),
      );
    },
    [applyInteractionResult, getInteractionState],
  );

  const clearPendingSearchJump = useCallback(() => {
    applyInteractionResult(
      applyNotesWorkspaceInteractionEvent(getInteractionState(), {
        type: "pendingSearchJumpCleared",
      }),
    );
  }, [applyInteractionResult, getInteractionState]);

  const requestEditorFocus = useCallback(() => {
    applyInteractionResult(
      applyNotesWorkspaceInteractionEvent(getInteractionState(), {
        type: "editorFocusRequested",
      }),
    );
  }, [applyInteractionResult, getInteractionState]);

  const requestEditorSave = useCallback(() => {
    const result = applyInteractionResult(
      applyNotesWorkspaceInteractionEvent(getInteractionState(), {
        type: "saveRequested",
      }),
    );

    return (
      result.instructions.find(
        (instruction): instruction is NotesWorkspaceSaveInstruction => {
          return (
            instruction.type === "createNote" ||
            instruction.type === "updateNote"
          );
        },
      ) ?? null
    );
  }, [applyInteractionResult, getInteractionState]);

  const selectRecallLabel = useCallback((labelId: string) => {
    setSelectedRecallLabelId(labelId);
  }, []);

  const selectRecallSearchQuery = useCallback((query: string) => {
    setSelectedRecallSearchQuery(query);
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
    editorFocusRequestNonce: interactionState.editorFocusRequestNonce,
    hasPendingWorkspaceTransition:
      hasPendingNotesWorkspaceInteractionTransition(interactionState),
    hasUnsavedNoteChanges:
      hasUnsavedNotesWorkspaceInteractionChanges(interactionState),
    markEditorSaved: markSaved,
    noteEditor,
    pendingSearchJump: interactionState.pendingSearchJump,
    selectedRecallLabelId,
    selectedRecallSearchQuery,
    selectedRecallSessionId,
    removeEditorAcronym,
    removeEditorMetaphor,
    requestEditorFocus,
    requestEditorSave,
    selectRecallLabel,
    selectRecallSearchQuery,
    selectRecallSession,
    startNewNoteDraft: startDraft,
    syncEditorWithNotes,
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
