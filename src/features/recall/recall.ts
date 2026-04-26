import {
  type AppNote,
  type AppNotesContext,
  listNotesForUser,
} from "../notes/notes";

export type FlashCardRecallMode = "FlashCard";

export type FlashCardRecallNote = AppNote;

export type FlashCardRecallRating = "missed" | "partial" | "nailed";

export type FlashCardRecallAttempt = {
  noteId: string;
  rating: FlashCardRecallRating;
};

export type FlashCardRecallSession = {
  attempts: FlashCardRecallAttempt[];
  createdAt: string;
  currentIndex: number;
  id: string;
  isAnswerRevealed: boolean;
  labelId: string | null;
  labelName: string;
  mode: FlashCardRecallMode;
  notes: FlashCardRecallNote[];
};

export type FlashCardSessionResult = {
  attempts: FlashCardRecallAttempt[];
  completedAt: string;
  createdAt: string;
  id: string;
  labelId: string | null;
  labelName: string;
  mode: FlashCardRecallMode;
  notes: FlashCardRecallNote[];
};

type StoredFlashCardRecallSession = FlashCardRecallSession & {
  userId: string;
};

type StoredFlashCardSessionResult = FlashCardSessionResult & {
  userId: string;
};

export type AppRecallSnapshot = StoredFlashCardRecallSession | null;

type RecallListener = () => void;

type RecallStorageAdapter = Pick<Storage, "getItem" | "setItem">;

type RecallCrypto = Pick<Crypto, "randomUUID">;

type ShuffleNotes = (
  notes: readonly FlashCardRecallNote[],
) => FlashCardRecallNote[];

type StartFlashCardSessionInput = {
  noteIds: string[];
  userId: string;
};

type UpdateFlashCardSessionInput = {
  sessionId: string;
  userId: string;
};

type GetSessionResultInput = {
  sessionResultId: string;
  userId: string;
};

type ListSessionResultsInput = {
  labelId?: string;
  userId: string;
};

type RateFlashCardAnswerInput = UpdateFlashCardSessionInput & {
  rating: FlashCardRecallRating;
};

type CreateAppRecallContextOptions = {
  crypto?: RecallCrypto;
  keyPrefix?: string;
  notes: AppNotesContext;
  shuffleNotes?: ShuffleNotes;
  storage?: RecallStorageAdapter;
};

export class AppRecallError extends Error {
  readonly code: "invalid_input" | "not_found";

  constructor(code: "invalid_input" | "not_found", message: string) {
    super(message);
    this.code = code;
  }
}

export type AppRecallContext = {
  endFlashCardSession: (
    input: UpdateFlashCardSessionInput,
  ) => FlashCardRecallSession;
  getSessionResult: (input: GetSessionResultInput) => FlashCardSessionResult;
  getSessionResultsSnapshot: () => readonly FlashCardSessionResult[];
  getSnapshot: () => AppRecallSnapshot;
  listSessionResults: (
    input: ListSessionResultsInput,
  ) => FlashCardSessionResult[];
  rateFlashCardAnswer: (
    input: RateFlashCardAnswerInput,
  ) => FlashCardRecallSession | null;
  revealFlashCardAnswer: (
    input: UpdateFlashCardSessionInput,
  ) => FlashCardRecallSession;
  startFlashCardSession: (
    input: StartFlashCardSessionInput,
  ) => FlashCardRecallSession;
  subscribe: (listener: RecallListener) => () => void;
};

const DEFAULT_STORAGE_KEY_PREFIX = "learning-makes-difference-recall";

function getDefaultStorage(): RecallStorageAdapter | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}

function getDefaultCrypto(): RecallCrypto {
  return globalThis.crypto;
}

function getRecallStorageKey(prefix: string) {
  return `${prefix}:active-session`;
}

function getSessionResultsStorageKey(prefix: string) {
  return `${prefix}:session-results`;
}

