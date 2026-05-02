import type { AppNoteSearchResult } from "./note-search";
import type { AppAcronym, AppMetaphor, AppNote } from "./notes";

export type NoteEditorMetaphorDraft = AppMetaphor & {
  key: string;
};

export type NoteEditorAcronymDraft = AppAcronym & {
  key: string;
};

export type NoteEditorDraft = {
  acronyms: NoteEditorAcronymDraft[];
  body: string;
  labelIds: string[];
  metaphors: NoteEditorMetaphorDraft[];
  title: string;
};

export type NoteEditorTransitionTarget =
  | {
      noteId: string;
      type: "note";
    }
  | {
      result: AppNoteSearchResult;
      type: "searchResult";
    };

export type NoteEditorState = {
  baselineDraft: NoteEditorDraft;
  draft: NoteEditorDraft;
  mode: "draft" | "editing";
  pendingTransition: NoteEditorTransitionTarget | null;
  selectedNoteId: string | null;
};

export type NoteEditorSaveInput = {
  acronyms: AppAcronym[];
  body: string;
  labelIds: string[];
  metaphors: AppMetaphor[];
  title: string;
};

export type NoteEditorTransitionResult = {
  completedSearchJump: AppNoteSearchResult | null;
  state: NoteEditorState;
};

type EditorKeyFactory = () => string;

const defaultEditorKeyFactory: EditorKeyFactory = () =>
  globalThis.crypto.randomUUID();

export const emptyNoteEditorDraft: NoteEditorDraft = {
  acronyms: [],
  body: "",
  labelIds: [],
  metaphors: [],
  title: "",
};

function createMetaphorDraft(
  createEditorKey: EditorKeyFactory,
  metaphor: AppMetaphor = {
    explanation: "",
    title: "",
  },
): NoteEditorMetaphorDraft {
  return {
    ...metaphor,
    key: createEditorKey(),
  };
}

function createAcronymDraft(
  createEditorKey: EditorKeyFactory,
  acronym: AppAcronym = {
    expansion: "",
    shortForm: "",
  },
): NoteEditorAcronymDraft {
  return {
    ...acronym,
    key: createEditorKey(),
  };
}

function cloneDraft(draft: NoteEditorDraft): NoteEditorDraft {
  return {
    acronyms: draft.acronyms.map((acronym) => ({ ...acronym })),
    body: draft.body,
    labelIds: [...draft.labelIds],
    metaphors: draft.metaphors.map((metaphor) => ({ ...metaphor })),
    title: draft.title,
  };
}

