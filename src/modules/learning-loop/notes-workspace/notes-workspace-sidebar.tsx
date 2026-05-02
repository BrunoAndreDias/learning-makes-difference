import { useRouteContext } from "@tanstack/react-router";
import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { AppSessionSnapshot } from "../../access/domain/session";
import {
  deriveLearningStates,
  formatLearningStateStatusLabel,
  toNoteRecallHistories,
} from "../shared/learning-state";
import { listNotesForUser } from "./notes";
import { useNotesWorkspace } from "./notes-workspace";

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
  const {
    activateNoteTarget,
    activeNoteId,
    noteEditor,
    requestEditorFocus,
    startNewNoteDraft,
  } = useNotesWorkspace();
  const isDraftingNewNote = noteEditor.mode === "draft";
  const activeNoteRef = useRef<HTMLButtonElement | null>(null);
  const sessionSnapshot = useSyncExternalStore<AppSessionSnapshot>(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
  });
  const notesSnapshot = useSyncExternalStore(
    notesContext.subscribe,
    notesContext.getSnapshot,
    notesContext.getSnapshot,
  );
  const recallResultsSnapshot = useSyncExternalStore(
    recallContext.subscribe,
    recallContext.getSessionResultsSnapshot,
    recallContext.getSessionResultsSnapshot,
  );
  const notes = listNotesForUser(
    notesSnapshot,
    sessionSnapshot.user?.id ?? null,
  );
  const userId = sessionSnapshot.user?.id ?? null;
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

  function handleSidebarAction(action: () => void) {
    if (isMobileSidebarOpen) {
      requestEditorFocus();
    }

    action();
    closeMobileSidebar();
  }

  function handleNoteClick(noteId: string) {
    activateNoteTarget(
      {
        noteId,
        type: "note",
      },
      notes,
    );

    if (isMobileSidebarOpen) {
      requestEditorFocus();
    }

    closeMobileSidebar();
  }

  function handleDeleteNote(noteId: string) {
    if (userId === null) {
      return;
    }

    notesContext.deleteNote(userId, noteId);
  }

  useLayoutEffect(() => {
    if (!isSidebarVisible || activeNoteId === null) {
      return;
    }

    const activeButton = activeNoteRef.current;

    if (activeButton === null) {
      return;
    }

    activeButton.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [activeNoteId, isSidebarVisible]);

  return (
    <section className="app-sidebar__workspace" aria-label="Notes sidebar">
      <div className="app-sidebar__workspace-header">
        <h3>All notes</h3>
        <button
          className="notes-action notes-action-primary app-sidebar__primary-action"
          disabled={isDraftingNewNote || activeNoteId === null}
          onClick={() => handleSidebarAction(startNewNoteDraft)}
          type="button"
        >
          New note
        </button>
      </div>

      <nav aria-label="Notes list" className="app-sidebar__workspace-nav">
        {notes.length === 0 ? (
          <p className="muted">No notes yet</p>
        ) : (
          <ul className="app-sidebar__workspace-list">
            {notes.map((note) => {
              const learningState = noteLearningStatesById.get(note.id);

              return (
                <li className="app-sidebar__workspace-item" key={note.id}>
                  <button
                    aria-label={note.title}
                    aria-current={activeNoteId === note.id ? "page" : undefined}
                    className="app-sidebar__workspace-link"
                    onClick={() => handleNoteClick(note.id)}
                    ref={activeNoteId === note.id ? activeNoteRef : null}
                    type="button"
                  >
                    <span className="app-sidebar__workspace-summary">
                      <span>{note.title}</span>
                      {learningState === undefined ? null : (
                        <span className="app-sidebar__workspace-state">
                          {formatLearningStateStatusLabel(learningState.status)}
                        </span>
                      )}
                    </span>
                    <span
                      aria-hidden="true"
                      className="app-sidebar__workspace-meta"
                    >
                      {formatSidebarNoteDate(note.updatedAt)}
                    </span>
                  </button>
                  <button
                    aria-label={`Delete ${note.title}`}
                    className="app-sidebar__workspace-delete"
                    onClick={() => handleDeleteNote(note.id)}
                    type="button"
                  >
                    <TrashIcon />
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

function TrashIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M9 4h6" />
      <path d="M10 4l.5-1h3L14 4" />
      <path d="M5 7h14" />
      <path d="M8 7l.7 13h6.6L16 7" />
      <path d="M10.5 10.5v6" />
      <path d="M13.5 10.5v6" />
    </svg>
  );
}
