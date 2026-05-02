import type { AppLabel } from "../../labels/domain/labels";
import type { AppNote } from "../notes-workspace/notes";

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

export type RecallStudyActivityMode = "AiAssisted" | "AiGraded" | "FlashCard";

export type RecallStudyActivitySession = {
  createdAt: string;
  id: string;
  mode: RecallStudyActivityMode;
  notes: readonly AppNote[];
};

export type NoteFocusTarget = {
  kind: "Note";
  labels: readonly AppLabel[];
  note: AppNote;
};

export type RecallSessionFocusTarget = {
  kind: "RecallSession";
  labels: readonly AppLabel[];
  notes: readonly AppNote[];
  recallSession: {
    createdAt: string;
    id: string;
    mode: RecallStudyActivityMode;
  };
};

export type FocusTarget = NoteFocusTarget | RecallSessionFocusTarget;

export type FocusRecord = {
  breakIntervalMinutes: number;
  completedBreakIntervalCount: number;
  completedFocusIntervalCount: number;
  createdAt: string;
  endedAt: string;
  focusIntervalMinutes: number;
  focusTargets: readonly FocusTarget[];
  id: string;
  intervals: readonly FocusRecordInterval[];
  method: FocusMethod;
  plannedFocusIntervalCount: number | null;
  startedAt: string;
  targets: readonly FocusTarget[];
};

export type FocusSession = {
  breakIntervalMinutes: number;
  completedBreakIntervalCount: number;
  completedFocusIntervalCount: number;
  createdAt: string;
  currentInterval: FocusSessionInterval;
  focusIntervalMinutes: number;
  focusTargets: readonly FocusTarget[];
  id: string;
  intervalState: FocusSessionState;
  isStale: boolean;
  method: FocusMethod;
  plannedFocusIntervalCount: number | null;
  remainingSeconds: number | null;
  stateEndsAt: string | null;
  stateStartedAt: string;
  targets: readonly FocusTarget[];
};

export function isBreakIntervalActive(session: FocusSession | null) {
  return (
    session !== null &&
    session.currentInterval === "Break" &&
    session.intervalState === "Break"
  );
}

type StoredFocusSession = Omit<
  FocusSession,
  "isStale" | "remainingSeconds" | "stateEndsAt"
> & {
  focusTargets: FocusTarget[];
  targets: FocusTarget[];
  userId: string;
};

type StoredFocusRecord = FocusRecord & {
  focusTargets: FocusTarget[];
  intervals: FocusRecordInterval[];
  targets: FocusTarget[];
  userId: string;
};

