import type { AppLabelsContext } from "./labels";
import { AppLabelError } from "./labels";
import {
  type AppNote,
  type AppNotesContext,
  listNotesForUser,
} from "./notes";

export type FlashCardRecallMode = "FlashCard";

export type FlashCardRecallNote = AppNote;

export type FlashCardRecallSession = {
  createdAt: string;
  currentIndex: number;
  id: string;
  isAnswerRevealed: boolean;
  labelId: string;
  labelName: string;
  mode: FlashCardRecallMode;
  notes: FlashCardRecallNote[];
};

type StoredFlashCardRecallSession = FlashCardRecallSession & {
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
  getSnapshot: () => AppRecallSnapshot;
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

function parseStoredRecallSession(
  value: string | null,
): AppRecallSnapshot {
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
      !Array.isArray(parsedValue.notes)
    ) {
      return null;
    }

    const notes = parsedValue.notes.filter(
      (note: unknown): note is FlashCardRecallNote => {
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
      },
    );

    return {
      ...parsedValue,
      notes,
    };
  } catch {
    return null;
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

function getLabelName(labels: AppLabelsContext, labelId: string, userId: string) {
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

  for (const note of listNotesForUser(input.notes.getSnapshot(), input.userId)) {
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

  return {
    getSnapshot: () => snapshot,
    startFlashCardSession: ({ labelId, userId }) => {
      const labelName = getLabelName(options.labels, labelId, userId);
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
