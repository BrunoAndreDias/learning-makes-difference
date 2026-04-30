export type FocusMethod = "Pomodoro";

export type FocusSessionInterval = "Break" | "Focus";

export type FocusSessionState =
  | "AwaitingNextFocus"
  | "Break"
  | "Focus"
  | "Transition";

export type FocusRecordInterval = {
  endedAt: string;
  kind: FocusSessionInterval;
  startedAt: string;
};

export type FocusRecord = {
  breakIntervalMinutes: number;
  completedBreakIntervalCount: number;
  completedFocusIntervalCount: number;
  createdAt: string;
  endedAt: string;
  focusIntervalMinutes: number;
  id: string;
  intervals: readonly FocusRecordInterval[];
  method: FocusMethod;
  plannedFocusIntervalCount: number | null;
  startedAt: string;
};

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

type StoredFocusRecord = FocusRecord & {
  intervals: FocusRecordInterval[];
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
export type AppFocusRecordSnapshot = readonly StoredFocusRecord[];

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

type EndFocusSessionInput = {
  userId: string;
};

type GetFocusRecordsInput = {
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
  getFocusRecords: (input: GetFocusRecordsInput) => readonly FocusRecord[];
  getSnapshot: () => AppFocusSnapshot;
  getRecordSnapshot: () => AppFocusRecordSnapshot;
  endFocusSession: (input: EndFocusSessionInput) => FocusRecord | null;
  startFocusSession: (input: StartFocusSessionInput) => FocusSession;
  startNextFocusInterval: (input: StartNextFocusIntervalInput) => FocusSession;
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
const FOCUS_RECORDS_STORAGE_KEY = "records";

function isFocusSessionInterval(value: unknown): value is FocusSessionInterval {
  return value === "Focus" || value === "Break";
}

function isFocusSessionState(value: unknown): value is FocusSessionState {
  return (
    value === "AwaitingNextFocus" ||
    value === "Break" ||
    value === "Focus" ||
    value === "Transition"
  );
}

function isPlannedFocusIntervalCount(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

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

function getFocusRecordsStorageKey(prefix: string) {
  return `${prefix}:${FOCUS_RECORDS_STORAGE_KEY}`;
}

function cloneStoredFocusSession(
  session: StoredFocusSession,
): StoredFocusSession {
  return {
    ...session,
  };
}

function cloneFocusRecordInterval(
  interval: FocusRecordInterval,
): FocusRecordInterval {
  return {
    ...interval,
  };
}

function cloneStoredFocusRecord(record: StoredFocusRecord): StoredFocusRecord {
  return {
    ...record,
    intervals: record.intervals.map(cloneFocusRecordInterval),
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
    isFocusSessionInterval(candidate.currentInterval) &&
    isPlannedFocusIntervalCount(candidate.plannedFocusIntervalCount)
  );
}

function isStoredFocusSession(entry: unknown): entry is StoredFocusSession {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }

  const candidate = entry as Partial<StoredFocusSession>;

  return (
    isLegacyStoredFocusSession(entry) &&
    isFocusSessionState(candidate.intervalState) &&
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

function isFocusRecordInterval(entry: unknown): entry is FocusRecordInterval {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }

  const candidate = entry as Partial<FocusRecordInterval>;

  return (
    typeof candidate.startedAt === "string" &&
    typeof candidate.endedAt === "string" &&
    isFocusSessionInterval(candidate.kind)
  );
}

function isStoredFocusRecord(entry: unknown): entry is StoredFocusRecord {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }

  const candidate = entry as Partial<StoredFocusRecord>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.userId === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.startedAt === "string" &&
    typeof candidate.endedAt === "string" &&
    typeof candidate.focusIntervalMinutes === "number" &&
    typeof candidate.breakIntervalMinutes === "number" &&
    typeof candidate.completedFocusIntervalCount === "number" &&
    typeof candidate.completedBreakIntervalCount === "number" &&
    candidate.method === SUPPORTED_FOCUS_METHOD &&
    isPlannedFocusIntervalCount(candidate.plannedFocusIntervalCount) &&
    Array.isArray(candidate.intervals) &&
    candidate.intervals.every(isFocusRecordInterval)
  );
}

function parseFocusRecordSnapshot(
  value: string | null,
): AppFocusRecordSnapshot {
  if (value === null) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(isStoredFocusRecord).map(cloneStoredFocusRecord);
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

    const nextStateStartedAt = toIsoString(stateEndTimestamp);

    switch (derivedSession.intervalState) {
      case "Focus":
        derivedSession = {
          ...derivedSession,
          completedFocusIntervalCount:
            derivedSession.completedFocusIntervalCount + 1,
          currentInterval: "Focus",
          intervalState: "Transition",
          stateStartedAt: nextStateStartedAt,
        };
        continue;
      case "Transition":
        if (hasReachedPlannedIntervalCount(derivedSession)) {
          return {
            isStale: nowMs > stateEndTimestamp,
            session: {
              ...derivedSession,
              currentInterval: "Focus",
              intervalState: "AwaitingNextFocus",
              stateStartedAt: nextStateStartedAt,
            },
          };
        }

        derivedSession = {
          ...derivedSession,
          currentInterval: "Break",
          intervalState: "Break",
          stateStartedAt: nextStateStartedAt,
        };
        continue;
      case "Break":
        return {
          isStale: nowMs > stateEndTimestamp,
          session: {
            ...derivedSession,
            completedBreakIntervalCount:
              derivedSession.completedBreakIntervalCount + 1,
            currentInterval: "Break",
            intervalState: "AwaitingNextFocus",
            stateStartedAt: nextStateStartedAt,
          },
        };
      case "AwaitingNextFocus":
        return {
          isStale: nowMs > Date.parse(derivedSession.stateStartedAt),
          session: derivedSession,
        };
    }
  }
}

