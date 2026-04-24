import type { AppLabelsContext } from "./labels";
import { AppLabelError } from "./labels";
import { type AppNote, type AppNotesContext, listNotesForUser } from "./notes";

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
  labelId: string;
  labelName: string;
  mode: FlashCardRecallMode;
  notes: FlashCardRecallNote[];
};

export type FlashCardSessionResult = {
  attempts: FlashCardRecallAttempt[];
  completedAt: string;
  createdAt: string;
  id: string;
  labelId: string;
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
  labelId: string;
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
  labels: AppLabelsContext;
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
      typeof parsedValue.labelId !== "string" ||
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
          typeof result.labelId === "string" &&
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

function getLabelNameForUser(
  labels: AppLabelsContext,
  labelId: string,
  userId: string,
) {
  const label = labels.getLabelsForUser(userId).find((candidate) => {
    return candidate.id === labelId;
  });

  if (label === undefined) {
    throw new AppRecallError("not_found", "Label not found.");
  }

  return label.name;
}

export function resolveRecallableNotesFromLabel(input: {
  labelId: string;
  labels: AppLabelsContext;
  notes: AppNotesContext;
  userId: string;
}): FlashCardRecallNote[] {
  const reachableLabelIds = new Set<string>([input.labelId]);

  try {
    for (const descendantId of input.labels.getDescendantIds({
      labelId: input.labelId,
      userId: input.userId,
    })) {
      reachableLabelIds.add(descendantId);
    }
  } catch (error) {
    if (error instanceof AppLabelError && error.code === "not_found") {
      throw new AppRecallError("not_found", "Label not found.");
    }

    throw error;
  }

  const recallableNotes = new Map<string, FlashCardRecallNote>();

  for (const note of listNotesForUser(
    input.notes.getSnapshot(),
    input.userId,
  )) {
    const isReachable = note.labelIds.some((labelId) => {
      return reachableLabelIds.has(labelId);
    });

    if (!isReachable || recallableNotes.has(note.id)) {
      continue;
    }

    recallableNotes.set(note.id, note);
  }

  return [...recallableNotes.values()].sort((left, right) => {
    return (
      left.title.localeCompare(right.title) || left.id.localeCompare(right.id)
    );
  });
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
      notes: session.notes.map((note) => ({
        ...note,
        acronyms: [...note.acronyms],
        labelIds: [...note.labelIds],
        metaphors: note.metaphors.map((metaphor) => ({ ...metaphor })),
      })),
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
    startFlashCardSession: ({ labelId, userId }) => {
      const labelName = getLabelNameForUser(options.labels, labelId, userId);
      const resolvedNotes = resolveRecallableNotesFromLabel({
        labelId,
        labels: options.labels,
        notes: options.notes,
        userId,
      });

      if (resolvedNotes.length === 0) {
        throw new AppRecallError(
          "invalid_input",
          "Choose a label with at least one reachable note.",
        );
      }

      const nextSession: StoredFlashCardRecallSession = {
        attempts: [],
        createdAt: new Date().toISOString(),
        currentIndex: 0,
        id: cryptoProvider.randomUUID(),
        isAnswerRevealed: false,
        labelId,
        labelName,
        mode: "FlashCard",
        notes: shuffleNotes(resolvedNotes),
        userId,
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
