import { describe, expect, it } from "vitest";

import {
  addNoteEditorMetaphor,
  cancelNoteEditorTransition,
  createInitialNoteEditorState,
  discardAndApplyNoteEditorTransition,
  getNoteEditorSaveInput,
  getSelectedNote,
  isNoteEditorDirty,
  requestNoteEditorTransition,
  startNewNoteDraft,
  syncNoteEditorWithNotes,
  updateNoteEditorDraftField,
} from "./note-editor";
import type { AppNote } from "./notes";

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

describe("Note editor model", () => {
  it("starts from the first Note and tracks dirty state against its baseline", () => {
    const note = buildNote({
      body: "Original body",
      id: "note-1",
      title: "Original title",
    });
    const state = createInitialNoteEditorState([note], createKey);

    expect(state.mode).toBe("editing");
    expect(state.selectedNoteId).toBe("note-1");
    expect(isNoteEditorDirty(state)).toBe(false);

    const nextState = updateNoteEditorDraftField(
      state,
      "title",
      "Changed title",
    );

    expect(isNoteEditorDirty(nextState)).toBe(true);
    expect(getNoteEditorSaveInput(nextState)).toMatchObject({
      body: "Original body",
      title: "Changed title",
    });
  });

  it("keeps the selected noteId and refreshes clean drafts from the latest Notes collection", () => {
    const state = createInitialNoteEditorState(
      [buildNote({ id: "note-1", title: "Old title" })],
      createKey,
    );

    const nextState = syncNoteEditorWithNotes(
      state,
      [buildNote({ id: "note-1", title: "New title" })],
      createKey,
    );

    expect(nextState.selectedNoteId).toBe("note-1");
    expect(nextState.draft.title).toBe("New title");
    expect(isNoteEditorDirty(nextState)).toBe(false);
  });

  it("preserves dirty drafts when the Notes collection changes", () => {
    const state = updateNoteEditorDraftField(
      createInitialNoteEditorState(
        [buildNote({ id: "note-1", title: "Old title" })],
        createKey,
      ),
      "title",
      "Unsaved title",
    );

    const nextState = syncNoteEditorWithNotes(
      state,
      [buildNote({ id: "note-1", title: "External title" })],
      createKey,
    );

    expect(nextState.draft.title).toBe("Unsaved title");
    expect(isNoteEditorDirty(nextState)).toBe(true);
  });

  it("guards transitions away from a dirty draft and applies them after discard", () => {
    const notes = [
      buildNote({ id: "note-1", title: "First" }),
      buildNote({ id: "note-2", title: "Second" }),
    ];
    const dirtyState = updateNoteEditorDraftField(
      createInitialNoteEditorState(notes, createKey),
      "body",
      "Unsaved body",
    );

    const guarded = requestNoteEditorTransition(
      dirtyState,
      { noteId: "note-2", type: "note" },
      notes,
      createKey,
    );

    expect(guarded.state.selectedNoteId).toBe("note-1");
    expect(guarded.state.pendingTransition).toEqual({
      noteId: "note-2",
      type: "note",
    });

    const canceledState = cancelNoteEditorTransition(guarded.state);

    expect(canceledState.pendingTransition).toBeNull();
    expect(canceledState.selectedNoteId).toBe("note-1");

    const discarded = discardAndApplyNoteEditorTransition(
      guarded.state,
      notes,
      createKey,
    );

    expect(discarded.state.selectedNoteId).toBe("note-2");
    expect(discarded.state.pendingTransition).toBeNull();
    expect(discarded.state.draft.title).toBe("Second");
  });

  it("keeps new Note drafts independent from the Notes collection", () => {
    const state = updateNoteEditorDraftField(
      addNoteEditorMetaphor(startNewNoteDraft(), createKey),
      "title",
      "Draft title",
    );

    const nextState = syncNoteEditorWithNotes(
      state,
      [buildNote({ id: "note-1" })],
      createKey,
    );

    expect(nextState.mode).toBe("draft");
    expect(nextState.selectedNoteId).toBeNull();
    expect(
      getSelectedNote(nextState, [buildNote({ id: "note-1" })]),
    ).toBeNull();
    expect(nextState.draft.title).toBe("Draft title");
    expect(nextState.draft.metaphors).toHaveLength(1);
  });
});
