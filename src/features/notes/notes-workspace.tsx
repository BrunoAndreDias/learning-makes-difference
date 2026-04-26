import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

import {
  cancelRecallSelectionMode,
  completeRecallSelection,
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
  cancelRecallSelection: () => void;
  clearPendingSidebarAction: (nonce: number) => void;
  completeRecallSelection: () => string[];
  enterRecallSelection: () => void;
  editorFocusRequestNonce: number;
  pendingSidebarAction: NotesWorkspaceSidebarAction | null;
  recallSelection: RecallSelectionState;
  requestEditorFocus: () => void;
  requestNewNote: () => void;
  requestSelectNote: (noteId: string) => void;
  setActiveNoteId: (noteId: string | null) => void;
  toggleRecallSelection: (noteId: string) => void;
};

const NotesWorkspaceContext = createContext<NotesWorkspaceContextValue | null>(
  null,
);

export function NotesWorkspaceProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [editorFocusRequestNonce, setEditorFocusRequestNonce] = useState(0);
  const [pendingSidebarAction, setPendingSidebarAction] =
    useState<NotesWorkspaceSidebarAction | null>(null);
  const [recallSelection, setRecallSelection] = useState(() =>
    createInitialRecallSelectionState(),
  );
  const actionNonceRef = useRef(0);

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
    const result = completeRecallSelection(recallSelection);

    setRecallSelection(result.state);

    return result.noteIds;
  }, [recallSelection]);

  const value: NotesWorkspaceContextValue = {
    activeNoteId,
    cancelRecallSelection,
    clearPendingSidebarAction,
    completeRecallSelection: finishRecallSelection,
    enterRecallSelection,
    editorFocusRequestNonce,
    pendingSidebarAction,
    recallSelection,
    requestEditorFocus,
    requestNewNote,
    requestSelectNote,
    setActiveNoteId,
    toggleRecallSelection,
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
