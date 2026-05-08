export type AppStudyNoteSource = {
  body: string;
  id: string;
  title: string;
  updatedAt: string;
};

export type AppStudyNote = {
  createdAt: string;
  expectedAnswer: string;
  id: string;
  prompt: string;
  source: AppStudyNoteSource;
  sourceNoteId: string;
  updatedAt: string;
};

export type AppStoredStudyNote = AppStudyNote & {
  userId: string;
};

export type CreateStudyNoteInput = {
  sourceBody: string;
  sourceTitle: string;
};

export type UpdateStudyNoteInput = {
  expectedAnswer: string;
  prompt: string;
  sourceBody: string;
  sourceTitle: string;
};

type StudyNotesListener = () => void;

type StudyNotesStorageAdapter = Pick<Storage, "getItem" | "setItem">;

type StudyNotesCrypto = {
  randomUUID: () => string;
};

type CreateAppStudyNotesContextOptions = {
  crypto?: StudyNotesCrypto;
  keyPrefix?: string;
  storage?: StudyNotesStorageAdapter;
};

const DEFAULT_STORAGE_KEY_PREFIX = "learning-makes-difference-study-notes";

export class AppStudyNotesError extends Error {
  readonly code: "invalid_input" | "not_found" | "unauthorized";

  constructor(
    code: "invalid_input" | "not_found" | "unauthorized",
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

export type AppStudyNotesContext = {
  createStudyNote: (
    userId: string | null,
    input: CreateStudyNoteInput,
  ) => AppStudyNote;
  getSnapshot: () => readonly AppStoredStudyNote[];
  subscribe: (listener: StudyNotesListener) => () => void;
  updateStudyNote: (
    userId: string | null,
    studyNoteId: string,
    input: UpdateStudyNoteInput,
  ) => AppStudyNote;
};

function getDefaultStorage(): StudyNotesStorageAdapter | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}

function getDefaultCrypto(): StudyNotesCrypto {
  return globalThis.crypto;
}

function getStudyNotesStorageKey(prefix: string): string {
  return `${prefix}:records`;
}

function validateUserId(userId: string | null): string {
  if (userId === null) {
    throw new AppStudyNotesError(
      "unauthorized",
      "A signed-in user is required.",
    );
  }

  return userId;
}

function validateRequiredText(value: string, label: string): string {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    throw new AppStudyNotesError("invalid_input", `${label} is required.`);
  }

  return trimmedValue;
}

function validateOptionalText(value: string): string {
  return value.trim();
}

function toPublicStudyNote(note: AppStoredStudyNote): AppStudyNote {
  return {
    createdAt: note.createdAt,
    expectedAnswer: note.expectedAnswer,
    id: note.id,
    prompt: note.prompt,
    source: { ...note.source },
    sourceNoteId: note.sourceNoteId,
    updatedAt: note.updatedAt,
  };
}

function parseStoredStudyNotes(value: string | null): AppStoredStudyNote[] {
  if (value === null) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter((studyNote): studyNote is AppStoredStudyNote => {
      return (
        typeof studyNote === "object" &&
        studyNote !== null &&
        typeof studyNote.createdAt === "string" &&
        typeof studyNote.expectedAnswer === "string" &&
        typeof studyNote.id === "string" &&
        typeof studyNote.prompt === "string" &&
        typeof studyNote.sourceNoteId === "string" &&
        typeof studyNote.updatedAt === "string" &&
        typeof studyNote.userId === "string" &&
        typeof studyNote.source === "object" &&
        studyNote.source !== null &&
        typeof studyNote.source.body === "string" &&
        typeof studyNote.source.id === "string" &&
        typeof studyNote.source.title === "string" &&
        typeof studyNote.source.updatedAt === "string"
      );
    });
  } catch {
    return [];
  }
}

export function listStudyNotesForUser(
  studyNotes: readonly AppStoredStudyNote[],
  userId: string | null,
): AppStudyNote[] {
  if (userId === null) {
    return [];
  }

  return studyNotes
    .filter((studyNote) => studyNote.userId === userId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map(toPublicStudyNote);
}

export function createAppStudyNotesContext(
  options: CreateAppStudyNotesContextOptions = {},
): AppStudyNotesContext {
  const storage = options.storage ?? getDefaultStorage();
  const cryptoProvider = options.crypto ?? getDefaultCrypto();
  const keyPrefix = options.keyPrefix ?? DEFAULT_STORAGE_KEY_PREFIX;
  const listeners = new Set<StudyNotesListener>();
  let snapshot: readonly AppStoredStudyNote[] = parseStoredStudyNotes(
    storage?.getItem(getStudyNotesStorageKey(keyPrefix)) ?? null,
  );

  function notifyListeners() {
    for (const listener of listeners) {
      listener();
    }
  }

  function writeSnapshot(nextSnapshot: readonly AppStoredStudyNote[]) {
    snapshot = [...nextSnapshot].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
    storage?.setItem(
      getStudyNotesStorageKey(keyPrefix),
      JSON.stringify(snapshot),
    );
    notifyListeners();
  }

  return {
    createStudyNote(userId, input) {
      const validatedUserId = validateUserId(userId);
      const timestamp = new Date().toISOString();
      const sourceTitle = validateRequiredText(
        input.sourceTitle,
        "Source title",
      );
      const sourceBody = validateOptionalText(input.sourceBody);
      const sourceNoteId = cryptoProvider.randomUUID();
      const studyNote: AppStoredStudyNote = {
        createdAt: timestamp,
        expectedAnswer: sourceBody,
        id: cryptoProvider.randomUUID(),
        prompt: sourceTitle,
        source: {
          body: sourceBody,
          id: sourceNoteId,
          title: sourceTitle,
          updatedAt: timestamp,
        },
        sourceNoteId,
        updatedAt: timestamp,
        userId: validatedUserId,
      };

      writeSnapshot([studyNote, ...snapshot]);

      return toPublicStudyNote(studyNote);
    },
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    updateStudyNote(userId, studyNoteId, input) {
      const validatedUserId = validateUserId(userId);
      const existingStudyNote = snapshot.find(
        (studyNote) => studyNote.id === studyNoteId,
      );

      if (
        existingStudyNote === undefined ||
        existingStudyNote.userId !== validatedUserId
      ) {
        throw new AppStudyNotesError(
          "not_found",
          "The requested Study Note could not be found for this account.",
        );
      }

      const timestamp = new Date().toISOString();
      const updatedStudyNote: AppStoredStudyNote = {
        ...existingStudyNote,
        expectedAnswer: validateOptionalText(input.expectedAnswer),
        prompt: validateRequiredText(input.prompt, "Prompt"),
        source: {
          ...existingStudyNote.source,
          body: validateOptionalText(input.sourceBody),
          title: validateRequiredText(input.sourceTitle, "Source title"),
          updatedAt: timestamp,
        },
        updatedAt: timestamp,
      };

      writeSnapshot([
        updatedStudyNote,
        ...snapshot.filter((studyNote) => studyNote.id !== studyNoteId),
      ]);

      return toPublicStudyNote(updatedStudyNote);
    },
  };
}
