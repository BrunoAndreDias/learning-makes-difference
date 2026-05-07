import type { RecallStudyActivitySession } from "../focus";
import type { AppLabel } from "../labels/label-management/labels";
import { type AppNote, type AppNotesContext, listNotesForUser } from "../notes";

export type RecallMode = "AiAssisted" | "AiGraded" | "FlashCard";

export type RecallLabelSnapshot = {
  id: string;
  name: string;
};

export type RecallNoteSnapshot = AppNote & {
  labels?: RecallLabelSnapshot[];
};

export type LegacyRecallSelfRating = "missed" | "partial" | "nailed";

export type RecallSelfRating = "forgot" | "hard" | "good" | "easy";

export type RecallAttempt = {
  noteId: string;
  rating: RecallSelfRating;
  text?: string | null;
};

export type RecallAttemptSummary = {
  easy: number;
  forgot: number;
  good: number;
  hard: number;
};

export type RecallQuestion = {
  isAnswerRevealed: boolean;
  noteId: string;
  noteSnapshot: RecallNoteSnapshot;
  score?: number | null;
  selfRating: RecallSelfRating | null;
  typedAnswer?: string;
};

export type RecallSession = {
  attempts: RecallAttempt[];
  createdAt: string;
  currentIndex: number;
  currentQuestionIndex: number;
  draftAnswer?: string;
  id: string;
  isAnswerRevealed: boolean;
  mode: RecallMode;
  notes: RecallNoteSnapshot[];
  questions: RecallQuestion[];
};

export type SessionResult = {
  attempts: RecallAttempt[];
  completedAt: string;
  createdAt: string;
  id: string;
  mode: RecallMode;
  notes: RecallNoteSnapshot[];
  questions: RecallQuestion[];
  score?: number | null;
};

export type FlashCardRecallMode = "FlashCard";
export type FlashCardRecallNote = RecallNoteSnapshot;
export type FlashCardRecallRating = RecallSelfRating;
export type FlashCardRecallAttempt = RecallAttempt;
export type FlashCardRecallAttemptSummary = RecallAttemptSummary;
export type FlashCardRecallSession = RecallSession;
export type FlashCardSessionResult = SessionResult;

type StoredRecallSession = RecallSession & {
  userId: string;
};

type StoredSessionResult = SessionResult & {
  userId: string;
};

export type AppRecallSnapshot = StoredRecallSession | null;

type RecallListener = () => void;

type RecallStorageAdapter = Pick<Storage, "getItem" | "setItem">;

type RecallCrypto = Pick<Crypto, "randomUUID">;

type ShuffleNotes = (
  notes: readonly RecallNoteSnapshot[],
) => RecallNoteSnapshot[];

type StartRecallSessionInput = {
  mode?: RecallMode;
  noteIds: string[];
  userId: string;
};

type UpdateRecallSessionInput = {
  sessionId: string;
  userId: string;
};

type GetSessionResultInput = {
  sessionResultId: string;
  userId: string;
};

type ListSessionResultsInput = {
  labelId?: string;
  userId: string;
};

type ListAttemptsByNoteInput = ListSessionResultsInput;

export type FlashCardRecallAttemptHistoryEntry = {
  bodySnapshot: string;
  completedAt: string;
  rating: FlashCardRecallRating;
  sessionId: string;
  snapshotTitle: string;
};

export type FlashCardRecallAttemptsByNote = FlashCardRecallAttemptSummary & {
  attempts: FlashCardRecallAttemptHistoryEntry[];
  currentTitle: string | null;
  noteId: string;
  snapshotTitle: string;
  totalAttempts: number;
};

type AnswerQuestionInput = UpdateRecallSessionInput & {
  rating: RecallSelfRating;
};

type SkipQuestionInput = UpdateRecallSessionInput;

type UpdateAttemptTextInput = UpdateRecallSessionInput & {
  text: string;
};

