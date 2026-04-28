import {
  cancelNoteEditorTransition,
  discardAndApplyNoteEditorTransition,
  discardNoteEditorChanges,
  isNoteEditorDirty,
  type NoteEditorState,
  type NoteEditorTransitionTarget,
  requestNoteEditorTransition,
} from "./note-editor";
import type { AppNoteSearchResult } from "./note-search";
import type { AppNote } from "./notes";
import {
  cancelPendingRecallSelectionStart,
  completeRecallSelection,
  markRecallSelectionStartPending,
  type RecallSelectionState,
  toggleRecallSelectionNote,
} from "./recall-selection";

type EditorKeyFactory = () => string;

export type NotesWorkspaceState = {
  noteEditor: NoteEditorState;
  recallSelection: RecallSelectionState;
};

export type NotesWorkspaceActivationResult = {
  completedSearchJump: AppNoteSearchResult | null;
  state: NotesWorkspaceState;
  status: "activated" | "pending" | "selectedForRecall";
};

export type NotesWorkspaceRecallStartResult =
  | {
      noteIds: string[];
      state: NotesWorkspaceState;
      status: "ready";
    }
  | {
      noteIds: [];
      state: NotesWorkspaceState;
      status: "empty" | "pending";
    };

export type NotesWorkspaceDiscardResult =
  | {
      completedSearchJump: AppNoteSearchResult | null;
      noteIds: null;
      state: NotesWorkspaceState;
      status: "activated";
    }
  | {
      completedSearchJump: null;
      noteIds: string[];
      state: NotesWorkspaceState;
      status: "recallStart";
    };

function getTargetNoteId(target: NoteEditorTransitionTarget): string {
  if (target.type === "note") {
    return target.noteId;
  }

  return target.result.note.id;
}

export function hasPendingNotesWorkspaceTransition(
  state: NotesWorkspaceState,
): boolean {
  return (
    state.noteEditor.pendingTransition !== null ||
    state.recallSelection.pendingStart
  );
}

export function activateNotesWorkspaceNote(
  state: NotesWorkspaceState,
  target: NoteEditorTransitionTarget,
  notes: readonly AppNote[],
  createEditorKey?: EditorKeyFactory,
): NotesWorkspaceActivationResult {
  if (state.recallSelection.isSelectingForRecall) {
    return {
      completedSearchJump: null,
      state: {
        ...state,
        recallSelection: toggleRecallSelectionNote(
          state.recallSelection,
          getTargetNoteId(target),
        ),
      },
      status: "selectedForRecall",
    };
  }

  const result = requestNoteEditorTransition(
    state.noteEditor,
    target,
    notes,
    createEditorKey,
  );

  return {
    completedSearchJump: result.completedSearchJump,
    state: {
      ...state,
      noteEditor: result.state,
    },
    status: result.state.pendingTransition === null ? "activated" : "pending",
  };
}

export function requestNotesWorkspaceRecallStart(
  state: NotesWorkspaceState,
): NotesWorkspaceRecallStartResult {
  if (state.recallSelection.selectedCount === 0) {
    return {
      noteIds: [],
      state,
      status: "empty",
    };
  }

  if (isNoteEditorDirty(state.noteEditor)) {
    return {
      noteIds: [],
      state: {
        ...state,
        recallSelection: markRecallSelectionStartPending(state.recallSelection),
      },
      status: "pending",
    };
  }

  const result = completeRecallSelection(state.recallSelection);

  return {
    noteIds: result.noteIds,
    state: {
      ...state,
      recallSelection: result.state,
    },
    status: "ready",
  };
}

export function cancelPendingNotesWorkspaceTransition(
  state: NotesWorkspaceState,
): NotesWorkspaceState {
  return {
    noteEditor: cancelNoteEditorTransition(state.noteEditor),
    recallSelection: cancelPendingRecallSelectionStart(state.recallSelection),
  };
}

export function discardPendingNotesWorkspaceTransition(
  state: NotesWorkspaceState,
  notes: readonly AppNote[],
  createEditorKey?: EditorKeyFactory,
): NotesWorkspaceDiscardResult {
  if (state.recallSelection.pendingStart) {
    const result = completeRecallSelection(state.recallSelection);

    return {
      completedSearchJump: null,
      noteIds: result.noteIds,
      state: {
        noteEditor: discardNoteEditorChanges(
          state.noteEditor,
          notes,
          createEditorKey,
        ),
        recallSelection: result.state,
      },
      status: "recallStart",
    };
  }

  const result = discardAndApplyNoteEditorTransition(
    state.noteEditor,
    notes,
    createEditorKey,
  );

  return {
    completedSearchJump: result.completedSearchJump,
    noteIds: null,
    state: {
      ...state,
      noteEditor: result.state,
    },
    status: "activated",
  };
}
