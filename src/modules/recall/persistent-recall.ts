import type { AppNotesContext } from "../notes";
import { listNotesForUser } from "../notes";
import type { AppStudyNotesContext } from "../study-notes";
import { listStudyNotesForUser } from "../study-notes";
import {
  type AppRecallContext,
  AppRecallError,
  type AppRecallSnapshot,
  type FlashCardRecallAttemptHistoryEntry,
  type FlashCardRecallAttemptsByNote,
  type RecallNoteSnapshot,
  type RecallQuestion,
  type RecallSelfRating,
  type RecallSession,
  type SessionResult,
  summarizeAttempts,
} from "./recall";
import { cloneRecallAnswerCheckResult } from "./recall-answer-check";
import {
  clonePracticeRepairEntry as clonePracticeRepairEntryValue,
  listActivePracticeRepairEntriesForStudyNote as listActivePracticeRepairEntriesForStudyNoteValue,
  listPracticeRepairEntriesForQuestion as listPracticeRepairEntriesForQuestionValue,
  type PracticeRepairEntry,
  type PracticeRepairEntryConfirmation,
  type PracticeRepairLinkedCompletionInput,
  type PracticeRepairQuestionReference,
} from "./recall-practice-repair";
import type { RecallSchedule } from "./recall-schedule";

type PersistentRecallListener = () => void;

type StoredRecallSession = RecallSession & {
  userId: string;
};

type StoredSessionResult = SessionResult & {
  userId: string;
};

type StoredRecallSchedule = RecallSchedule & {
  userId: string;
};

type StartRecallSessionInput = {
  mode?: "AiAssisted" | "AiGraded" | "FlashCard";
  noteIds?: string[];
  studyNoteIds?: string[];
};

type UpdateRecallSessionInput = {
  sessionId: string;
};

type AnswerQuestionInput = UpdateRecallSessionInput & {
  rating: RecallSelfRating;
};

type UpdateAttemptTextInput = UpdateRecallSessionInput & {
  text: string;
};

type ConfirmPracticeRepairEntryInput = PracticeRepairEntryConfirmation;

type PracticeRepairEntryMutationInput = {
  reference: PracticeRepairQuestionReference;
};

type UpdatePracticeRepairEntryCorrectionInput =
  PracticeRepairEntryMutationInput & {
    correction: string;
  };

type CompleteLinkedPracticeRepairEntryInput =
  PracticeRepairLinkedCompletionInput;

export type AppPersistentRecallService = {
  completePracticeRepairEntry: (
    input: PracticeRepairEntryMutationInput,
  ) => Promise<SessionResult>;
  completeLinkedPracticeRepairEntry: (
    input: CompleteLinkedPracticeRepairEntryInput,
  ) => Promise<SessionResult>;
  confirmPracticeRepairEntry: (
    input: ConfirmPracticeRepairEntryInput,
  ) => Promise<SessionResult>;
  dismissPracticeRepairEntry: (
    input: PracticeRepairEntryMutationInput,
  ) => Promise<SessionResult>;
  endRecallSession: (input: UpdateRecallSessionInput) => Promise<RecallSession>;
  getActiveSession: () => Promise<RecallSession | null>;
  listRecallSchedules: () => Promise<RecallSchedule[]>;
  listSessionResults: () => Promise<SessionResult[]>;
  rateFlashCardAnswer: (
    input: AnswerQuestionInput,
  ) => Promise<RecallSession | null>;
  revealFlashCardAnswer: (
    input: UpdateRecallSessionInput,
  ) => Promise<RecallSession>;
  skipFlashCardQuestion?: (
    input: UpdateRecallSessionInput,
  ) => Promise<RecallSession | null>;
  startFlashCardSession: (
    input: StartRecallSessionInput,
  ) => Promise<RecallSession>;
  updatePracticeRepairEntryCorrection: (
    input: UpdatePracticeRepairEntryCorrectionInput,
  ) => Promise<SessionResult>;
  updateFlashCardAttemptText: (
    input: UpdateAttemptTextInput,
  ) => Promise<RecallSession>;
};

