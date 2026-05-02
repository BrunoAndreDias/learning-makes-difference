import {
  addNoteEditorAcronym,
  addNoteEditorMetaphor,
  cancelNoteEditorTransition,
  createInitialNoteEditorState,
  discardAndApplyNoteEditorTransition,
  discardNoteEditorChanges,
  getNoteEditorSaveInput,
  isNoteEditorDirty,
  markNoteEditorSaved,
  type NoteEditorDraft,
  type NoteEditorSaveInput,
  type NoteEditorState,
  type NoteEditorTransitionTarget,
  removeNoteEditorAcronym,
  removeNoteEditorMetaphor,
  requestNoteEditorTransition,
  startNewNoteDraft,
  syncNoteEditorWithNotes,
  updateNoteEditorAcronym,
  updateNoteEditorDraftField,
  updateNoteEditorMetaphor,
} from "./note-editor";
import type { AppNoteSearchResult } from "./note-search";
import type { AppAcronym, AppMetaphor, AppNote } from "./notes";

type EditorKeyFactory = () => string;

export type NotesWorkspaceInteractionState = {
  editorFocusRequestNonce: number;
  hasInitializedEditor: boolean;
  noteEditor: NoteEditorState;
  pendingSearchJump: AppNoteSearchResult | null;
};

export type NotesWorkspaceSaveInstruction =
  | {
      input: NoteEditorSaveInput;
      type: "createNote";
    }
  | {
      input: NoteEditorSaveInput;
      noteId: string;
      type: "updateNote";
    };

export type NotesWorkspaceAdapterInstruction =
  | NotesWorkspaceSaveInstruction
  | {
      note: AppNote;
      type: "captureStudyActivity";
    }
  | {
      result: AppNoteSearchResult;
      type: "focusSearchResult";
    }
  | {
      target: NoteEditorTransitionTarget;
      type: "showDiscardConfirmation";
    };

export type NotesWorkspaceInteractionResult = {
  instructions: readonly NotesWorkspaceAdapterInstruction[];
  state: NotesWorkspaceInteractionState;
};

export type NotesWorkspaceActivationResult = NotesWorkspaceInteractionResult & {
  completedSearchJump: AppNoteSearchResult | null;
  status: "activated" | "pending";
};

export type NotesWorkspaceDiscardResult = NotesWorkspaceInteractionResult & {
  completedSearchJump: AppNoteSearchResult | null;
  status: "activated";
};

export type NotesWorkspaceInteractionEvent =
  | {
      createEditorKey?: EditorKeyFactory;
      notes: readonly AppNote[];
      type: "notesSynced";
    }
  | {
      field: keyof NoteEditorDraft;
      type: "editorDraftFieldChanged";
      value: NoteEditorDraft[keyof NoteEditorDraft];
    }
  | {
      createEditorKey?: EditorKeyFactory;
      type: "editorMetaphorAdded";
    }
  | {
      index: number;
      type: "editorMetaphorRemoved";
    }
  | {
      field: keyof AppMetaphor;
      index: number;
      type: "editorMetaphorChanged";
      value: AppMetaphor[keyof AppMetaphor];
    }
  | {
      createEditorKey?: EditorKeyFactory;
      type: "editorAcronymAdded";
    }
  | {
      index: number;
      type: "editorAcronymRemoved";
    }
  | {
      field: keyof AppAcronym;
      index: number;
      type: "editorAcronymChanged";
      value: AppAcronym[keyof AppAcronym];
    }
  | {
      createEditorKey?: EditorKeyFactory;
      notes: readonly AppNote[];
      target: NoteEditorTransitionTarget;
      type: "noteTargetActivated";
    }
  | {
      type: "pendingTransitionCanceled";
    }
  | {
      createEditorKey?: EditorKeyFactory;
      notes: readonly AppNote[];
      type: "pendingTransitionDiscarded";
    }
  | {
      type: "newNoteDraftStarted";
    }
  | {
      createEditorKey?: EditorKeyFactory;
      notes: readonly AppNote[];
      type: "editorChangesDiscarded";
    }
  | {
      note: AppNote;
      type: "noteSaved";
    }
  | {
      type: "pendingSearchJumpCleared";
    }
  | {
      type: "editorFocusRequested";
    }
  | {
      type: "saveRequested";
    };

