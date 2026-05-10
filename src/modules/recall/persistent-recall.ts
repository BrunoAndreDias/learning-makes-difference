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

type PersistentRecallListener = () => void;

type StoredRecallSession = RecallSession & {
  userId: string;
};

type StoredSessionResult = SessionResult & {
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

export type AppPersistentRecallService = {
  endRecallSession: (input: UpdateRecallSessionInput) => Promise<RecallSession>;
  getActiveSession: () => Promise<RecallSession | null>;
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
  updateFlashCardAttemptText: (
    input: UpdateAttemptTextInput,
  ) => Promise<RecallSession>;
};

export type AppPersistentRecallContext = {
  endFlashCardSession: (
    userId: string | null,
    input: UpdateRecallSessionInput,
  ) => Promise<RecallSession>;
  getSessionResultsSnapshot: () => readonly SessionResult[];
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

function cloneQuestion(question: RecallQuestion): RecallQuestion {
  return {
    ...question,
    noteSnapshot: cloneNoteSnapshot(question.noteSnapshot),
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
  let sessionResultsSnapshot: SessionResult[] = [];

  function notifyListeners() {
    for (const listener of listeners) {
      listener();
    }
  }

  function writeState(input: {
    activeSession: StoredRecallSession | null;
    sessionResults: StoredSessionResult[];
  }) {
    snapshot = input.activeSession;
    sessionResults = input.sessionResults;
    sessionResultsSnapshot = stripUserId(input.sessionResults);
    notifyListeners();

    return {
      activeSession: snapshot,
      sessionResults: sessionResultsSnapshot,
    };
  }

  function requireService(): AppPersistentRecallService {
    if (service === undefined) {
      throw createMissingServiceError();
    }

    return service;
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
    getSnapshot: () => snapshot,
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
    async endFlashCardSession(userId, input) {
      const validatedUserId = requireUserId(userId);
      const [endedSession, nextResults] = await Promise.all([
        requireService().endRecallSession(input),
        requireService().listSessionResults(),
      ]);

      writeState({
        activeSession: null,
        sessionResults: toStoredSessionResults(nextResults, validatedUserId),
      });

      return cloneSession(endedSession);
    },
    getSessionResultsSnapshot() {
      return sessionResultsSnapshot;
    },
    getSnapshot() {
      return snapshot;
    },
    async rateFlashCardAnswer(userId, input) {
      const validatedUserId = requireUserId(userId);
      const nextSession = await requireService().rateFlashCardAnswer(input);

      if (nextSession !== null) {
        writeState({
          activeSession: toStoredRecallSession(nextSession, validatedUserId),
          sessionResults,
        });
        await emitStudyActivity(validatedUserId, nextSession);

        return cloneSession(nextSession);
      }

      const nextResults = await requireService().listSessionResults();

      writeState({
        activeSession: null,
        sessionResults: toStoredSessionResults(nextResults, validatedUserId),
      });
      await emitStudyActivity(
        validatedUserId,
        nextResults.find((result) => result.id === input.sessionId) ?? null,
      );

      return null;
    },
    async refresh(userId) {
      if (userId === null) {
        return writeState({
          activeSession: null,
          sessionResults: [],
        });
      }

      const [activeSession, nextResults] = await Promise.all([
        requireService().getActiveSession(),
        requireService().listSessionResults(),
      ]);

      return writeState({
        activeSession: toStoredRecallSession(activeSession, userId),
        sessionResults: toStoredSessionResults(nextResults, userId),
      });
    },
    async revealFlashCardAnswer(userId, input) {
      const validatedUserId = requireUserId(userId);
      const revealedSession =
        await requireService().revealFlashCardAnswer(input);

      writeState({
        activeSession: toStoredRecallSession(revealedSession, validatedUserId),
        sessionResults,
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
        writeState({
          activeSession: toStoredRecallSession(nextSession, validatedUserId),
          sessionResults,
        });

        return cloneSession(nextSession);
      }

      const nextResults = await requireService().listSessionResults();

      writeState({
        activeSession: null,
        sessionResults: toStoredSessionResults(nextResults, validatedUserId),
      });

      return null;
    },
    async startFlashCardSession(userId, input) {
      const validatedUserId = requireUserId(userId);
      const startedSession =
        await requireService().startFlashCardSession(input);

      writeState({
        activeSession: toStoredRecallSession(startedSession, validatedUserId),
        sessionResults,
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
    async updateFlashCardAttemptText(userId, input) {
      const validatedUserId = requireUserId(userId);
      const updatedSession =
        await requireService().updateFlashCardAttemptText(input);

      writeState({
        activeSession: toStoredRecallSession(updatedSession, validatedUserId),
        sessionResults,
      });

      return cloneSession(updatedSession);
    },
    readonlyContext,
  };
}