export type AppPersistentRecallContext = {
  completePracticeRepairEntry: (
    userId: string | null,
    input: PracticeRepairEntryMutationInput,
  ) => Promise<SessionResult>;
  completeLinkedPracticeRepairEntry: (
    userId: string | null,
    input: CompleteLinkedPracticeRepairEntryInput,
  ) => Promise<SessionResult>;
  confirmPracticeRepairEntry: (
    userId: string | null,
    input: ConfirmPracticeRepairEntryInput,
  ) => Promise<SessionResult>;
  dismissPracticeRepairEntry: (
    userId: string | null,
    input: PracticeRepairEntryMutationInput,
  ) => Promise<SessionResult>;
  endFlashCardSession: (
    userId: string | null,
    input: UpdateRecallSessionInput,
  ) => Promise<RecallSession>;
  getSessionResultsSnapshot: () => readonly SessionResult[];
  getRecallSchedulesSnapshot: () => readonly RecallSchedule[];
  getSnapshot: () => AppRecallSnapshot;
  rateFlashCardAnswer: (
    userId: string | null,
    input: AnswerQuestionInput,
  ) => Promise<RecallSession | null>;
  refresh: (userId: string | null) => Promise<{
    activeSession: AppRecallSnapshot;
    sessionResults: readonly SessionResult[];
  }>;
  readonlyContext: AppRecallContext;
  revealFlashCardAnswer: (
    userId: string | null,
    input: UpdateRecallSessionInput,
  ) => Promise<RecallSession>;
  skipFlashCardQuestion: (
    userId: string | null,
    input: UpdateRecallSessionInput,
  ) => Promise<RecallSession | null>;
  startFlashCardSession: (
    userId: string | null,
    input: StartRecallSessionInput,
  ) => Promise<RecallSession>;
  subscribe: (listener: PersistentRecallListener) => () => void;
  updatePracticeRepairEntryCorrection: (
    userId: string | null,
    input: UpdatePracticeRepairEntryCorrectionInput,
  ) => Promise<SessionResult>;
  updateFlashCardAttemptText: (
    userId: string | null,
    input: UpdateAttemptTextInput,
  ) => Promise<RecallSession>;
};

type CreatePersistentRecallContextOptions = {
  notes?: AppNotesContext;
  onStudyActivity?: (
    userId: string | null,
    input: {
      recallSession: {
        createdAt: string;
        id: string;
        mode: RecallSession["mode"];
        notes: RecallSession["notes"];
      };
    },
  ) => void | Promise<void>;
  service?: AppPersistentRecallService;
  studyNotes?: AppStudyNotesContext;
};

function createMissingServiceError() {
  return new Error("Persistent recall service is not configured.");
}

function cloneNoteSnapshot(note: RecallNoteSnapshot): RecallNoteSnapshot {
  return {
    ...note,
    acronyms: note.acronyms.map((acronym) => ({ ...acronym })),
    labelIds: [...note.labelIds],
    labels: (note.labels ?? []).map((label) => ({ ...label })),
    metaphors: note.metaphors.map((metaphor) => ({ ...metaphor })),
    source: note.source === undefined ? undefined : { ...note.source },
  };
}

function clonePracticeRepairEntry(
  entry: PracticeRepairEntry | undefined,
): PracticeRepairEntry | undefined {
  if (entry === undefined) {
    return undefined;
  }

  return clonePracticeRepairEntryValue(entry);
}

function cloneQuestion(question: RecallQuestion): RecallQuestion {
  return {
    ...question,
    answerCheck: cloneRecallAnswerCheckResult(question.answerCheck),
    noteSnapshot: cloneNoteSnapshot(question.noteSnapshot),
    practiceRepairEntry: clonePracticeRepairEntry(question.practiceRepairEntry),
  };
}

function cloneSession(session: RecallSession): RecallSession {
  return {
    ...session,
    attempts: session.attempts.map((attempt) => ({ ...attempt })),
    notes: session.notes.map(cloneNoteSnapshot),
    questions: session.questions.map(cloneQuestion),
  };
}

function cloneSessionResult(result: SessionResult): SessionResult {
  return {
    ...result,
    attempts: result.attempts.map((attempt) => ({ ...attempt })),
    notes: result.notes.map(cloneNoteSnapshot),
    questions: result.questions.map(cloneQuestion),
  };
}

function toStoredRecallSession(
  session: RecallSession | null,
  userId: string,
): StoredRecallSession | null {
  if (session === null) {
    return null;
  }

  return {
    ...cloneSession(session),
    userId,
  };
}

function toStoredSessionResults(
  sessionResults: readonly SessionResult[],
  userId: string,
): StoredSessionResult[] {
  return sessionResults.map((sessionResult) => ({
    ...cloneSessionResult(sessionResult),
    userId,
  }));
}

function stripUserId(sessionResults: readonly StoredSessionResult[]) {
  return sessionResults.map(({ userId: _userId, ...sessionResult }) =>
    cloneSessionResult(sessionResult),
  );
}

