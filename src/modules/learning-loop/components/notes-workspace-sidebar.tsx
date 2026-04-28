import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { AppSessionSnapshot } from "../../../features/session/session";
import { listNotesForUser } from "../domain/notes";
import { useNotesWorkspace } from "../domain/notes-workspace";
import { AppRecallError } from "../domain/recall";

function formatSidebarNoteDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

export function NotesWorkspaceSidebar({
  isSidebarVisible,
  isMobileSidebarOpen,
  closeMobileSidebar,
}: Readonly<{
  isSidebarVisible: boolean;
  isMobileSidebarOpen: boolean;
  closeMobileSidebar: () => void;
}>) {
  const notesContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.notes,
  });
  const session = useRouteContext({
    from: "/_protected",
    select: (context) => context.session,
  });
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
  });
  const navigate = useNavigate();
  const {
    activateNoteTarget,
    activeNoteId,
    cancelRecallSelection,
    noteEditor,
    recallSelection,
    requestEditorFocus,
    requestRecallStart,
    startNewNoteDraft,
  } = useNotesWorkspace();
  const isDraftingNewNote = noteEditor.mode === "draft";
  const [recallStartError, setRecallStartError] = useState<string | null>(null);
  const activeNoteRef = useRef<HTMLButtonElement | null>(null);
  const sessionSnapshot = useSyncExternalStore<AppSessionSnapshot>(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const notesSnapshot = useSyncExternalStore(
    notesContext.subscribe,
    notesContext.getSnapshot,
    notesContext.getSnapshot,
  );
  const notes = listNotesForUser(
    notesSnapshot,
    sessionSnapshot.user?.id ?? null,
  );
  const recalledNoteIds = new Set(recallSelection.selectedNoteIds);
  const userId = sessionSnapshot.user?.id ?? null;
  const isSelectingForRecall = recallSelection.isSelectingForRecall;

  async function handleStartRecall() {
    if (userId === null || recallSelection.selectedCount === 0) {
      return;
    }

    const result = requestRecallStart();

    if (result.status !== "ready") {
      return;
    }

    try {
      recallContext.startFlashCardSession({
        noteIds: result.noteIds,
        userId,
      });
      setRecallStartError(null);
      closeMobileSidebar();
      await navigate({ to: "/notes/recall" });
    } catch (error) {
      if (error instanceof AppRecallError) {
        setRecallStartError(error.message);
        return;
      }

      throw error;
    }
  }

  function handleCancelRecall() {
    cancelRecallSelection();
    setRecallStartError(null);
  }

  function handleSidebarAction(action: () => void) {
    if (isMobileSidebarOpen) {
      requestEditorFocus();
    }

    action();
    closeMobileSidebar();
  }

  function handleNoteClick(noteId: string) {
    const result = activateNoteTarget(
      {
        noteId,
        type: "note",
      },
      notes,
    );

    if (result.status === "selectedForRecall") {
      return;
    }

    if (isMobileSidebarOpen) {
      requestEditorFocus();
    }

    closeMobileSidebar();
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: activeNoteId changes which button owns the ref and must retrigger the scroll.
  useEffect(() => {
    if (!isSidebarVisible) {
      return;
    }

    activeNoteRef.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [activeNoteId, isSidebarVisible]);

  return (
    <section
      className="app-sidebar__workspace"
      aria-label="Notes sidebar"
      data-recall-selection-mode={isSelectingForRecall ? "true" : undefined}
    >
      <div className="app-sidebar__workspace-header">
        <h3>All notes</h3>
        {isSelectingForRecall ? (
          <button
            className="notes-action notes-action-primary app-sidebar__primary-action"
            disabled={recallSelection.selectedCount === 0}
            onClick={() => void handleStartRecall()}
            type="button"
          >
            Start recall
          </button>
        ) : (
          <button
            className="notes-action notes-action-primary app-sidebar__primary-action"
            disabled={isDraftingNewNote || activeNoteId === null}
            onClick={() => handleSidebarAction(startNewNoteDraft)}
            type="button"
          >
            New note
          </button>
        )}
      </div>
      {isSelectingForRecall ? (
        <div
          className="app-sidebar__recall-status"
          role="status"
          aria-live="polite"
        >
          <span className="app-sidebar__recall-status-count">
            <span
              aria-hidden="true"
              className="app-sidebar__recall-status-dot"
            />
            <span className="app-sidebar__recall-status-label">
              {recallSelection.selectedCount === 0
                ? "Tap to add"
                : `${recallSelection.selectedCount} selected`}
            </span>
          </span>
          <button
            className="app-sidebar__recall-cancel"
            onClick={handleCancelRecall}
            type="button"
          >
            Cancel
          </button>
        </div>
      ) : null}
      {recallStartError !== null ? (
        <p className="app-sidebar__recall-error" role="alert">
          {recallStartError}
        </p>
      ) : null}

      <nav aria-label="Notes list" className="app-sidebar__workspace-nav">
        {notes.length === 0 ? (
          <p className="muted">No notes yet</p>
        ) : (
          <ul className="app-sidebar__workspace-list">
            {notes.map((note) => {
              const isRecallSelected = recalledNoteIds.has(note.id);

              return (
                <li key={note.id}>
                  <button
                    aria-label={note.title}
                    aria-current={
                      !isSelectingForRecall && activeNoteId === note.id
                        ? "page"
                        : undefined
                    }
                    aria-pressed={
                      isSelectingForRecall ? isRecallSelected : undefined
                    }
                    className="app-sidebar__workspace-link"
                    data-recall-selected={isRecallSelected ? "true" : undefined}
                    onClick={() => handleNoteClick(note.id)}
                    ref={
                      !isSelectingForRecall && activeNoteId === note.id
                        ? activeNoteRef
                        : null
                    }
                    type="button"
                  >
                    <span>{note.title}</span>
                    <span
                      aria-hidden="true"
                      className="app-sidebar__workspace-meta"
                    >
                      {formatSidebarNoteDate(note.updatedAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </section>
  );
}
