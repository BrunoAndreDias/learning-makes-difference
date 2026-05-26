import type { RecallStudyActivitySession } from "../focus";
import type { AppLabel } from "../labels/label-management/labels";
import { type AppNote, type AppNotesContext, listNotesForUser } from "../notes";
import {
  type AppStudyNote,
  type AppStudyNoteAcceptedVariant,
  type AppStudyNoteKeyIdea,
  type AppStudyNoteProhibitedPhrase,
  type AppStudyNotesContext,
  getStudyNoteReadiness,
  listStudyNotesForUser,
} from "../study-notes";
import {
  cloneRecallAnswerCheckResult,
  isRecallAnswerCheckResult,
  type RecallAnswerCheckResult,
  scoreRecallAnswerCheck,
} from "./recall-answer-check";
import {
  clonePracticeRepairEntry as clonePracticeRepairEntryValue,
  createPracticeRepairEntryId,
  createPracticeRepairIntentMetadata,
  getPracticeRepairEntryLifecycleState,
  isActionablePracticeFollowUp,
  isPracticeRepairEligibleQuestion,
  isPracticeRepairEntry,
  isPracticeRepairEntryForIntent,
  isPracticeRepairIntent,
  listActivePracticeRepairEntriesForStudyNote as listActivePracticeRepairEntriesForStudyNoteValue,
  listPracticeRepairEntriesForQuestion as listPracticeRepairEntriesForQuestionValue,
  type PracticeFollowUpSatisfaction,
  type PracticeRepairEntry,
  type PracticeRepairEntryConfirmation,
  type PracticeRepairEntryForIntent,
  type PracticeRepairLinkedCompletionInput,
  type PracticeRepairLinkedCompletionIntent,
  type PracticeRepairQuestionReference,
  type SplitStudyNotePracticeRepairMetadata,
  satisfyPracticeRepairEntryFollowUp,
} from "./recall-practice-repair";
import {
  createInitialRecallSchedule,
  getUpdatedRecallSchedule,
  type RecallSchedule,
} from "./recall-schedule";
import {
  AppRecallError,
  createRecallState,
  type RecallCrypto,
  type ShuffleNotes,
  type StoredRecallSchedule,
  type StoredRecallSession,
  type StoredSessionResult,
} from "./recall-state";
export { AppRecallError } from "./recall-state";

export type RecallMode = "AiAssisted" | "AiGraded" | "FlashCard";

export type RecallLabelSnapshot = {
  id: string;
  name: string;
};