function toStoredRecallSchedules(
  recallSchedules: readonly RecallSchedule[],
  userId: string,
): StoredRecallSchedule[] {
  return recallSchedules.map((schedule) => ({
    ...schedule,
    userId,
  }));
}

function stripRecallScheduleUserIds(
  recallSchedules: readonly StoredRecallSchedule[],
) {
  return recallSchedules.map(({ userId: _userId, ...recallSchedule }) => ({
    ...recallSchedule,
  }));
}

function listFilteredSessionResults(input: {
  labelId?: string;
  sessionResults: readonly StoredSessionResult[];
  userId: string;
}) {
  return input.sessionResults.filter((result) => {
    if (result.userId !== input.userId) {
      return false;
    }

    if (input.labelId === undefined) {
      return true;
    }

    const labelId = input.labelId;

    return result.notes.some((note) => note.labelIds.includes(labelId));
  });
}

function requireUserId(userId: string | null): string {
  if (userId === null) {
    throw new AppRecallError("not_found", "A signed-in user is required.");
  }

  return userId;
}

export function createPersistentRecallContext(
  options: CreatePersistentRecallContextOptions = {},
): AppPersistentRecallContext {
  const service = options.service;
  const listeners = new Set<PersistentRecallListener>();
  let snapshot: StoredRecallSession | null = null;
  let sessionResults: StoredSessionResult[] = [];
  let recallSchedules: StoredRecallSchedule[] = [];
  let sessionResultsSnapshot: SessionResult[] = [];
  let recallSchedulesSnapshot: RecallSchedule[] = [];
  let mutationRevision = 0;

  function notifyListeners() {
    for (const listener of listeners) {
      listener();
    }
  }

  function writeState(
    input: {
      activeSession: StoredRecallSession | null;
      recallSchedules?: StoredRecallSchedule[];
      sessionResults: StoredSessionResult[];
    },
    options: { countAsMutation?: boolean } = {},
  ) {
    if (options.countAsMutation !== false) {
      mutationRevision += 1;
    }

    snapshot = input.activeSession;
    sessionResults = input.sessionResults;
    recallSchedules = input.recallSchedules ?? recallSchedules;
    sessionResultsSnapshot = stripUserId(input.sessionResults);
    recallSchedulesSnapshot = stripRecallScheduleUserIds(recallSchedules);
    notifyListeners();

    return {
      activeSession: snapshot,
      recallSchedules: recallSchedulesSnapshot,
      sessionResults: sessionResultsSnapshot,
    };
  }

  async function listServiceRecallSchedules(userId: string) {
    return toStoredRecallSchedules(
      await requireService().listRecallSchedules(),
      userId,
    );
  }

  function requireService(): AppPersistentRecallService {
    if (service === undefined) {
      throw createMissingServiceError();
    }

    return service;
  }

  function applyReturnedMutationLocally(input: {
    activeSession?: RecallSession | null;
    sessionResult?: SessionResult;
    userId: string;
  }) {
    if ("activeSession" in input) {
      writeState({
        activeSession: toStoredRecallSession(
          input.activeSession ?? null,
          input.userId,
        ),
        sessionResults,
      });

      return;
    }

    if (input.sessionResult !== undefined) {
      writeState({
        activeSession: snapshot,
        sessionResults: toStoredSessionResults(
          [
            input.sessionResult,
            ...sessionResultsSnapshot.filter(
              (result) => result.id !== input.sessionResult?.id,
            ),
          ],
          input.userId,
        ),
      });
    }
  }

  async function refreshAuthoritativeState(input: {
    activeSession?: RecallSession | null;
    refreshRecallSchedules?: boolean;
    refreshSessionResults?: boolean;
    userId: string;
  }) {
    const [nextResults, nextRecallSchedules] = await Promise.all([
      input.refreshSessionResults
        ? requireService().listSessionResults()
        : Promise.resolve<SessionResult[] | null>(null),
      input.refreshRecallSchedules
        ? listServiceRecallSchedules(input.userId)
        : Promise.resolve<StoredRecallSchedule[] | null>(null),
    ]);

    return writeState({
      activeSession:
        input.activeSession === undefined
          ? snapshot
          : toStoredRecallSession(input.activeSession, input.userId),
      recallSchedules: nextRecallSchedules ?? recallSchedules,
      sessionResults:
        nextResults === null
          ? sessionResults
          : toStoredSessionResults(nextResults, input.userId),
    });
  }

  async function emitStudyActivity(
    userId: string | null,
    recallSession:
      | Pick<RecallSession, "createdAt" | "id" | "mode" | "notes">
      | Pick<SessionResult, "createdAt" | "id" | "mode" | "notes">
      | null,
  ) {
    if (recallSession === null) {
      return;
    }

    await options.onStudyActivity?.(userId, {
      recallSession: {
        createdAt: recallSession.createdAt,
        id: recallSession.id,
        mode: recallSession.mode,
        notes: recallSession.notes.map(cloneNoteSnapshot),
      },
    });
  }

  const readonlyContext: AppRecallContext = {
    answerQuestion: () => {
      throw new Error(
        "Readonly recall context cannot answer questions. Use persistentRecall instead.",
      );
    },
    completePracticeRepairEntry: () => {
      throw new Error(
        "Readonly recall context cannot complete Practice Repair. Use persistentRecall instead.",
      );
    },
    completeLinkedPracticeRepairEntry: () => {
      throw new Error(
        "Readonly recall context cannot complete Practice Repair. Use persistentRecall instead.",
      );
    },
    confirmPracticeRepairEntry: () => {
      throw new Error(
        "Readonly recall context cannot confirm Practice Repair. Use persistentRecall instead.",
      );
    },
    dismissPracticeRepairEntry: () => {
      throw new Error(
        "Readonly recall context cannot dismiss Practice Repair. Use persistentRecall instead.",
      );
    },
    endFlashCardSession: () => {
      throw new Error(
        "Readonly recall context cannot end sessions. Use persistentRecall instead.",
      );
    },
    endRecallSession: () => {
      throw new Error(
        "Readonly recall context cannot end sessions. Use persistentRecall instead.",
      );
    },
    getSessionResult: ({ sessionResultId, userId }) => {
      const result = sessionResults.find((candidate) => {
        return candidate.userId === userId && candidate.id === sessionResultId;
      });

      if (result === undefined) {
        throw new AppRecallError("not_found", "Session result not found.");
      }

      return cloneSessionResult(result);
    },
    getSessionResultsSnapshot: () => sessionResultsSnapshot,
    getRecallSchedulesSnapshot: () => recallSchedulesSnapshot,
    getSnapshot: () => snapshot,
    listActivePracticeRepairEntriesForStudyNote: ({ studyNoteId, userId }) => {
      return listActivePracticeRepairEntriesForStudyNoteValue({
        results: listFilteredSessionResults({ sessionResults, userId }),
        studyNoteId,
      });
    },
    listPracticeRepairEntriesForQuestion: ({ reference, userId }) => {
      return listPracticeRepairEntriesForQuestionValue({
        reference,
        results: listFilteredSessionResults({ sessionResults, userId }),
      });
    },
    listAttemptsByNote: ({ labelId, userId }) => {
      const currentNoteTitlesById = new Map(
        options.notes === undefined
          ? []
          : listNotesForUser(options.notes.getSnapshot(), userId).map(
              (note) => [note.id, note.title],
            ),
      );
      const currentStudyNotePromptsById = new Map(
        options.studyNotes === undefined
          ? []
          : listStudyNotesForUser(options.studyNotes.getSnapshot(), userId).map(
              (studyNote) => [studyNote.id, studyNote.prompt],
            ),
      );
      const groups = new Map<
        string,
        {
          attempts: FlashCardRecallAttemptHistoryEntry[];
          latestCompletedAt: string;
          snapshotTitle: string;
        }
      >();

      for (const result of listFilteredSessionResults({
        labelId,
        sessionResults,
        userId,
      })) {
        const notesById = new Map(result.notes.map((note) => [note.id, note]));

        for (const attempt of result.attempts) {
          const noteSnapshot = notesById.get(attempt.noteId);

          if (
            noteSnapshot === undefined ||
            (labelId !== undefined && !noteSnapshot.labelIds.includes(labelId))
          ) {
            continue;
          }

          const existingGroup = groups.get(attempt.noteId);
          const historyEntry: FlashCardRecallAttemptHistoryEntry = {
            bodySnapshot: noteSnapshot.body,
            completedAt: result.completedAt,
            rating: attempt.rating,
            sessionId: result.id,
            snapshotTitle: noteSnapshot.title,
          };

          if (existingGroup === undefined) {
            groups.set(attempt.noteId, {
              attempts: [historyEntry],
              latestCompletedAt: result.completedAt,
              snapshotTitle: noteSnapshot.title,
            });
            continue;
          }

          existingGroup.attempts.push(historyEntry);

          if (result.completedAt >= existingGroup.latestCompletedAt) {
            existingGroup.latestCompletedAt = result.completedAt;
            existingGroup.snapshotTitle = noteSnapshot.title;
          }
        }
      }

      return [...groups.entries()]
        .map(([noteId, group]): FlashCardRecallAttemptsByNote => {
          const summary = summarizeAttempts(
            group.attempts.map((attempt) => ({
              noteId,
              rating: attempt.rating,
            })),
          );

          return {
            ...summary,
            attempts: group.attempts.sort((left, right) => {
              return (
                left.completedAt.localeCompare(right.completedAt) ||
                left.sessionId.localeCompare(right.sessionId)
              );
            }),
            currentTitle:
              currentStudyNotePromptsById.get(noteId) ??
              currentNoteTitlesById.get(noteId) ??
              null,
            noteId,
            snapshotTitle: group.snapshotTitle,
            totalAttempts: group.attempts.length,
          };
        })
        .sort((left, right) => {
          const leftLatestCompletedAt =
            left.attempts[left.attempts.length - 1]?.completedAt ?? "";
          const rightLatestCompletedAt =
            right.attempts[right.attempts.length - 1]?.completedAt ?? "";

          return (
            right.totalAttempts - left.totalAttempts ||
            rightLatestCompletedAt.localeCompare(leftLatestCompletedAt) ||
            right.noteId.localeCompare(left.noteId)
          );
        });
    },
    listSessionResults: ({ labelId, userId }) => {
      return listFilteredSessionResults({ labelId, sessionResults, userId })
        .sort((left, right) => {
          return (
            right.completedAt.localeCompare(left.completedAt) ||
            right.id.localeCompare(left.id)
          );
        })
        .map(cloneSessionResult);
    },
    rateFlashCardAnswer: () => {
      throw new Error(
        "Readonly recall context cannot rate answers. Use persistentRecall instead.",
      );
    },
    revealAnswer: () => {
      throw new Error(
        "Readonly recall context cannot reveal answers. Use persistentRecall instead.",
      );
    },
    revealFlashCardAnswer: () => {
      throw new Error(
        "Readonly recall context cannot reveal answers. Use persistentRecall instead.",
      );
    },
    skipFlashCardQuestion: () => {
      throw new Error(
        "Readonly recall context cannot skip questions. Use persistentRecall instead.",
      );
    },
    startFlashCardSession: () => {
      throw new Error(
        "Readonly recall context cannot start sessions. Use persistentRecall instead.",
      );
    },
    startRecallSession: () => {
      throw new Error(
        "Readonly recall context cannot start sessions. Use persistentRecall instead.",
      );
    },
    updatePracticeRepairEntryCorrection: () => {
      throw new Error(
        "Readonly recall context cannot edit Practice Repair. Use persistentRecall instead.",
      );
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    updateAttemptText: () => {
      throw new Error(
        "Readonly recall context cannot update attempts. Use persistentRecall instead.",
      );
    },
    updateFlashCardAttemptText: () => {
      throw new Error(
        "Readonly recall context cannot update attempts. Use persistentRecall instead.",
      );
    },
  };

  return {
    async completePracticeRepairEntry(userId, input) {
      const validatedUserId = requireUserId(userId);
      const updatedResult =
        await requireService().completePracticeRepairEntry(input);

      applyReturnedMutationLocally({
        sessionResult: updatedResult,
        userId: validatedUserId,
      });

      return cloneSessionResult(updatedResult);
    },
    async completeLinkedPracticeRepairEntry(userId, input) {
      const validatedUserId = requireUserId(userId);
      const updatedResult =
        await requireService().completeLinkedPracticeRepairEntry(input);

      applyReturnedMutationLocally({
        sessionResult: updatedResult,
        userId: validatedUserId,
      });

      return cloneSessionResult(updatedResult);
    },
    async confirmPracticeRepairEntry(userId, input) {
      const validatedUserId = requireUserId(userId);
      const updatedResult =
        await requireService().confirmPracticeRepairEntry(input);

      applyReturnedMutationLocally({
        sessionResult: updatedResult,
        userId: validatedUserId,
      });

      return cloneSessionResult(updatedResult);
    },
    async dismissPracticeRepairEntry(userId, input) {
      const validatedUserId = requireUserId(userId);
      const updatedResult =
        await requireService().dismissPracticeRepairEntry(input);

      applyReturnedMutationLocally({
        sessionResult: updatedResult,
        userId: validatedUserId,
      });

      return cloneSessionResult(updatedResult);
    },
    async endFlashCardSession(userId, input) {
      const validatedUserId = requireUserId(userId);
      const endedSession = await requireService().endRecallSession(input);

      await refreshAuthoritativeState({
        activeSession: null,
        refreshSessionResults: true,
        userId: validatedUserId,
      });

      return cloneSession(endedSession);
    },
    getSessionResultsSnapshot() {
      return sessionResultsSnapshot;
    },
    getRecallSchedulesSnapshot() {
      return recallSchedulesSnapshot;
    },
    getSnapshot() {
      return snapshot;
    },
    async rateFlashCardAnswer(userId, input) {
      const validatedUserId = requireUserId(userId);
      const nextSession = await requireService().rateFlashCardAnswer(input);

      if (nextSession !== null) {
        await refreshAuthoritativeState({
          activeSession: nextSession,
          refreshRecallSchedules: true,
          userId: validatedUserId,
        });
        await emitStudyActivity(validatedUserId, nextSession);

        return cloneSession(nextSession);
      }

      const nextState = await refreshAuthoritativeState({
        activeSession: null,
        refreshRecallSchedules: true,
        refreshSessionResults: true,
        userId: validatedUserId,
      });
      await emitStudyActivity(
        validatedUserId,
        nextState.sessionResults.find((result) => result.id === input.sessionId) ??
          null,
      );

      return null;
    },
    async refresh(userId) {
      if (userId === null) {
        return writeState({
          activeSession: null,
          recallSchedules: [],
          sessionResults: [],
        });
      }

      const refreshStartedAtRevision = mutationRevision;
      const [activeSession, nextResults, nextRecallSchedules] =
        await Promise.all([
          requireService().getActiveSession(),
          requireService().listSessionResults(),
          listServiceRecallSchedules(userId),
        ]);

      if (mutationRevision !== refreshStartedAtRevision) {
        return {
          activeSession: snapshot,
          recallSchedules: recallSchedulesSnapshot,
          sessionResults: sessionResultsSnapshot,
        };
      }

      return writeState(
        {
          activeSession: toStoredRecallSession(activeSession, userId),
          recallSchedules: nextRecallSchedules,
          sessionResults: toStoredSessionResults(nextResults, userId),
        },
        {
          countAsMutation: false,
        },
      );
    },
    async revealFlashCardAnswer(userId, input) {
      const validatedUserId = requireUserId(userId);
      const revealedSession =
        await requireService().revealFlashCardAnswer(input);

      applyReturnedMutationLocally({
        activeSession: revealedSession,
        userId: validatedUserId,
      });

      return cloneSession(revealedSession);
    },
    async skipFlashCardQuestion(userId, input) {
      const validatedUserId = requireUserId(userId);
      const skipQuestion = requireService().skipFlashCardQuestion;

      if (skipQuestion === undefined) {
        throw createMissingServiceError();
      }

      const nextSession = await skipQuestion(input);

      if (nextSession !== null) {
        applyReturnedMutationLocally({
          activeSession: nextSession,
          userId: validatedUserId,
        });

        return cloneSession(nextSession);
      }

      await refreshAuthoritativeState({
        activeSession: null,
        refreshSessionResults: true,
        userId: validatedUserId,
      });

      return null;
    },
    async startFlashCardSession(userId, input) {
      const validatedUserId = requireUserId(userId);
      const startedSession =
        await requireService().startFlashCardSession(input);

      applyReturnedMutationLocally({
        activeSession: startedSession,
        userId: validatedUserId,
      });
      await emitStudyActivity(validatedUserId, startedSession);

      return cloneSession(startedSession);
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    async updatePracticeRepairEntryCorrection(userId, input) {
      const validatedUserId = requireUserId(userId);
      const updatedResult =
        await requireService().updatePracticeRepairEntryCorrection(input);

      applyReturnedMutationLocally({
        sessionResult: updatedResult,
        userId: validatedUserId,
      });

      return cloneSessionResult(updatedResult);
    },
    async updateFlashCardAttemptText(userId, input) {
      const validatedUserId = requireUserId(userId);
      const updatedSession =
        await requireService().updateFlashCardAttemptText(input);

      applyReturnedMutationLocally({
        activeSession: updatedSession,
        userId: validatedUserId,
      });

      return cloneSession(updatedSession);
    },
    readonlyContext,
  };
}
