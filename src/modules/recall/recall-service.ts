import { desc, eq } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core/db";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";

import type { AppLabel } from "../labels/label-management/labels";
import { createLabelsService } from "../labels/labels-service";
import type { AppNote, AppNotesContext, AppStoredNote } from "../notes";
import { createNotesService } from "../notes/notes-service";
import {
  createAppRecallContext,
  type RecallSelfRating,
  type RecallSession,
  type SessionResult,
} from "./recall";
import {
  activeRecallSessionsTable,
  sessionResultsTable,
} from "./recall-schema";

type RecallDatabase<TSchema extends Record<string, unknown>> = PgDatabase<
  PgQueryResultHKT,
  TSchema
>;

type StoredRecallSession = RecallSession & {
  userId: string;
};

type StoredSessionResult = SessionResult & {
  userId: string;
};

type RecallCrypto = Pick<Crypto, "randomUUID">;

type StartRecallSessionInput = {
  noteIds: string[];
  userId: string;
};

type UpdateRecallSessionInput = {
  sessionId: string;
  userId: string;
};

type AnswerQuestionInput = UpdateRecallSessionInput & {
  rating: RecallSelfRating;
};

type UpdateAttemptTextInput = UpdateRecallSessionInput & {
  text: string;
};

type CreateRecallServiceOptions = {
  crypto?: RecallCrypto;
  db: RecallDatabase<Record<string, unknown>>;
  shuffleNotes?: (
    notes: readonly RecallSession["notes"][number][],
  ) => RecallSession["notes"];
};

type MemoryStorage = Pick<Storage, "getItem" | "setItem">;

const SERVICE_STORAGE_KEY_PREFIX = "persistent-recall-service";

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

function toStoredNote(note: AppNote, userId: string): AppStoredNote {
  return {
    ...note,
    userId,
  };
}

function createReadonlyNotesContext(
  notes: readonly AppNote[],
  userId: string,
): AppNotesContext {
  const snapshot = notes.map((note) => toStoredNote(note, userId));

  return {
    createNote: () => {
      throw new Error("Readonly recall notes context cannot create notes.");
    },
    deleteNote: () => {
      throw new Error("Readonly recall notes context cannot delete notes.");
    },
    getSnapshot() {
      return snapshot;
    },
    subscribe() {
      return () => undefined;
    },
    updateNote: () => {
      throw new Error("Readonly recall notes context cannot update notes.");
    },
  };
}

function getActiveSessionStorageKey(prefix: string) {
  return `${prefix}:active-session`;
}

function getSessionResultsStorageKey(prefix: string) {
  return `${prefix}:session-results`;
}

async function readStoredActiveSession(
  db: RecallDatabase<Record<string, unknown>>,
  userId: string,
): Promise<StoredRecallSession | null> {
  const row =
    (
      await db
        .select({
          payload: activeRecallSessionsTable.payload,
        })
        .from(activeRecallSessionsTable)
        .where(eq(activeRecallSessionsTable.userId, userId))
        .limit(1)
    )[0] ?? null;

  return row?.payload ?? null;
}

async function readStoredSessionResults(
  db: RecallDatabase<Record<string, unknown>>,
  userId: string,
): Promise<StoredSessionResult[]> {
  const rows = await db
    .select({
      payload: sessionResultsTable.payload,
    })
    .from(sessionResultsTable)
    .where(eq(sessionResultsTable.userId, userId))
    .orderBy(
      desc(sessionResultsTable.completedAt),
      desc(sessionResultsTable.id),
    );

  return rows.map((row) => row.payload);
}

function stripStoredSessionUserId(
  session: StoredRecallSession | null,
): RecallSession | null {
  if (session === null) {
    return null;
  }

  const { userId: _userId, ...recallSession } = session;

  return recallSession;
}

function stripStoredResultUserId(result: StoredSessionResult): SessionResult {
  const { userId: _userId, ...sessionResult } = result;

  return sessionResult;
}