export type RecallNoteSnapshot = AppNote & {
  acceptedVariants?: AppStudyNoteAcceptedVariant[];
  expectedAnswer?: string;
  keyIdeas?: AppStudyNoteKeyIdea[];
  labels?: RecallLabelSnapshot[];
  prompt?: string;
  prohibitedPhrases?: AppStudyNoteProhibitedPhrase[];
  source?: {
    body: string;
    displayName?: string;
    id: string;
    title: string;
    updatedAt: string;
  };
  sourceNoteId?: string;
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
  answerCheck?: RecallAnswerCheckResult;
  isAnswerRevealed: boolean;
  noteId: string;
  noteSnapshot: RecallNoteSnapshot;
  practiceRepairEntry?: PracticeRepairEntry;
  questionResultId?: string;
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

export type AppRecallSnapshot = StoredRecallSession | null;

type RecallListener = () => void;

type RecallStorageAdapter = Pick<Storage, "getItem" | "setItem">;

type ScoreRecallAnswerCheck = typeof scoreRecallAnswerCheck;

type RecallQuestionAnswerCheckStrategy =
  | {
      mode: "derive";
      scoreAnswerCheck: ScoreRecallAnswerCheck;
    }
  | {
      mode: "omit";
    };

type RecallQuestionAnswerCheckInput = RecallQuestionAnswerCheckStrategy & {
  isAnswerRevealed: boolean;
  note: RecallNoteSnapshot;
  selfRating: RecallSelfRating | null;
  typedAnswer: string;
};

type StartRecallSessionInput = {
  mode?: RecallMode;
  noteIds?: string[];
  studyNoteIds?: string[];
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

type ListActivePracticeRepairEntriesForStudyNoteInput = {
  studyNoteId: string;
  userId: string;
};

type ListPracticeRepairEntriesForQuestionInput = {
  reference: PracticeRepairQuestionReference;
  userId: string;
};

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

type CreateAppRecallContextOptions = {
  crypto?: RecallCrypto;
  getLabelsForUser?: (userId: string) => readonly AppLabel[];
  keyPrefix?: string;
  notes: AppNotesContext;
  now?: () => Date;
  onStudyActivity?: (input: {
    recallSession: RecallStudyActivitySession;
    userId: string;
  }) => void;
  scoreAnswerCheck?: ScoreRecallAnswerCheck;
  shuffleNotes?: ShuffleNotes;
  storage?: RecallStorageAdapter;
  studyNotes?: AppStudyNotesContext;
};

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
  completePracticeRepairEntry: (
    input: PracticeRepairEntryMutationInput,
  ) => SessionResult;
  completeLinkedPracticeRepairEntry: (
    input: CompleteLinkedPracticeRepairEntryInput,
  ) => SessionResult;
  confirmPracticeRepairEntry: (
    input: ConfirmPracticeRepairEntryInput,
  ) => SessionResult;
  dismissPracticeRepairEntry: (
    input: PracticeRepairEntryMutationInput,
  ) => SessionResult;
  endRecallSession: (input: UpdateRecallSessionInput) => RecallSession;
  getRecallSchedulesSnapshot: () => readonly RecallSchedule[];
  getSessionResult: (input: GetSessionResultInput) => SessionResult;
  getSessionResultsSnapshot: () => readonly SessionResult[];
  getSnapshot: () => AppRecallSnapshot;
  listActivePracticeRepairEntriesForStudyNote: (
    input: ListActivePracticeRepairEntriesForStudyNoteInput,
  ) => PracticeRepairEntry[];
  listPracticeRepairEntriesForQuestion: (
    input: ListPracticeRepairEntriesForQuestionInput,
  ) => PracticeRepairEntry[];
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
  updatePracticeRepairEntryCorrection: (
    input: UpdatePracticeRepairEntryCorrectionInput,
  ) => SessionResult;
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

function getRecallSchedulesStorageKey(prefix: string) {
  return `${prefix}:recall-schedules`;
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

function isRecallAnswerCheckTextReference(
  value: unknown,
): value is AppStudyNoteAcceptedVariant | AppStudyNoteProhibitedPhrase {
  const candidate = asRecord(value);

  return (
    candidate !== null &&
    typeof candidate.id === "string" &&
    typeof candidate.text === "string"
  );
}

function isRecallKeyIdea(value: unknown): value is AppStudyNoteKeyIdea {
  const candidate = asRecord(value);

  return (
    candidate !== null &&
    Array.isArray(candidate.acceptedPhrases) &&
    candidate.acceptedPhrases.every(
      (phrase: unknown) => typeof phrase === "string",
    ) &&
    typeof candidate.id === "string" &&
    (candidate.importance === "required" ||
      candidate.importance === "supporting") &&
    Array.isArray(candidate.prohibitedPhrases) &&
    candidate.prohibitedPhrases.every(
      (phrase: unknown) => typeof phrase === "string",
    ) &&
    typeof candidate.text === "string"
  );
}

function isRecallNoteSnapshot(note: unknown): note is RecallNoteSnapshot {
  const candidate = asRecord(note);
  const labels = candidate?.labels;
  const source = asRecord(candidate?.source);

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
    (!("acceptedVariants" in candidate) ||
      (Array.isArray(candidate.acceptedVariants) &&
        candidate.acceptedVariants.every((reference: unknown) =>
          isRecallAnswerCheckTextReference(reference),
        ))) &&
    (!("expectedAnswer" in candidate) ||
      typeof candidate.expectedAnswer === "string") &&
    (!("keyIdeas" in candidate) ||
      (Array.isArray(candidate.keyIdeas) &&
        candidate.keyIdeas.every((keyIdea: unknown) =>
          isRecallKeyIdea(keyIdea),
        ))) &&
    (!("prompt" in candidate) || typeof candidate.prompt === "string") &&
    (!("prohibitedPhrases" in candidate) ||
      (Array.isArray(candidate.prohibitedPhrases) &&
        candidate.prohibitedPhrases.every((reference: unknown) =>
          isRecallAnswerCheckTextReference(reference),
        ))) &&
    (!("sourceNoteId" in candidate) ||
      typeof candidate.sourceNoteId === "string") &&
    (!("source" in candidate) ||
      (source !== null &&
        typeof source.body === "string" &&
        (!("displayName" in source) ||
          typeof source.displayName === "string") &&
        typeof source.id === "string" &&
        typeof source.title === "string" &&
        typeof source.updatedAt === "string")) &&
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
    (!("questionResultId" in candidate) ||
      typeof candidate.questionResultId === "string") &&
    (!("practiceRepairEntry" in candidate) ||
      isPracticeRepairEntry(candidate.practiceRepairEntry)) &&
    (!("answerCheck" in candidate) ||
      candidate.answerCheck === undefined ||
      isRecallAnswerCheckResult(candidate.answerCheck)) &&
    (candidate.selfRating === null ||
      isStoredRecallSelfRating(candidate.selfRating)) &&
    (!("score" in candidate) ||
      candidate.score === null ||
      typeof candidate.score === "number")
  );
}

function isStoredRecallSchedule(
  schedule: unknown,
): schedule is StoredRecallSchedule {
  const candidate = asRecord(schedule);

  return (
    candidate !== null &&
    typeof candidate.userId === "string" &&
    typeof candidate.studyNoteId === "string" &&
    typeof candidate.nextRecallAt === "string" &&
    (candidate.lastRecalledAt === null ||
      typeof candidate.lastRecalledAt === "string") &&
    typeof candidate.intervalDays === "number" &&
    typeof candidate.ease === "number" &&
    typeof candidate.repetitionCount === "number"
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
  scoreAnswerCheck: ScoreRecallAnswerCheck;
}) {
  return createQuestionsFromSessionState({
    attempts: input.attempts,
    answerCheckStrategy: {
      mode: "derive",
      scoreAnswerCheck: input.scoreAnswerCheck,
    },
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

function shouldRunAnswerCheck(input: {
  isAnswerRevealed: boolean;
  note: RecallNoteSnapshot;
  selfRating: RecallSelfRating | null;
  typedAnswer: string;
}) {
  return (
    (input.isAnswerRevealed || input.selfRating !== null) &&
    input.note.sourceNoteId !== undefined &&
    (input.note.expectedAnswer ?? "").trim().length > 0 &&
    input.typedAnswer.trim().length > 0
  );
}

function getRecallAnswerCheck(input: {
  isAnswerRevealed: boolean;
  note: RecallNoteSnapshot;
  scoreAnswerCheck: ScoreRecallAnswerCheck;
  selfRating: RecallSelfRating | null;
  typedAnswer: string;
}): RecallAnswerCheckResult | undefined {
  if (!shouldRunAnswerCheck(input)) {
    return undefined;
  }

  try {
    return (
      input.scoreAnswerCheck({
        acceptedVariants: input.note.acceptedVariants ?? [],
        expectedAnswer: input.note.expectedAnswer ?? "",
        keyIdeas: input.note.keyIdeas ?? [],
        prohibitedPhrases: input.note.prohibitedPhrases ?? [],
        typedAnswer: input.typedAnswer,
      }) ?? undefined
    );
  } catch {
    return undefined;
  }
}

function getRecallQuestionAnswerCheck(
  input: RecallQuestionAnswerCheckInput,
): RecallAnswerCheckResult | undefined {
  switch (input.mode) {
    case "derive":
      return getRecallAnswerCheck({
        isAnswerRevealed: input.isAnswerRevealed,
        note: input.note,
        scoreAnswerCheck: input.scoreAnswerCheck,
        selfRating: input.selfRating,
        typedAnswer: input.typedAnswer,
      });
    case "omit":
      return undefined;
  }
}

function getRecallQuestionState(
  input: {
    answerCheckStrategy: RecallQuestionAnswerCheckStrategy;
    currentIndex: number;
    draftAnswer: string;
    isAnswerRevealed: boolean;
    note: RecallNoteSnapshot;
    noteIndex: number;
  },
  attemptsByNoteId: ReadonlyMap<string, RecallAttempt>,
): RecallQuestion {
  const attempt = attemptsByNoteId.get(input.note.id);
  const selfRating = attempt?.rating ?? null;
  const typedAnswer = getTypedAnswerForQuestion({
    attempt,
    currentIndex: input.currentIndex,
    draftAnswer: input.draftAnswer,
    noteIndex: input.noteIndex,
  });
  const isQuestionAnswerRevealed =
    attempt === undefined &&
    input.noteIndex === input.currentIndex &&
    input.isAnswerRevealed;

  return {
    answerCheck: getRecallQuestionAnswerCheck({
      ...input.answerCheckStrategy,
      isAnswerRevealed: isQuestionAnswerRevealed,
      note: input.note,
      selfRating,
      typedAnswer,
    }),
    isAnswerRevealed: isQuestionAnswerRevealed,
    noteId: input.note.id,
    noteSnapshot: cloneRecallNoteSnapshot(input.note),
    score: getRecallQuestionScore(attempt),
    selfRating,
    typedAnswer,
  };
}

function createQuestionsFromSessionState(input: {
  attempts: readonly RecallAttempt[];
  answerCheckStrategy: RecallQuestionAnswerCheckStrategy;
  currentIndex: number;
  draftAnswer: string;
  isAnswerRevealed: boolean;
  notes: readonly RecallNoteSnapshot[];
}): RecallQuestion[] {
  const attemptsByNoteId = getFirstAttemptByNoteId(input.attempts);

  return input.notes.map((note, noteIndex) =>
    getRecallQuestionState(
      {
        answerCheckStrategy: input.answerCheckStrategy,
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

function parseStoredRecallSession(
  value: string | null,
  scoreAnswerCheck: ScoreRecallAnswerCheck,
): AppRecallSnapshot {
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
    const questions =
      Array.isArray(parsedValue.questions) &&
      parsedValue.questions.every((question: unknown) =>
        isRecallQuestion(question),
      )
        ? parsedValue.questions.map(normalizeStoredRecallQuestion)
        : createQuestionsFromProgress({
            attempts,
            draftAnswer,
            isAnswerRevealed: parsedValue.isAnswerRevealed,
            notes,
            questionIndex: parsedValue.currentIndex,
            scoreAnswerCheck,
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

  return createQuestionsFromSessionState({
    attempts: result.attempts,
    answerCheckStrategy: { mode: "omit" },
    currentIndex: notes.length,
    draftAnswer: "",
    isAnswerRevealed: false,
    notes,
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

function parseStoredRecallSchedules(
  value: string | null,
): StoredRecallSchedule[] {
  if (value === null) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value);

    return Array.isArray(parsedValue)
      ? parsedValue.filter(isStoredRecallSchedule)
      : [];
  } catch {
    return [];
  }
}

function stripRecallScheduleUserIds(
  schedules: readonly StoredRecallSchedule[],
): RecallSchedule[] {
  return schedules.map(({ userId: _userId, ...schedule }) => ({
    ...schedule,
  }));
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
    acceptedVariants: Array.isArray(note.acceptedVariants)
      ? note.acceptedVariants.map((variant) => ({ ...variant }))
      : [],
    acronyms: note.acronyms.map((acronym) => ({ ...acronym })),
    keyIdeas: Array.isArray(note.keyIdeas)
      ? note.keyIdeas.map((keyIdea) => ({
          ...keyIdea,
          acceptedPhrases: [...keyIdea.acceptedPhrases],
          prohibitedPhrases: [...keyIdea.prohibitedPhrases],
        }))
      : [],
    labelIds: [...note.labelIds],
    labels: Array.isArray(note.labels)
      ? note.labels.map((label) => ({ ...label }))
      : [],
    metaphors: note.metaphors.map((metaphor) => ({ ...metaphor })),
    prohibitedPhrases: Array.isArray(note.prohibitedPhrases)
      ? note.prohibitedPhrases.map((phrase) => ({ ...phrase }))
      : [],
    source: note.source === undefined ? undefined : { ...note.source },
  };
}

function cloneRecallNoteSnapshots(
  notes: readonly RecallNoteSnapshot[],
): RecallNoteSnapshot[] {
  return notes.map(cloneRecallNoteSnapshot);
}

function clonePracticeRepairEntry(
  entry: PracticeRepairEntry | undefined,
): PracticeRepairEntry | undefined {
  if (entry === undefined) {
    return undefined;
  }

  return clonePracticeRepairEntryValue(entry);
}

function cloneRecallQuestion(question: RecallQuestion): RecallQuestion {
  return {
    ...question,
    answerCheck: cloneRecallAnswerCheckResult(question.answerCheck),
    noteSnapshot: cloneRecallNoteSnapshot(question.noteSnapshot),
    practiceRepairEntry: clonePracticeRepairEntry(question.practiceRepairEntry),
  };
}

function getQuestionResultId(
  sessionId: string,
  resultQuestionIndex: number,
): string {
  return `${sessionId}-question-${resultQuestionIndex}`;
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
    answerCheck: cloneRecallAnswerCheckResult(question.answerCheck),
    noteSnapshot: cloneRecallNoteSnapshot(question.noteSnapshot),
    practiceRepairEntry: clonePracticeRepairEntry(question.practiceRepairEntry),
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

function isAttemptedStudyNoteQuestion(
  question: StoredSessionResult["questions"][number],
): question is StoredSessionResult["questions"][number] & {
  selfRating: RecallSelfRating;
} {
  return (
    question.selfRating !== null &&
    question.noteSnapshot.sourceNoteId !== undefined &&
    (question.noteSnapshot.expectedAnswer ?? "").trim().length > 0
  );
}

function getPracticeFollowUpSatisfactionsByStudyNoteId(
  result: StoredSessionResult,
): Map<string, PracticeFollowUpSatisfaction> {
  const satisfactions = new Map<string, PracticeFollowUpSatisfaction>();

  result.questions.forEach((question, questionIndex) => {
    if (!isAttemptedStudyNoteQuestion(question)) {
      return;
    }

    satisfactions.set(question.noteId, {
      questionReference: {
        questionIndex,
        questionResultId: question.questionResultId,
        sessionResultId: result.id,
        studyNoteId: question.noteId,
      },
      rating: question.selfRating,
      satisfiedAt: result.completedAt,
    });
  });

  return satisfactions;
}

function satisfyActionablePracticeFollowUpsInResult(input: {
  result: StoredSessionResult;
  satisfactionsByStudyNoteId: ReadonlyMap<string, PracticeFollowUpSatisfaction>;
}): StoredSessionResult {
  let didUpdateResult = false;
  const nextResult = cloneSessionResult(input.result);
  const nextQuestions = nextResult.questions.map((question) => {
    const practiceRepairEntry = question.practiceRepairEntry;

    if (
      practiceRepairEntry === undefined ||
      !isActionablePracticeFollowUp(practiceRepairEntry)
    ) {
      return question;
    }

    const satisfaction = input.satisfactionsByStudyNoteId.get(
      practiceRepairEntry.reference.studyNoteId,
    );

    if (satisfaction === undefined) {
      return question;
    }

    didUpdateResult = true;

    return {
      ...question,
      practiceRepairEntry: satisfyPracticeRepairEntryFollowUp({
        entry: practiceRepairEntry,
        satisfaction,
      }),
    };
  });

  return didUpdateResult
    ? {
        ...nextResult,
        questions: nextQuestions,
      }
    : input.result;
}

function satisfyActionablePracticeFollowUpsFromResult(input: {
  nextResult: StoredSessionResult;
  sessionResults: readonly StoredSessionResult[];
  userId: string;
}): StoredSessionResult[] {
  const satisfactionsByStudyNoteId =
    getPracticeFollowUpSatisfactionsByStudyNoteId(input.nextResult);

  if (satisfactionsByStudyNoteId.size === 0) {
    return [...input.sessionResults];
  }

  return input.sessionResults.map((result) => {
    if (result.userId !== input.userId) {
      return result;
    }

    return satisfyActionablePracticeFollowUpsInResult({
      result,
      satisfactionsByStudyNoteId,
    });
  });
}

function getSessionResultQuestionIndex(input: {
  reference: PracticeRepairQuestionReference;
  result: StoredSessionResult;
}) {
  if (input.result.id !== input.reference.sessionResultId) {
    return null;
  }

  if (input.reference.questionResultId !== undefined) {
    const matchedQuestionIndex = input.result.questions.findIndex(
      (question) =>
        question.questionResultId === input.reference.questionResultId &&
        question.noteId === input.reference.studyNoteId,
    );

    if (matchedQuestionIndex >= 0) {
      return matchedQuestionIndex;
    }
  }

  const legacyQuestion = input.result.questions[input.reference.questionIndex];

  if (legacyQuestion?.noteId !== input.reference.studyNoteId) {
    return null;
  }

  return input.reference.questionIndex;
}

function replacePracticeRepairEntryInSessionResult(input: {
  practiceRepairEntry: PracticeRepairEntry;
  questionIndex: number;
  result: StoredSessionResult;
}): StoredSessionResult {
  const nextResult = cloneSessionResult(input.result);

  return {
    ...nextResult,
    questions: nextResult.questions.map((question, candidateQuestionIndex) =>
      candidateQuestionIndex === input.questionIndex
        ? {
            ...question,
            practiceRepairEntry: clonePracticeRepairEntryValue(
              input.practiceRepairEntry,
            ),
          }
        : question,
    ),
  };
}

function shouldSupersedeActivePracticeRepairEntry(input: {
  entry: PracticeRepairEntry;
  intent: PracticeRepairEntry["intent"];
  isConfirmedEntry: boolean;
  studyNoteId: string;
}) {
  return (
    input.entry.intent === input.intent &&
    input.entry.reference.studyNoteId === input.studyNoteId &&
    getPracticeRepairEntryLifecycleState(input.entry) === "active" &&
    !input.isConfirmedEntry
  );
}

function supersedePracticeRepairEntry(
  entry: PracticeRepairEntry,
  supersededAt: string,
): PracticeRepairEntry {
  return {
    ...clonePracticeRepairEntryValue(entry),
    lifecycle: {
      ...entry.lifecycle,
      supersededAt,
    },
  };
}

function supersedeMatchingPracticeRepairEntries(input: {
  confirmedAt: string;
  intent: PracticeRepairEntry["intent"];
  nextResult: StoredSessionResult;
  questionIndex: number;
  resultIndex: number;
  sessionResults: readonly StoredSessionResult[];
  studyNoteId: string;
  userId: string;
}): StoredSessionResult[] {
  return input.sessionResults.map((candidate, candidateIndex) => {
    if (candidate.userId !== input.userId) {
      return candidate;
    }

    const nextCandidate =
      candidateIndex === input.resultIndex
        ? input.nextResult
        : cloneSessionResult(candidate);

    return {
      ...nextCandidate,
      questions: nextCandidate.questions.map(
        (candidateQuestion, candidateQuestionIndex) => {
          const candidateEntry = candidateQuestion.practiceRepairEntry;
          const isConfirmedEntry =
            candidateIndex === input.resultIndex &&
            candidateQuestionIndex === input.questionIndex;

          if (
            candidateEntry === undefined ||
            !shouldSupersedeActivePracticeRepairEntry({
              entry: candidateEntry,
              intent: input.intent,
              isConfirmedEntry,
              studyNoteId: input.studyNoteId,
            })
          ) {
            return candidateQuestion;
          }

          return {
            ...cloneRecallQuestion(candidateQuestion),
            practiceRepairEntry: supersedePracticeRepairEntry(
              candidateEntry,
              input.confirmedAt,
            ),
          };
        },
      ),
    };
  });
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

function toRecallStudyNoteSnapshot(input: {
  labelsById: ReadonlyMap<string, AppLabel>;
  studyNote: AppStudyNote;
}): RecallNoteSnapshot {
  return {
    acceptedVariants: input.studyNote.acceptedVariants.map((variant) => ({
      ...variant,
    })),
    acronyms: input.studyNote.acronyms.map((acronym) => ({ ...acronym })),
    body: input.studyNote.expectedAnswer,
    createdAt: input.studyNote.createdAt,
    expectedAnswer: input.studyNote.expectedAnswer,
    id: input.studyNote.id,
    keyIdeas: input.studyNote.keyIdeas.map((keyIdea) => ({
      ...keyIdea,
      acceptedPhrases: [...keyIdea.acceptedPhrases],
      prohibitedPhrases: [...keyIdea.prohibitedPhrases],
    })),
    labelIds: [...input.studyNote.labelIds],
    labels: getRecallLabelSnapshots({
      labelIds: input.studyNote.labelIds,
      labelsById: input.labelsById,
    }),
    metaphors: input.studyNote.metaphors.map((metaphor) => ({ ...metaphor })),
    prompt: input.studyNote.prompt,
    prohibitedPhrases: input.studyNote.prohibitedPhrases.map((phrase) => ({
      ...phrase,
    })),
    source: { ...input.studyNote.source },
    sourceNoteId: input.studyNote.sourceNoteId,
    title: input.studyNote.prompt,
    updatedAt: input.studyNote.updatedAt,
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

function normalizeSelectedRecallTargetIds(input: {
  emptySelectionMessage: string;
  ids: readonly string[] | undefined;
}): string[] {
  if (!Array.isArray(input.ids)) {
    throw new AppRecallError("invalid_input", input.emptySelectionMessage);
  }

  const selectedIds: string[] = [];
  const seenIds = new Set<string>();

  for (const id of input.ids) {
    if (typeof id !== "string" || id.length === 0) {
      continue;
    }

    if (seenIds.has(id)) {
      continue;
    }

    seenIds.add(id);
    selectedIds.push(id);
  }

  if (selectedIds.length === 0) {
    throw new AppRecallError("invalid_input", input.emptySelectionMessage);
  }

  return selectedIds;
}

function resolveRecallableNotesFromSelection(input: {
  noteIds: readonly string[] | undefined;
  notes: AppNotesContext;
  userId: string;
}): AppNote[] {
  const selectedNoteIds = normalizeSelectedRecallTargetIds({
    emptySelectionMessage: "Choose at least one note for recall.",
    ids: input.noteIds,
  });
  const ownedNotes = listNotesForUser(input.notes.getSnapshot(), input.userId);
  const ownedNotesById = new Map(ownedNotes.map((note) => [note.id, note]));

  return selectedNoteIds.map((noteId) => {
    const note = ownedNotesById.get(noteId);

    if (note === undefined) {
      throw new AppRecallError("not_found", "Note not found.");
    }

    return note;
  });
}

function resolveRecallableStudyNotesFromSelection(input: {
  studyNoteIds: readonly string[] | undefined;
  studyNotes: AppStudyNotesContext;
  userId: string;
}): AppStudyNote[] {
  const selectedStudyNoteIds = normalizeSelectedRecallTargetIds({
    emptySelectionMessage: "Choose at least one Study Note for recall.",
    ids: input.studyNoteIds,
  });
  const ownedStudyNotes = listStudyNotesForUser(
    input.studyNotes.getSnapshot(),
    input.userId,
  );
  const ownedStudyNotesById = new Map(
    ownedStudyNotes.map((studyNote) => [studyNote.id, studyNote]),
  );

  return selectedStudyNoteIds.map((studyNoteId) => {
    const studyNote = ownedStudyNotesById.get(studyNoteId);

    if (studyNote === undefined) {
      throw new AppRecallError("not_found", "Study Note not found.");
    }

    if (!getStudyNoteReadiness(studyNote).recallable) {
      throw new AppRecallError(
        "invalid_input",
        "Add expected answer before recall.",
      );
    }

    return studyNote;
  });
}

function createRecallNoteSnapshotsFromSelection(input: {
  labelsById: ReadonlyMap<string, AppLabel>;
  noteIds: readonly string[] | undefined;
  notes: AppNotesContext;
  studyNoteIds: readonly string[] | undefined;
  studyNotes: AppStudyNotesContext | undefined;
  userId: string;
}): RecallNoteSnapshot[] {
  if (input.studyNotes !== undefined && input.studyNoteIds !== undefined) {
    return resolveRecallableStudyNotesFromSelection({
      studyNoteIds: input.studyNoteIds,
      studyNotes: input.studyNotes,
      userId: input.userId,
    }).map((studyNote) =>
      toRecallStudyNoteSnapshot({
        labelsById: input.labelsById,
        studyNote,
      }),
    );
  }

  return resolveRecallableNotesFromSelection({
    noteIds: input.noteIds,
    notes: input.notes,
    userId: input.userId,
  }).map((note) =>
    toRecallNoteSnapshot({
      labelsById: input.labelsById,
      note,
    }),
  );
}

export function createAppRecallContext(
  options: CreateAppRecallContextOptions,
): AppRecallContext {
  const storage = options.storage ?? getDefaultStorage();
  const keyPrefix = options.keyPrefix ?? DEFAULT_STORAGE_KEY_PREFIX;
  const answerCheckScorer = options.scoreAnswerCheck ?? scoreRecallAnswerCheck;
  const studyNotes = options.studyNotes;
  const recallState = createRecallState({
    activeSession: parseStoredRecallSession(
      storage?.getItem(getRecallStorageKey(keyPrefix)) ?? null,
      answerCheckScorer,
    ),
    crypto: options.crypto ?? getDefaultCrypto(),
    getLabelsForUser: options.getLabelsForUser,
    getNotesForUser: (userId) =>
      listNotesForUser(options.notes.getSnapshot(), userId),
    getStudyNotesForUser:
      studyNotes === undefined
        ? undefined
        : (userId) => listStudyNotesForUser(studyNotes.getSnapshot(), userId),
    now: options.now,
    onStudyActivity: options.onStudyActivity,
    recallSchedules: parseStoredRecallSchedules(
      storage?.getItem(getRecallSchedulesStorageKey(keyPrefix)) ?? null,
    ),
    scoreAnswerCheck: answerCheckScorer,
    sessionResults: parseStoredSessionResults(
      storage?.getItem(getSessionResultsStorageKey(keyPrefix)) ?? null,
    ),
    shuffleNotes: options.shuffleNotes ?? defaultShuffleNotes,
  });
  const listeners = new Set<RecallListener>();

  function notifyListeners() {
    for (const listener of listeners) {
      listener();
    }
  }

  function persistState() {
    const { activeSession, recallSchedules, sessionResults } =
      recallState.getPersistedState();

    storage?.setItem(
      getRecallStorageKey(keyPrefix),
      JSON.stringify(activeSession),
    );
    storage?.setItem(
      getSessionResultsStorageKey(keyPrefix),
      JSON.stringify(sessionResults),
    );
    storage?.setItem(
      getRecallSchedulesStorageKey(keyPrefix),
      JSON.stringify(recallSchedules),
    );
  }

  function hasStateChanged(input: {
    after: ReturnType<typeof recallState.getPersistedState>;
    before: ReturnType<typeof recallState.getPersistedState>;
  }) {
    return (
      input.before.activeSession !== input.after.activeSession ||
      input.before.sessionResults !== input.after.sessionResults ||
      input.before.recallSchedules !== input.after.recallSchedules
    );
  }

  function commit<TResult>(mutate: () => TResult): TResult {
    const before = recallState.getPersistedState();
    const result = mutate();
    const after = recallState.getPersistedState();

    if (hasStateChanged({ after, before })) {
      persistState();
      notifyListeners();
    }

    return result;
  }

  return {
    answerQuestion: (input) => commit(() => recallState.answerQuestion(input)),
    completePracticeRepairEntry: (input) =>
      commit(() => recallState.completePracticeRepairEntry(input)),
    completeLinkedPracticeRepairEntry: (input) =>
      commit(() => recallState.completeLinkedPracticeRepairEntry(input)),
    confirmPracticeRepairEntry: (input) =>
      commit(() => recallState.confirmPracticeRepairEntry(input)),
    dismissPracticeRepairEntry: (input) =>
      commit(() => recallState.dismissPracticeRepairEntry(input)),
    endRecallSession: (input) =>
      commit(() => recallState.endRecallSession(input)),
    endFlashCardSession: (input) =>
      commit(() => recallState.endFlashCardSession(input)),
    getSessionResult: (input) => recallState.getSessionResult(input),
    getRecallSchedulesSnapshot: () => recallState.getRecallSchedulesSnapshot(),
    getSessionResultsSnapshot: () => recallState.getSessionResultsSnapshot(),
    getSnapshot: () => recallState.getSnapshot(),
    listActivePracticeRepairEntriesForStudyNote: (input) =>
      recallState.listActivePracticeRepairEntriesForStudyNote(input),
    listPracticeRepairEntriesForQuestion: (input) =>
      recallState.listPracticeRepairEntriesForQuestion(input),
    listSessionResults: (input) => recallState.listSessionResults(input),
    listAttemptsByNote: (input) => recallState.listAttemptsByNote(input),
    rateFlashCardAnswer: (input) =>
      commit(() => recallState.rateFlashCardAnswer(input)),
    revealAnswer: (input) => commit(() => recallState.revealAnswer(input)),
    revealFlashCardAnswer: (input) =>
      commit(() => recallState.revealFlashCardAnswer(input)),
    skipFlashCardQuestion: (input) =>
      commit(() => recallState.skipFlashCardQuestion(input)),
    startFlashCardSession: (input) =>
      commit(() => recallState.startFlashCardSession(input)),
    startRecallSession: (input) =>
      commit(() => recallState.startRecallSession(input)),
    updatePracticeRepairEntryCorrection: (input) =>
      commit(() => recallState.updatePracticeRepairEntryCorrection(input)),
    updateAttemptText: (input) =>
      commit(() => recallState.updateAttemptText(input)),
    updateFlashCardAttemptText: (input) =>
      commit(() => recallState.updateFlashCardAttemptText(input)),
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}
