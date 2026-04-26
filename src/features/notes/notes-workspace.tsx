import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

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
  clearPendingSidebarAction: (nonce: number) => void;
  pendingSidebarAction: NotesWorkspaceSidebarAction | null;
  requestNewNote: () => void;
  requestSelectNote: (noteId: string) => void;
  setActiveNoteId: (noteId: string | null) => void;
};

const NotesWorkspaceContext = createContext<NotesWorkspaceContextValue | null>(
  null,
);

export function NotesWorkspaceProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [pendingSidebarAction, setPendingSidebarAction] =
    useState<NotesWorkspaceSidebarAction | null>(null);
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

  const value: NotesWorkspaceContextValue = {
    activeNoteId,
    clearPendingSidebarAction,
    pendingSidebarAction,
    requestNewNote,
    requestSelectNote,
    setActiveNoteId,
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