type LegacyStoredFocusSession = {
  breakIntervalMinutes: number;
  createdAt: string;
  currentInterval: FocusSessionInterval;
  focusIntervalMinutes: number;
  focusTargets?: FocusTarget[];
  id: string;
  method: FocusMethod;
  plannedFocusIntervalCount: number | null;
  targets?: FocusTarget[];
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

type CaptureNoteStudyActivityInput = {
  labels: readonly AppLabel[];
  note: AppNote;
  userId: string;
};

type GetFocusRecordsInput = {
  userId: string;
};

type CreateAppFocusContextOptions = {
  crypto?: FocusCrypto;
  getLabelsForUser?: (userId: string) => readonly AppLabel[];
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
  captureNoteStudyActivity: (input: CaptureNoteStudyActivityInput) => void;
  captureRecallSessionStudyActivity: (input: {
    recallSession: RecallStudyActivitySession;
    userId: string;
  }) => void;
  endFocusSession: (input: EndFocusSessionInput) => FocusRecord | null;
  getActiveSession: (input: GetActiveFocusSessionInput) => FocusSession | null;
  getFocusRecords: (input: GetFocusRecordsInput) => readonly FocusRecord[];
  getRecordSnapshot: () => AppFocusRecordSnapshot;
  getSnapshot: () => AppFocusSnapshot;
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

function isRecallStudyActivityMode(
  value: unknown,
): value is RecallStudyActivityMode {
  return (
    value === "AiAssisted" || value === "AiGraded" || value === "FlashCard"
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
    focusTargets: session.focusTargets.map(cloneFocusTarget),
    targets: session.targets.map(cloneFocusTarget),
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
    focusTargets: record.focusTargets.map(cloneFocusTarget),
    intervals: record.intervals.map(cloneFocusRecordInterval),
    targets: record.targets.map(cloneFocusTarget),
  };
}

function cloneLabel(label: AppLabel): AppLabel {
  return {
    ...label,
    parentIds: [...label.parentIds],
  };
}

function cloneNote(note: AppNote): AppNote {
  return {
    ...note,
    acronyms: note.acronyms.map((acronym) => ({ ...acronym })),
    labelIds: [...note.labelIds],
    metaphors: note.metaphors.map((metaphor) => ({ ...metaphor })),
  };
}

function cloneFocusTarget(target: FocusTarget): FocusTarget {
  if (target.kind === "RecallSession") {
    return {
      kind: "RecallSession",
      labels: target.labels.map(cloneLabel),
      notes: target.notes.map(cloneNote),
      recallSession: {
        ...target.recallSession,
      },
    };
  }

  return {
    kind: "Note",
    labels: target.labels.map(cloneLabel),
    note: cloneNote(target.note),
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
    typeof candidate.completedBreakIntervalCount === "number" &&
    Array.isArray(candidate.focusTargets) &&
    candidate.focusTargets.every(isFocusTarget) &&
    Array.isArray(candidate.targets) &&
    candidate.targets.every(isFocusTarget)
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
    focusTargets: Array.isArray(session.focusTargets)
      ? session.focusTargets.map(cloneFocusTarget)
      : [],
    intervalState:
      session.currentInterval === "Break" ? "Break" : INITIAL_INTERVAL_STATE,
    stateStartedAt: session.createdAt,
    targets: Array.isArray(session.targets)
      ? session.targets.map(cloneFocusTarget)
      : [],
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

function isAppLabel(entry: unknown): entry is AppLabel {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }

  const candidate = entry as Partial<AppLabel>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    Array.isArray(candidate.parentIds) &&
    candidate.parentIds.every((parentId) => typeof parentId === "string")
  );
}

function isAppAcronym(entry: unknown) {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }

  const candidate = entry as Record<string, unknown>;

  return (
    typeof candidate.shortForm === "string" &&
    typeof candidate.expansion === "string"
  );
}

function isAppMetaphor(entry: unknown) {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }

  const candidate = entry as Record<string, unknown>;

  return (
    typeof candidate.title === "string" &&
    typeof candidate.explanation === "string"
  );
}

function isAppNote(entry: unknown): entry is AppNote {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }

  const candidate = entry as Partial<AppNote>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.body === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string" &&
    Array.isArray(candidate.labelIds) &&
    candidate.labelIds.every((labelId) => typeof labelId === "string") &&
    Array.isArray(candidate.metaphors) &&
    candidate.metaphors.every(isAppMetaphor) &&
    Array.isArray(candidate.acronyms) &&
    candidate.acronyms.every(isAppAcronym)
  );
}

function isFocusTarget(entry: unknown): entry is FocusTarget {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }

  const candidate = entry as Partial<FocusTarget>;

  if (candidate.kind === "RecallSession") {
    return (
      Array.isArray(candidate.labels) &&
      candidate.labels.every(isAppLabel) &&
      Array.isArray(candidate.notes) &&
      candidate.notes.every(isAppNote) &&
      typeof candidate.recallSession === "object" &&
      candidate.recallSession !== null &&
      typeof candidate.recallSession.id === "string" &&
      typeof candidate.recallSession.createdAt === "string" &&
      isRecallStudyActivityMode(candidate.recallSession.mode)
    );
  }

  return (
    candidate.kind === "Note" &&
    Array.isArray(candidate.labels) &&
    candidate.labels.every(isAppLabel) &&
    isAppNote(candidate.note)
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
    (candidate.focusTargets === undefined ||
      (Array.isArray(candidate.focusTargets) &&
        candidate.focusTargets.every(isFocusTarget))) &&
    (candidate.targets === undefined ||
      (Array.isArray(candidate.targets) &&
        candidate.targets.every(isFocusTarget))) &&
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

    return parsedValue.filter(isStoredFocusRecord).map((record) =>
      cloneStoredFocusRecord({
        ...record,
        focusTargets: Array.isArray(record.focusTargets)
          ? record.focusTargets
          : [],
        targets: Array.isArray(record.targets) ? record.targets : [],
      }),
    );
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
    focusTargets: storedSession.focusTargets.map(cloneFocusTarget),
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
    targets: storedSession.targets.map(cloneFocusTarget),
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
    focusTargets: record.focusTargets.map(cloneFocusTarget),
    intervals: record.intervals.map(cloneFocusRecordInterval),
    targets: record.targets.map(cloneFocusTarget),
  };
}

