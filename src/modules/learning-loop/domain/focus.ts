export type FocusMethod = "Pomodoro";

export type FocusSessionInterval = "Break" | "Focus";

export type FocusSession = {
  breakIntervalMinutes: number;
  createdAt: string;
  currentInterval: FocusSessionInterval;
  focusIntervalMinutes: number;
  id: string;
  method: FocusMethod;
  plannedFocusIntervalCount: number | null;
};

type StoredFocusSession = FocusSession & {
  userId: string;
};

export type AppFocusSnapshot = readonly StoredFocusSession[];

type FocusListener = () => void;

type FocusStorageAdapter = Pick<Storage, "getItem" | "setItem">;

type FocusCrypto = Pick<Crypto, "randomUUID">;

type StartFocusSessionInput = {
  breakIntervalMinutes?: number;
  focusIntervalMinutes?: number;
  plannedFocusIntervalCount?: number | null;
  userId: string;
};

type GetActiveFocusSessionInput = {
  userId: string;
};

type CreateAppFocusContextOptions = {
  crypto?: FocusCrypto;
  keyPrefix?: string;
  storage?: FocusStorageAdapter;
};

export class AppFocusError extends Error {
  readonly code: "invalid_input";

  constructor(code: "invalid_input", message: string) {
    super(message);
    this.code = code;
  }
}

export type AppFocusContext = {
  getActiveSession: (input: GetActiveFocusSessionInput) => FocusSession | null;
  getSnapshot: () => AppFocusSnapshot;
  startFocusSession: (input: StartFocusSessionInput) => FocusSession;
  subscribe: (listener: FocusListener) => () => void;
};

const DEFAULT_STORAGE_KEY_PREFIX = "learning-makes-difference-focus";
const DEFAULT_FOCUS_INTERVAL_MINUTES = 25;
const DEFAULT_BREAK_INTERVAL_MINUTES = 5;

function getDefaultStorage(): FocusStorageAdapter | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}

function getDefaultCrypto(): FocusCrypto {
  return globalThis.crypto;
}

function getActiveSessionsStorageKey(prefix: string) {
  return `${prefix}:active-sessions`;
}

function cloneFocusSession(session: StoredFocusSession): StoredFocusSession {
  return {
    ...session,
  };
}

function parseFocusSnapshot(value: string | null): AppFocusSnapshot {
  if (value === null) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.flatMap((entry) => {
      if (
        typeof entry !== "object" ||
        entry === null ||
        typeof entry.id !== "string" ||
        typeof entry.userId !== "string" ||
        typeof entry.createdAt !== "string" ||
        typeof entry.focusIntervalMinutes !== "number" ||
        typeof entry.breakIntervalMinutes !== "number" ||
        typeof entry.method !== "string" ||
        typeof entry.currentInterval !== "string"
      ) {
        return [];
      }

      if (entry.method !== "Pomodoro") {
        return [];
      }

      if (entry.currentInterval !== "Focus" && entry.currentInterval !== "Break") {
        return [];
      }

      if (
        entry.plannedFocusIntervalCount !== null &&
        typeof entry.plannedFocusIntervalCount !== "number"
      ) {
        return [];
      }

      return [cloneFocusSession(entry as StoredFocusSession)];
    });
  } catch {
    return [];
  }
}

function assertPositiveInteger(value: number, message: string) {
  if (!Number.isInteger(value) || value < 1) {
    throw new AppFocusError("invalid_input", message);
  }
}

function toPublicSession(session: StoredFocusSession): FocusSession {
  return {
    breakIntervalMinutes: session.breakIntervalMinutes,
    createdAt: session.createdAt,
    currentInterval: session.currentInterval,
    focusIntervalMinutes: session.focusIntervalMinutes,
    id: session.id,
    method: session.method,
    plannedFocusIntervalCount: session.plannedFocusIntervalCount,
  };
}

export function createAppFocusContext(
  options: CreateAppFocusContextOptions = {},
): AppFocusContext {
  const storage = options.storage ?? getDefaultStorage();
  const cryptoProvider = options.crypto ?? getDefaultCrypto();
  const keyPrefix = options.keyPrefix ?? DEFAULT_STORAGE_KEY_PREFIX;
  const listeners = new Set<FocusListener>();
  let activeSessions = parseFocusSnapshot(
    storage?.getItem(getActiveSessionsStorageKey(keyPrefix)) ?? null,
  );
  let snapshot = activeSessions.map(cloneFocusSession);

  function notifyListeners() {
    for (const listener of listeners) {
      listener();
    }
  }

  function writeSnapshot(nextSnapshot: readonly StoredFocusSession[]) {
    activeSessions = nextSnapshot.map(cloneFocusSession);
    snapshot = activeSessions.map(cloneFocusSession);
    storage?.setItem(
      getActiveSessionsStorageKey(keyPrefix),
      JSON.stringify(activeSessions),
    );
    notifyListeners();
  }

  function getSnapshot() {
    return snapshot;
  }

  function getActiveSession({ userId }: GetActiveFocusSessionInput) {
    const session = activeSessions.find((candidate) => candidate.userId === userId);

    return session === undefined ? null : toPublicSession(session);
  }

  function startFocusSession(input: StartFocusSessionInput) {
    const focusIntervalMinutes =
      input.focusIntervalMinutes ?? DEFAULT_FOCUS_INTERVAL_MINUTES;
    const breakIntervalMinutes =
      input.breakIntervalMinutes ?? DEFAULT_BREAK_INTERVAL_MINUTES;
    const plannedFocusIntervalCount =
      input.plannedFocusIntervalCount ?? null;

    assertPositiveInteger(
      focusIntervalMinutes,
      "Focus interval duration must be at least 1 minute.",
    );
    assertPositiveInteger(
      breakIntervalMinutes,
      "Break interval duration must be at least 1 minute.",
    );

    if (plannedFocusIntervalCount !== null) {
      assertPositiveInteger(
        plannedFocusIntervalCount,
        "Planned focus interval count must be at least 1 when provided.",
      );
    }

    if (getActiveSession({ userId: input.userId }) !== null) {
      throw new AppFocusError(
        "invalid_input",
        "User already has an active FocusSession.",
      );
    }

    const nextSession: StoredFocusSession = {
      breakIntervalMinutes,
      createdAt: new Date().toISOString(),
      currentInterval: "Focus",
      focusIntervalMinutes,
      id: cryptoProvider.randomUUID(),
      method: "Pomodoro",
      plannedFocusIntervalCount,
      userId: input.userId,
    };

    writeSnapshot([...activeSessions, nextSession]);

    return toPublicSession(nextSession);
  }

  function subscribe(listener: FocusListener) {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  return {
    getActiveSession,
    getSnapshot,
    startFocusSession,
    subscribe,
  };
}