type CreateAppRecallContextOptions = {
  crypto?: RecallCrypto;
  getLabelsForUser?: (userId: string) => readonly AppLabel[];
  keyPrefix?: string;
  notes: AppNotesContext;
  onStudyActivity?: (input: {
    recallSession: RecallStudyActivitySession;
    userId: string;
  }) => void;
  shuffleNotes?: ShuffleNotes;
  storage?: RecallStorageAdapter;
};

export class AppRecallError extends Error {
  readonly code: "invalid_input" | "not_found";

  constructor(code: "invalid_input" | "not_found", message: string) {
    super(message);
    this.code = code;
  }
}

export function summarizeAttempts(
  attempts: readonly FlashCardRecallAttempt[],
): FlashCardRecallAttemptSummary {
  const summary: FlashCardRecallAttemptSummary = {
    easy: 0,
    forgot: 0,
    good: 0,
    hard: 0,
  };

  for (const attempt of attempts) {
    summary[attempt.rating] += 1;
  }

  return summary;
}

function normalizeRecallSelfRating(
  rating: RecallSelfRating | LegacyRecallSelfRating,
): RecallSelfRating {
  switch (rating) {
    case "missed":
      return "forgot";
    case "partial":
      return "hard";
    case "nailed":
      return "easy";
    case "forgot":
    case "hard":
    case "good":
    case "easy":
      return rating;
  }
}

function getRecallSelfRatingScore(rating: RecallSelfRating): number {
  switch (rating) {
    case "forgot":
      return 0;
    case "hard":
      return 50;
    case "good":
      return 75;
    case "easy":
      return 100;
  }
}

export type AppRecallContext = {
  answerQuestion: (input: AnswerQuestionInput) => RecallSession | null;
  endRecallSession: (input: UpdateRecallSessionInput) => RecallSession;
  getSessionResult: (input: GetSessionResultInput) => SessionResult;
  getSessionResultsSnapshot: () => readonly SessionResult[];
  getSnapshot: () => AppRecallSnapshot;
  listSessionResults: (input: ListSessionResultsInput) => SessionResult[];
  listAttemptsByNote: (
    input: ListAttemptsByNoteInput,
  ) => FlashCardRecallAttemptsByNote[];
  revealAnswer: (input: UpdateRecallSessionInput) => RecallSession;
  skipFlashCardQuestion: (input: SkipQuestionInput) => RecallSession | null;
  startRecallSession: (input: StartRecallSessionInput) => RecallSession;
  endFlashCardSession: (input: UpdateRecallSessionInput) => RecallSession;
  rateFlashCardAnswer: (input: AnswerQuestionInput) => RecallSession | null;
  revealFlashCardAnswer: (input: UpdateRecallSessionInput) => RecallSession;
  startFlashCardSession: (input: StartRecallSessionInput) => RecallSession;
  updateAttemptText: (input: UpdateAttemptTextInput) => RecallSession;
  updateFlashCardAttemptText: (input: UpdateAttemptTextInput) => RecallSession;
  subscribe: (listener: RecallListener) => () => void;
};

const DEFAULT_STORAGE_KEY_PREFIX = "learning-makes-difference-recall";

function getDefaultStorage(): RecallStorageAdapter | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}

function getDefaultCrypto(): RecallCrypto {
  return globalThis.crypto;
}

function getRecallStorageKey(prefix: string) {
  return `${prefix}:active-session`;
}