function areStoredSessionsEqual(
  left: StoredFocusSession,
  right: StoredFocusSession,
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function replaceActiveStoredSession(
  sessions: readonly StoredFocusSession[],
  userId: string,
  nextSession: StoredFocusSession,
) {
  return sessions.map((session) =>
    session.userId === userId ? nextSession : session,
  );
}

function isRunningFocusInterval(session: StoredFocusSession) {
  return (
    session.currentInterval === "Focus" && session.intervalState === "Focus"
  );
}

function mergeNoteFocusTarget(
  currentTargets: readonly FocusTarget[],
  input: CaptureNoteStudyActivityInput,
) {
  const noteLabelIds = new Set(input.note.labelIds);
  const nextTarget: FocusTarget = {
    kind: "Note",
    labels: input.labels
      .filter((label) => noteLabelIds.has(label.id))
      .map(cloneLabel),
    note: cloneNote(input.note),
  };
  const existingTarget = currentTargets.find(
    (target): target is NoteFocusTarget =>
      target.kind === "Note" && target.note.id === input.note.id,
  );

  if (existingTarget === undefined) {
    return [...currentTargets.map(cloneFocusTarget), nextTarget];
  }

  const labelsById = new Map(
    existingTarget.labels.map((label) => [label.id, cloneLabel(label)]),
  );

  for (const label of nextTarget.labels) {
    labelsById.set(label.id, cloneLabel(label));
  }

  const mergedTarget: FocusTarget = {
    kind: "Note",
    labels: [...labelsById.values()],
    note: cloneNote(nextTarget.note),
  };

  return currentTargets.map((target) => {
    if (target.kind === "Note" && target.note.id === existingTarget.note.id) {
      return mergedTarget;
    }

    return cloneFocusTarget(target);
  });
}

function getRecallTargetLabelSnapshots(input: {
  getLabelsForUser?: (userId: string) => readonly AppLabel[];
  noteSnapshots: readonly AppNote[];
  userId: string;
}) {
  const labelsById = new Map(
    (input.getLabelsForUser?.(input.userId) ?? []).map((label) => [
      label.id,
      label,
    ]),
  );
  const seenLabelIds = new Set<string>();
  const labelSnapshots: AppLabel[] = [];

  for (const note of input.noteSnapshots) {
    for (const labelId of note.labelIds) {
      if (seenLabelIds.has(labelId)) {
        continue;
      }

      const label = labelsById.get(labelId);

      if (label === undefined) {
        continue;
      }

      seenLabelIds.add(labelId);
      labelSnapshots.push(cloneLabel(label));
    }
  }

  return labelSnapshots;
}

function appendCompletedInterval(
  intervals: FocusRecordInterval[],
  input: {
    durationMinutes: number;
    kind: FocusSessionInterval;
    startedAt: string;
  },
) {
  const endedAt = toIsoString(
    Date.parse(input.startedAt) + getDurationMs(input.durationMinutes),
  );

  intervals.push({
    endedAt,
    kind: input.kind,
    startedAt: input.startedAt,
  });

  return endedAt;
}

function buildCompletedIntervals(
  session: StoredFocusSession,
): FocusRecordInterval[] {
  const intervals: FocusRecordInterval[] = [];
  let nextIntervalStartsAt = session.createdAt;

  for (let index = 0; index < session.completedFocusIntervalCount; index += 1) {
    nextIntervalStartsAt = appendCompletedInterval(intervals, {
      durationMinutes: session.focusIntervalMinutes,
      kind: "Focus",
      startedAt: nextIntervalStartsAt,
    });

    if (index < session.completedBreakIntervalCount) {
      nextIntervalStartsAt = appendCompletedInterval(intervals, {
        durationMinutes: session.breakIntervalMinutes,
        kind: "Break",
        startedAt: nextIntervalStartsAt,
      });
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

  function replaceActiveSession(
    userId: string,
    nextSession: StoredFocusSession,
  ) {
    writeSnapshot(
      replaceActiveStoredSession(activeSessions, userId, nextSession),
    );
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
      focusTargets: [],
      id: cryptoProvider.randomUUID(),
      intervalState: INITIAL_INTERVAL_STATE,
      method: SUPPORTED_FOCUS_METHOD,
      plannedFocusIntervalCount,
      stateStartedAt: startedAt,
      targets: [],
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

    replaceActiveSession(input.userId, nextSession);

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
      focusTargets: derivedSession.focusTargets.map(cloneFocusTarget),
      id: cryptoProvider.randomUUID(),
      intervals,
      method: derivedSession.method,
      plannedFocusIntervalCount: derivedSession.plannedFocusIntervalCount,
      startedAt: derivedSession.createdAt,
      targets: derivedSession.targets.map(cloneFocusTarget),
      userId: input.userId,
    };

    writeRecordSnapshot([record, ...focusRecords]);

    return toPublicFocusRecord(record);
  }

  function syncInactiveDerivedSession(
    userId: string,
    session: StoredFocusSession,
    derivedSession: StoredFocusSession,
  ) {
    if (!areStoredSessionsEqual(session, derivedSession)) {
      replaceActiveSession(userId, derivedSession);
    }
  }

  function captureRecallSessionStudyActivity(input: {
    recallSession: RecallStudyActivitySession;
    userId: string;
  }) {
    const session = getActiveStoredSession(activeSessions, input.userId);

    if (session === null) {
      return;
    }

    const now = getCurrentDate();
    const derivedSession = deriveStoredFocusSession(session, now).session;

    if (!isRunningFocusInterval(derivedSession)) {
      syncInactiveDerivedSession(input.userId, session, derivedSession);
      return;
    }

    const recallTarget: FocusTarget = {
      kind: "RecallSession",
      labels: getRecallTargetLabelSnapshots({
        getLabelsForUser: options.getLabelsForUser,
        noteSnapshots: input.recallSession.notes,
        userId: input.userId,
      }),
      notes: input.recallSession.notes.map(cloneNote),
      recallSession: {
        createdAt: input.recallSession.createdAt,
        id: input.recallSession.id,
        mode: input.recallSession.mode,
      },
    };
    const nextFocusTargets = [
      ...derivedSession.focusTargets.filter(
        (target) =>
          target.kind !== "RecallSession" ||
          target.recallSession.id !== input.recallSession.id,
      ),
      recallTarget,
    ];
    const nextSession: StoredFocusSession = {
      ...derivedSession,
      focusTargets: nextFocusTargets,
    };

    replaceActiveSession(input.userId, nextSession);
  }

  function subscribe(listener: FocusListener) {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  function captureNoteStudyActivity(input: CaptureNoteStudyActivityInput) {
    const session = getActiveStoredSession(activeSessions, input.userId);

    if (session === null) {
      return;
    }

    const now = getCurrentDate();
    const derivedSession = deriveStoredFocusSession(session, now).session;

    if (!isRunningFocusInterval(derivedSession)) {
      syncInactiveDerivedSession(input.userId, session, derivedSession);
      return;
    }

    const nextSession: StoredFocusSession = {
      ...derivedSession,
      targets: mergeNoteFocusTarget(derivedSession.targets, input),
    };

    replaceActiveSession(input.userId, nextSession);
  }

  return {
    captureNoteStudyActivity,
    captureRecallSessionStudyActivity,
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
