export type FocusMethod = "Pomodoro";

export type FocusSessionInterval = "Break" | "Focus";

export type FocusSessionState =
  | "AwaitingNextFocus"
  | "Break"
  | "Focus"
  | "Transition";

export type FocusSession = {
  breakIntervalMinutes: number;
  completedBreakIntervalCount: number;
  completedFocusIntervalCount: number;
  createdAt: string;
  currentInterval: FocusSessionInterval;
  focusIntervalMinutes: number;
  id: string;
  intervalState: FocusSessionState;
  isStale: boolean;
  method: FocusMethod;
  plannedFocusIntervalCount: number | null;
  remainingSeconds: number | null;
  stateEndsAt: string | null;
  stateStartedAt: string;
};

type StoredFocusSession = Omit<
  FocusSession,
  "isStale" | "remainingSeconds" | "stateEndsAt"
> & {
  userId: string;
};

type LegacyStoredFocusSession = {
  breakIntervalMinutes: number;
  createdAt: string;
  currentInterval: FocusSessionInterval;
  focusIntervalMinutes: number;
  id: string;
  method: FocusMethod;
  plannedFocusIntervalCount: number | null;
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

type StartNextFocusIntervalInput = {
  userId: string;
};

type CreateAppFocusContextOptions = {
  crypto?: FocusCrypto;
  keyPrefix?: string;
  storage?: FocusStorageAdapter;
};

type DerivedFocusSession = {
  isStale: boolean;
  session: StoredFocusSession;
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
  startNextFocusInterval: (
    input: StartNextFocusIntervalInput,
  ) => FocusSession;
  subscribe: (listener: FocusListener) => () => void;
};

const DEFAULT_STORAGE_KEY_PREFIX = "learning-makes-difference-focus";
const DEFAULT_FOCUS_INTERVAL_MINUTES = 25;
const DEFAULT_BREAK_INTERVAL_MINUTES = 5;
const SUPPORTED_FOCUS_METHOD: FocusMethod = "Pomodoro";
const INITIAL_FOCUS_INTERVAL: FocusSessionInterval = "Focus";
const INITIAL_INTERVAL_STATE: FocusSessionState = "Focus";
const TRANSITION_WINDOW_SECONDS = 30;
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

function isLegacyStoredFocusSession(
  entry: unknown,
): entry is LegacyStoredFocusSession {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }

  const candidate = entry as Partial<LegacyStoredFocusSession>;

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

function isStoredFocusSession(entry: unknown): entry is StoredFocusSession {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }

  const candidate = entry as Partial<StoredFocusSession>;

  return (
    isLegacyStoredFocusSession(entry) &&
    (candidate.intervalState === "AwaitingNextFocus" ||
      candidate.intervalState === "Break" ||
      candidate.intervalState === "Focus" ||
      candidate.intervalState === "Transition") &&
    typeof candidate.stateStartedAt === "string" &&
    typeof candidate.completedFocusIntervalCount === "number" &&
    typeof candidate.completedBreakIntervalCount === "number"
  );
}

function upgradeStoredFocusSession(
  session: LegacyStoredFocusSession,
): StoredFocusSession {
  if (isStoredFocusSession(session)) {
    return cloneStoredFocusSession(session);
  }

  return {
    ...session,
    completedBreakIntervalCount: 0,
    completedFocusIntervalCount: 0,
    intervalState:
      session.currentInterval === "Break" ? "Break" : INITIAL_INTERVAL_STATE,
    stateStartedAt: session.createdAt,
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

    return parsedValue
      .filter(isLegacyStoredFocusSession)
      .map(upgradeStoredFocusSession);
  } catch {
    return [];
  }
}

function assertPositiveInteger(value: number, message: string) {
  if (!Number.isInteger(value) || value < 1) {
    throw new AppFocusError("invalid_input", message);
  }
}

function getDurationMs(minutes: number) {
  return minutes * 60 * 1000;
}

function toIsoString(timestampMs: number) {
  return new Date(timestampMs).toISOString();
}

function getTransitionWindowMs() {
  return TRANSITION_WINDOW_SECONDS * 1000;
}

function getStateEndTimestamp(session: StoredFocusSession) {
  const stateStartedAtMs = Date.parse(session.stateStartedAt);

  switch (session.intervalState) {
    case "Focus":
      return stateStartedAtMs + getDurationMs(session.focusIntervalMinutes);
    case "Break":
      return stateStartedAtMs + getDurationMs(session.breakIntervalMinutes);
    case "Transition":
      return stateStartedAtMs + getTransitionWindowMs();
    case "AwaitingNextFocus":
      return null;
  }
}

function hasReachedPlannedIntervalCount(session: StoredFocusSession) {
  return (
    session.plannedFocusIntervalCount !== null &&
    session.completedFocusIntervalCount >= session.plannedFocusIntervalCount
  );
}

