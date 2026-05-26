import { desc, eq } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core/db";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";

import { createLabelsService } from "../labels/labels-service";
import { createNotesService } from "../notes/notes-service";
import { createStudyNotesService } from "../study-notes/study-notes-service";
import {
  type RecallSelfRating,
  type RecallSession,
  type SessionResult,
} from "./recall";
import type {
  PracticeRepairEntryConfirmation,
  PracticeRepairLinkedCompletionInput,
  PracticeRepairQuestionReference,
} from "./recall-practice-repair";
import type { RecallSchedule } from "./recall-schedule";
import {
  activeRecallSessionsTable,
  recallSchedulesTable,
  sessionResultsTable,
} from "./recall-schema";
import {
  createRecallState,
  type RecallCrypto,
  type RecallStateContext,
  type ShuffleNotes,
  type StoredRecallSchedule,
  type StoredRecallSession,
  type StoredSessionResult,
} from "./recall-state";

type RecallDatabase<TSchema extends Record<string, unknown>> = PgDatabase<
  PgQueryResultHKT,
  TSchema
>;

type RecallNoteSnapshot = RecallSession["notes"][number];
type RecallMutationResult = RecallSession | SessionResult | null;
type MutableRecallState = RecallStateContext;

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

const recallScheduleSelection = {
  ease: recallSchedulesTable.ease,
  intervalDays: recallSchedulesTable.intervalDays,
  lastRecalledAt: recallSchedulesTable.lastRecalledAt,
  nextRecallAt: recallSchedulesTable.nextRecallAt,
  repetitionCount: recallSchedulesTable.repetitionCount,
  studyNoteId: recallSchedulesTable.studyNoteId,
};

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
): Promise<StoredRecallSchedule[]> {
  const rows = await db
    .select(recallScheduleSelection)
    .from(recallSchedulesTable)
    .where(eq(recallSchedulesTable.userId, userId))
    .orderBy(recallSchedulesTable.studyNoteId);

  return rows.map((row) => ({
    ...toRecallSchedule(row),
    userId,
  }));
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

function stripStoredRecallScheduleUserId(
  schedule: StoredRecallSchedule,
): RecallSchedule {
  const { userId: _userId, ...recallSchedule } = schedule;

  return recallSchedule;
}

async function persistRecallState(input: {
  db: RecallDatabase<Record<string, unknown>>;
  recall: MutableRecallState;
  userId: string;
}) {
  const {
    activeSession: nextActiveSession,
    recallSchedules: nextRecallSchedules,
    sessionResults: nextSessionResults,
  } = input.recall.getPersistedState();
  const nextRecallScheduleRows = nextRecallSchedules.map((schedule) =>
    toStoredRecallSchedule({
      schedule,
      userId: schedule.userId,
    }),
  );

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

    await tx
      .delete(recallSchedulesTable)
      .where(eq(recallSchedulesTable.userId, input.userId));

    if (nextRecallScheduleRows.length > 0) {
      await tx.insert(recallSchedulesTable).values(nextRecallScheduleRows);
    }
  });
}

async function loadRecallStateData(input: {
  db: RecallDatabase<Record<string, unknown>>;
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

  return {
    activeSession,
    labels,
    notes,
    recallSchedules,
    sessionResults,
    studyNotes,
  };
}

function createMutableRecallState(input: {
  activeSession: StoredRecallSession | null;
  crypto?: RecallCrypto;
  labels: Awaited<ReturnType<ReturnType<typeof createLabelsService>["listLabels"]>>;
  notes: Awaited<ReturnType<ReturnType<typeof createNotesService>["listNotes"]>>;
  now?: () => Date;
  recallSchedules: readonly StoredRecallSchedule[];
  sessionResults: readonly StoredSessionResult[];
  shuffleNotes?: ShuffleNotes;
  studyNotes: Awaited<
    ReturnType<ReturnType<typeof createStudyNotesService>["listStudyNotes"]>
  >;
  userId: string;
}) {
  return createRecallState({
    activeSession: input.activeSession,
    crypto: input.crypto,
    getLabelsForUser: (userId) => (userId === input.userId ? input.labels : []),
    getNotesForUser: (userId) => (userId === input.userId ? input.notes : []),
    getStudyNotesForUser: (userId) =>
      userId === input.userId ? input.studyNotes : [],
    now: input.now,
    recallSchedules: input.recallSchedules,
    sessionResults: input.sessionResults,
    shuffleNotes: input.shuffleNotes,
  });
}

async function mutatePersistentRecall<
  TResult extends RecallMutationResult,
>(input: {
  crypto?: RecallCrypto;
  db: RecallDatabase<Record<string, unknown>>;
  mutate: (recall: MutableRecallState) => TResult;
  now?: () => Date;
  shuffleNotes?: ShuffleNotes;
  userId: string;
}): Promise<TResult> {
  const stateData = await loadRecallStateData({
    db: input.db,
    userId: input.userId,
  });
  const recall = createMutableRecallState({
    ...stateData,
    crypto: input.crypto,
    now: input.now,
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
        now,
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
        now,
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
        now,
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
        now,
        shuffleNotes,
        userId: input.userId,
      });
    },
    async endFlashCardSession(input: UpdateRecallSessionInput) {
      return mutatePersistentRecall({
        crypto,
        db,
        mutate: (recall) => recall.endFlashCardSession(input),
        now,
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
      return (await readStoredRecallSchedules(db, input.userId)).map(
        stripStoredRecallScheduleUserId,
      );
    },
    async rateFlashCardAnswer(input: AnswerQuestionInput) {
      return mutatePersistentRecall({
        crypto,
        db,
        mutate: (recall) => recall.rateFlashCardAnswer(input),
        now,
        shuffleNotes,
        userId: input.userId,
      });
    },
    async revealFlashCardAnswer(input: UpdateRecallSessionInput) {
      return mutatePersistentRecall({
        crypto,
        db,
        mutate: (recall) => recall.revealFlashCardAnswer(input),
        now,
        shuffleNotes,
        userId: input.userId,
      });
    },
    async skipFlashCardQuestion(input: UpdateRecallSessionInput) {
      return mutatePersistentRecall({
        crypto,
        db,
        mutate: (recall) => recall.skipFlashCardQuestion(input),
        now,
        shuffleNotes,
        userId: input.userId,
      });
    },
    async startFlashCardSession(input: StartRecallSessionInput) {
      return mutatePersistentRecall({
        crypto,
        db,
        mutate: (recall) => recall.startFlashCardSession(input),
        now,
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
        now,
        shuffleNotes,
        userId: input.userId,
      });
    },
    async updateFlashCardAttemptText(input: UpdateAttemptTextInput) {
      return mutatePersistentRecall({
        crypto,
        db,
        mutate: (recall) => recall.updateFlashCardAttemptText(input),
        now,
        shuffleNotes,
        userId: input.userId,
      });
    },
  };
}