function toPublicSession(
  session: StoredFocusSession,
  now: Date = new Date(),
): FocusSession {
  const derivedSession = deriveStoredFocusSession(session, now);
  const storedSession = derivedSession.session;
  const stateEndTimestamp = getStateEndTimestamp(storedSession);

  return {
    breakIntervalMinutes: storedSession.breakIntervalMinutes,
    completedBreakIntervalCount: storedSession.completedBreakIntervalCount,
    completedFocusIntervalCount: storedSession.completedFocusIntervalCount,
    createdAt: storedSession.createdAt,
    currentInterval: storedSession.currentInterval,
    focusIntervalMinutes: storedSession.focusIntervalMinutes,
    id: storedSession.id,
    intervalState: storedSession.intervalState,
    isStale: derivedSession.isStale,
    method: storedSession.method,
    plannedFocusIntervalCount: storedSession.plannedFocusIntervalCount,
    remainingSeconds:
      stateEndTimestamp === null
        ? null
        : Math.ceil((stateEndTimestamp - now.getTime()) / 1000),
    stateEndsAt:
      stateEndTimestamp === null ? null : toIsoString(stateEndTimestamp),
    stateStartedAt: storedSession.stateStartedAt,
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

function toPublicFocusRecord(record: StoredFocusRecord): FocusRecord {
  return {
    ...record,
    intervals: record.intervals.map(cloneFocusRecordInterval),
  };
}

function buildCompletedIntervals(
  session: StoredFocusSession,
): FocusRecordInterval[] {
  const intervals: FocusRecordInterval[] = [];
  let nextIntervalStartsAt = session.createdAt;

  for (let index = 0; index < session.completedFocusIntervalCount; index += 1) {
    const focusStartedAt = nextIntervalStartsAt;
    const focusEndedAt = toIsoString(
      Date.parse(focusStartedAt) + getDurationMs(session.focusIntervalMinutes),
    );
    intervals.push({
      endedAt: focusEndedAt,
      kind: "Focus",
      startedAt: focusStartedAt,
    });
    nextIntervalStartsAt = focusEndedAt;

    if (index < session.completedBreakIntervalCount) {
      const breakStartedAt = nextIntervalStartsAt;
      const breakEndedAt = toIsoString(
        Date.parse(breakStartedAt) +
          getDurationMs(session.breakIntervalMinutes),
      );
      intervals.push({
        endedAt: breakEndedAt,
        kind: "Break",
        startedAt: breakStartedAt,
      });
      nextIntervalStartsAt = breakEndedAt;
    }
  }

  return intervals;
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
  let focusRecords = parseFocusRecordSnapshot(
    storage?.getItem(getFocusRecordsStorageKey(keyPrefix)) ?? null,
  );
  let snapshot = activeSessions.map(cloneStoredFocusSession);
  let recordSnapshot = focusRecords.map(cloneStoredFocusRecord);

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

  function writeRecordSnapshot(nextSnapshot: readonly StoredFocusRecord[]) {
    focusRecords = nextSnapshot.map(cloneStoredFocusRecord);
    recordSnapshot = focusRecords.map(cloneStoredFocusRecord);
    storage?.setItem(
      getFocusRecordsStorageKey(keyPrefix),
      JSON.stringify(focusRecords),
    );
    notifyListeners();
  }

  function getSnapshot() {
    return snapshot;
  }

  function getRecordSnapshot() {
    return recordSnapshot;
  }

  function getActiveSession({ userId }: GetActiveFocusSessionInput) {
    const session = getActiveStoredSession(activeSessions, userId);

    return session === null ? null : toPublicSession(session, getCurrentDate());
  }

  function getFocusRecords({ userId }: GetFocusRecordsInput) {
    return focusRecords
      .filter((record) => record.userId === userId)
      .map(toPublicFocusRecord);
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
    const startedAt = now.toISOString();
    const nextSession: StoredFocusSession = {
      breakIntervalMinutes,
      completedBreakIntervalCount: 0,
      completedFocusIntervalCount: 0,
      createdAt: startedAt,
      currentInterval: INITIAL_FOCUS_INTERVAL,
      focusIntervalMinutes,
      id: cryptoProvider.randomUUID(),
      intervalState: INITIAL_INTERVAL_STATE,
      method: SUPPORTED_FOCUS_METHOD,
      plannedFocusIntervalCount,
      stateStartedAt: startedAt,
      userId: input.userId,
    };

    writeSnapshot([...activeSessions, nextSession]);

    return toPublicSession(nextSession, now);
  }

  function startNextFocusInterval(input: StartNextFocusIntervalInput) {
    const session = getActiveStoredSession(activeSessions, input.userId);

    if (session === null) {
      throw new AppFocusError(
        "invalid_input",
        "User has no active FocusSession.",
      );
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

  function endFocusSession(input: EndFocusSessionInput) {
    const session = getActiveStoredSession(activeSessions, input.userId);

    if (session === null) {
      throw new AppFocusError(
        "invalid_input",
        "User has no active FocusSession.",
      );
    }

    const now = getCurrentDate();
    const endedAt = now.toISOString();
    const derivedSession = deriveStoredFocusSession(session, now).session;
    const nextActiveSessions = activeSessions.filter(
      (activeSession) => activeSession.userId !== input.userId,
    );

    writeSnapshot(nextActiveSessions);

    const intervals = buildCompletedIntervals(derivedSession);

    if (intervals.length === 0) {
      return null;
    }

    const record: StoredFocusRecord = {
      breakIntervalMinutes: derivedSession.breakIntervalMinutes,
      completedBreakIntervalCount: derivedSession.completedBreakIntervalCount,
      completedFocusIntervalCount: derivedSession.completedFocusIntervalCount,
      createdAt: endedAt,
      endedAt,
      focusIntervalMinutes: derivedSession.focusIntervalMinutes,
      id: cryptoProvider.randomUUID(),
      intervals,
      method: derivedSession.method,
      plannedFocusIntervalCount: derivedSession.plannedFocusIntervalCount,
      startedAt: derivedSession.createdAt,
      userId: input.userId,
    };

    writeRecordSnapshot([record, ...focusRecords]);

    return toPublicFocusRecord(record);
  }

  function subscribe(listener: FocusListener) {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  return {
    endFocusSession,
    getActiveSession,
    getFocusRecords,
    getRecordSnapshot,
    getSnapshot,
    startFocusSession,
    startNextFocusInterval,
    subscribe,
  };
}