function getSessionResultsStorageKey(prefix: string) {
  return `${prefix}:session-results`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function isRecallLabelSnapshot(label: unknown): label is RecallLabelSnapshot {
  const candidate = asRecord(label);

  return (
    candidate !== null &&
    typeof candidate.id === "string" &&
    typeof candidate.name === "string"
  );
}

function isRecallNoteSnapshot(note: unknown): note is RecallNoteSnapshot {
  const candidate = asRecord(note);
  const labels = candidate?.labels;

  return (
    candidate !== null &&
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.body === "string" &&
    Array.isArray(candidate.labelIds) &&
    candidate.labelIds.every(
      (labelId: unknown) => typeof labelId === "string",
    ) &&
    (labels === undefined ||
      (Array.isArray(labels) &&
        labels.every((label: unknown) => isRecallLabelSnapshot(label)))) &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

type StoredRecallAttempt = Omit<RecallAttempt, "rating"> & {
  rating: LegacyRecallSelfRating | RecallSelfRating;
};

type StoredRecallQuestion = Omit<RecallQuestion, "score" | "selfRating"> & {
  score?: number | null;
  selfRating: LegacyRecallSelfRating | RecallSelfRating | null;
};

function isRecallAttempt(attempt: unknown): attempt is StoredRecallAttempt {
  const candidate = asRecord(attempt);

  return (
    candidate !== null &&
    typeof candidate.noteId === "string" &&
    (!("text" in candidate) ||
      candidate.text === null ||
      typeof candidate.text === "string") &&
    isStoredRecallSelfRating(candidate.rating)
  );
}

function isRecallSelfRating(value: unknown): value is RecallSelfRating {
  return (
    value === "forgot" ||
    value === "hard" ||
    value === "good" ||
    value === "easy"
  );
}

function isLegacyRecallSelfRating(
  value: unknown,
): value is LegacyRecallSelfRating {
  return value === "missed" || value === "partial" || value === "nailed";
}

function isStoredRecallSelfRating(
  value: unknown,
): value is LegacyRecallSelfRating | RecallSelfRating {
  return isRecallSelfRating(value) || isLegacyRecallSelfRating(value);
}

function isRecallQuestion(question: unknown): question is StoredRecallQuestion {
  const candidate = asRecord(question);

  return (
    candidate !== null &&
    typeof candidate.isAnswerRevealed === "boolean" &&
    typeof candidate.noteId === "string" &&
    isRecallNoteSnapshot(candidate.noteSnapshot) &&
    (candidate.selfRating === null ||
      isStoredRecallSelfRating(candidate.selfRating)) &&
    (!("score" in candidate) ||
      candidate.score === null ||
      typeof candidate.score === "number")
  );
}

function normalizeRecallAttemptText(text: string): string | null {
  if (text.trim().length === 0) {
    return null;
  }

  return text;
}

function normalizeStoredRecallAttempt(
  attempt: StoredRecallAttempt,
): RecallAttempt {
  return {
    noteId: attempt.noteId,
    rating: normalizeRecallSelfRating(attempt.rating),
    text: attempt.text ?? null,
  };
}

function getFirstAttemptByNoteId(attempts: readonly RecallAttempt[]) {
  const attemptsByNoteId = new Map<string, RecallAttempt>();

  for (const attempt of attempts) {
    if (!attemptsByNoteId.has(attempt.noteId)) {
      attemptsByNoteId.set(attempt.noteId, attempt);
    }
  }

  return attemptsByNoteId;
}

function createQuestionsFromProgress(input: {
  attempts: readonly RecallAttempt[];
  draftAnswer: string;
  isAnswerRevealed: boolean;
  notes: readonly RecallNoteSnapshot[];
  questionIndex: number;
}) {
  return createQuestionsFromSessionState({
    attempts: input.attempts,
    currentIndex: input.questionIndex,
    draftAnswer: input.draftAnswer,
    isAnswerRevealed: input.isAnswerRevealed,
    notes: input.notes,
  });
}

function getTypedAnswerForQuestion(input: {
  attempt: RecallAttempt | undefined;
  currentIndex: number;
  draftAnswer: string;
  noteIndex: number;
}): string {
  if (input.attempt?.text != null) {
    return input.attempt.text;
  }

  if (input.noteIndex === input.currentIndex) {
    return input.draftAnswer;
  }

  return "";
}

function getRecallQuestionScore(attempt: RecallAttempt | undefined) {
  return attempt === undefined
    ? null
    : getRecallSelfRatingScore(attempt.rating);
}

function getRecallQuestionState(
  input: {
    currentIndex: number;
    draftAnswer: string;
    isAnswerRevealed: boolean;
    note: RecallNoteSnapshot;
    noteIndex: number;
  },
  attemptsByNoteId: ReadonlyMap<string, RecallAttempt>,
): RecallQuestion {
  const attempt = attemptsByNoteId.get(input.note.id);

  return {
    isAnswerRevealed:
      attempt === undefined &&
      input.noteIndex === input.currentIndex &&
      input.isAnswerRevealed,
    noteId: input.note.id,
    noteSnapshot: cloneRecallNoteSnapshot(input.note),
    score: getRecallQuestionScore(attempt),
    selfRating: attempt?.rating ?? null,
    typedAnswer: getTypedAnswerForQuestion({
      attempt,
      currentIndex: input.currentIndex,
      draftAnswer: input.draftAnswer,
      noteIndex: input.noteIndex,
    }),
  };
}

function createQuestionsFromSessionState(input: {
  attempts: readonly RecallAttempt[];
  currentIndex: number;
  draftAnswer: string;
  isAnswerRevealed: boolean;
  notes: readonly RecallNoteSnapshot[];
}): RecallQuestion[] {
  const attemptsByNoteId = getFirstAttemptByNoteId(input.attempts);

  return input.notes.map((note, noteIndex) =>
    getRecallQuestionState(
      {
        currentIndex: input.currentIndex,
        draftAnswer: input.draftAnswer,
        isAnswerRevealed: input.isAnswerRevealed,
        note,
        noteIndex,
      },
      attemptsByNoteId,
    ),
  );
}

function parseStoredRecallSession(value: string | null): AppRecallSnapshot {
  if (value === null) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(value);

    if (
      typeof parsedValue !== "object" ||
      parsedValue === null ||
      typeof parsedValue.id !== "string" ||
      typeof parsedValue.userId !== "string" ||
      parsedValue.mode !== "FlashCard" ||
      typeof parsedValue.createdAt !== "string" ||
      typeof parsedValue.currentIndex !== "number" ||
      ("draftAnswer" in parsedValue &&
        typeof parsedValue.draftAnswer !== "string") ||
      typeof parsedValue.isAnswerRevealed !== "boolean" ||
      ("attempts" in parsedValue &&
        (!Array.isArray(parsedValue.attempts) ||
          parsedValue.attempts.some((attempt: unknown) => {
            return !isRecallAttempt(attempt);
          }))) ||
      !Array.isArray(parsedValue.notes)
    ) {
      return null;
    }

    const notes = parsedValue.notes.filter(isRecallNoteSnapshot);
    const attempts = Array.isArray(parsedValue.attempts)
      ? parsedValue.attempts.map(normalizeStoredRecallAttempt)
      : [];
    const draftAnswer =
      typeof parsedValue.draftAnswer === "string"
        ? parsedValue.draftAnswer
        : "";
    const questions = createQuestionsFromProgress({
      attempts,
      draftAnswer,
      isAnswerRevealed: parsedValue.isAnswerRevealed,
      notes,
      questionIndex: parsedValue.currentIndex,
    });

    return {
      ...parsedValue,
      attempts,
      currentQuestionIndex: parsedValue.currentIndex,
      draftAnswer,
      notes,
      questions,
    };
  } catch {
    return null;
  }
}

function restoreStoredSessionResultQuestions(
  result: StoredSessionResult,
  notes: readonly RecallNoteSnapshot[],
): RecallQuestion[] {
  if (
    Array.isArray(result.questions) &&
    result.questions.every((question: unknown) => isRecallQuestion(question))
  ) {
    return result.questions.map(normalizeStoredRecallQuestion);
  }

  return createQuestionsFromProgress({
    attempts: result.attempts,
    draftAnswer: "",
    isAnswerRevealed: false,
    notes,
    questionIndex: notes.length,
  }).filter((question) => question.selfRating !== null);
}

function parseStoredSessionResults(
  value: string | null,
): StoredSessionResult[] {
  if (value === null) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .filter((result): result is StoredSessionResult => {
        return (
          typeof result === "object" &&
          result !== null &&
          typeof result.id === "string" &&
          typeof result.userId === "string" &&
          result.mode === "FlashCard" &&
          typeof result.createdAt === "string" &&
          typeof result.completedAt === "string" &&
          Array.isArray(result.attempts) &&
          result.attempts.every((attempt: unknown) =>
            isRecallAttempt(attempt),
          ) &&
          Array.isArray(result.notes)
        );
      })
      .map((result) => {
        const notes = result.notes.filter(isRecallNoteSnapshot);
        const attempts = result.attempts.map(normalizeStoredRecallAttempt);

        return {
          ...result,
          attempts,
          notes,
          questions: restoreStoredSessionResultQuestions(
            {
              ...result,
              attempts,
            },
            notes,
          ),
        };
      })
      .map((result) => ({
        ...result,
        score:
          typeof result.score === "number"
            ? result.score
            : getAverageQuestionScore(result.questions),
      }));
  } catch {
    return [];
  }
}

function defaultShuffleNotes(
  notes: readonly RecallNoteSnapshot[],
): RecallNoteSnapshot[] {
  const shuffledNotes = [...notes];

  for (let index = shuffledNotes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const currentNote = shuffledNotes[index];

    shuffledNotes[index] = shuffledNotes[swapIndex];
    shuffledNotes[swapIndex] = currentNote;
  }

  return shuffledNotes;
}

function cloneRecallNoteSnapshot(note: RecallNoteSnapshot): RecallNoteSnapshot {
  return {
    ...note,
    acronyms: note.acronyms.map((acronym) => ({ ...acronym })),
    labelIds: [...note.labelIds],
    labels: Array.isArray(note.labels)
      ? note.labels.map((label) => ({ ...label }))
      : [],
    metaphors: note.metaphors.map((metaphor) => ({ ...metaphor })),
  };
}

function cloneRecallNoteSnapshots(
  notes: readonly RecallNoteSnapshot[],
): RecallNoteSnapshot[] {
  return notes.map(cloneRecallNoteSnapshot);
}

function cloneRecallQuestion(question: RecallQuestion): RecallQuestion {
  return {
    ...question,
    noteSnapshot: cloneRecallNoteSnapshot(question.noteSnapshot),
  };
}

function normalizeStoredRecallQuestion(
  question: StoredRecallQuestion,
): RecallQuestion {
  const selfRating =
    question.selfRating === null
      ? null
      : normalizeRecallSelfRating(question.selfRating);

  return {
    ...question,
    noteSnapshot: cloneRecallNoteSnapshot(question.noteSnapshot),
    score:
      typeof question.score === "number"
        ? question.score
        : selfRating === null
          ? null
          : getRecallSelfRatingScore(selfRating),
    selfRating,
  };
}

function getAverageQuestionScore(questions: readonly RecallQuestion[]) {
  const scores = questions
    .map((question) => question.score)
    .filter((score): score is number => typeof score === "number");

  if (scores.length === 0) {
    return null;
  }

  return scores.reduce((total, score) => total + score, 0) / scores.length;
}

function cloneSessionResult(result: StoredSessionResult): StoredSessionResult {
  return {
    ...result,
    attempts: result.attempts.map((attempt) => ({ ...attempt })),
    notes: cloneRecallNoteSnapshots(result.notes),
    questions: result.questions.map(cloneRecallQuestion),
  };
}

function getRecallLabelSnapshots(input: {
  labelIds: readonly string[];
  labelsById: ReadonlyMap<string, AppLabel>;
}): RecallLabelSnapshot[] {
  const snapshots: RecallLabelSnapshot[] = [];

  for (const labelId of input.labelIds) {
    const label = input.labelsById.get(labelId);

    if (label !== undefined) {
      snapshots.push({
        id: label.id,
        name: label.name,
      });
    }
  }

  return snapshots;
}

function toRecallNoteSnapshot(input: {
  labelsById: ReadonlyMap<string, AppLabel>;
  note: AppNote;
}): RecallNoteSnapshot {
  return {
    ...input.note,
    acronyms: input.note.acronyms.map((acronym) => ({ ...acronym })),
    labelIds: [...input.note.labelIds],
    labels: getRecallLabelSnapshots({
      labelIds: input.note.labelIds,
      labelsById: input.labelsById,
    }),
    metaphors: input.note.metaphors.map((metaphor) => ({ ...metaphor })),
  };
}

function resultMatchesLabel(
  result: StoredSessionResult,
  labelId: string | undefined,
): boolean {
  if (labelId === undefined) {
    return true;
  }

  return result.notes.some((note) => note.labelIds.includes(labelId));
}

function listFilteredSessionResults(input: {
  labelId?: string;
  sessionResults: readonly StoredSessionResult[];
  userId: string;
}): StoredSessionResult[] {
  return input.sessionResults.filter((result) => {
    return (
      result.userId === input.userId &&
      resultMatchesLabel(result, input.labelId)
    );
  });
}

function resolveRecallableNotesFromSelection(input: {
  noteIds: readonly string[];
  notes: AppNotesContext;
  userId: string;
}): RecallNoteSnapshot[] {
  if (!Array.isArray(input.noteIds)) {
    throw new AppRecallError(
      "invalid_input",
      "Choose at least one note for recall.",
    );
  }

  const selectedNoteIds: string[] = [];
  const seenNoteIds = new Set<string>();

  for (const noteId of input.noteIds) {
    if (typeof noteId !== "string" || noteId.length === 0) {
      continue;
    }

    if (seenNoteIds.has(noteId)) {
      continue;
    }

    seenNoteIds.add(noteId);
    selectedNoteIds.push(noteId);
  }

  if (selectedNoteIds.length === 0) {
    throw new AppRecallError(
      "invalid_input",
      "Choose at least one note for recall.",
    );
  }

  const ownedNotes = listNotesForUser(input.notes.getSnapshot(), input.userId);
  const ownedNotesById = new Map(ownedNotes.map((note) => [note.id, note]));
  const recallableNotes = selectedNoteIds.map((noteId) => {
    const note = ownedNotesById.get(noteId);

    if (note === undefined) {
      throw new AppRecallError("not_found", "Note not found.");
    }

    return note;
  });

  return recallableNotes;
}

export function createAppRecallContext(
  options: CreateAppRecallContextOptions,
): AppRecallContext {
  const storage = options.storage ?? getDefaultStorage();
  const cryptoProvider = options.crypto ?? getDefaultCrypto();
  const keyPrefix = options.keyPrefix ?? DEFAULT_STORAGE_KEY_PREFIX;
  const shuffleNotes = options.shuffleNotes ?? defaultShuffleNotes;
  const listeners = new Set<RecallListener>();
  let snapshot = parseStoredRecallSession(
    storage?.getItem(getRecallStorageKey(keyPrefix)) ?? null,
  );
  let sessionResults = parseStoredSessionResults(
    storage?.getItem(getSessionResultsStorageKey(keyPrefix)) ?? null,
  );
  let sessionResultsSnapshot = sessionResults.map(cloneSessionResult);

  function notifyListeners() {
    for (const listener of listeners) {
      listener();
    }
  }

  function writeSnapshot(nextSnapshot: StoredRecallSession | null) {
    snapshot = nextSnapshot;
    storage?.setItem(getRecallStorageKey(keyPrefix), JSON.stringify(snapshot));
    notifyListeners();
  }

  function writeSessionResults(nextSessionResults: StoredSessionResult[]) {
    sessionResults = nextSessionResults;
    sessionResultsSnapshot = sessionResults.map(cloneSessionResult);
    storage?.setItem(
      getSessionResultsStorageKey(keyPrefix),
      JSON.stringify(sessionResults),
    );
    notifyListeners();
  }

  function emitStudyActivity(session: StoredRecallSession) {
    options.onStudyActivity?.({
      recallSession: {
        createdAt: session.createdAt,
        id: session.id,
        mode: session.mode,
        notes: cloneRecallNoteSnapshots(session.notes),
      },
      userId: session.userId,
    });
  }

  function getActiveSessionForUser({
    sessionId,
    userId,
  }: UpdateRecallSessionInput): StoredRecallSession {
    if (
      snapshot === null ||
      snapshot.userId !== userId ||
      snapshot.id !== sessionId
    ) {
      throw new AppRecallError("not_found", "Recall session not found.");
    }

    return snapshot;
  }

  function toSessionResult(session: StoredRecallSession): StoredSessionResult {
    const questions = session.questions
      .filter((question) => question.selfRating !== null)
      .map(cloneRecallQuestion);

    return {
      attempts: [...session.attempts],
      completedAt: new Date().toISOString(),
      createdAt: session.createdAt,
      id: session.id,
      mode: session.mode,
      notes: cloneRecallNoteSnapshots(session.notes),
      questions,
      score: getAverageQuestionScore(questions),
      userId: session.userId,
    };
  }

  function persistSessionResult(session: StoredRecallSession) {
    if (session.attempts.length === 0) {
      return;
    }

    const nextResult = toSessionResult(session);

    writeSessionResults([
      ...sessionResults.filter((result) => result.id !== nextResult.id),
      nextResult,
    ]);
  }

  function endRecallSession({ sessionId, userId }: UpdateRecallSessionInput) {
    const activeSession = getActiveSessionForUser({ sessionId, userId });

    persistSessionResult(activeSession);
    writeSnapshot(null);

    return activeSession;
  }

  function revealAnswer({ sessionId, userId }: UpdateRecallSessionInput) {
    const activeSession = getActiveSessionForUser({ sessionId, userId });

    if (activeSession.notes[activeSession.currentQuestionIndex] === undefined) {
      throw new AppRecallError("invalid_input", "Recall session is complete.");
    }

    if (activeSession.isAnswerRevealed) {
      return activeSession;
    }

    const nextSession: StoredRecallSession = {
      ...activeSession,
      isAnswerRevealed: true,
      questions: createQuestionsFromProgress({
        attempts: activeSession.attempts,
        draftAnswer: activeSession.draftAnswer ?? "",
        isAnswerRevealed: true,
        notes: activeSession.notes,
        questionIndex: activeSession.currentQuestionIndex,
      }),
    };

    writeSnapshot(nextSession);

    return nextSession;
  }

  function answerQuestion({ rating, sessionId, userId }: AnswerQuestionInput) {
    const activeSession = getActiveSessionForUser({ sessionId, userId });
    const currentNote = activeSession.notes[activeSession.currentQuestionIndex];

    if (currentNote === undefined) {
      throw new AppRecallError("invalid_input", "Recall session is complete.");
    }

    if (!activeSession.isAnswerRevealed) {
      throw new AppRecallError(
        "invalid_input",
        "Reveal the answer before rating recall.",
      );
    }

    const attempts: RecallAttempt[] = [
      ...activeSession.attempts,
      {
        noteId: currentNote.id,
        rating,
        text: normalizeRecallAttemptText(activeSession.draftAnswer ?? ""),
      },
    ];
    const currentQuestionIndex = activeSession.currentQuestionIndex + 1;
    const nextSession: StoredRecallSession = {
      ...activeSession,
      attempts,
      currentIndex: currentQuestionIndex,
      currentQuestionIndex,
      draftAnswer: "",
      isAnswerRevealed: false,
      questions: createQuestionsFromProgress({
        attempts,
        draftAnswer: "",
        isAnswerRevealed: false,
        notes: activeSession.notes,
        questionIndex: currentQuestionIndex,
      }),
    };

    if (nextSession.currentQuestionIndex >= nextSession.notes.length) {
      emitStudyActivity(nextSession);
      persistSessionResult(nextSession);
      writeSnapshot(null);
      return null;
    }

    writeSnapshot(nextSession);
    emitStudyActivity(nextSession);

    return nextSession;
  }

  function skipFlashCardQuestion({
    sessionId,
    userId,
  }: SkipQuestionInput): RecallSession | null {
    const activeSession = getActiveSessionForUser({ sessionId, userId });

    if (activeSession.notes[activeSession.currentQuestionIndex] === undefined) {
      throw new AppRecallError("invalid_input", "Recall session is complete.");
    }

    const currentQuestionIndex = activeSession.currentQuestionIndex + 1;
    const nextSession: StoredRecallSession = {
      ...activeSession,
      currentIndex: currentQuestionIndex,
      currentQuestionIndex,
      draftAnswer: "",
      isAnswerRevealed: false,
      questions: createQuestionsFromProgress({
        attempts: activeSession.attempts,
        draftAnswer: "",
        isAnswerRevealed: false,
        notes: activeSession.notes,
        questionIndex: currentQuestionIndex,
      }),
    };

    if (nextSession.currentQuestionIndex >= nextSession.notes.length) {
      persistSessionResult(nextSession);
      writeSnapshot(null);
      return null;
    }

    writeSnapshot(nextSession);

    return nextSession;
  }

  function updateAttemptText({
    sessionId,
    text,
    userId,
  }: UpdateAttemptTextInput) {
    const activeSession = getActiveSessionForUser({ sessionId, userId });

    if (activeSession.notes[activeSession.currentQuestionIndex] === undefined) {
      throw new AppRecallError("invalid_input", "Recall session is complete.");
    }

    if ((activeSession.draftAnswer ?? "") === text) {
      return activeSession;
    }

    const nextSession: StoredRecallSession = {
      ...activeSession,
      draftAnswer: text,
      questions: createQuestionsFromProgress({
        attempts: activeSession.attempts,
        draftAnswer: text,
        isAnswerRevealed: activeSession.isAnswerRevealed,
        notes: activeSession.notes,
        questionIndex: activeSession.currentQuestionIndex,
      }),
    };

    writeSnapshot(nextSession);

    return nextSession;
  }

  function startRecallSession(input: StartRecallSessionInput) {
    const mode = input.mode ?? "FlashCard";

    if (mode !== "FlashCard") {
      throw new AppRecallError(
        "invalid_input",
        "This RecallMode is not available yet.",
      );
    }

    const notes = resolveRecallableNotesFromSelection({
      noteIds: input.noteIds,
      notes: options.notes,
      userId: input.userId,
    });
    const labelsById = new Map(
      (options.getLabelsForUser?.(input.userId) ?? []).map((label) => [
        label.id,
        label,
      ]),
    );
    const noteSnapshots = notes.map((note) =>
      toRecallNoteSnapshot({
        labelsById,
        note,
      }),
    );
    const shuffledNotes = cloneRecallNoteSnapshots(shuffleNotes(noteSnapshots));

    const nextSession: StoredRecallSession = {
      attempts: [],
      createdAt: new Date().toISOString(),
      currentIndex: 0,
      currentQuestionIndex: 0,
      draftAnswer: "",
      id: cryptoProvider.randomUUID(),
      isAnswerRevealed: false,
      mode,
      notes: shuffledNotes,
      questions: createQuestionsFromProgress({
        attempts: [],
        draftAnswer: "",
        isAnswerRevealed: false,
        notes: shuffledNotes,
        questionIndex: 0,
      }),
      userId: input.userId,
    };

    writeSnapshot(nextSession);
    emitStudyActivity(nextSession);

    return nextSession;
  }

  return {
    answerQuestion,
    endRecallSession,
    endFlashCardSession: endRecallSession,
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
    listAttemptsByNote: ({ labelId, userId }) => {
      const currentNotesById = new Map(
        listNotesForUser(options.notes.getSnapshot(), userId).map((note) => [
          note.id,
          note,
        ]),
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
        .map(([noteId, group]) => {
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
            currentTitle: currentNotesById.get(noteId)?.title ?? null,
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
    rateFlashCardAnswer: answerQuestion,
    revealAnswer,
    revealFlashCardAnswer: revealAnswer,
    skipFlashCardQuestion,
    startFlashCardSession: startRecallSession,
    startRecallSession,
    updateAttemptText,
    updateFlashCardAttemptText: updateAttemptText,
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}
