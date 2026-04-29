import { describe, expect, it } from "vitest";

import {
  createInitialNoteEditorState,
  updateNoteEditorDraftField,
} from "./note-editor";
import type { AppNoteSearchResult } from "./note-search";
import type { AppNote } from "./notes";
import {
  activateNotesWorkspaceNote,
  discardPendingNotesWorkspaceTransition,
} from "./notes-workspace-state";

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

describe("Notes Workspace state", () => {
  it("activates Notes as editor transitions", () => {
    const notes = [
      buildNote({ id: "note-1", title: "First" }),
      buildNote({ id: "note-2", title: "Second" }),
    ];
    const initialState = {
      noteEditor: createInitialNoteEditorState(notes, createKey),
    };

    const opened = activateNotesWorkspaceNote(
      initialState,
      { noteId: "note-2", type: "note" },
      notes,
      createKey,
    );

    expect(opened.status).toBe("activated");
    expect(opened.state.noteEditor.selectedNoteId).toBe("note-2");
  });

  it("keeps dirty Note activation pending until the User discards changes", () => {
    const notes = [
      buildNote({ body: "Original body", id: "note-1", title: "First" }),
      buildNote({ body: "Target body", id: "note-2", title: "Second" }),
    ];
    const dirtyState = {
      noteEditor: updateNoteEditorDraftField(
        createInitialNoteEditorState(notes, createKey),
        "body",
        "Unsaved body",
      ),
    };

    const pending = activateNotesWorkspaceNote(
      dirtyState,
      { result: buildSearchResult(notes[1]), type: "searchResult" },
      notes,
      createKey,
    );

    expect(pending.status).toBe("pending");
    expect(pending.state.noteEditor.selectedNoteId).toBe("note-1");
    expect(pending.state.noteEditor.pendingTransition).toMatchObject({
      type: "searchResult",
    });

    const discarded = discardPendingNotesWorkspaceTransition(
      pending.state,
      notes,
      createKey,
    );

    expect(discarded.status).toBe("activated");
    expect(discarded.completedSearchJump).toMatchObject({
      note: { id: "note-2" },
    });
    expect(discarded.state.noteEditor.selectedNoteId).toBe("note-2");
  });
});
