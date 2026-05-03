import { desc, eq } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core/db";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";

import type { AppLabel } from "../labels/label-management/labels";
import { createLabelsService } from "../labels/labels-service";
import type { AppNote } from "../notes";
import {
  createAppFocusContext,
  type RecallStudyActivitySession,
  type StoredFocusRecord,
  type StoredFocusSession,
  toStoredFocusSession,
} from "./focus";
import { activeFocusSessionsTable, focusRecordsTable } from "./focus-schema";

type FocusDatabase<TSchema extends Record<string, unknown>> = PgDatabase<
  PgQueryResultHKT,
  TSchema
>;

type FocusCrypto = Pick<Crypto, "randomUUID">;

type StartFocusSessionInput = {
  breakIntervalMinutes?: number;
  focusIntervalMinutes?: number;
  plannedFocusIntervalCount?: number | null;
  userId: string;
};

type UpdateFocusSessionInput = {
  userId: string;
};

type CaptureNoteStudyActivityInput = {
  labels: readonly AppLabel[];
  note: AppNote;
  userId: string;
};

type CaptureRecallStudyActivityInput = {
  recallSession: RecallStudyActivitySession;
  userId: string;
};

type CreateFocusServiceOptions = {
  crypto?: FocusCrypto;
  db: FocusDatabase<Record<string, unknown>>;
};

type MemoryStorage = Pick<Storage, "getItem" | "setItem">;
type MutableFocusContext = ReturnType<typeof createAppFocusContext>;

const SERVICE_STORAGE_KEY_PREFIX = "persistent-focus-service";

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

async function readStoredActiveSession(
  db: FocusDatabase<Record<string, unknown>>,
  userId: string,
): Promise<StoredFocusSession | null> {
  const row =
    (
      await db
        .select({
          payload: activeFocusSessionsTable.payload,
        })
        .from(activeFocusSessionsTable)
        .where(eq(activeFocusSessionsTable.userId, userId))
        .limit(1)
    )[0] ?? null;

  return row?.payload ?? null;
}

async function readStoredFocusRecords(
  db: FocusDatabase<Record<string, unknown>>,
  userId: string,
): Promise<StoredFocusRecord[]> {
  const rows = await db
    .select({
      payload: focusRecordsTable.payload,
    })
    .from(focusRecordsTable)
    .where(eq(focusRecordsTable.userId, userId))
    .orderBy(desc(focusRecordsTable.endedAt), desc(focusRecordsTable.id));

  return rows.map((row) => row.payload);
}

async function persistStoredActiveSession(input: {
  db: FocusDatabase<Record<string, unknown>>;
  session: StoredFocusSession | null;
  userId: string;
}) {
  if (input.session === null) {
    await input.db
      .delete(activeFocusSessionsTable)
      .where(eq(activeFocusSessionsTable.userId, input.userId));
    return;
  }

  await input.db
    .insert(activeFocusSessionsTable)
    .values({
      payload: input.session,
      sessionId: input.session.id,
      userId: input.userId,
    })
    .onConflictDoUpdate({
      set: {
        payload: input.session,
        sessionId: input.session.id,
      },
      target: activeFocusSessionsTable.userId,
    });
}

async function persistFocusState(input: {
  db: FocusDatabase<Record<string, unknown>>;
  focus: MutableFocusContext;
  userId: string;
}) {
  const nextActiveSession =
    input.focus
      .getSnapshot()
      .find((session) => session.userId === input.userId) ?? null;
  const nextFocusRecords = input.focus
    .getRecordSnapshot()
    .filter(
      (record) => record.userId === input.userId,
    ) satisfies StoredFocusRecord[];

  await input.db.transaction(async (tx) => {
    if (nextActiveSession === null) {
      await tx
        .delete(activeFocusSessionsTable)
        .where(eq(activeFocusSessionsTable.userId, input.userId));
    } else {
      await tx
        .insert(activeFocusSessionsTable)
        .values({
          payload: nextActiveSession,
          sessionId: nextActiveSession.id,
          userId: input.userId,
        })
        .onConflictDoUpdate({
          set: {
            payload: nextActiveSession,
            sessionId: nextActiveSession.id,
          },
          target: activeFocusSessionsTable.userId,
        });
    }

    await tx
      .delete(focusRecordsTable)
      .where(eq(focusRecordsTable.userId, input.userId));

    if (nextFocusRecords.length > 0) {
      await tx.insert(focusRecordsTable).values(
        nextFocusRecords.map((record) => ({
          endedAt: new Date(record.endedAt),
          id: record.id,
          payload: record,
          userId: input.userId,
        })),
      );
    }
  });
}

