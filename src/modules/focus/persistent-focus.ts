import type { AppLabel } from "../labels/label-management/labels";
import type { AppNote } from "../notes";
import type { AppStudyNote } from "../study-notes";
import {
  type AppFocusContext,
  AppFocusError,
  type AppFocusRecordSnapshot,
  type AppFocusSnapshot,
  createAppFocusContext,
  type FocusRecord,
  type FocusSession,
  type RecallStudyActivitySession,
  type StoredFocusRecord,
  type StoredFocusSession,
  toStoredFocusRecord,
  toStoredFocusSession,
} from "./focus";

type PersistentFocusListener = () => void;

type StartFocusSessionInput = {
  breakIntervalMinutes?: number;
  focusIntervalMinutes?: number;
  plannedFocusIntervalCount?: number | null;
};

type CaptureNoteStudyActivityInput = {
  labels: readonly AppLabel[];
  note: AppNote;
};

type CaptureStudyNoteStudyActivityInput = {
  labels: readonly AppLabel[];
  studyNote: AppStudyNote;
};

export type AppPersistentFocusService = {
  captureNoteStudyActivity: (
    input: CaptureNoteStudyActivityInput,
  ) => Promise<void>;
  captureRecallSessionStudyActivity: (input: {
    recallSession: RecallStudyActivitySession;
  }) => Promise<void>;
  captureStudyNoteStudyActivity: (
    input: CaptureStudyNoteStudyActivityInput,
  ) => Promise<void>;
  endFocusSession: () => Promise<FocusRecord | null>;
  getActiveSession: () => Promise<FocusSession | null>;
  listFocusRecords: () => Promise<readonly FocusRecord[]>;
  startFocusSession: (input: StartFocusSessionInput) => Promise<FocusSession>;
  startNextFocusInterval: () => Promise<FocusSession>;
};

export type AppPersistentFocusContext = {
  captureNoteStudyActivity: (
    userId: string | null,
    input: CaptureNoteStudyActivityInput,
  ) => Promise<void>;
  captureRecallSessionStudyActivity: (
    userId: string | null,
    input: {
      recallSession: RecallStudyActivitySession;
    },
  ) => Promise<void>;
  captureStudyNoteStudyActivity: (
    userId: string | null,
    input: CaptureStudyNoteStudyActivityInput,
  ) => Promise<void>;
  endFocusSession: (userId: string | null) => Promise<FocusRecord | null>;
  getRecordSnapshot: () => AppFocusRecordSnapshot;
  getSnapshot: () => AppFocusSnapshot;
  readonlyContext: AppFocusContext;
  refresh: (userId: string | null) => Promise<{
    activeSession: AppFocusSnapshot;
    focusRecords: AppFocusRecordSnapshot;
  }>;
  startFocusSession: (
    userId: string | null,
    input: StartFocusSessionInput,
  ) => Promise<FocusSession>;
  startNextFocusInterval: (userId: string | null) => Promise<FocusSession>;
  subscribe: (listener: PersistentFocusListener) => () => void;
};

type CreatePersistentFocusContextOptions = {
  service?: AppPersistentFocusService;
};

type MemoryStorage = Pick<Storage, "getItem" | "setItem">;

const STORAGE_KEY_PREFIX = "persistent-focus-context";

function createNotAuthenticatedError() {
  return new AppFocusError("invalid_input", "A signed-in user is required.");
}

function createMissingServiceError() {
  return new Error("Persistent focus service is not configured.");
}

function createMemoryStorage(
  values: Record<string, string | null>,
): MemoryStorage {
  const storage = new Map(
    Object.entries(values).filter((entry): entry is [string, string] => {
      return entry[1] !== null;
    }),
  );

  return {
    getItem(key) {
      return storage.get(key) ?? null;
    },
    setItem(key, value) {
      storage.set(key, value);
    },
  };
}

function getActiveSessionStorageKey(prefix: string) {
  return `${prefix}:active-sessions`;
}

function getFocusRecordsStorageKey(prefix: string) {
  return `${prefix}:records`;
}

function createReadonlyFocusContext(
  state: Pick<
    AppPersistentFocusContext,
    "getRecordSnapshot" | "getSnapshot" | "subscribe"
  > & {
    getActiveSessionForUser: (userId: string) => FocusSession | null;
    getFocusRecordsForUser: (userId: string) => readonly FocusRecord[];
  },
): AppFocusContext {
  return {
    captureNoteStudyActivity: () => {
      throw new Error(
        "Readonly focus context cannot capture note activity. Use persistentFocus instead.",
      );
    },
    captureRecallSessionStudyActivity: () => {
      throw new Error(
        "Readonly focus context cannot capture recall activity. Use persistentFocus instead.",
      );
    },
    captureStudyNoteStudyActivity: () => {
      throw new Error(
        "Readonly focus context cannot capture study note activity. Use persistentFocus instead.",
      );
    },
    endFocusSession: () => {
      throw new Error(
        "Readonly focus context cannot end sessions. Use persistentFocus instead.",
      );
    },
    getActiveSession: ({ userId }) => state.getActiveSessionForUser(userId),
    getFocusRecords: ({ userId }) => state.getFocusRecordsForUser(userId),
    getRecordSnapshot: state.getRecordSnapshot,
    getSnapshot: state.getSnapshot,
    startFocusSession: () => {
      throw new Error(
        "Readonly focus context cannot start sessions. Use persistentFocus instead.",
      );
    },
    startNextFocusInterval: () => {
      throw new Error(
        "Readonly focus context cannot advance sessions. Use persistentFocus instead.",
      );
    },
    subscribe: state.subscribe,
  };
}

