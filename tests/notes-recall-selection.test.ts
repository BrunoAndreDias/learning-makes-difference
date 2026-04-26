import { describe, expect, it } from "vitest";

import {
  cancelRecallSelectionMode,
  completeRecallSelection,
  createInitialRecallSelectionState,
  enterRecallSelectionMode,
  toggleRecallSelectionNote,
} from "../src/features/notes/recall-selection";

describe("notes recall selection", () => {
  it("enters selection mode, toggles notes, derives count, clears on cancel, and hands off selected note ids on start", () => {
    let state = createInitialRecallSelectionState();

    state = enterRecallSelectionMode(state);
    state = toggleRecallSelectionNote(state, "note-1");
    state = toggleRecallSelectionNote(state, "note-2");
    state = toggleRecallSelectionNote(state, "note-1");

    expect(state).toMatchObject({
      isSelectingForRecall: true,
      selectedCount: 1,
      selectedNoteIds: ["note-2"],
    });

    state = cancelRecallSelectionMode();

    expect(state).toMatchObject({
      isSelectingForRecall: false,
      selectedCount: 0,
      selectedNoteIds: [],
    });

    state = enterRecallSelectionMode(state);
    state = toggleRecallSelectionNote(state, "note-3");

    expect(completeRecallSelection(state)).toEqual({
      noteIds: ["note-3"],
      state: {
        isSelectingForRecall: false,
        selectedCount: 0,
        selectedNoteIds: [],
      },
    });
  });
});
