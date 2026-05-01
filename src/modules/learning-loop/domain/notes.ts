export type AppMetaphor = {
  explanation: string;
  title: string;
};

export type AppAcronym = {
  expansion: string;
  shortForm: string;
};

export type AppNote = {
  acronyms: AppAcronym[];
  body: string;
  createdAt: string;
  id: string;
  labelIds: string[];
  metaphors: AppMetaphor[];
  title: string;
  updatedAt: string;
};

export type AppStoredNote = AppNote & {
  userId: string;
};

export type {
  AppNoteSearchMatchChip,
  AppNoteSearchResult,
  AppNoteSearchTarget,
  AppNoteSearchTargetField,
} from "./note-search";
export {
  filterNotesByQuery,
  searchNoteResults,
} from "./note-search";

type NotesListener = () => void;

type CreateNoteInput = {
  acronyms: AppAcronym[];
  body: string;
  labelIds: string[];
  metaphors: AppMetaphor[];
  title: string;
};

type UpdateNoteInput = CreateNoteInput;

type NotesStorageAdapter = Pick<Storage, "getItem" | "setItem">;

type NotesCrypto = Pick<Crypto, "randomUUID">;

type OwnedLabelIdsLookup = (userId: string) => readonly string[];

type CreateAppNotesContextOptions = {
  crypto?: NotesCrypto;
  getOwnedLabelIdsForUser?: OwnedLabelIdsLookup;
  keyPrefix?: string;
  storage?: NotesStorageAdapter;
};

export class AppNotesError extends Error {
  readonly code: "invalid_input" | "not_found" | "unauthorized";

  constructor(
    code: "invalid_input" | "not_found" | "unauthorized",
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

export type AppNotesContext = {
  createNote: (userId: string | null, input: CreateNoteInput) => AppNote;
  deleteNote: (userId: string | null, noteId: string) => void;
  getSnapshot: () => readonly AppStoredNote[];
  subscribe: (listener: NotesListener) => () => void;
  updateNote: (
    userId: string | null,
    noteId: string,
    input: UpdateNoteInput,
  ) => AppNote;
};

const DEFAULT_STORAGE_KEY_PREFIX = "learning-makes-difference-notes";

type SnapshotNormalizationResult = {
  didChange: boolean;
  snapshot: readonly AppStoredNote[];
};

function getDefaultStorage(): NotesStorageAdapter | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}

function getDefaultCrypto(): NotesCrypto {
  return globalThis.crypto;
}

function getNotesStorageKey(prefix: string): string {
  return `${prefix}:records`;
}

function isStoredMetaphor(value: unknown): value is AppMetaphor {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.title === "string" && typeof record.explanation === "string"
  );
}

function isStoredAcronym(value: unknown): value is AppAcronym {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.shortForm === "string" && typeof record.expansion === "string"
  );
}

function parseStoredNotes(value: string | null): AppStoredNote[] {
  if (value === null) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .filter((note): note is AppStoredNote => {
        return (
          typeof note === "object" &&
          note !== null &&
          typeof note.id === "string" &&
          typeof note.userId === "string" &&
          typeof note.title === "string" &&
          typeof note.body === "string" &&
          (note.acronyms === undefined ||
            (Array.isArray(note.acronyms) &&
              note.acronyms.every((acronym: unknown) =>
                isStoredAcronym(acronym),
              ))) &&
          (note.metaphors === undefined ||
            (Array.isArray(note.metaphors) &&
              note.metaphors.every((metaphor: unknown) =>
                isStoredMetaphor(metaphor),
              ))) &&
          (note.labelIds === undefined ||
            (Array.isArray(note.labelIds) &&
              note.labelIds.every(
                (labelId: unknown) => typeof labelId === "string",
              ))) &&
          typeof note.createdAt === "string" &&
          typeof note.updatedAt === "string"
        );
      })
      .map((note) => ({
        ...note,
        acronyms: Array.isArray(note.acronyms) ? note.acronyms : [],
        labelIds: Array.isArray(note.labelIds) ? note.labelIds : [],
        metaphors: Array.isArray(note.metaphors) ? note.metaphors : [],
      }));
  } catch {
    return [];
  }
}