export function createInitialNotesWorkspaceInteractionState(
  notes: readonly AppNote[] = [],
  createEditorKey?: EditorKeyFactory,
): NotesWorkspaceInteractionState {
  return {
    editorFocusRequestNonce: 0,
    hasInitializedEditor: notes.length > 0,
    noteEditor: createInitialNoteEditorState(notes, createEditorKey),
    pendingSearchJump: null,
  };
}

export function hasPendingNotesWorkspaceInteractionTransition(
  state: NotesWorkspaceInteractionState,
): boolean {
  return state.noteEditor.pendingTransition !== null;
}

export function hasUnsavedNotesWorkspaceInteractionChanges(
  state: NotesWorkspaceInteractionState,
): boolean {
  return isNoteEditorDirty(state.noteEditor);
}

export function applyNotesWorkspaceInteractionEvent(
  state: NotesWorkspaceInteractionState,
  event: Extract<
    NotesWorkspaceInteractionEvent,
    { type: "noteTargetActivated" }
  >,
): NotesWorkspaceActivationResult;
export function applyNotesWorkspaceInteractionEvent(
  state: NotesWorkspaceInteractionState,
  event: Extract<
    NotesWorkspaceInteractionEvent,
    { type: "pendingTransitionDiscarded" }
  >,
): NotesWorkspaceDiscardResult;
export function applyNotesWorkspaceInteractionEvent(
  state: NotesWorkspaceInteractionState,
  event: NotesWorkspaceInteractionEvent,
): NotesWorkspaceInteractionResult;
export function applyNotesWorkspaceInteractionEvent(
  state: NotesWorkspaceInteractionState,
  event: NotesWorkspaceInteractionEvent,
): NotesWorkspaceInteractionResult {
  switch (event.type) {
    case "notesSynced": {
      if (!state.hasInitializedEditor) {
        return withState({
          ...state,
          hasInitializedEditor: true,
          noteEditor: createInitialNoteEditorState(
            event.notes,
            event.createEditorKey,
          ),
        });
      }

      return withNoteEditor(
        state,
        syncNoteEditorWithNotes(
          state.noteEditor,
          event.notes,
          event.createEditorKey,
        ),
      );
    }
    case "editorDraftFieldChanged":
      return withNoteEditor(
        state,
        updateNoteEditorDraftField(state.noteEditor, event.field, event.value),
      );
    case "editorMetaphorAdded":
      return withNoteEditor(
        state,
        addNoteEditorMetaphor(state.noteEditor, event.createEditorKey),
      );
    case "editorMetaphorRemoved":
      return withNoteEditor(
        state,
        removeNoteEditorMetaphor(state.noteEditor, event.index),
      );
    case "editorMetaphorChanged":
      return withNoteEditor(
        state,
        updateNoteEditorMetaphor(
          state.noteEditor,
          event.index,
          event.field,
          event.value,
        ),
      );
    case "editorAcronymAdded":
      return withNoteEditor(
        state,
        addNoteEditorAcronym(state.noteEditor, event.createEditorKey),
      );
    case "editorAcronymRemoved":
      return withNoteEditor(
        state,
        removeNoteEditorAcronym(state.noteEditor, event.index),
      );
    case "editorAcronymChanged":
      return withNoteEditor(
        state,
        updateNoteEditorAcronym(
          state.noteEditor,
          event.index,
          event.field,
          event.value,
        ),
      );
    case "noteTargetActivated":
      return activateNoteTarget(state, event);
    case "pendingTransitionCanceled":
      return withNoteEditor(
        state,
        cancelNoteEditorTransition(state.noteEditor),
      );
    case "pendingTransitionDiscarded":
      return discardPendingTransition(state, event);
    case "newNoteDraftStarted":
      return withNoteEditor(state, startNewNoteDraft());
    case "editorChangesDiscarded":
      return withNoteEditor(
        state,
        discardNoteEditorChanges(
          state.noteEditor,
          event.notes,
          event.createEditorKey,
        ),
      );
    case "noteSaved":
      return {
        instructions: [
          {
            note: event.note,
            type: "captureStudyActivity",
          },
        ],
        state: {
          ...state,
          noteEditor: markNoteEditorSaved(event.note),
        },
      };
    case "pendingSearchJumpCleared":
      return withState({
        ...state,
        pendingSearchJump: null,
      });
    case "editorFocusRequested":
      return withState({
        ...state,
        editorFocusRequestNonce: state.editorFocusRequestNonce + 1,
      });
    case "saveRequested":
      return {
        instructions: [getSaveInstruction(state.noteEditor)],
        state,
      };
  }
}