function deriveStoredFocusSession(
  session: StoredFocusSession,
  now: Date,
): DerivedFocusSession {
  const nowMs = now.getTime();
  let derivedSession = cloneStoredFocusSession(session);

  while (true) {
    const stateEndTimestamp = getStateEndTimestamp(derivedSession);

    if (stateEndTimestamp === null || nowMs < stateEndTimestamp) {
      return {
        isStale:
          derivedSession.intervalState === "AwaitingNextFocus" &&
          nowMs > Date.parse(derivedSession.stateStartedAt),
        session: derivedSession,
      };
    }

    if (derivedSession.intervalState === "Focus") {
      derivedSession = {
        ...derivedSession,
        completedFocusIntervalCount:
          derivedSession.completedFocusIntervalCount + 1,
        currentInterval: "Focus",
        intervalState: "Transition",
        stateStartedAt: toIsoString(stateEndTimestamp),
      };
      continue;
    }

    if (derivedSession.intervalState === "Transition") {
      if (hasReachedPlannedIntervalCount(derivedSession)) {
        return {
          isStale: nowMs > stateEndTimestamp,
          session: {
            ...derivedSession,
            currentInterval: "Focus",
            intervalState: "AwaitingNextFocus",
            stateStartedAt: toIsoString(stateEndTimestamp),
          },
        };
      }

      derivedSession = {
        ...derivedSession,
        currentInterval: "Break",
        intervalState: "Break",
        stateStartedAt: toIsoString(stateEndTimestamp),
      };
      continue;
    }

    if (derivedSession.intervalState === "Break") {
      return {
        isStale: nowMs > stateEndTimestamp,
        session: {
          ...derivedSession,
          completedBreakIntervalCount:
            derivedSession.completedBreakIntervalCount + 1,
          currentInterval: "Break",
          intervalState: "AwaitingNextFocus",
          stateStartedAt: toIsoString(stateEndTimestamp),
        },
      };
    }

    return {
      isStale: nowMs > Date.parse(derivedSession.stateStartedAt),
      session: derivedSession,
    };
  }
}

function toPublicSession(
  session: StoredFocusSession,
  now: Date = new Date(),
): FocusSession {
  const derivedSession = deriveStoredFocusSession(session, now);
  const stateEndTimestamp = getStateEndTimestamp(derivedSession.session);

  return {
    breakIntervalMinutes: derivedSession.session.breakIntervalMinutes,
    completedBreakIntervalCount:
      derivedSession.session.completedBreakIntervalCount,
    completedFocusIntervalCount:
      derivedSession.session.completedFocusIntervalCount,
    createdAt: derivedSession.session.createdAt,
    currentInterval: derivedSession.session.currentInterval,
    focusIntervalMinutes: derivedSession.session.focusIntervalMinutes,
    id: derivedSession.session.id,
    intervalState: derivedSession.session.intervalState,
    isStale: derivedSession.isStale,
    method: derivedSession.session.method,
    plannedFocusIntervalCount: derivedSession.session.plannedFocusIntervalCount,
    remainingSeconds:
      stateEndTimestamp === null
        ? null
        : Math.ceil((stateEndTimestamp - now.getTime()) / 1000),
    stateEndsAt:
      stateEndTimestamp === null ? null : toIsoString(stateEndTimestamp),
    stateStartedAt: derivedSession.session.stateStartedAt,
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

function getCurrentDate() {
  return new Date();
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

    return session === null ? null : toPublicSession(session, getCurrentDate());
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

    const now = getCurrentDate();
    const nextSession: StoredFocusSession = {
      breakIntervalMinutes,
      completedBreakIntervalCount: 0,
      completedFocusIntervalCount: 0,
      createdAt: now.toISOString(),
      currentInterval: INITIAL_FOCUS_INTERVAL,
      focusIntervalMinutes,
      id: cryptoProvider.randomUUID(),
      intervalState: INITIAL_INTERVAL_STATE,
      method: SUPPORTED_FOCUS_METHOD,
      plannedFocusIntervalCount,
      stateStartedAt: now.toISOString(),
      userId: input.userId,
    };

    writeSnapshot([...activeSessions, nextSession]);

    return toPublicSession(nextSession, now);
  }

  function startNextFocusInterval(input: StartNextFocusIntervalInput) {
    const session = getActiveStoredSession(activeSessions, input.userId);

    if (session === null) {
      throw new AppFocusError("invalid_input", "User has no active FocusSession.");
    }

    const now = getCurrentDate();
    const derivedSession = deriveStoredFocusSession(session, now).session;

    if (derivedSession.intervalState === "Focus") {
      throw new AppFocusError(
        "invalid_input",
        "Current FocusInterval is already running.",
      );
    }

    const nextSession: StoredFocusSession = {
      ...derivedSession,
      currentInterval: "Focus",
      intervalState: "Focus",
      stateStartedAt: now.toISOString(),
    };

    writeSnapshot(
      activeSessions.map((activeSession) =>
        activeSession.userId === input.userId ? nextSession : activeSession,
      ),
    );

    return toPublicSession(nextSession, now);
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
    startNextFocusInterval,
    subscribe,
  };
}
