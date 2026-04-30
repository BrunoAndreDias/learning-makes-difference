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
const SUPPORTED_FOCUS_METHOD: FocusMethod = "Pomodoro";
const INITIAL_FOCUS_INTERVAL: FocusSessionInterval = "Focus";
const ACTIVE_SESSIONS_STORAGE_KEY = "active-sessions";

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
  return `${prefix}:${ACTIVE_SESSIONS_STORAGE_KEY}`;
}

function cloneStoredFocusSession(
  session: StoredFocusSession,
): StoredFocusSession {
  return {
    ...session,
  };
}

function isStoredFocusSession(entry: unknown): entry is StoredFocusSession {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }

  const candidate = entry as Partial<StoredFocusSession>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.userId === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.focusIntervalMinutes === "number" &&
    typeof candidate.breakIntervalMinutes === "number" &&
    candidate.method === SUPPORTED_FOCUS_METHOD &&
    (candidate.currentInterval === "Focus" ||
      candidate.currentInterval === "Break") &&
    (candidate.plannedFocusIntervalCount === null ||
      typeof candidate.plannedFocusIntervalCount === "number")
  );
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

    return parsedValue
      .filter(isStoredFocusSession)
      .map(cloneStoredFocusSession);
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

function getActiveStoredSession(
  sessions: readonly StoredFocusSession[],
  userId: string,
) {
  return sessions.find((session) => session.userId === userId) ?? null;
}

function getPlannedFocusIntervalCount(input: StartFocusSessionInput) {
  return input.plannedFocusIntervalCount ?? null;
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
  let snapshot = activeSessions.map(cloneStoredFocusSession);

  function notifyListeners() {
    for (const listener of listeners) {
      listener();
    }
  }

  function writeSnapshot(nextSnapshot: readonly StoredFocusSession[]) {
    activeSessions = nextSnapshot.map(cloneStoredFocusSession);
    snapshot = activeSessions.map(cloneStoredFocusSession);
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
    const session = getActiveStoredSession(activeSessions, userId);

    return session === null ? null : toPublicSession(session);
  }

  function startFocusSession(input: StartFocusSessionInput) {
    const focusIntervalMinutes =
      input.focusIntervalMinutes ?? DEFAULT_FOCUS_INTERVAL_MINUTES;
    const breakIntervalMinutes =
      input.breakIntervalMinutes ?? DEFAULT_BREAK_INTERVAL_MINUTES;
    const plannedFocusIntervalCount = getPlannedFocusIntervalCount(input);

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

    if (getActiveStoredSession(activeSessions, input.userId) !== null) {
      throw new AppFocusError(
        "invalid_input",
        "User already has an active FocusSession.",
      );
    }

    const nextSession: StoredFocusSession = {
      breakIntervalMinutes,
      createdAt: new Date().toISOString(),
      currentInterval: INITIAL_FOCUS_INTERVAL,
      focusIntervalMinutes,
      id: cryptoProvider.randomUUID(),
      method: SUPPORTED_FOCUS_METHOD,
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
