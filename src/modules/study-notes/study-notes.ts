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
  labelIds: string[];
  prompt: string;
  source: AppStudyNoteSource;
  sourceNoteId: string;
  updatedAt: string;
};

export type AppStoredStudyNote = AppStudyNote & {
  userId: string;
};

export type CreateStudyNoteInput = {
  labelIds?: string[];
  sourceBody: string;
  sourceTitle: string;
};

export type UpdateStudyNoteInput = {
  expectedAnswer: string;
  labelIds: string[];
  prompt: string;
  sourceBody: string;
  sourceTitle: string;
};

type StudyNotesListener = () => void;

type StudyNotesStorageAdapter = Pick<Storage, "getItem" | "setItem">;

type StudyNotesCrypto = {
  randomUUID: () => string;
};

type OwnedLabelIdsLookup = (userId: string) => readonly string[];

type CreateAppStudyNotesContextOptions = {
  crypto?: StudyNotesCrypto;
  getOwnedLabelIdsForUser?: OwnedLabelIdsLookup;
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

function normalizeLabelIds(labelIds: readonly string[] | undefined): string[] {
  return [...new Set((labelIds ?? []).filter(Boolean))];
}

function validateOwnedLabelIds(
  labelIds: readonly string[] | undefined,
  options: {
    getOwnedLabelIdsForUser?: OwnedLabelIdsLookup;
    userId: string;
  },
): string[] {
  const normalizedLabelIds = normalizeLabelIds(labelIds);

  if (options.getOwnedLabelIdsForUser === undefined) {
    return normalizedLabelIds;
  }

  const ownedLabelIds = new Set(
    options.getOwnedLabelIdsForUser(options.userId),
  );

  if (normalizedLabelIds.every((labelId) => ownedLabelIds.has(labelId))) {
    return normalizedLabelIds;
  }

  throw new AppStudyNotesError(
    "invalid_input",
    "Study Notes can only be assigned to labels owned by this account.",
  );
}

function toPublicStudyNote(note: AppStoredStudyNote): AppStudyNote {
  return {
    createdAt: note.createdAt,
    expectedAnswer: note.expectedAnswer,
    id: note.id,
    labelIds: [...note.labelIds],
    prompt: note.prompt,
    source: { ...note.source },
    sourceNoteId: note.sourceNoteId,
    updatedAt: note.updatedAt,
  };
}

function sortStoredStudyNotes(
  studyNotes: readonly AppStoredStudyNote[],
): AppStoredStudyNote[] {
  return [...studyNotes].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStoredStudyNoteSource(value: unknown): value is AppStudyNoteSource {
  return (
    isObjectRecord(value) &&
    typeof value.body === "string" &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isStoredStudyNote(value: unknown): value is AppStoredStudyNote {
  return (
    isObjectRecord(value) &&
    typeof value.createdAt === "string" &&
    typeof value.expectedAnswer === "string" &&
    typeof value.id === "string" &&
    (value.labelIds === undefined ||
      (Array.isArray(value.labelIds) &&
        value.labelIds.every((labelId) => typeof labelId === "string"))) &&
    typeof value.prompt === "string" &&
    typeof value.sourceNoteId === "string" &&
    typeof value.updatedAt === "string" &&
    typeof value.userId === "string" &&
    isStoredStudyNoteSource(value.source)
  );
}

function parseStoredStudyNotes(value: string | null): AppStoredStudyNote[] {
  if (value === null) {
    return [];
  }

  try {
    const parsedValue: unknown = JSON.parse(value);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(isStoredStudyNote).map((studyNote) => ({
      ...studyNote,
      labelIds: Array.isArray(studyNote.labelIds) ? studyNote.labelIds : [],
    }));
  } catch {
    return [];
  }
}

export function listStudyNotesForUser(
  studyNotes: readonly AppStoredStudyNote[],
  userId: string | null,
  options: {
    labelId?: string;
  } = {},
): AppStudyNote[] {
  if (userId === null) {
    return [];
  }

  return sortStoredStudyNotes(
    studyNotes.filter(
      (studyNote) =>
        studyNote.userId === userId &&
        (options.labelId === undefined ||
          studyNote.labelIds.includes(options.labelId)),
    ),
  ).map(toPublicStudyNote);
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
    snapshot = sortStoredStudyNotes(nextSnapshot);
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
      const labelIds = validateOwnedLabelIds(input.labelIds, {
        getOwnedLabelIdsForUser: options.getOwnedLabelIdsForUser,
        userId: validatedUserId,
      });
      const sourceNoteId = cryptoProvider.randomUUID();
      const studyNote: AppStoredStudyNote = {
        createdAt: timestamp,
        expectedAnswer: sourceBody,
        id: cryptoProvider.randomUUID(),
        labelIds,
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
      const labelIds = validateOwnedLabelIds(input.labelIds, {
        getOwnedLabelIdsForUser: options.getOwnedLabelIdsForUser,
        userId: validatedUserId,
      });
      const updatedStudyNote: AppStoredStudyNote = {
        ...existingStudyNote,
        expectedAnswer: validateOptionalText(input.expectedAnswer),
        labelIds,
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