async function persistRecallState(input: {
  db: RecallDatabase<Record<string, unknown>>;
  recall: ReturnType<typeof createAppRecallContext>;
  userId: string;
}) {
  const nextActiveSession = input.recall.getSnapshot();
  const nextSessionResults = input.recall
    .getSessionResultsSnapshot()
    .map((result) => ({
      ...result,
      userId: input.userId,
    })) satisfies StoredSessionResult[];

  await input.db.transaction(async (tx) => {
    if (nextActiveSession === null) {
      await tx
        .delete(activeRecallSessionsTable)
        .where(eq(activeRecallSessionsTable.userId, input.userId));
    } else {
      await tx
        .insert(activeRecallSessionsTable)
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
          target: activeRecallSessionsTable.userId,
        });
    }

    await tx
      .delete(sessionResultsTable)
      .where(eq(sessionResultsTable.userId, input.userId));

    if (nextSessionResults.length > 0) {
      await tx.insert(sessionResultsTable).values(
        nextSessionResults.map((result) => ({
          completedAt: new Date(result.completedAt),
          id: result.id,
          payload: result,
          userId: input.userId,
        })),
      );
    }
  });
}

async function createMutableRecallContext(input: {
  crypto?: RecallCrypto;
  db: RecallDatabase<Record<string, unknown>>;
  shuffleNotes?: (
    notes: readonly RecallSession["notes"][number][],
  ) => RecallSession["notes"];
  userId: string;
}) {
  const notesService = createNotesService({
    db: input.db,
  });
  const labelsService = createLabelsService({
    db: input.db,
  });
  const [notes, labels, activeSession, sessionResults] = await Promise.all([
    notesService.listNotes({
      userId: input.userId,
    }),
    labelsService.listLabels({
      userId: input.userId,
    }),
    readStoredActiveSession(input.db, input.userId),
    readStoredSessionResults(input.db, input.userId),
  ]);
  const storage = createMemoryStorage({
    [getActiveSessionStorageKey(SERVICE_STORAGE_KEY_PREFIX)]:
      activeSession === null ? null : JSON.stringify(activeSession),
    [getSessionResultsStorageKey(SERVICE_STORAGE_KEY_PREFIX)]:
      JSON.stringify(sessionResults),
  });

  return createAppRecallContext({
    crypto: input.crypto,
    getLabelsForUser: (_userId: string): readonly AppLabel[] => labels,
    keyPrefix: SERVICE_STORAGE_KEY_PREFIX,
    notes: createReadonlyNotesContext(notes, input.userId),
    shuffleNotes: input.shuffleNotes,
    storage,
  });
}

export function createRecallService({
  crypto,
  db,
  shuffleNotes,
}: CreateRecallServiceOptions) {
  return {
    async endFlashCardSession(input: UpdateRecallSessionInput) {
      const recall = await createMutableRecallContext({
        crypto,
        db,
        shuffleNotes,
        userId: input.userId,
      });
      const endedSession = recall.endFlashCardSession(input);

      await persistRecallState({
        db,
        recall,
        userId: input.userId,
      });

      return endedSession;
    },
    async getActiveSession(input: { userId: string }) {
      return stripStoredSessionUserId(
        await readStoredActiveSession(db, input.userId),
      );
    },
    async listSessionResults(input: { userId: string }) {
      return (await readStoredSessionResults(db, input.userId)).map(
        stripStoredResultUserId,
      );
    },
    async rateFlashCardAnswer(input: AnswerQuestionInput) {
      const recall = await createMutableRecallContext({
        crypto,
        db,
        shuffleNotes,
        userId: input.userId,
      });
      const nextSession = recall.rateFlashCardAnswer(input);

      await persistRecallState({
        db,
        recall,
        userId: input.userId,
      });

      return nextSession;
    },
    async revealFlashCardAnswer(input: UpdateRecallSessionInput) {
      const recall = await createMutableRecallContext({
        crypto,
        db,
        shuffleNotes,
        userId: input.userId,
      });
      const revealedSession = recall.revealFlashCardAnswer(input);

      await persistRecallState({
        db,
        recall,
        userId: input.userId,
      });

      return revealedSession;
    },
    async startFlashCardSession(input: StartRecallSessionInput) {
      const recall = await createMutableRecallContext({
        crypto,
        db,
        shuffleNotes,
        userId: input.userId,
      });
      const startedSession = recall.startFlashCardSession(input);

      await persistRecallState({
        db,
        recall,
        userId: input.userId,
      });

      return startedSession;
    },
    async updateFlashCardAttemptText(input: UpdateAttemptTextInput) {
      const recall = await createMutableRecallContext({
        crypto,
        db,
        shuffleNotes,
        userId: input.userId,
      });
      const updatedSession = recall.updateFlashCardAttemptText(input);

      await persistRecallState({
        db,
        recall,
        userId: input.userId,
      });

      return updatedSession;
    },
  };
}
