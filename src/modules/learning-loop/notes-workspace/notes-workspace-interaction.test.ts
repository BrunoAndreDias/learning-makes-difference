import { describe, expect, it } from "vitest";

import type { AppNoteSearchResult } from "./note-search";
import type { AppNote } from "./notes";
import {
  applyNotesWorkspaceInteractionEvent,
  createInitialNotesWorkspaceInteractionState,
  hasPendingNotesWorkspaceInteractionTransition,
  hasUnsavedNotesWorkspaceInteractionChanges,
} from "./notes-workspace-interaction";

const createKey = (() => {
  let index = 0;

  return () => {
    index += 1;
    return `key-${index}`;
  };
})();

function buildNote(overrides: Partial<AppNote> & Pick<AppNote, "id">): AppNote {
  const { id, ...rest } = overrides;

  return {
    acronyms: [],
    body: "Body",
    createdAt: "2026-01-01T00:00:00.000Z",
    id,
    labelIds: [],
    metaphors: [],
    title: "Title",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...rest,
  };
}

function buildSearchResult(note: AppNote): AppNoteSearchResult {
  return {
    matchChip: "Body",
    note,
    target: {
      field: "body",
      match: {
        end: 4,
        start: 0,
      },
    },
  };
}

describe("NotesWorkspaceInteraction", () => {
  it("preserves state identity when synced Notes do not change the editor", () => {
    const notes = [buildNote({ id: "note-1", title: "Stable" })];
    const state = createInitialNotesWorkspaceInteractionState(notes, createKey);

    const synced = applyNotesWorkspaceInteractionEvent(state, {
      notes: [...notes],
      type: "notesSynced",
    });

    expect(synced.state).toBe(state);
  });

  it("activates Notes as interaction state transitions", () => {
    const notes = [
      buildNote({ id: "note-1", title: "First" }),
      buildNote({ id: "note-2", title: "Second" }),
    ];
    const initialState = createInitialNotesWorkspaceInteractionState(
      notes,
      createKey,
    );

    const opened = applyNotesWorkspaceInteractionEvent(initialState, {
      notes,
      target: { noteId: "note-2", type: "note" },
      type: "noteTargetActivated",
    });

    expect(opened.status).toBe("activated");
    expect(opened.instructions).toEqual([]);
    expect(opened.state.noteEditor.selectedNoteId).toBe("note-2");
  });

  it("keeps dirty Note activation pending and declares discard confirmation", () => {
    const notes = [
      buildNote({ body: "Original body", id: "note-1", title: "First" }),
      buildNote({ body: "Target body", id: "note-2", title: "Second" }),
    ];
    const dirtyResult = applyNotesWorkspaceInteractionEvent(
      createInitialNotesWorkspaceInteractionState(notes, createKey),
      {
        field: "body",
        type: "editorDraftFieldChanged",
        value: "Unsaved body",
      },
    );

    const pending = applyNotesWorkspaceInteractionEvent(dirtyResult.state, {
      notes,
      target: { result: buildSearchResult(notes[1]), type: "searchResult" },
      type: "noteTargetActivated",
    });

    expect(pending.status).toBe("pending");
    expect(hasPendingNotesWorkspaceInteractionTransition(pending.state)).toBe(
      true,
    );
    expect(pending.state.noteEditor.selectedNoteId).toBe("note-1");
    expect(pending.instructions).toEqual([
      {
        target: { result: buildSearchResult(notes[1]), type: "searchResult" },
        type: "showDiscardConfirmation",
      },
    ]);
  });

  it("applies a discarded search transition and declares the search-result focus jump", () => {
    const notes = [
      buildNote({ body: "Original body", id: "note-1", title: "First" }),
      buildNote({ body: "Target body", id: "note-2", title: "Second" }),
    ];
    const searchResult = buildSearchResult(notes[1]);
    const dirtyResult = applyNotesWorkspaceInteractionEvent(
      createInitialNotesWorkspaceInteractionState(notes, createKey),
      {
        field: "body",
        type: "editorDraftFieldChanged",
        value: "Unsaved body",
      },
    );
    const pending = applyNotesWorkspaceInteractionEvent(dirtyResult.state, {
      notes,
      target: { result: searchResult, type: "searchResult" },
      type: "noteTargetActivated",
    });

    const discarded = applyNotesWorkspaceInteractionEvent(pending.state, {
      notes,
      type: "pendingTransitionDiscarded",
    });

    expect(discarded.status).toBe("activated");
    expect(discarded.completedSearchJump).toEqual(searchResult);
    expect(discarded.state.pendingSearchJump).toEqual(searchResult);
    expect(discarded.state.noteEditor.selectedNoteId).toBe("note-2");
    expect(discarded.instructions).toEqual([
      {
        result: searchResult,
        type: "focusSearchResult",
      },
    ]);
  });

  it("declares create instructions before save and capture instructions after save", () => {
    const state = applyNotesWorkspaceInteractionEvent(
      createInitialNotesWorkspaceInteractionState([], createKey),
      {
        field: "title",
        type: "editorDraftFieldChanged",
        value: "New concept",
      },
    ).state;

    const saveRequested = applyNotesWorkspaceInteractionEvent(state, {
      type: "saveRequested",
    });

    expect(saveRequested.instructions).toEqual([
      {
        input: {
          acronyms: [],
          body: "",
          labelIds: [],
          metaphors: [],
          title: "New concept",
        },
        type: "createNote",
      },
    ]);

    const savedNote = buildNote({ id: "note-created", title: "New concept" });
    const noteSaved = applyNotesWorkspaceInteractionEvent(saveRequested.state, {
      note: savedNote,
      type: "noteSaved",
    });

    expect(hasUnsavedNotesWorkspaceInteractionChanges(noteSaved.state)).toBe(
      false,
    );
    expect(noteSaved.instructions).toEqual([
      {
        note: savedNote,
        type: "captureStudyActivity",
      },
    ]);
  });

  it("declares update instructions for the selected Note", () => {
    const notes = [buildNote({ id: "note-1", title: "Original title" })];
    const dirtyResult = applyNotesWorkspaceInteractionEvent(
      createInitialNotesWorkspaceInteractionState(notes, createKey),
      {
        field: "title",
        type: "editorDraftFieldChanged",
        value: "Updated title",
      },
    );

    const saveRequested = applyNotesWorkspaceInteractionEvent(
      dirtyResult.state,
      {
        type: "saveRequested",
      },
    );

    expect(saveRequested.instructions).toEqual([
      {
        input: {
          acronyms: [],
          body: "Body",
          labelIds: [],
          metaphors: [],
          title: "Updated title",
        },
        noteId: "note-1",
        type: "updateNote",
      },
    ]);
  });
});
