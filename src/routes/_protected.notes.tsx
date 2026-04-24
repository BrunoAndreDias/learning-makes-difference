import { createFileRoute } from "@tanstack/react-router";
import {
  type FormEvent,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import {
  type AppNote,
  AppNotesError,
  type AppStoredNote,
  listNotesForUser,
} from "../lib/notes";
import type { AppSessionSnapshot } from "../lib/session";

export const Route = createFileRoute("/_protected/notes")({
  component: NotesWorkspace,
});

type NoteEditorState = {
  body: string;
  title: string;
};

const emptyEditorState: NoteEditorState = {
  body: "",
  title: "",
};

function NotesWorkspace() {
  const notesContext = Route.useRouteContext({
    select: (context) => context.notes,
  });
  const sessionContext = Route.useRouteContext({
    select: (context) => context.session,
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
  const [isCreatingNew, setIsCreatingNew] = useState(notes.length === 0);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    notes[0]?.id ?? null,
  );
  const [editorState, setEditorState] = useState<NoteEditorState>(() => {
    const selectedNote = notes[0];

    if (selectedNote === undefined) {
      return emptyEditorState;
    }

    return {
      body: selectedNote.body,
      title: selectedNote.title,
    };
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedNote =
    isCreatingNew || selectedNoteId === null
      ? null
      : (notes.find((note) => note.id === selectedNoteId) ?? null);
  const isCreating = selectedNote === null;

  useEffect(() => {
    if (notes.length === 0) {
      setIsCreatingNew(true);
      setSelectedNoteId(null);
      return;
    }

    if (isCreatingNew) {
      return;
    }

    if (selectedNoteId !== null && selectedNote !== null) {
      return;
    }

    setSelectedNoteId(notes[0].id);
  }, [isCreatingNew, notes, selectedNote, selectedNoteId]);

  useEffect(() => {
    if (selectedNote === null) {
      setEditorState((currentState) => {
        if (
          currentState.title === emptyEditorState.title &&
          currentState.body === emptyEditorState.body
        ) {
          return currentState;
        }

        return emptyEditorState;
      });
      return;
    }

    setEditorState((currentState) => {
      if (
        currentState.title === selectedNote.title &&
        currentState.body === selectedNote.body
      ) {
        return currentState;
      }

      return {
        body: selectedNote.body,
        title: selectedNote.title,
      };
    });
  }, [selectedNote]);

  function handleEditorChange<K extends keyof NoteEditorState>(
    field: K,
    value: NoteEditorState[K],
  ) {
    setEditorState((currentState) => ({
      ...currentState,
      [field]: value,
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      if (selectedNote === null) {
        const createdNote = notesContext.createNote(userId, editorState);

        setIsCreatingNew(false);
        setSelectedNoteId(createdNote.id);
        return;
      }

      notesContext.updateNote(userId, selectedNote.id, editorState);
    } catch (error) {
      if (error instanceof AppNotesError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    }
  }

  return (
    <section className="stack">
      <article className="card stack panel-protected">
        <p className="section-label">Protected route</p>
        <h3>Notes workspace</h3>
        <p>
          Browse your notes, capture new concepts, and refine existing drafts
          without leaving the authenticated shell.
        </p>
      </article>

      <div className="notes-layout">
        <aside className="card stack notes-list" aria-label="Notes list">
          <div className="notes-list__header">
            <div className="stack">
              <p className="section-label">Your notes</p>
              <h3>Browse notes</h3>
            </div>

            <button
              className="notes-action"
              onClick={handleNewNote}
              type="button"
            >
              New note
            </button>
          </div>

          {notes.length === 0 ? (
            <p className="muted">No notes yet</p>
          ) : (
            <ul className="notes-list__items">
              {notes.map((note) => {
                const isActive = note.id === selectedNote?.id;

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
                      <span>{note.body}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <article className="card stack notes-editor">
          <div className="notes-editor__header">
            <div className="stack">
              <p className="section-label">Editor</p>
              <h3>{isCreating ? "Create note" : "Edit note"}</h3>
              <p className="muted">
                Notes remain valid without labels, so capture the concept first
                and organize it later.
              </p>
            </div>
          </div>

          <form
            aria-label="Note editor"
            className="notes-form"
            onSubmit={handleSubmit}
          >
            <label className="notes-form__field">
              <span>Title</span>
              <input
                name="title"
                onChange={(event) =>
                  handleEditorChange("title", event.target.value)
                }
                placeholder="One concept per note"
                type="text"
                value={editorState.title}
              />
            </label>

            <label className="notes-form__field">
              <span>Body</span>
              <textarea
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

            <div className="notes-editor__actions">
              <button
                className="notes-action notes-action-primary"
                type="submit"
              >
                {isCreating ? "Create note" : "Save changes"}
              </button>
            </div>
          </form>
        </article>
      </div>
    </section>
  );
}