function isFlashCardRecallNote(note: unknown): note is FlashCardRecallNote {
  const candidate =
    typeof note === "object" && note !== null
      ? (note as Record<string, unknown>)
      : null;

  return (
    candidate !== null &&
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.body === "string" &&
    Array.isArray(candidate.labelIds) &&
    candidate.labelIds.every(
      (labelId: unknown) => typeof labelId === "string",
    ) &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

function isFlashCardRecallAttempt(
  attempt: unknown,
): attempt is FlashCardRecallAttempt {
  const candidate =
    typeof attempt === "object" && attempt !== null
      ? (attempt as Record<string, unknown>)
      : null;

  return (
    candidate !== null &&
    typeof candidate.noteId === "string" &&
    (candidate.rating === "missed" ||
      candidate.rating === "partial" ||
      candidate.rating === "nailed")
  );
}

function isNullableLabelId(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function parseStoredRecallSession(value: string | null): AppRecallSnapshot {
  if (value === null) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(value);

    if (
      typeof parsedValue !== "object" ||
      parsedValue === null ||
      typeof parsedValue.id !== "string" ||
      typeof parsedValue.userId !== "string" ||
      !isNullableLabelId(parsedValue.labelId) ||
      typeof parsedValue.labelName !== "string" ||
      parsedValue.mode !== "FlashCard" ||
      typeof parsedValue.createdAt !== "string" ||
      typeof parsedValue.currentIndex !== "number" ||
      typeof parsedValue.isAnswerRevealed !== "boolean" ||
      ("attempts" in parsedValue &&
        (!Array.isArray(parsedValue.attempts) ||
          parsedValue.attempts.some((attempt: unknown) => {
            return !isFlashCardRecallAttempt(attempt);
          }))) ||
      !Array.isArray(parsedValue.notes)
    ) {
      return null;
    }

    const notes = parsedValue.notes.filter(isFlashCardRecallNote);
    const attempts = Array.isArray(parsedValue.attempts)
      ? parsedValue.attempts
      : [];

    return {
      ...parsedValue,
      attempts,
      notes,
    };
  } catch {
    return null;
  }
}

function parseStoredSessionResults(
  value: string | null,
): StoredFlashCardSessionResult[] {
  if (value === null) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .filter((result): result is StoredFlashCardSessionResult => {
        return (
          typeof result === "object" &&
          result !== null &&
          typeof result.id === "string" &&
          typeof result.userId === "string" &&
          isNullableLabelId(result.labelId) &&
          typeof result.labelName === "string" &&
          result.mode === "FlashCard" &&
          typeof result.createdAt === "string" &&
          typeof result.completedAt === "string" &&
          Array.isArray(result.attempts) &&
          result.attempts.every((attempt: unknown) =>
            isFlashCardRecallAttempt(attempt),
          ) &&
          Array.isArray(result.notes)
        );
      })
      .map((result) => ({
        ...result,
        notes: result.notes.filter(isFlashCardRecallNote),
      }));
  } catch {
    return [];
  }
}

function defaultShuffleNotes(
  notes: readonly FlashCardRecallNote[],
): FlashCardRecallNote[] {
  const shuffledNotes = [...notes];

  for (let index = shuffledNotes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const currentNote = shuffledNotes[index];

    shuffledNotes[index] = shuffledNotes[swapIndex];
    shuffledNotes[swapIndex] = currentNote;
  }

  return shuffledNotes;
}

function cloneFlashCardRecallNote(
  note: FlashCardRecallNote,
): FlashCardRecallNote {
  return {
    ...note,
    acronyms: note.acronyms.map((acronym) => ({ ...acronym })),
    labelIds: [...note.labelIds],
    metaphors: note.metaphors.map((metaphor) => ({ ...metaphor })),
  };
}

function cloneFlashCardRecallNotes(
  notes: readonly FlashCardRecallNote[],
): FlashCardRecallNote[] {
  return notes.map(cloneFlashCardRecallNote);
}

export function resolveRecallableNotesFromSelection(input: {
  noteIds: readonly string[];
  notes: AppNotesContext;
  userId: string;
}): FlashCardRecallNote[] {
  if (!Array.isArray(input.noteIds)) {
    throw new AppRecallError(
      "invalid_input",
      "Choose at least one note for recall.",
    );
  }

  const selectedNoteIds = [
    ...new Set(input.noteIds.filter((noteId) => noteId.length > 0)),
  ];

  if (selectedNoteIds.length === 0) {
    throw new AppRecallError(
      "invalid_input",
      "Choose at least one note for recall.",
    );
  }

  const ownedNotesById = new Map(
    listNotesForUser(input.notes.getSnapshot(), input.userId).map((note) => [
      note.id,
      note,
    ]),
  );
  const recallableNotes = selectedNoteIds.map((noteId) => {
    const note = ownedNotesById.get(noteId);

    if (note === undefined) {
      throw new AppRecallError("not_found", "Note not found.");
    }

    return note;
  });

  return recallableNotes;
}

export function createAppRecallContext(
  options: CreateAppRecallContextOptions,
): AppRecallContext {
  const storage = options.storage ?? getDefaultStorage();
  const cryptoProvider = options.crypto ?? getDefaultCrypto();
  const keyPrefix = options.keyPrefix ?? DEFAULT_STORAGE_KEY_PREFIX;
  const shuffleNotes = options.shuffleNotes ?? defaultShuffleNotes;
  const listeners = new Set<RecallListener>();
  let snapshot = parseStoredRecallSession(
    storage?.getItem(getRecallStorageKey(keyPrefix)) ?? null,
  );
  let sessionResults = parseStoredSessionResults(
    storage?.getItem(getSessionResultsStorageKey(keyPrefix)) ?? null,
  );

  function notifyListeners() {
    for (const listener of listeners) {
      listener();
    }
  }

  function writeSnapshot(nextSnapshot: StoredFlashCardRecallSession | null) {
    snapshot = nextSnapshot;
    storage?.setItem(getRecallStorageKey(keyPrefix), JSON.stringify(snapshot));
    notifyListeners();
  }

  function writeSessionResults(
    nextSessionResults: StoredFlashCardSessionResult[],
  ) {
    sessionResults = nextSessionResults;
    storage?.setItem(
      getSessionResultsStorageKey(keyPrefix),
      JSON.stringify(sessionResults),
    );
    notifyListeners();
  }

  function getActiveSessionForUser({
    sessionId,
    userId,
  }: UpdateFlashCardSessionInput): StoredFlashCardRecallSession {
    if (
      snapshot === null ||
      snapshot.userId !== userId ||
      snapshot.id !== sessionId
    ) {
      throw new AppRecallError("not_found", "Recall session not found.");
    }

    return snapshot;
  }

  function toSessionResult(
    session: StoredFlashCardRecallSession,
  ): StoredFlashCardSessionResult {
    return {
      attempts: [...session.attempts],
      completedAt: new Date().toISOString(),
      createdAt: session.createdAt,
      id: session.id,
      labelId: session.labelId,
      labelName: session.labelName,
      mode: session.mode,
      notes: cloneFlashCardRecallNotes(session.notes),
      userId: session.userId,
    };
  }

  function persistSessionResult(session: StoredFlashCardRecallSession) {
    if (session.attempts.length === 0) {
      return;
    }

    const nextResult = toSessionResult(session);

    writeSessionResults([
      ...sessionResults.filter((result) => result.id !== nextResult.id),
      nextResult,
    ]);
  }

  return {
    endFlashCardSession: ({ sessionId, userId }) => {
      const activeSession = getActiveSessionForUser({ sessionId, userId });

      persistSessionResult(activeSession);
      writeSnapshot(null);

      return activeSession;
    },
    getSessionResult: ({ sessionResultId, userId }) => {
      const result = sessionResults.find((candidate) => {
        return candidate.userId === userId && candidate.id === sessionResultId;
      });

      if (result === undefined) {
        throw new AppRecallError("not_found", "Session result not found.");
      }

      return result;
    },
    getSessionResultsSnapshot: () => sessionResults,
    getSnapshot: () => snapshot,
    listSessionResults: ({ labelId, userId }) => {
      return sessionResults
        .filter((result) => {
          return (
            result.userId === userId &&
            (labelId === undefined || result.labelId === labelId)
          );
        })
        .sort((left, right) => {
          return (
            right.completedAt.localeCompare(left.completedAt) ||
            right.id.localeCompare(left.id)
          );
        });
    },
    rateFlashCardAnswer: ({ rating, sessionId, userId }) => {
      const activeSession = getActiveSessionForUser({ sessionId, userId });
      const currentNote = activeSession.notes[activeSession.currentIndex];

      if (currentNote === undefined) {
        throw new AppRecallError(
          "invalid_input",
          "Recall session is complete.",
        );
      }

      if (!activeSession.isAnswerRevealed) {
        throw new AppRecallError(
          "invalid_input",
          "Reveal the answer before rating recall.",
        );
      }

      const nextSession: StoredFlashCardRecallSession = {
        ...activeSession,
        attempts: [
          ...activeSession.attempts,
          {
            noteId: currentNote.id,
            rating,
          },
        ],
        currentIndex: activeSession.currentIndex + 1,
        isAnswerRevealed: false,
      };

      if (nextSession.currentIndex >= nextSession.notes.length) {
        persistSessionResult(nextSession);
        writeSnapshot(null);
        return null;
      }

      writeSnapshot(nextSession);

      return nextSession;
    },
    revealFlashCardAnswer: ({ sessionId, userId }) => {
      const activeSession = getActiveSessionForUser({ sessionId, userId });

      if (activeSession.notes[activeSession.currentIndex] === undefined) {
        throw new AppRecallError(
          "invalid_input",
          "Recall session is complete.",
        );
      }

      if (activeSession.isAnswerRevealed) {
        return activeSession;
      }

      const nextSession: StoredFlashCardRecallSession = {
        ...activeSession,
        isAnswerRevealed: true,
      };

      writeSnapshot(nextSession);

      return nextSession;
    },
    startFlashCardSession: (input) => {
      const notes = resolveRecallableNotesFromSelection({
        noteIds: input.noteIds,
        notes: options.notes,
        userId: input.userId,
      });

      const nextSession: StoredFlashCardRecallSession = {
        attempts: [],
        createdAt: new Date().toISOString(),
        currentIndex: 0,
        id: cryptoProvider.randomUUID(),
        isAnswerRevealed: false,
        labelId: null,
        labelName: "Selected notes",
        mode: "FlashCard",
        notes: cloneFlashCardRecallNotes(shuffleNotes(notes)),
        userId: input.userId,
      };

      writeSnapshot(nextSession);

      return nextSession;
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}