function validateUserId(userId: string | null): string {
  if (userId === null) {
    throw new AppNotesError("unauthorized", "A signed-in user is required.");
  }

  return userId;
}

function validateTitle(title: string): string {
  const trimmedValue = title.trim();

  if (trimmedValue.length === 0) {
    throw new AppNotesError("invalid_input", "Title is required.");
  }

  return trimmedValue;
}

function validateBody(body: string): string {
  return body.trim();
}

function validateLabelIds(
  labelIds: string[],
  options: {
    getOwnedLabelIdsForUser?: OwnedLabelIdsLookup;
    userId: string;
  },
): string[] {
  const normalizedLabelIds = [...new Set(labelIds.filter(Boolean))];

  if (options.getOwnedLabelIdsForUser === undefined) {
    return normalizedLabelIds;
  }

  const ownedLabelIds = new Set(
    options.getOwnedLabelIdsForUser(options.userId),
  );

  if (normalizedLabelIds.every((labelId) => ownedLabelIds.has(labelId))) {
    return normalizedLabelIds;
  }

  throw new AppNotesError(
    "invalid_input",
    "Notes can only be assigned to labels owned by this account.",
  );
}

function validateMetaphors(metaphors: AppMetaphor[]): AppMetaphor[] {
  return metaphors.map((metaphor) => {
    const title = metaphor.title.trim();
    const explanation = metaphor.explanation.trim();

    if (title.length === 0) {
      throw new AppNotesError("invalid_input", "Metaphor title is required.");
    }

    if (explanation.length === 0) {
      throw new AppNotesError(
        "invalid_input",
        "Metaphor explanation is required.",
      );
    }

    return {
      explanation,
      title,
    };
  });
}

function validateAcronyms(acronyms: AppAcronym[]): AppAcronym[] {
  return acronyms.map((acronym) => {
    const shortForm = acronym.shortForm.trim();
    const expansion = acronym.expansion.trim();

    if (shortForm.length === 0) {
      throw new AppNotesError("invalid_input", "Acronym is required.");
    }

    if (expansion.length === 0) {
      throw new AppNotesError(
        "invalid_input",
        "Acronym expansion is required.",
      );
    }

    return {
      expansion,
      shortForm,
    };
  });
}

