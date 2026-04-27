export type RecallSelectionState = {
  isSelectingForRecall: boolean;
  pendingStart: boolean;
  selectedCount: number;
  selectedNoteIds: string[];
};

function createRecallSelectionState(input: {
  isSelectingForRecall: boolean;
  pendingStart?: boolean;
  selectedNoteIds: string[];
}): RecallSelectionState {
  return {
    isSelectingForRecall: input.isSelectingForRecall,
    pendingStart: input.pendingStart ?? false,
    selectedCount: input.selectedNoteIds.length,
    selectedNoteIds: [...input.selectedNoteIds],
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
    pendingStart: false,
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
    pendingStart: false,
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
    noteIds: [...state.selectedNoteIds],
    state: createInitialRecallSelectionState(),
  };
}

export function markRecallSelectionStartPending(
  state: RecallSelectionState,
): RecallSelectionState {
  return createRecallSelectionState({
    isSelectingForRecall: state.isSelectingForRecall,
    pendingStart: true,
    selectedNoteIds: state.selectedNoteIds,
  });
}

export function cancelPendingRecallSelectionStart(
  state: RecallSelectionState,
): RecallSelectionState {
  if (!state.pendingStart) {
    return state;
  }

  return createRecallSelectionState({
    isSelectingForRecall: state.isSelectingForRecall,
    pendingStart: false,
    selectedNoteIds: state.selectedNoteIds,
  });
}
