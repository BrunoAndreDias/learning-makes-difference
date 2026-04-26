export type RecallSelectionState = {
  isSelectingForRecall: boolean;
  selectedCount: number;
  selectedNoteIds: string[];
};

function createRecallSelectionState(input: {
  isSelectingForRecall: boolean;
  selectedNoteIds: string[];
}): RecallSelectionState {
  return {
    isSelectingForRecall: input.isSelectingForRecall,
    selectedCount: input.selectedNoteIds.length,
    selectedNoteIds: input.selectedNoteIds,
  };
}

export function createInitialRecallSelectionState(): RecallSelectionState {
  return createRecallSelectionState({
    isSelectingForRecall: false,
    selectedNoteIds: [],
  });
}

export function enterRecallSelectionMode(
  state: RecallSelectionState,
): RecallSelectionState {
  return createRecallSelectionState({
    isSelectingForRecall: true,
    selectedNoteIds: state.selectedNoteIds,
  });
}

export function toggleRecallSelectionNote(
  state: RecallSelectionState,
  noteId: string,
): RecallSelectionState {
  const selectedNoteIds = state.selectedNoteIds.includes(noteId)
    ? state.selectedNoteIds.filter(
        (selectedNoteId) => selectedNoteId !== noteId,
      )
    : [...state.selectedNoteIds, noteId];

  return createRecallSelectionState({
    isSelectingForRecall: state.isSelectingForRecall,
    selectedNoteIds,
  });
}

export function cancelRecallSelectionMode(): RecallSelectionState {
  return createInitialRecallSelectionState();
}

export function completeRecallSelection(state: RecallSelectionState): {
  noteIds: string[];
  state: RecallSelectionState;
} {
  return {
    noteIds: state.selectedNoteIds,
    state: createInitialRecallSelectionState(),
  };
}
