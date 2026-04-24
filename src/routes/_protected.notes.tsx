import { createFileRoute } from "@tanstack/react-router";
import {
  type FormEvent,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import type { AppLabel } from "../lib/labels";
import {
  type AppMetaphor,
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
  labelIds: string[];
  metaphors: AppMetaphor[];
  title: string;
};

const emptyEditorState: NoteEditorState = {
  body: "",
  labelIds: [],
  metaphors: [],
  title: "",
};

function getEditorState(note: AppNote | null): NoteEditorState {
  if (note === null) {
    return emptyEditorState;
  }

  return {
    body: note.body,
    labelIds: note.labelIds,
    metaphors: note.metaphors,
    title: note.title,
  };
}

function haveSameLabelIds(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((labelId, index) => labelId === right[index]);
}

function haveSameMetaphors(
  left: AppMetaphor[],
  right: AppMetaphor[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((metaphor, index) => {
    const rightMetaphor = right[index];

    return (
      metaphor.title === rightMetaphor?.title &&
      metaphor.explanation === rightMetaphor.explanation
    );
  });
}

function NotesWorkspace() {
  const notesContext = Route.useRouteContext({
    select: (context) => context.notes,
  });
  const sessionContext = Route.useRouteContext({
    select: (context) => context.session,
  });
  const labelsContext = Route.useRouteContext({
    select: (context) => context.labels,
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
  const [availableLabels, setAvailableLabels] = useState<AppLabel[]>([]);
  const firstNoteId = notes[0]?.id ?? null;
  const [isCreatingNew, setIsCreatingNew] = useState(notes.length === 0);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    firstNoteId,
  );
  const [editorState, setEditorState] = useState<NoteEditorState>(() =>
    getEditorState(notes[0] ?? null),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedNote =
    isCreatingNew || selectedNoteId === null
      ? null
      : (notes.find((note) => note.id === selectedNoteId) ?? null);
  const isCreating = selectedNote === null;
  const selectedNoteExists =
    selectedNoteId === null
      ? false
      : notesSnapshot.some((note) => note.id === selectedNoteId);

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
    if (firstNoteId === null) {
      setIsCreatingNew(true);
      setSelectedNoteId(null);
      return;
    }

    if (isCreatingNew) {
      return;
    }

    if (selectedNoteExists) {
      return;
    }

    setSelectedNoteId(firstNoteId);
  }, [firstNoteId, isCreatingNew, selectedNoteExists]);

  useEffect(() => {
    const nextSelectedNote =
      isCreatingNew || selectedNoteId === null
        ? null
        : (notesSnapshot.find((note) => note.id === selectedNoteId) ?? null);
    const nextEditorState = getEditorState(nextSelectedNote);

    setEditorState((currentState) => {
      if (nextSelectedNote === null) {
        if (
          currentState.title === emptyEditorState.title &&
          currentState.body === emptyEditorState.body &&
          haveSameLabelIds(currentState.labelIds, emptyEditorState.labelIds) &&
          haveSameMetaphors(
            currentState.metaphors,
            emptyEditorState.metaphors,
          )
        ) {
          return currentState;
        }

        return emptyEditorState;
      }

      if (
        currentState.title === nextEditorState.title &&
        currentState.body === nextEditorState.body &&
        haveSameLabelIds(currentState.labelIds, nextEditorState.labelIds) &&
        haveSameMetaphors(currentState.metaphors, nextEditorState.metaphors)
      ) {
        return currentState;
      }

      return nextEditorState;
    });
  }, [isCreatingNew, notesSnapshot, selectedNoteId]);

  function handleEditorChange<K extends keyof NoteEditorState>(
    field: K,
    value: NoteEditorState[K],
  ) {
    setEditorState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  }

  function handleLabelToggle(labelId: string, checked: boolean) {
    setEditorState((currentState) => {
      if (checked) {
        return {
          ...currentState,
          labelIds: [...new Set([...currentState.labelIds, labelId])],
        };
      }

      return {
        ...currentState,
        labelIds: currentState.labelIds.filter(
          (candidateId) => candidateId !== labelId,
        ),
      };
    });
  }

  function handleAddMetaphor() {
    setEditorState((currentState) => ({
      ...currentState,
      metaphors: [
        ...currentState.metaphors,
        {
          explanation: "",
          title: "",
        },
      ],
    }));
  }

  function handleMetaphorChange<K extends keyof AppMetaphor>(
    index: number,
    field: K,
    value: AppMetaphor[K],
  ) {
    setEditorState((currentState) => ({
      ...currentState,
      metaphors: currentState.metaphors.map((metaphor, metaphorIndex) => {
        if (metaphorIndex !== index) {
          return metaphor;
        }

        return {
          ...metaphor,
          [field]: value,
        };
      }),
    }));
  }

  function handleRemoveMetaphor(index: number) {
    setEditorState((currentState) => ({
      ...currentState,
      metaphors: currentState.metaphors.filter(
        (_, metaphorIndex) => metaphorIndex !== index,
      ),
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

  const selectedLabels = availableLabels.filter((label) =>
    editorState.labelIds.includes(label.id),
  );

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

            <section aria-label="Metaphors" className="notes-metaphors">
              <div className="notes-metaphors__header">
                <div className="stack">
                  <p className="section-label">Memory aids</p>
                  <h4>Metaphors on this note</h4>
                  <p className="muted">
                    Keep concrete analogies with the note they support.
                  </p>
                </div>

                <button
                  className="notes-action"
                  onClick={handleAddMetaphor}
                  type="button"
                >
                  Add metaphor
                </button>
              </div>

              {editorState.metaphors.length === 0 ? (
                <p className="muted">
                  No metaphors yet. Add one when a concept needs a memory hook.
                </p>
              ) : (
                <div className="notes-metaphors__list">
                  {editorState.metaphors.map((metaphor, index) => (
                    <fieldset
                      aria-label="Metaphor editor"
                      className="notes-metaphor"
                      key={`${index}-${metaphor.title}`}
                    >
                      <legend>{`Metaphor ${index + 1}`}</legend>

                      <label className="notes-form__field">
                        <span>Metaphor title</span>
                        <input
                          aria-label="Metaphor title"
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
              )}
            </section>

            <section aria-label="Topic context" className="notes-topic-context">
              <div className="stack">
                <p className="section-label">Topic context</p>
                <h4>Labels on this note</h4>
                {selectedLabels.length === 0 ? (
                  <p className="muted">This note is currently unlabeled.</p>
                ) : (
                  <section aria-label="Assigned labels" className="tag-row">
                    {selectedLabels.map((label) => (
                      <span className="tag" key={label.id}>
                        {label.name}
                      </span>
                    ))}
                  </section>
                )}
              </div>

              {availableLabels.length === 0 ? (
                <p className="muted">
                  Create labels in the Labels area to attach topic context to
                  this note.
                </p>
              ) : (
                <fieldset className="notes-labels">
                  <legend>Assign labels</legend>
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
              )}
            </section>

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