function toPublicNote(note: AppStoredNote): AppNote {
  return {
    acronyms: note.acronyms.map((acronym) => ({ ...acronym })),
    id: note.id,
    labelIds: [...note.labelIds],
    metaphors: note.metaphors.map((metaphor) => ({ ...metaphor })),
    title: note.title,
    body: note.body,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

function normalizeSnapshotLabelAssignments(
  snapshot: readonly AppStoredNote[],
  getOwnedLabelIdsForUser?: OwnedLabelIdsLookup,
): SnapshotNormalizationResult {
  if (getOwnedLabelIdsForUser === undefined) {
    return {
      didChange: false,
      snapshot,
    };
  }

  let didChange = false;
  const ownedLabelIdsByUserId = new Map<string, ReadonlySet<string>>();
  const normalizedSnapshot = snapshot.map((note) => {
    const ownedLabelIds =
      ownedLabelIdsByUserId.get(note.userId) ??
      new Set(getOwnedLabelIdsForUser(note.userId));

    ownedLabelIdsByUserId.set(note.userId, ownedLabelIds);

    const normalizedLabelIds = note.labelIds.filter((labelId) =>
      ownedLabelIds.has(labelId),
    );

    if (normalizedLabelIds.length === note.labelIds.length) {
      return note;
    }

    didChange = true;

    return {
      ...note,
      labelIds: normalizedLabelIds,
    };
  });

  return {
    didChange,
    snapshot: normalizedSnapshot,
  };
}

export function listNotesForUser(
  notes: readonly AppStoredNote[],
  userId: string | null,
): AppNote[] {
  if (userId === null) {
    return [];
  }

  return notes
    .filter((note) => {
      return note.userId === userId;
    })
    .sort((left, right) => {
      return right.updatedAt.localeCompare(left.updatedAt);
    })
    .map(toPublicNote);
}

export function createAppNotesContext(
  options: CreateAppNotesContextOptions = {},
): AppNotesContext {
  const storage = options.storage ?? getDefaultStorage();
  const cryptoProvider = options.crypto ?? getDefaultCrypto();
  const getOwnedLabelIdsForUser = options.getOwnedLabelIdsForUser;
  const keyPrefix = options.keyPrefix ?? DEFAULT_STORAGE_KEY_PREFIX;
  const listeners = new Set<NotesListener>();
  let snapshot: readonly AppStoredNote[] = parseStoredNotes(
    storage?.getItem(getNotesStorageKey(keyPrefix)) ?? null,
  );

  function notifyListeners() {
    for (const listener of listeners) {
      listener();
    }
  }

  function persistSnapshot(nextSnapshot: readonly AppStoredNote[]) {
    snapshot = nextSnapshot;
    storage?.setItem(getNotesStorageKey(keyPrefix), JSON.stringify(snapshot));
  }

  function writeSnapshot(nextSnapshot: readonly AppStoredNote[]) {
    persistSnapshot(nextSnapshot);
    notifyListeners();
  }

  function readSnapshot() {
    const normalized = normalizeSnapshotLabelAssignments(
      snapshot,
      getOwnedLabelIdsForUser,
    );

    if (normalized.didChange) {
      persistSnapshot(normalized.snapshot);
    }

    return snapshot;
  }

  return {
    createNote: (userId, input) => {
      const validatedUserId = validateUserId(userId);
      const timestamp = new Date().toISOString();
      const nextNote: AppStoredNote = {
        acronyms: validateAcronyms(input.acronyms),
        body: validateBody(input.body),
        createdAt: timestamp,
        id: cryptoProvider.randomUUID(),
        labelIds: validateLabelIds(input.labelIds, {
          getOwnedLabelIdsForUser,
          userId: validatedUserId,
        }),
        metaphors: validateMetaphors(input.metaphors),
        title: validateTitle(input.title),
        updatedAt: timestamp,
        userId: validatedUserId,
      };

      writeSnapshot([nextNote, ...snapshot]);

      return toPublicNote(nextNote);
    },
    deleteNote: (userId, noteId) => {
      const validatedUserId = validateUserId(userId);
      const currentSnapshot = readSnapshot();
      const existingNote = currentSnapshot.find((note) => note.id === noteId);

      if (
        existingNote === undefined ||
        existingNote.userId !== validatedUserId
      ) {
        throw new AppNotesError(
          "not_found",
          "The requested note could not be found for this account.",
        );
      }

      writeSnapshot(currentSnapshot.filter((note) => note.id !== noteId));
    },
    getSnapshot: () => readSnapshot(),
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    updateNote: (userId, noteId, input) => {
      const validatedUserId = validateUserId(userId);
      const currentSnapshot = readSnapshot();
      const existingNote = currentSnapshot.find((note) => note.id === noteId);

      if (
        existingNote === undefined ||
        existingNote.userId !== validatedUserId
      ) {
        throw new AppNotesError(
          "not_found",
          "The requested note could not be found for this account.",
        );
      }

      const nextNote: AppStoredNote = {
        ...existingNote,
        acronyms: validateAcronyms(input.acronyms),
        body: validateBody(input.body),
        labelIds: validateLabelIds(input.labelIds, {
          getOwnedLabelIdsForUser,
          userId: validatedUserId,
        }),
        metaphors: validateMetaphors(input.metaphors),
        title: validateTitle(input.title),
        updatedAt: new Date().toISOString(),
      };

      writeSnapshot(
        [nextNote, ...currentSnapshot.filter((note) => note.id !== noteId)].sort(
          (left, right) => right.updatedAt.localeCompare(left.updatedAt),
        ),
      );

      return toPublicNote(nextNote);
    },
  };
}
