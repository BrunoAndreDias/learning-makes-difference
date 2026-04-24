export type AppNote = {
  body: string;
  createdAt: string;
  id: string;
  labelIds: string[];
  title: string;
  updatedAt: string;
};

export type AppStoredNote = AppNote & {
  userId: string;
};

type NotesListener = () => void;

type CreateNoteInput = {
  body: string;
  labelIds: string[];
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
  getSnapshot: () => readonly AppStoredNote[];
  subscribe: (listener: NotesListener) => () => void;
  updateNote: (
    userId: string | null,
    noteId: string,
    input: UpdateNoteInput,
  ) => AppNote;
};

const DEFAULT_STORAGE_KEY_PREFIX = "learning-makes-difference-notes";

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
        labelIds: Array.isArray(note.labelIds) ? note.labelIds : [],
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
  const trimmedValue = body.trim();

  if (trimmedValue.length === 0) {
    throw new AppNotesError("invalid_input", "Body is required.");
  }

  return trimmedValue;
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

function toPublicNote(note: AppStoredNote): AppNote {
  return {
    id: note.id,
    labelIds: [...note.labelIds],
    title: note.title,
    body: note.body,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
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

  function writeSnapshot(nextSnapshot: readonly AppStoredNote[]) {
    snapshot = nextSnapshot;
    storage?.setItem(getNotesStorageKey(keyPrefix), JSON.stringify(snapshot));
    notifyListeners();
  }

  return {
    createNote: (userId, input) => {
      const validatedUserId = validateUserId(userId);
      const timestamp = new Date().toISOString();
      const nextNote: AppStoredNote = {
        body: validateBody(input.body),
        createdAt: timestamp,
        id: cryptoProvider.randomUUID(),
        labelIds: validateLabelIds(input.labelIds, {
          getOwnedLabelIdsForUser,
          userId: validatedUserId,
        }),
        title: validateTitle(input.title),
        updatedAt: timestamp,
        userId: validatedUserId,
      };

      writeSnapshot([nextNote, ...snapshot]);

      return toPublicNote(nextNote);
    },
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    updateNote: (userId, noteId, input) => {
      const validatedUserId = validateUserId(userId);
      const existingNote = snapshot.find((note) => note.id === noteId);

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
        body: validateBody(input.body),
        labelIds: validateLabelIds(input.labelIds, {
          getOwnedLabelIdsForUser,
          userId: validatedUserId,
        }),
        title: validateTitle(input.title),
        updatedAt: new Date().toISOString(),
      };

      writeSnapshot(
        [nextNote, ...snapshot.filter((note) => note.id !== noteId)].sort(
          (left, right) => right.updatedAt.localeCompare(left.updatedAt),
        ),
      );

      return toPublicNote(nextNote);
    },
  };
}