async function createMutableFocusContext(input: {
  crypto?: FocusCrypto;
  db: FocusDatabase<Record<string, unknown>>;
  userId: string;
}) {
  const labelsService = createLabelsService({
    db: input.db,
  });
  const [labels, activeSession, focusRecords] = await Promise.all([
    labelsService.listLabels({
      userId: input.userId,
    }),
    readStoredActiveSession(input.db, input.userId),
    readStoredFocusRecords(input.db, input.userId),
  ]);
  const storage = createMemoryStorage({
    [getActiveSessionStorageKey(SERVICE_STORAGE_KEY_PREFIX)]:
      activeSession === null
        ? JSON.stringify([])
        : JSON.stringify([activeSession]),
    [getFocusRecordsStorageKey(SERVICE_STORAGE_KEY_PREFIX)]:
      JSON.stringify(focusRecords),
  });

  return createAppFocusContext({
    crypto: input.crypto,
    getLabelsForUser: () => labels,
    keyPrefix: SERVICE_STORAGE_KEY_PREFIX,
    storage,
  });
}

function areStoredFocusSessionsEqual(
  left: StoredFocusSession | null,
  right: StoredFocusSession | null,
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function runFocusMutation<TResult>(input: {
  db: FocusDatabase<Record<string, unknown>>;
  crypto?: FocusCrypto;
  operation: (focus: MutableFocusContext) => TResult;
  userId: string;
}) {
  const focus = await createMutableFocusContext({
    crypto: input.crypto,
    db: input.db,
    userId: input.userId,
  });
  const result = input.operation(focus);
  await persistFocusState({
    db: input.db,
    focus,
    userId: input.userId,
  });

  return result;
}

export function createFocusService({ crypto, db }: CreateFocusServiceOptions) {
  return {
    async captureNoteStudyActivity(input: CaptureNoteStudyActivityInput) {
      await runFocusMutation({
        crypto,
        db,
        operation: (focus) => {
          focus.captureNoteStudyActivity(input);
        },
        userId: input.userId,
      });
    },
    async captureRecallSessionStudyActivity(
      input: CaptureRecallStudyActivityInput,
    ) {
      await runFocusMutation({
        crypto,
        db,
        operation: (focus) => {
          focus.captureRecallSessionStudyActivity(input);
        },
        userId: input.userId,
      });
    },
    async endFocusSession(input: UpdateFocusSessionInput) {
      return runFocusMutation({
        crypto,
        db,
        operation: (focus) => focus.endFocusSession(input),
        userId: input.userId,
      });
    },
    async getActiveSession(input: UpdateFocusSessionInput) {
      const focus = await createMutableFocusContext({
        crypto,
        db,
        userId: input.userId,
      });
      const activeSession = focus.getActiveSession({
        userId: input.userId,
      });
      const storedSession = await readStoredActiveSession(db, input.userId);
      const nextStoredSession = toStoredFocusSession(
        activeSession,
        input.userId,
      );

      if (!areStoredFocusSessionsEqual(storedSession, nextStoredSession)) {
        await persistStoredActiveSession({
          db,
          session: nextStoredSession,
          userId: input.userId,
        });
      }

      return activeSession;
    },
    async listFocusRecords(input: UpdateFocusSessionInput) {
      const focus = await createMutableFocusContext({
        crypto,
        db,
        userId: input.userId,
      });

      return focus.getFocusRecords({
        userId: input.userId,
      });
    },
    async startFocusSession(input: StartFocusSessionInput) {
      return runFocusMutation({
        crypto,
        db,
        operation: (focus) => focus.startFocusSession(input),
        userId: input.userId,
      });
    },
    async startNextFocusInterval(input: UpdateFocusSessionInput) {
      return runFocusMutation({
        crypto,
        db,
        operation: (focus) => focus.startNextFocusInterval(input),
        userId: input.userId,
      });
    },
  };
}