function createHydratedFocusContext(input: {
  activeSession: StoredFocusSession | null;
  focusRecords: readonly StoredFocusRecord[];
}) {
  const storage = createMemoryStorage({
    [getActiveSessionStorageKey(STORAGE_KEY_PREFIX)]:
      input.activeSession === null
        ? JSON.stringify([])
        : JSON.stringify([input.activeSession]),
    [getFocusRecordsStorageKey(STORAGE_KEY_PREFIX)]: JSON.stringify(
      input.focusRecords,
    ),
  });

  return createAppFocusContext({
    keyPrefix: STORAGE_KEY_PREFIX,
    storage,
  });
}

export function createPersistentFocusContext(
  options: CreatePersistentFocusContextOptions = {},
): AppPersistentFocusContext {
  const service = options.service;
  const listeners = new Set<PersistentFocusListener>();
  let activeSessionSnapshot: StoredFocusSession | null = null;
  let focusRecordSnapshot: StoredFocusRecord[] = [];
  let focus = createHydratedFocusContext({
    activeSession: activeSessionSnapshot,
    focusRecords: focusRecordSnapshot,
  });

  function notifyListeners() {
    for (const listener of listeners) {
      listener();
    }
  }

  function requireService() {
    if (service === undefined) {
      throw createMissingServiceError();
    }

    return service;
  }

  function writeState(input: {
    activeSession: FocusSession | null;
    focusRecords: readonly FocusRecord[];
    userId: string;
  }) {
    activeSessionSnapshot = toStoredFocusSession(
      input.activeSession,
      input.userId,
    );
    focusRecordSnapshot = input.focusRecords.map((record) =>
      toStoredFocusRecord(record, input.userId),
    );
    focus = createHydratedFocusContext({
      activeSession: activeSessionSnapshot,
      focusRecords: focusRecordSnapshot,
    });
    notifyListeners();

    return {
      activeSession: focus.getSnapshot(),
      focusRecords: focus.getRecordSnapshot(),
    };
  }

  function resetState() {
    activeSessionSnapshot = null;
    focusRecordSnapshot = [];
    focus = createHydratedFocusContext({
      activeSession: null,
      focusRecords: [],
    });
    notifyListeners();

    return {
      activeSession: focus.getSnapshot(),
      focusRecords: focus.getRecordSnapshot(),
    };
  }

  function requireUserId(userId: string | null) {
    if (userId === null) {
      throw createNotAuthenticatedError();
    }

    return userId;
  }

  function getRecordSnapshot() {
    return focus.getRecordSnapshot();
  }

  function getSnapshot() {
    return focus.getSnapshot();
  }

  async function refresh(userId: string | null) {
    if (userId === null) {
      return resetState();
    }

    const focusService = requireService();
    const [activeSession, focusRecords] = await Promise.all([
      focusService.getActiveSession(),
      focusService.listFocusRecords(),
    ]);

    return writeState({
      activeSession,
      focusRecords,
      userId,
    });
  }

  function subscribe(listener: PersistentFocusListener) {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  const readonlyContext = createReadonlyFocusContext({
    getActiveSessionForUser(userId) {
      return focus.getActiveSession({ userId });
    },
    getFocusRecordsForUser(userId) {
      return focus.getFocusRecords({ userId });
    },
    getRecordSnapshot,
    getSnapshot,
    subscribe,
  });

  return {
    async captureNoteStudyActivity(userId, input) {
      const validatedUserId = requireUserId(userId);
      await requireService().captureNoteStudyActivity(input);
      await refresh(validatedUserId);
    },
    async captureRecallSessionStudyActivity(userId, input) {
      const validatedUserId = requireUserId(userId);
      await requireService().captureRecallSessionStudyActivity(input);
      await refresh(validatedUserId);
    },
    async captureStudyNoteStudyActivity(userId, input) {
      const validatedUserId = requireUserId(userId);
      await requireService().captureStudyNoteStudyActivity(input);
      await refresh(validatedUserId);
    },
    async endFocusSession(userId) {
      const validatedUserId = requireUserId(userId);
      const record = await requireService().endFocusSession();
      await refresh(validatedUserId);
      return record;
    },
    getRecordSnapshot,
    getSnapshot,
    readonlyContext,
    refresh,
    async startFocusSession(userId, input) {
      const validatedUserId = requireUserId(userId);
      const session = await requireService().startFocusSession(input);
      await refresh(validatedUserId);
      return session;
    },
    async startNextFocusInterval(userId) {
      const validatedUserId = requireUserId(userId);
      const session = await requireService().startNextFocusInterval();
      await refresh(validatedUserId);
      return session;
    },
    subscribe,
  };
}