function createDraftFromNote(
  note: AppNote,
  createEditorKey: EditorKeyFactory,
): NoteEditorDraft {
  return {
    acronyms: note.acronyms.map((acronym) =>
      createAcronymDraft(createEditorKey, acronym),
    ),
    body: note.body,
    labelIds: [...note.labelIds],
    metaphors: note.metaphors.map((metaphor) =>
      createMetaphorDraft(createEditorKey, metaphor),
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

export function haveSameNoteEditorDraft(
  left: NoteEditorDraft,
  right: NoteEditorDraft,
): boolean {
  return (
    left.title === right.title &&
    left.body === right.body &&
    haveSameItems(
      left.labelIds,
      right.labelIds,
      (leftLabelId, rightLabelId) => {
        return leftLabelId === rightLabelId;
      },
    ) &&
    haveSameItems(
      left.metaphors,
      right.metaphors,
      (leftMetaphor, rightMetaphor) => {
        return (
          leftMetaphor.title === rightMetaphor.title &&
          leftMetaphor.explanation === rightMetaphor.explanation
        );
      },
    ) &&
    haveSameItems(
      left.acronyms,
      right.acronyms,
      (leftAcronym, rightAcronym) => {
        return (
          leftAcronym.shortForm === rightAcronym.shortForm &&
          leftAcronym.expansion === rightAcronym.expansion
        );
      },
    )
  );
}

function findNoteById(
  notes: readonly AppNote[],
  noteId: string,
): AppNote | null {
  return notes.find((note) => note.id === noteId) ?? null;
}

function createEditingState(
  note: AppNote,
  createEditorKey: EditorKeyFactory,
): NoteEditorState {
  const draft = createDraftFromNote(note, createEditorKey);

  return {
    baselineDraft: cloneDraft(draft),
    draft,
    mode: "editing",
    pendingTransition: null,
    selectedNoteId: note.id,
  };
}

function createDraftState(): NoteEditorState {
  return {
    baselineDraft: cloneDraft(emptyNoteEditorDraft),
    draft: cloneDraft(emptyNoteEditorDraft),
    mode: "draft",
    pendingTransition: null,
    selectedNoteId: null,
  };
}

export function createInitialNoteEditorState(
  notes: readonly AppNote[],
  createEditorKey: EditorKeyFactory = defaultEditorKeyFactory,
): NoteEditorState {
  const firstNote = notes[0];

  if (firstNote === undefined) {
    return createDraftState();
  }

  return createEditingState(firstNote, createEditorKey);
}

export function getSelectedNote(
  state: NoteEditorState,
  notes: readonly AppNote[],
): AppNote | null {
  if (state.mode === "draft" || state.selectedNoteId === null) {
    return null;
  }

  return findNoteById(notes, state.selectedNoteId);
}

export function isNoteEditorDirty(state: NoteEditorState): boolean {
  return !haveSameNoteEditorDraft(state.draft, state.baselineDraft);
}

export function syncNoteEditorWithNotes(
  state: NoteEditorState,
  notes: readonly AppNote[],
  createEditorKey: EditorKeyFactory = defaultEditorKeyFactory,
): NoteEditorState {
  if (state.mode === "draft") {
    return state;
  }

  const selectedNote =
    state.selectedNoteId === null
      ? null
      : findNoteById(notes, state.selectedNoteId);

  if (selectedNote === null) {
    const firstNote = notes[0];

    if (firstNote === undefined) {
      return createDraftState();
    }

    return createEditingState(firstNote, createEditorKey);
  }

  if (isNoteEditorDirty(state)) {
    return state;
  }

  const nextDraft = createDraftFromNote(selectedNote, createEditorKey);

  if (haveSameNoteEditorDraft(state.draft, nextDraft)) {
    return state;
  }

  return {
    ...state,
    baselineDraft: cloneDraft(nextDraft),
    draft: nextDraft,
  };
}

export function discardNoteEditorChanges(
  state: NoteEditorState,
  notes: readonly AppNote[],
  createEditorKey: EditorKeyFactory = defaultEditorKeyFactory,
): NoteEditorState {
  if (state.mode === "editing" && state.selectedNoteId !== null) {
    const selectedNote = findNoteById(notes, state.selectedNoteId);

    if (selectedNote !== null) {
      return createEditingState(selectedNote, createEditorKey);
    }
  }

  const firstNote = notes[0];

  if (firstNote === undefined) {
    return createDraftState();
  }

  return createEditingState(firstNote, createEditorKey);
}

export function startNewNoteDraft(): NoteEditorState {
  return createDraftState();
}

function applyTransitionTarget(
  state: NoteEditorState,
  target: NoteEditorTransitionTarget,
  notes: readonly AppNote[],
  createEditorKey: EditorKeyFactory,
): NoteEditorTransitionResult {
  const targetNote =
    target.type === "note"
      ? findNoteById(notes, target.noteId)
      : (findNoteById(notes, target.result.note.id) ?? target.result.note);

  if (targetNote === null) {
    return {
      completedSearchJump: null,
      state,
    };
  }

  return {
    completedSearchJump: target.type === "searchResult" ? target.result : null,
    state: createEditingState(targetNote, createEditorKey),
  };
}

export function requestNoteEditorTransition(
  state: NoteEditorState,
  target: NoteEditorTransitionTarget,
  notes: readonly AppNote[],
  createEditorKey: EditorKeyFactory = defaultEditorKeyFactory,
): NoteEditorTransitionResult {
  if (
    target.type === "note" &&
    state.mode === "editing" &&
    state.selectedNoteId === target.noteId
  ) {
    return {
      completedSearchJump: null,
      state,
    };
  }

  if (isNoteEditorDirty(state)) {
    return {
      completedSearchJump: null,
      state: {
        ...state,
        pendingTransition: target,
      },
    };
  }

  return applyTransitionTarget(state, target, notes, createEditorKey);
}

export function cancelNoteEditorTransition(
  state: NoteEditorState,
): NoteEditorState {
  if (state.pendingTransition === null) {
    return state;
  }

  return {
    ...state,
    pendingTransition: null,
  };
}

export function discardAndApplyNoteEditorTransition(
  state: NoteEditorState,
  notes: readonly AppNote[],
  createEditorKey: EditorKeyFactory = defaultEditorKeyFactory,
): NoteEditorTransitionResult {
  if (state.pendingTransition === null) {
    return {
      completedSearchJump: null,
      state,
    };
  }

  return applyTransitionTarget(
    state,
    state.pendingTransition,
    notes,
    createEditorKey,
  );
}

export function updateNoteEditorDraftField<K extends keyof NoteEditorDraft>(
  state: NoteEditorState,
  field: K,
  value: NoteEditorDraft[K],
): NoteEditorState {
  return {
    ...state,
    draft: {
      ...state.draft,
      [field]: value,
    },
  };
}

export function addNoteEditorMetaphor(
  state: NoteEditorState,
  createEditorKey: EditorKeyFactory = defaultEditorKeyFactory,
): NoteEditorState {
  return updateNoteEditorDraftField(state, "metaphors", [
    ...state.draft.metaphors,
    createMetaphorDraft(createEditorKey),
  ]);
}

export function updateNoteEditorMetaphor<K extends keyof AppMetaphor>(
  state: NoteEditorState,
  index: number,
  field: K,
  value: AppMetaphor[K],
): NoteEditorState {
  return updateNoteEditorDraftField(
    state,
    "metaphors",
    state.draft.metaphors.map((metaphor, metaphorIndex) => {
      if (metaphorIndex !== index) {
        return metaphor;
      }

      return {
        ...metaphor,
        [field]: value,
      };
    }),
  );
}

export function removeNoteEditorMetaphor(
  state: NoteEditorState,
  index: number,
): NoteEditorState {
  return updateNoteEditorDraftField(
    state,
    "metaphors",
    state.draft.metaphors.filter((_, metaphorIndex) => metaphorIndex !== index),
  );
}

export function addNoteEditorAcronym(
  state: NoteEditorState,
  createEditorKey: EditorKeyFactory = defaultEditorKeyFactory,
): NoteEditorState {
  return updateNoteEditorDraftField(state, "acronyms", [
    ...state.draft.acronyms,
    createAcronymDraft(createEditorKey),
  ]);
}

export function updateNoteEditorAcronym<K extends keyof AppAcronym>(
  state: NoteEditorState,
  index: number,
  field: K,
  value: AppAcronym[K],
): NoteEditorState {
  return updateNoteEditorDraftField(
    state,
    "acronyms",
    state.draft.acronyms.map((acronym, acronymIndex) => {
      if (acronymIndex !== index) {
        return acronym;
      }

      return {
        ...acronym,
        [field]: value,
      };
    }),
  );
}

export function removeNoteEditorAcronym(
  state: NoteEditorState,
  index: number,
): NoteEditorState {
  return updateNoteEditorDraftField(
    state,
    "acronyms",
    state.draft.acronyms.filter((_, acronymIndex) => acronymIndex !== index),
  );
}

export function getNoteEditorSaveInput(
  state: NoteEditorState,
): NoteEditorSaveInput {
  return {
    acronyms: state.draft.acronyms.map((acronym) => ({
      expansion: acronym.expansion,
      shortForm: acronym.shortForm,
    })),
    body: state.draft.body,
    labelIds: [...state.draft.labelIds],
    metaphors: state.draft.metaphors.map((metaphor) => ({
      explanation: metaphor.explanation,
      title: metaphor.title,
    })),
    title: state.draft.title,
  };
}

export function markNoteEditorSaved(
  note: AppNote,
  createEditorKey: EditorKeyFactory = defaultEditorKeyFactory,
): NoteEditorState {
  return createEditingState(note, createEditorKey);
}
