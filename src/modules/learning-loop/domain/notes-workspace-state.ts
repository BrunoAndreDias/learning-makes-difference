import {
  cancelNoteEditorTransition,
  discardAndApplyNoteEditorTransition,
  type NoteEditorState,
  type NoteEditorTransitionTarget,
  requestNoteEditorTransition,
} from "./note-editor";
import type { AppNoteSearchResult } from "./note-search";
import type { AppNote } from "./notes";

type EditorKeyFactory = () => string;

export type NotesWorkspaceState = {
  noteEditor: NoteEditorState;
};

export type NotesWorkspaceActivationResult = {
  completedSearchJump: AppNoteSearchResult | null;
  state: NotesWorkspaceState;
  status: "activated" | "pending";
};

export type NotesWorkspaceDiscardResult = {
  completedSearchJump: AppNoteSearchResult | null;
  state: NotesWorkspaceState;
  status: "activated";
};

export function hasPendingNotesWorkspaceTransition(
  state: NotesWorkspaceState,
): boolean {
  return state.noteEditor.pendingTransition !== null;
}

export function activateNotesWorkspaceNote(
  state: NotesWorkspaceState,
  target: NoteEditorTransitionTarget,
  notes: readonly AppNote[],
  createEditorKey?: EditorKeyFactory,
): NotesWorkspaceActivationResult {
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

export function cancelPendingNotesWorkspaceTransition(
  state: NotesWorkspaceState,
): NotesWorkspaceState {
  return {
    noteEditor: cancelNoteEditorTransition(state.noteEditor),
  };
}

export function discardPendingNotesWorkspaceTransition(
  state: NotesWorkspaceState,
  notes: readonly AppNote[],
  createEditorKey?: EditorKeyFactory,
): NotesWorkspaceDiscardResult {
  const result = discardAndApplyNoteEditorTransition(
    state.noteEditor,
    notes,
    createEditorKey,
  );

  return {
    completedSearchJump: result.completedSearchJump,
    state: {
      ...state,
      noteEditor: result.state,
    },
    status: "activated",
  };
}
