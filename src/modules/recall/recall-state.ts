import type { AppLabel } from "../labels/label-management/labels";
import type { AppNote } from "../notes";
import type { AppStudyNote } from "../study-notes";
import { getStudyNoteReadiness } from "../study-notes";
import {
  cloneRecallAnswerCheckResult,
  scoreRecallAnswerCheck,
  type RecallAnswerCheckResult,
} from "./recall-answer-check";
import {
  clonePracticeRepairEntry as clonePracticeRepairEntryValue,
  createPracticeRepairEntryId,
  createPracticeRepairIntentMetadata,
  getPracticeRepairEntryLifecycleState,
  isActionablePracticeFollowUp,
  isPracticeRepairEligibleQuestion,
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
import type {
  AppRecallContext,
  FlashCardRecallAttempt,
  FlashCardRecallAttemptHistoryEntry,
  FlashCardRecallAttemptsByNote,
  RecallAttempt,
  RecallLabelSnapshot,
  RecallNoteSnapshot,
  RecallQuestion,
  RecallSelfRating,
  RecallSession,
  SessionResult,
} from "./recall";

export type StoredRecallSession = RecallSession & {
  userId: string;
};

export type StoredSessionResult = SessionResult & {
  userId: string;
};

export type StoredRecallSchedule = RecallSchedule & {
  userId: string;
};

export type RecallCrypto = Pick<Crypto, "randomUUID">;

export type ShuffleNotes = (
  notes: readonly RecallNoteSnapshot[],
) => RecallNoteSnapshot[];

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
  mode?: RecallSession["mode"];
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

type PersistedRecallState = {
  activeSession: StoredRecallSession | null;
  recallSchedules: StoredRecallSchedule[];
  sessionResults: StoredSessionResult[];
};

type CreateRecallStateOptions = {
  activeSession: StoredRecallSession | null;
  crypto?: RecallCrypto;
  getLabelsForUser?: (userId: string) => readonly AppLabel[];
  getNotesForUser: (userId: string) => readonly AppNote[];
  getStudyNotesForUser?: (userId: string) => readonly AppStudyNote[];
  now?: () => Date;
  onStudyActivity?: (input: {
    recallSession: {
      createdAt: string;
      id: string;
      mode: RecallSession["mode"];
      notes: RecallSession["notes"];
    };
    userId: string;
  }) => void;
  recallSchedules: readonly StoredRecallSchedule[];
  scoreAnswerCheck?: ScoreRecallAnswerCheck;
  sessionResults: readonly StoredSessionResult[];
  shuffleNotes?: ShuffleNotes;
};

export type RecallStateContext = Omit<AppRecallContext, "subscribe"> & {
  getPersistedState: () => PersistedRecallState;
};

export class AppRecallError extends Error {
  readonly code: "invalid_input" | "not_found";

  constructor(code: "invalid_input" | "not_found", message: string) {
    super(message);
    this.code = code;
  }
}

function summarizeFlashCardAttempts(
  attempts: readonly FlashCardRecallAttempt[],
) {
  const summary = {
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

function getFirstAttemptByNoteId(attempts: readonly RecallAttempt[]) {
  const attemptsByNoteId = new Map<string, RecallAttempt>();

  for (const attempt of attempts) {
    if (!attemptsByNoteId.has(attempt.noteId)) {
      attemptsByNoteId.set(attempt.noteId, attempt);
    }
  }

  return attemptsByNoteId;
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

function cloneStoredRecallSession(
  session: StoredRecallSession | null,
): StoredRecallSession | null {
  if (session === null) {
    return null;
  }

  return {
    ...session,
    attempts: session.attempts.map((attempt) => ({ ...attempt })),
    notes: cloneRecallNoteSnapshots(session.notes),
    questions: session.questions.map(cloneRecallQuestion),
  };
}

function cloneStoredRecallSchedule(
  schedule: StoredRecallSchedule,
): StoredRecallSchedule {
  return {
    ...schedule,
  };
}

function cloneStoredRecallSchedules(
  schedules: readonly StoredRecallSchedule[],
): StoredRecallSchedule[] {
  return schedules.map(cloneStoredRecallSchedule);
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

function getQuestionResultId(
  sessionId: string,
  resultQuestionIndex: number,
): string {
  return `${sessionId}-question-${resultQuestionIndex}`;
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
  notes: readonly AppNote[];
}): AppNote[] {
  const selectedNoteIds = normalizeSelectedRecallTargetIds({
    emptySelectionMessage: "Choose at least one note for recall.",
    ids: input.noteIds,
  });
  const ownedNotesById = new Map(input.notes.map((note) => [note.id, note]));

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
  studyNotes: readonly AppStudyNote[];
}): AppStudyNote[] {
  const selectedStudyNoteIds = normalizeSelectedRecallTargetIds({
    emptySelectionMessage: "Choose at least one Study Note for recall.",
    ids: input.studyNoteIds,
  });
  const ownedStudyNotesById = new Map(
    input.studyNotes.map((studyNote) => [studyNote.id, studyNote]),
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
  getStudyNotesForUser?: (userId: string) => readonly AppStudyNote[];
  labelsById: ReadonlyMap<string, AppLabel>;
  noteIds: readonly string[] | undefined;
  notes: readonly AppNote[];
  studyNoteIds: readonly string[] | undefined;
  userId: string;
}): RecallNoteSnapshot[] {
  if (input.getStudyNotesForUser !== undefined && input.studyNoteIds !== undefined) {
    return resolveRecallableStudyNotesFromSelection({
      studyNoteIds: input.studyNoteIds,
      studyNotes: input.getStudyNotesForUser(input.userId),
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
  }).map((note) =>
    toRecallNoteSnapshot({
      labelsById: input.labelsById,
      note,
    }),
  );
}

function normalizeRecallAttemptText(text: string): string | null {
  if (text.trim().length === 0) {
    return null;
  }

  return text;
}

function createCompletedPracticeRepairEntry(
  entry: PracticeRepairEntry,
  intentMetadata = entry.intentMetadata,
): PracticeRepairEntry {
  return {
    ...entry,
    intentMetadata,
    lifecycle: {
      ...entry.lifecycle,
      completedAt: new Date().toISOString(),
    },
  };
}

function requireLinkedCompletionValue(
  value: string | null,
  message: string,
): string {
  const reference = value?.trim() ?? "";

  if (reference.length === 0) {
    throw new AppRecallError("invalid_input", message);
  }

  return reference;
}

function mergeLinkedCompletionReferences(input: {
  additions: readonly string[];
  existing: readonly string[];
  message: string;
}): string[] {
  return [...new Set([...input.existing, ...input.additions])].map(
    (reference) => requireLinkedCompletionValue(reference, input.message),
  );
}

function assertLinkedCompletionEntryIntent<
  Intent extends PracticeRepairLinkedCompletionIntent,
>(
  entry: PracticeRepairEntry,
  intent: Intent,
): asserts entry is PracticeRepairEntryForIntent<Intent> {
  if (isPracticeRepairEntryForIntent(entry, intent)) {
    return;
  }

  throw new AppRecallError(
    "invalid_input",
    "This linked action does not match the active Practice Repair intent.",
  );
}

export function createRecallState(
  options: CreateRecallStateOptions,
): RecallStateContext {
  const cryptoProvider = options.crypto ?? globalThis.crypto;
  const answerCheckScorer = options.scoreAnswerCheck ?? scoreRecallAnswerCheck;
  const shuffleNotes = options.shuffleNotes ?? defaultShuffleNotes;
  const getNow = options.now ?? (() => new Date());
  let snapshot = cloneStoredRecallSession(options.activeSession);
  let sessionResults = options.sessionResults.map(cloneSessionResult);
  let recallSchedules = cloneStoredRecallSchedules(options.recallSchedules);
  let sessionResultsSnapshot = sessionResults.map(cloneSessionResult);
  let recallSchedulesSnapshot = stripRecallScheduleUserIds(recallSchedules);

  function writeSnapshot(nextSnapshot: StoredRecallSession | null) {
    snapshot = nextSnapshot;
  }

  function writeSessionResults(nextSessionResults: StoredSessionResult[]) {
    sessionResults = nextSessionResults;
    sessionResultsSnapshot = sessionResults.map(cloneSessionResult);
  }

  function writeRecallSchedules(nextRecallSchedules: StoredRecallSchedule[]) {
    recallSchedules = nextRecallSchedules;
    recallSchedulesSnapshot = stripRecallScheduleUserIds(recallSchedules);
  }

  function updateRecallSchedule(input: {
    rating: RecallSelfRating;
    studyNoteId: string;
    userId: string;
  }) {
    const now = getNow().toISOString();
    const existingSchedule =
      recallSchedules.find(
        (schedule) =>
          schedule.userId === input.userId &&
          schedule.studyNoteId === input.studyNoteId,
      ) ??
      ({
        ...createInitialRecallSchedule({
          now,
          studyNoteId: input.studyNoteId,
        }),
        userId: input.userId,
      } satisfies StoredRecallSchedule);
    const nextSchedule = {
      ...getUpdatedRecallSchedule({
        now,
        rating: input.rating,
        schedule: existingSchedule,
      }),
      userId: input.userId,
    };

    writeRecallSchedules([
      ...recallSchedules.filter(
        (schedule) =>
          schedule.userId !== input.userId ||
          schedule.studyNoteId !== input.studyNoteId,
      ),
      nextSchedule,
    ]);
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
      .map((question, resultQuestionIndex) => ({
        ...cloneRecallQuestion(question),
        questionResultId:
          question.questionResultId ??
          getQuestionResultId(session.id, resultQuestionIndex),
      }));

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
    const nextSessionResults = [
      ...sessionResults.filter((result) => result.id !== nextResult.id),
      nextResult,
    ];

    writeSessionResults(
      satisfyActionablePracticeFollowUpsFromResult({
        nextResult,
        sessionResults: nextSessionResults,
        userId: session.userId,
      }),
    );
  }

  function endRecallSession({ sessionId, userId }: UpdateRecallSessionInput) {
    const activeSession = getActiveSessionForUser({ sessionId, userId });

    persistSessionResult(activeSession);
    writeSnapshot(null);

    return activeSession;
  }

  function getStoredPracticeRepairEntryTarget(input: {
    reference: PracticeRepairQuestionReference;
    userId: string;
  }) {
    const resultIndex = sessionResults.findIndex((candidate) => {
      return (
        candidate.userId === input.userId &&
        candidate.id === input.reference.sessionResultId
      );
    });

    if (resultIndex < 0) {
      throw new AppRecallError("not_found", "Session result not found.");
    }

    const result = sessionResults[resultIndex];
    const questionIndex = getSessionResultQuestionIndex({
      reference: input.reference,
      result,
    });

    if (questionIndex === null) {
      throw new AppRecallError("not_found", "Question result not found.");
    }

    return {
      question: result.questions[questionIndex],
      questionIndex,
      result,
      resultIndex,
    };
  }

  function updatePracticeRepairEntryForReference(input: {
    onHistoricalMessage: string;
    reference: PracticeRepairQuestionReference;
    updateEntry: (entry: PracticeRepairEntry) => PracticeRepairEntry;
    userId: string;
  }): SessionResult {
    const { question, questionIndex, result, resultIndex } =
      getStoredPracticeRepairEntryTarget({
        reference: input.reference,
        userId: input.userId,
      });
    const practiceRepairEntry = question.practiceRepairEntry;

    if (practiceRepairEntry === undefined) {
      throw new AppRecallError("not_found", "Practice Repair entry not found.");
    }

    if (
      getPracticeRepairEntryLifecycleState(practiceRepairEntry) !== "active"
    ) {
      throw new AppRecallError("invalid_input", input.onHistoricalMessage);
    }

    const nextResult = replacePracticeRepairEntryInSessionResult({
      practiceRepairEntry: input.updateEntry(
        clonePracticeRepairEntryValue(practiceRepairEntry),
      ),
      questionIndex,
      result,
    });

    writeSessionResults(
      sessionResults.map((candidate, candidateIndex) =>
        candidateIndex === resultIndex ? nextResult : candidate,
      ),
    );

    return cloneSessionResult(nextResult);
  }

  function confirmPracticeRepairEntry(
    input: ConfirmPracticeRepairEntryInput,
  ): SessionResult {
    if (!isPracticeRepairIntent(input.intent)) {
      throw new AppRecallError(
        "invalid_input",
        "Practice Repair intent is required.",
      );
    }

    const correction = input.correction.trim();
    const nextPracticeIdea = input.nextPracticeIdea?.trim();

    if (correction.length === 0) {
      throw new AppRecallError(
        "invalid_input",
        "Practice Repair correction is required.",
      );
    }

    const { question, questionIndex, result, resultIndex } =
      getStoredPracticeRepairEntryTarget({
        reference: input.reference,
        userId: input.userId,
      });

    if (!isPracticeRepairEligibleQuestion(question)) {
      throw new AppRecallError(
        "invalid_input",
        "Practice Repair is only available for weak Study Note questions.",
      );
    }

    const isRepeatedDraftConfirmation =
      question.practiceRepairEntry !== undefined;

    if (isRepeatedDraftConfirmation) {
      return cloneSessionResult(result);
    }

    const confirmedAt = new Date().toISOString();
    const confirmedReference = {
      ...input.reference,
      questionResultId:
        question.questionResultId ?? input.reference.questionResultId,
    };
    const practiceRepairEntry: PracticeRepairEntry = {
      confirmedAt,
      correction,
      intent: input.intent,
      intentMetadata: createPracticeRepairIntentMetadata(input.intent),
      nextPracticeIdea:
        nextPracticeIdea === undefined || nextPracticeIdea.length === 0
          ? undefined
          : nextPracticeIdea,
      practiceRepairEntryId: createPracticeRepairEntryId(confirmedReference),
      reference: confirmedReference,
    };
    const nextResult = replacePracticeRepairEntryInSessionResult({
      practiceRepairEntry,
      questionIndex,
      result,
    });

    writeSessionResults(
      supersedeMatchingPracticeRepairEntries({
        confirmedAt,
        intent: input.intent,
        nextResult,
        questionIndex,
        resultIndex,
        sessionResults,
        studyNoteId: input.reference.studyNoteId,
        userId: input.userId,
      }),
    );

    return cloneSessionResult(nextResult);
  }

  function updatePracticeRepairEntryCorrection(
    input: UpdatePracticeRepairEntryCorrectionInput,
  ): SessionResult {
    const correction = input.correction.trim();

    if (correction.length === 0) {
      throw new AppRecallError(
        "invalid_input",
        "Practice Repair correction is required.",
      );
    }

    return updatePracticeRepairEntryForReference({
      onHistoricalMessage: "Only active Practice Repair entries can be edited.",
      reference: input.reference,
      updateEntry: (entry) => ({
        ...entry,
        correction,
      }),
      userId: input.userId,
    });
  }

  function completePracticeRepairEntry(
    input: PracticeRepairEntryMutationInput,
  ): SessionResult {
    return updatePracticeRepairEntryForReference({
      onHistoricalMessage:
        "Only active Practice Repair entries can be completed.",
      reference: input.reference,
      updateEntry: createCompletedPracticeRepairEntry,
      userId: input.userId,
    });
  }

  function completeLinkedPracticeRepairEntry(
    input: CompleteLinkedPracticeRepairEntryInput,
  ): SessionResult {
    return updatePracticeRepairEntryForReference({
      onHistoricalMessage:
        "Only active Practice Repair entries can be completed.",
      reference: input.reference,
      updateEntry: (entry) => {
        switch (input.intent) {
          case "tighten-prompt": {
            assertLinkedCompletionEntryIntent(entry, "tighten-prompt");

            const updatedPrompt = requireLinkedCompletionValue(
              input.intentMetadata.updatedPrompt,
              "Edit prompt requires the updated prompt.",
            );

            return createCompletedPracticeRepairEntry(entry, {
              updatedPrompt,
            });
          }
          case "tighten-expected-answer": {
            assertLinkedCompletionEntryIntent(entry, "tighten-expected-answer");

            const updatedExpectedAnswer = requireLinkedCompletionValue(
              input.intentMetadata.updatedExpectedAnswer,
              "Edit expected answer requires the updated expected answer.",
            );

            return createCompletedPracticeRepairEntry(entry, {
              updatedExpectedAnswer,
            });
          }
          case "split-study-note": {
            assertLinkedCompletionEntryIntent(entry, "split-study-note");

            const existingMetadata = entry.intentMetadata;
            const createdStudyNoteIds = mergeLinkedCompletionReferences({
              additions: input.intentMetadata.createdStudyNoteIds,
              existing: existingMetadata.createdStudyNoteIds,
              message:
                "Split Study Note requires created sibling Study Note references.",
            });
            const narrowedOriginalStudyNoteAt =
              input.intentMetadata.narrowedOriginalStudyNoteAt === null
                ? existingMetadata.narrowedOriginalStudyNoteAt
                : requireLinkedCompletionValue(
                    input.intentMetadata.narrowedOriginalStudyNoteAt,
                    "Split Study Note requires the original Study Note narrowing timestamp.",
                  );
            const nextMetadata: SplitStudyNotePracticeRepairMetadata = {
              createdStudyNoteIds,
              narrowedOriginalStudyNoteAt,
            };

            return createdStudyNoteIds.length > 0 &&
              narrowedOriginalStudyNoteAt !== null
              ? createCompletedPracticeRepairEntry(entry, nextMetadata)
              : {
                  ...entry,
                  intentMetadata: nextMetadata,
                };
          }
          case "create-sibling-study-note": {
            assertLinkedCompletionEntryIntent(
              entry,
              "create-sibling-study-note",
            );

            const createdStudyNoteId = requireLinkedCompletionValue(
              input.intentMetadata.createdStudyNoteId,
              "Create sibling Study Note requires the created Study Note reference.",
            );

            return createCompletedPracticeRepairEntry(entry, {
              createdStudyNoteId,
            });
          }
          case "add-memory-aid": {
            assertLinkedCompletionEntryIntent(entry, "add-memory-aid");

            const memoryAidId = requireLinkedCompletionValue(
              input.intentMetadata.memoryAidId,
              "Add memory aid requires the created aid kind and reference.",
            );

            if (input.intentMetadata.memoryAidKind === null) {
              throw new AppRecallError(
                "invalid_input",
                "Add memory aid requires the created aid kind and reference.",
              );
            }

            return createCompletedPracticeRepairEntry(entry, {
              memoryAidId,
              memoryAidKind: input.intentMetadata.memoryAidKind,
            });
          }
        }
      },
      userId: input.userId,
    });
  }

  function dismissPracticeRepairEntry(
    input: PracticeRepairEntryMutationInput,
  ): SessionResult {
    return updatePracticeRepairEntryForReference({
      onHistoricalMessage:
        "Only active Practice Repair entries can be dismissed.",
      reference: input.reference,
      updateEntry: (entry) => ({
        ...entry,
        lifecycle: {
          ...entry.lifecycle,
          dismissedAt: new Date().toISOString(),
        },
      }),
      userId: input.userId,
    });
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
        scoreAnswerCheck: answerCheckScorer,
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

    if (
      currentNote.sourceNoteId !== undefined &&
      (currentNote.expectedAnswer ?? "").trim().length > 0
    ) {
      updateRecallSchedule({
        rating,
        studyNoteId: currentNote.id,
        userId,
      });
    }

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
        scoreAnswerCheck: answerCheckScorer,
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
        scoreAnswerCheck: answerCheckScorer,
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
        scoreAnswerCheck: answerCheckScorer,
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

    const labelsById = new Map(
      (options.getLabelsForUser?.(input.userId) ?? []).map((label) => [
        label.id,
        label,
      ]),
    );
    const noteSnapshots = createRecallNoteSnapshotsFromSelection({
      getStudyNotesForUser: options.getStudyNotesForUser,
      labelsById,
      noteIds: input.noteIds,
      notes: options.getNotesForUser(input.userId),
      studyNoteIds: input.studyNoteIds,
      userId: input.userId,
    });
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
        scoreAnswerCheck: answerCheckScorer,
      }),
      userId: input.userId,
    };

    writeSnapshot(nextSession);
    emitStudyActivity(nextSession);

    return nextSession;
  }

  return {
    answerQuestion,
    completePracticeRepairEntry,
    completeLinkedPracticeRepairEntry,
    confirmPracticeRepairEntry,
    dismissPracticeRepairEntry,
    endRecallSession,
    endFlashCardSession: endRecallSession,
    getPersistedState: () => ({
      activeSession: snapshot,
      recallSchedules,
      sessionResults,
    }),
    getSessionResult: ({ sessionResultId, userId }: GetSessionResultInput) => {
      const result = sessionResults.find((candidate) => {
        return candidate.userId === userId && candidate.id === sessionResultId;
      });

      if (result === undefined) {
        throw new AppRecallError("not_found", "Session result not found.");
      }

      return cloneSessionResult(result);
    },
    getRecallSchedulesSnapshot: () => recallSchedulesSnapshot,
    getSessionResultsSnapshot: () => sessionResultsSnapshot,
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
    listSessionResults: ({ labelId, userId }: ListSessionResultsInput) => {
      return listFilteredSessionResults({ labelId, sessionResults, userId })
        .sort((left, right) => {
          return (
            right.completedAt.localeCompare(left.completedAt) ||
            right.id.localeCompare(left.id)
          );
        })
        .map(cloneSessionResult);
    },
    listAttemptsByNote: ({ labelId, userId }: ListAttemptsByNoteInput) => {
      const currentNoteTitlesById = new Map(
        options.getNotesForUser(userId).map((note) => [note.id, note.title]),
      );
      const currentStudyNotePromptsById = new Map(
        (options.getStudyNotesForUser?.(userId) ?? []).map((studyNote) => [
          studyNote.id,
          studyNote.prompt,
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
        .map(([noteId, group]): FlashCardRecallAttemptsByNote => {
          const summary = summarizeFlashCardAttempts(
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
    rateFlashCardAnswer: answerQuestion,
    revealAnswer,
    revealFlashCardAnswer: revealAnswer,
    skipFlashCardQuestion,
    startFlashCardSession: startRecallSession,
    startRecallSession,
    updatePracticeRepairEntryCorrection,
    updateAttemptText,
    updateFlashCardAttemptText: updateAttemptText,
  };
}
