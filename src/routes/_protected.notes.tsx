import { createFileRoute } from "@tanstack/react-router";
import {
  type FormEvent,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import type { AppLabel } from "../lib/labels";
import {
  type AppAcronym,
  type AppMetaphor,
  type AppNote,
  AppNotesError,
  type AppStoredNote,
  filterNotesByQuery,
  listNotesForUser,
} from "../lib/notes";
import type { AppSessionSnapshot } from "../lib/session";

export const Route = createFileRoute("/_protected/notes")({
  component: NotesWorkspace,
});

type NoteMetaphorEditor = AppMetaphor & {
  key: string;
};

type NoteAcronymEditor = AppAcronym & {
  key: string;
};

type NoteEditorState = {
  acronyms: NoteAcronymEditor[];
  body: string;
  labelIds: string[];
  metaphors: NoteMetaphorEditor[];
  title: string;
};

const emptyEditorState: NoteEditorState = {
  acronyms: [],
  body: "",
  labelIds: [],
  metaphors: [],
  title: "",
};

function createEditorKey(): string {
  return globalThis.crypto.randomUUID();
}

function createNoteMetaphorEditor(
  metaphor: AppMetaphor = {
    explanation: "",
    title: "",
  },
): NoteMetaphorEditor {
  return {
    ...metaphor,
    key: createEditorKey(),
  };
}

function createNoteAcronymEditor(
  acronym: AppAcronym = {
    expansion: "",
    shortForm: "",
  },
): NoteAcronymEditor {
  return {
    ...acronym,
    key: createEditorKey(),
  };
}

function toStoredMetaphor(metaphor: NoteMetaphorEditor): AppMetaphor {
  return {
    explanation: metaphor.explanation,
    title: metaphor.title,
  };
}

function toStoredAcronym(acronym: NoteAcronymEditor): AppAcronym {
  return {
    expansion: acronym.expansion,
    shortForm: acronym.shortForm,
  };
}

function getEditorState(note: AppNote | null): NoteEditorState {
  if (note === null) {
    return emptyEditorState;
  }

  return {
    acronyms: note.acronyms.map((acronym) => createNoteAcronymEditor(acronym)),
    body: note.body,
    labelIds: note.labelIds,
    metaphors: note.metaphors.map((metaphor) =>
      createNoteMetaphorEditor(metaphor),
    ),
    title: note.title,
  };
}

function haveSameItems<T>(
  left: readonly T[],
  right: readonly T[],
  areEqual: (leftItem: T, rightItem: T) => boolean,
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((leftItem, index) => {
    const rightItem = right[index];

    if (rightItem === undefined) {
      return false;
    }

    return areEqual(leftItem, rightItem);
  });
}

function haveSameLabelIds(left: string[], right: string[]): boolean {
  return haveSameItems(left, right, (leftLabelId, rightLabelId) => {
    return leftLabelId === rightLabelId;
  });
}

function haveSameMetaphors(left: AppMetaphor[], right: AppMetaphor[]): boolean {
  return haveSameItems(left, right, (leftMetaphor, rightMetaphor) => {
    return (
      leftMetaphor.title === rightMetaphor.title &&
      leftMetaphor.explanation === rightMetaphor.explanation
    );
  });
}

function haveSameAcronyms(left: AppAcronym[], right: AppAcronym[]): boolean {
  return haveSameItems(left, right, (leftAcronym, rightAcronym) => {
    return (
      leftAcronym.shortForm === rightAcronym.shortForm &&
      leftAcronym.expansion === rightAcronym.expansion
    );
  });
}

function isSameEditorState(
  left: NoteEditorState,
  right: NoteEditorState,
): boolean {
  return (
    left.title === right.title &&
    left.body === right.body &&
    haveSameLabelIds(left.labelIds, right.labelIds) &&
    haveSameMetaphors(left.metaphors, right.metaphors) &&
    haveSameAcronyms(left.acronyms, right.acronyms)
  );
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
  const [searchQuery, setSearchQuery] = useState("");
  const filteredNotes = filterNotesByQuery(notes, searchQuery);
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
  const selectedNoteStillExists =
    selectedNoteId !== null && notes.some((note) => note.id === selectedNoteId);

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

    if (selectedNoteStillExists) {
      return;
    }

    setSelectedNoteId(firstNoteId);
  }, [firstNoteId, isCreatingNew, selectedNoteStillExists]);

  useEffect(() => {
    const currentUserNotesSnapshot =
      userId === null
        ? []
        : notesSnapshot.filter((note) => note.userId === userId);
    const nextSelectedNote =
      isCreatingNew || selectedNoteId === null
        ? null
        : (currentUserNotesSnapshot.find(
            (note) => note.id === selectedNoteId,
          ) ?? null);
    const nextEditorState = getEditorState(nextSelectedNote);

    setEditorState((currentState) => {
      if (nextSelectedNote === null) {
        return isSameEditorState(currentState, emptyEditorState)
          ? currentState
          : emptyEditorState;
      }

      if (isSameEditorState(currentState, nextEditorState)) {
        return currentState;
      }

      return nextEditorState;
    });
  }, [isCreatingNew, notesSnapshot, selectedNoteId, userId]);

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
      metaphors: [...currentState.metaphors, createNoteMetaphorEditor()],
    }));
  }

  function handleAddAcronym() {
    setEditorState((currentState) => ({
      ...currentState,
      acronyms: [...currentState.acronyms, createNoteAcronymEditor()],
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

  function handleAcronymChange<K extends keyof AppAcronym>(
    index: number,
    field: K,
    value: AppAcronym[K],
  ) {
    setEditorState((currentState) => ({
      ...currentState,
      acronyms: currentState.acronyms.map((acronym, acronymIndex) => {
        if (acronymIndex !== index) {
          return acronym;
        }

        return {
          ...acronym,
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

  function handleRemoveAcronym(index: number) {
    setEditorState((currentState) => ({
      ...currentState,
      acronyms: currentState.acronyms.filter(
        (_, acronymIndex) => acronymIndex !== index,
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
        const createdNote = notesContext.createNote(userId, {
          acronyms: editorState.acronyms.map(toStoredAcronym),
          body: editorState.body,
          labelIds: editorState.labelIds,
          metaphors: editorState.metaphors.map(toStoredMetaphor),
          title: editorState.title,
        });

        setIsCreatingNew(false);
        setSelectedNoteId(createdNote.id);
        return;
      }

      notesContext.updateNote(userId, selectedNote.id, {
        acronyms: editorState.acronyms.map(toStoredAcronym),
        body: editorState.body,
        labelIds: editorState.labelIds,
        metaphors: editorState.metaphors.map(toStoredMetaphor),
        title: editorState.title,
      });
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

          <label className="notes-form__field">
            <span>Search notes</span>
            <input
              name="search"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search note text, metaphors, and acronyms"
              type="search"
              value={searchQuery}
            />
          </label>

          {notes.length === 0 ? (
            <p className="muted">No notes yet</p>
          ) : filteredNotes.length === 0 ? (
            <p className="muted">No notes match this search.</p>
          ) : (
            <ul className="notes-list__items">
              {filteredNotes.map((note) => {
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
                      key={metaphor.key}
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

            <section aria-label="Acronyms" className="notes-acronyms">
              <div className="notes-acronyms__header">
                <div className="stack">
                  <p className="section-label">Memory aids</p>
                  <h4>Acronyms on this note</h4>
                  <p className="muted">
                    Keep mnemonic expansions beside the concept they support.
                  </p>
                </div>

                <button
                  className="notes-action"
                  onClick={handleAddAcronym}
                  type="button"
                >
                  Add acronym
                </button>
              </div>

              {editorState.acronyms.length === 0 ? (
                <p className="muted">
                  No acronyms yet. Add one when a compact mnemonic helps recall.
                </p>
              ) : (
                <div className="notes-acronyms__list">
                  {editorState.acronyms.map((acronym, index) => (
                    <fieldset
                      aria-label="Acronym editor"
                      className="notes-acronym"
                      key={acronym.key}
                    >
                      <legend>{`Acronym ${index + 1}`}</legend>

                      <label className="notes-form__field">
                        <span>Acronym</span>
                        <input
                          aria-label="Acronym"
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
