import { and, desc, eq } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core/db";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";

import type { AppLabel } from "../labels/label-management/labels";
import { createLabelsService } from "../labels/labels-service";
import type { AppNote, AppNotesContext, AppStoredNote } from "../notes";
import { createNotesService } from "../notes/notes-service";
import type {
  AppStoredStudyNote,
  AppStudyNote,
  AppStudyNotesContext,
} from "../study-notes";
import { studyNotesTable } from "../study-notes/study-notes-schema";
import { createStudyNotesService } from "../study-notes/study-notes-service";
import {
  createAppRecallContext,
  type RecallSelfRating,
  type RecallSession,
  type SessionResult,
} from "./recall";
import type {
  PracticeRepairEntryConfirmation,
  PracticeRepairLinkedCompletionInput,
  PracticeRepairQuestionReference,
} from "./recall-practice-repair";
import {
  createInitialRecallSchedule,
  getUpdatedRecallSchedule,
  type RecallSchedule,
} from "./recall-schedule";
import {
  activeRecallSessionsTable,
  recallSchedulesTable,
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
type RecallNoteSnapshot = RecallSession["notes"][number];
type RecallMutationResult = RecallSession | SessionResult | null;
type MutableRecallContext = ReturnType<typeof createAppRecallContext>;
type ShuffleNotes = (
  notes: readonly RecallNoteSnapshot[],
) => RecallNoteSnapshot[];

type StartRecallSessionInput = {
  noteIds?: string[];
  studyNoteIds?: string[];
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

type ConfirmPracticeRepairEntryInput = PracticeRepairEntryConfirmation & {
  userId: string;
};

type PracticeRepairEntryMutationInput = {
  reference: PracticeRepairQuestionReference;
  userId: string;
};

type UpdatePracticeRepairEntryCorrectionInput =
  PracticeRepairEntryMutationInput & {
    correction: string;
  };

type CompleteLinkedPracticeRepairEntryInput =
  PracticeRepairLinkedCompletionInput & {
    userId: string;
  };

type CreateRecallServiceOptions = {
  crypto?: RecallCrypto;
  db: RecallDatabase<Record<string, unknown>>;
  now?: () => Date;
  shuffleNotes?: ShuffleNotes;
};

type MemoryStorage = Pick<Storage, "getItem" | "setItem">;

const SERVICE_STORAGE_KEY_PREFIX = "persistent-recall-service";

const recallScheduleSelection = {
  ease: recallSchedulesTable.ease,
  intervalDays: recallSchedulesTable.intervalDays,
  lastRecalledAt: recallSchedulesTable.lastRecalledAt,
  nextRecallAt: recallSchedulesTable.nextRecallAt,
  repetitionCount: recallSchedulesTable.repetitionCount,
  studyNoteId: recallSchedulesTable.studyNoteId,
};

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

function toStoredStudyNote(
  studyNote: AppStudyNote,
  userId: string,
): AppStoredStudyNote {
  return {
    ...studyNote,
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

function createReadonlyStudyNotesContext(
  studyNotes: readonly AppStudyNote[],
  userId: string,
): AppStudyNotesContext {
  const snapshot = studyNotes.map((studyNote) =>
    toStoredStudyNote(studyNote, userId),
  );

  return {
    createStudyNote: () => {
      throw new Error(
        "Readonly recall Study Notes context cannot create Study Notes.",
      );
    },
    createStudyNoteFromSource: () => {
      throw new Error(
        "Readonly recall Study Notes context cannot create Study Notes.",
      );
    },
    deleteStudyNote: () => {
      throw new Error(
        "Readonly recall Study Notes context cannot delete Study Notes.",
      );
    },
    getSnapshot() {
      return snapshot;
    },
    subscribe() {
      return () => undefined;
    },
    updateStudyNote: () => {
      throw new Error(
        "Readonly recall Study Notes context cannot update Study Notes.",
      );
    },
  };
}

function getActiveSessionStorageKey(prefix: string) {
  return `${prefix}:active-session`;
}

function getSessionResultsStorageKey(prefix: string) {
  return `${prefix}:session-results`;
}

function getRecallSchedulesStorageKey(prefix: string) {
  return `${prefix}:recall-schedules`;
}

function toRecallSchedule(row: {
  ease: number;
  intervalDays: number;
  lastRecalledAt: Date | null;
  nextRecallAt: Date;
  repetitionCount: number;
  studyNoteId: string;
}): RecallSchedule {
  return {
    ease: row.ease,
    intervalDays: row.intervalDays,
    lastRecalledAt: row.lastRecalledAt?.toISOString() ?? null,
    nextRecallAt: row.nextRecallAt.toISOString(),
    repetitionCount: row.repetitionCount,
    studyNoteId: row.studyNoteId,
  };
}

function toStoredRecallSchedule(input: {
  schedule: RecallSchedule;
  userId: string;
}) {
  return {
    ease: input.schedule.ease,
    intervalDays: input.schedule.intervalDays,
    lastRecalledAt:
      input.schedule.lastRecalledAt === null
        ? null
        : new Date(input.schedule.lastRecalledAt),
    nextRecallAt: new Date(input.schedule.nextRecallAt),
    repetitionCount: input.schedule.repetitionCount,
    studyNoteId: input.schedule.studyNoteId,
    userId: input.userId,
  };
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

async function readStoredRecallSchedules(
  db: RecallDatabase<Record<string, unknown>>,
  userId: string,
): Promise<RecallSchedule[]> {
  const rows = await db
    .select(recallScheduleSelection)
    .from(recallSchedulesTable)
    .where(eq(recallSchedulesTable.userId, userId))
    .orderBy(recallSchedulesTable.studyNoteId);

  return rows.map(toRecallSchedule);
}

async function readStoredRecallSchedule(input: {
  db: RecallDatabase<Record<string, unknown>>;
  studyNoteId: string;
  userId: string;
}): Promise<RecallSchedule | null> {
  const row =
    (
      await input.db
        .select(recallScheduleSelection)
        .from(recallSchedulesTable)
        .where(
          and(
            eq(recallSchedulesTable.studyNoteId, input.studyNoteId),
            eq(recallSchedulesTable.userId, input.userId),
          ),
        )
        .limit(1)
    )[0] ?? null;

  if (row === null) {
    return null;
  }

  return toRecallSchedule(row);
}

async function upsertStoredRecallSchedule(input: {
  db: RecallDatabase<Record<string, unknown>>;
  schedule: RecallSchedule;
  userId: string;
}) {
  const storedSchedule = toStoredRecallSchedule(input);

  await input.db
    .insert(recallSchedulesTable)
    .values(storedSchedule)
    .onConflictDoUpdate({
      set: {
        ease: storedSchedule.ease,
        intervalDays: storedSchedule.intervalDays,
        lastRecalledAt: storedSchedule.lastRecalledAt,
        nextRecallAt: storedSchedule.nextRecallAt,
        repetitionCount: storedSchedule.repetitionCount,
        userId: storedSchedule.userId,
      },
      target: recallSchedulesTable.studyNoteId,
    });
}

async function updateStudyNoteRecallSchedule(input: {
  db: RecallDatabase<Record<string, unknown>>;
  now: string;
  rating: RecallSelfRating;
  studyNoteId: string;
  userId: string;
}) {
  const studyNote =
    (
      await input.db
        .select({ id: studyNotesTable.id })
        .from(studyNotesTable)
        .where(eq(studyNotesTable.id, input.studyNoteId))
        .limit(1)
    )[0] ?? null;

  if (studyNote === null) {
    return;
  }

  const existingSchedule =
    (await readStoredRecallSchedule({
      db: input.db,
      studyNoteId: input.studyNoteId,
      userId: input.userId,
    })) ??
    createInitialRecallSchedule({
      now: input.now,
      studyNoteId: input.studyNoteId,
    });
  const nextSchedule = getUpdatedRecallSchedule({
    now: input.now,
    rating: input.rating,
    schedule: existingSchedule,
  });

  await upsertStoredRecallSchedule({
    db: input.db,
    schedule: nextSchedule,
    userId: input.userId,
  });
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
  recall: MutableRecallContext;
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
  shuffleNotes?: ShuffleNotes;
  userId: string;
}) {
  const notesService = createNotesService({
    db: input.db,
  });
  const studyNotesService = createStudyNotesService({
    db: input.db,
  });
  const labelsService = createLabelsService({
    db: input.db,
  });
  const [
    notes,
    studyNotes,
    labels,
    activeSession,
    sessionResults,
    recallSchedules,
  ] = await Promise.all([
    notesService.listNotes({
      userId: input.userId,
    }),
    studyNotesService.listStudyNotes({
      userId: input.userId,
    }),
    labelsService.listLabels({
      userId: input.userId,
    }),
    readStoredActiveSession(input.db, input.userId),
    readStoredSessionResults(input.db, input.userId),
    readStoredRecallSchedules(input.db, input.userId),
  ]);
  const storage = createMemoryStorage({
    [getActiveSessionStorageKey(SERVICE_STORAGE_KEY_PREFIX)]:
      activeSession === null ? null : JSON.stringify(activeSession),
    [getRecallSchedulesStorageKey(SERVICE_STORAGE_KEY_PREFIX)]: JSON.stringify(
      recallSchedules.map((schedule) => ({
        ...schedule,
        userId: input.userId,
      })),
    ),
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
    studyNotes: createReadonlyStudyNotesContext(studyNotes, input.userId),
  });
}

async function mutatePersistentRecall<
  TResult extends RecallMutationResult,
>(input: {
  crypto?: RecallCrypto;
  db: RecallDatabase<Record<string, unknown>>;
  mutate: (recall: MutableRecallContext) => TResult;
  shuffleNotes?: ShuffleNotes;
  userId: string;
}): Promise<TResult> {
  const recall = await createMutableRecallContext({
    crypto: input.crypto,
    db: input.db,
    shuffleNotes: input.shuffleNotes,
    userId: input.userId,
  });
  const result = input.mutate(recall);

  await persistRecallState({
    db: input.db,
    recall,
    userId: input.userId,
  });

  return result;
}

export function createRecallService({
  crypto,
  db,
  now = () => new Date(),
  shuffleNotes,
}: CreateRecallServiceOptions) {
  return {
    async completePracticeRepairEntry(
      input: PracticeRepairEntryMutationInput,
    ): Promise<SessionResult> {
      return mutatePersistentRecall({
        crypto,
        db,
        mutate: (recall) => recall.completePracticeRepairEntry(input),
        shuffleNotes,
        userId: input.userId,
      });
    },
    async completeLinkedPracticeRepairEntry(
      input: CompleteLinkedPracticeRepairEntryInput,
    ): Promise<SessionResult> {
      return mutatePersistentRecall({
        crypto,
        db,
        mutate: (recall) => recall.completeLinkedPracticeRepairEntry(input),
        shuffleNotes,
        userId: input.userId,
      });
    },
    async confirmPracticeRepairEntry(
      input: ConfirmPracticeRepairEntryInput,
    ): Promise<SessionResult> {
      return mutatePersistentRecall({
        crypto,
        db,
        mutate: (recall) => recall.confirmPracticeRepairEntry(input),
        shuffleNotes,
        userId: input.userId,
      });
    },
    async dismissPracticeRepairEntry(
      input: PracticeRepairEntryMutationInput,
    ): Promise<SessionResult> {
      return mutatePersistentRecall({
        crypto,
        db,
        mutate: (recall) => recall.dismissPracticeRepairEntry(input),
        shuffleNotes,
        userId: input.userId,
      });
    },
    async endFlashCardSession(input: UpdateRecallSessionInput) {
      return mutatePersistentRecall({
        crypto,
        db,
        mutate: (recall) => recall.endFlashCardSession(input),
        shuffleNotes,
        userId: input.userId,
      });
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
    async listRecallSchedules(input: { userId: string }) {
      return readStoredRecallSchedules(db, input.userId);
    },
    async rateFlashCardAnswer(input: AnswerQuestionInput) {
      const activeSession = await readStoredActiveSession(db, input.userId);
      const currentStudyNoteId =
        activeSession?.notes[activeSession.currentQuestionIndex]?.id ?? null;
      const result = await mutatePersistentRecall({
        crypto,
        db,
        mutate: (recall) => recall.rateFlashCardAnswer(input),
        shuffleNotes,
        userId: input.userId,
      });

      if (currentStudyNoteId !== null) {
        await updateStudyNoteRecallSchedule({
          db,
          now: now().toISOString(),
          rating: input.rating,
          studyNoteId: currentStudyNoteId,
          userId: input.userId,
        });
      }

      return result;
    },
    async revealFlashCardAnswer(input: UpdateRecallSessionInput) {
      return mutatePersistentRecall({
        crypto,
        db,
        mutate: (recall) => recall.revealFlashCardAnswer(input),
        shuffleNotes,
        userId: input.userId,
      });
    },
    async skipFlashCardQuestion(input: UpdateRecallSessionInput) {
      return mutatePersistentRecall({
        crypto,
        db,
        mutate: (recall) => recall.skipFlashCardQuestion(input),
        shuffleNotes,
        userId: input.userId,
      });
    },
    async startFlashCardSession(input: StartRecallSessionInput) {
      return mutatePersistentRecall({
        crypto,
        db,
        mutate: (recall) => recall.startFlashCardSession(input),
        shuffleNotes,
        userId: input.userId,
      });
    },
    async updatePracticeRepairEntryCorrection(
      input: UpdatePracticeRepairEntryCorrectionInput,
    ): Promise<SessionResult> {
      return mutatePersistentRecall({
        crypto,
        db,
        mutate: (recall) => recall.updatePracticeRepairEntryCorrection(input),
        shuffleNotes,
        userId: input.userId,
      });
    },
    async updateFlashCardAttemptText(input: UpdateAttemptTextInput) {
      return mutatePersistentRecall({
        crypto,
        db,
        mutate: (recall) => recall.updateFlashCardAttemptText(input),
        shuffleNotes,
        userId: input.userId,
      });
    },
  };
}