function activateNoteTarget(
  state: NotesWorkspaceInteractionState,
  event: Extract<
    NotesWorkspaceInteractionEvent,
    { type: "noteTargetActivated" }
  >,
): NotesWorkspaceActivationResult {
  const result = requestNoteEditorTransition(
    state.noteEditor,
    event.target,
    event.notes,
    event.createEditorKey,
  );
  const status =
    result.state.pendingTransition === null ? "activated" : "pending";
  const instructions = getActivationInstructions({
    completedSearchJump: result.completedSearchJump,
    status,
    target: event.target,
  });

  return {
    completedSearchJump: result.completedSearchJump,
    instructions,
    state: {
      ...state,
      noteEditor: result.state,
      pendingSearchJump:
        result.completedSearchJump === null
          ? state.pendingSearchJump
          : result.completedSearchJump,
    },
    status,
  };
}

function discardPendingTransition(
  state: NotesWorkspaceInteractionState,
  event: Extract<
    NotesWorkspaceInteractionEvent,
    { type: "pendingTransitionDiscarded" }
  >,
): NotesWorkspaceDiscardResult {
  const result = discardAndApplyNoteEditorTransition(
    state.noteEditor,
    event.notes,
    event.createEditorKey,
  );
  const instructions =
    result.completedSearchJump === null
      ? []
      : [
          {
            result: result.completedSearchJump,
            type: "focusSearchResult" as const,
          },
        ];

  return {
    completedSearchJump: result.completedSearchJump,
    instructions,
    state: {
      ...state,
      noteEditor: result.state,
      pendingSearchJump:
        result.completedSearchJump === null
          ? state.pendingSearchJump
          : result.completedSearchJump,
    },
    status: "activated",
  };
}

function getActivationInstructions(input: {
  completedSearchJump: AppNoteSearchResult | null;
  status: "activated" | "pending";
  target: NoteEditorTransitionTarget;
}): NotesWorkspaceAdapterInstruction[] {
  if (input.status === "pending") {
    return [
      {
        target: input.target,
        type: "showDiscardConfirmation",
      },
    ];
  }

  if (input.completedSearchJump !== null) {
    return [
      {
        result: input.completedSearchJump,
        type: "focusSearchResult",
      },
    ];
  }

  return [];
}

function getSaveInstruction(
  noteEditor: NoteEditorState,
): NotesWorkspaceSaveInstruction {
  const input = getNoteEditorSaveInput(noteEditor);

  if (noteEditor.mode === "editing" && noteEditor.selectedNoteId !== null) {
    return {
      input,
      noteId: noteEditor.selectedNoteId,
      type: "updateNote",
    };
  }

  return {
    input,
    type: "createNote",
  };
}

function withNoteEditor(
  state: NotesWorkspaceInteractionState,
  noteEditor: NoteEditorState,
): NotesWorkspaceInteractionResult {
  if (state.noteEditor === noteEditor) {
    return withState(state);
  }

  return withState({
    ...state,
    noteEditor,
  });
}

function withState(
  state: NotesWorkspaceInteractionState,
): NotesWorkspaceInteractionResult {
  return {
    instructions: [],
    state,
  };
}
