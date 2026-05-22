import type { SessionResult } from "../recall";
import {
  findAcceptedVariantMatch,
  isMeaningfulAcceptedVariantCandidateText,
} from "../recall/recall-answer-check";
import type {
  AppStudyNoteAcceptedVariant,
  AppStudyNoteKeyIdea,
  AppStudyNoteProhibitedPhrase,
  UpdateStudyNoteInput,
} from "./study-notes";

type StudyNoteAnswerCheckSuggestionInput = {
  createId: () => string;
  draft: Pick<
    UpdateStudyNoteInput,
    "acceptedVariants" | "expectedAnswer" | "keyIdeas" | "prohibitedPhrases"
  >;
  sessionResults: readonly SessionResult[];
  studyNoteId: string | null;
};

export type StudyNoteAnswerCheckReferenceSuggestions = {
  acceptedVariants: AppStudyNoteAcceptedVariant[];
  keyIdeas: AppStudyNoteKeyIdea[];
  prohibitedPhrases: AppStudyNoteProhibitedPhrase[];
};

type RecallQuestionSuggestionCandidate = {
  completedAt: string;
  rating: "forgot" | "hard" | "good" | "easy";
  typedAnswer: string;
};

function normalizeSuggestionText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLocaleLowerCase();
}

function hasSavedKeyIdeas(
  keyIdeas: readonly Pick<AppStudyNoteKeyIdea, "text">[],
): boolean {
  return keyIdeas.some((keyIdea) => keyIdea.text.trim().length > 0);
}

function splitExpectedAnswerIntoKeyIdeaTexts(expectedAnswer: string): string[] {
  const cleanedExpectedAnswer = expectedAnswer.trim();

  if (cleanedExpectedAnswer.length === 0) {
    return [];
  }

  const sentenceCandidates = cleanedExpectedAnswer
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  const clauseCandidates =
    sentenceCandidates.length > 1
      ? sentenceCandidates
      : cleanedExpectedAnswer
          .split(/[;\n]+/)
          .map((clause) => clause.trim())
          .filter((clause) => clause.length > 0);

  const candidates =
    clauseCandidates.length > 0 ? clauseCandidates : [cleanedExpectedAnswer];
  const seenTexts = new Set<string>();

  return candidates
    .filter((candidate) => candidate.length >= 12)
    .filter((candidate) => {
      const normalizedCandidate = normalizeSuggestionText(candidate);

      if (
        normalizedCandidate.length === 0 ||
        seenTexts.has(normalizedCandidate)
      ) {
        return false;
      }

      seenTexts.add(normalizedCandidate);
      return true;
    })
    .slice(0, 3);
}

function listStudyNoteRecallQuestionCandidates(input: {
  sessionResults: readonly SessionResult[];
  studyNoteId: string;
}): RecallQuestionSuggestionCandidate[] {
  return input.sessionResults
    .slice()
    .sort((left, right) => {
      return (
        right.completedAt.localeCompare(left.completedAt) ||
        right.id.localeCompare(left.id)
      );
    })
    .flatMap((result) =>
      result.questions.flatMap((question) => {
        const typedAnswer = question.typedAnswer?.trim() ?? "";
        const rating = question.selfRating;

        if (
          question.noteId !== input.studyNoteId ||
          rating === null ||
          typedAnswer.length === 0
        ) {
          return [];
        }

        return [
          {
            completedAt: result.completedAt,
            rating,
            typedAnswer,
          },
        ];
      }),
    );
}

function inferKeyIdeaSuggestions(input: StudyNoteAnswerCheckSuggestionInput) {
  if (hasSavedKeyIdeas(input.draft.keyIdeas)) {
    return [];
  }

  return splitExpectedAnswerIntoKeyIdeaTexts(input.draft.expectedAnswer).map(
    (text) => ({
      acceptedPhrases: [],
      id: input.createId(),
      importance: "required" as const,
      prohibitedPhrases: [],
      text,
    }),
  );
}

function inferAcceptedVariantSuggestions(
  input: StudyNoteAnswerCheckSuggestionInput,
): AppStudyNoteAcceptedVariant[] {
  if (input.studyNoteId === null) {
    return [];
  }

  const expectedAnswer = input.draft.expectedAnswer.trim();
  const normalizedExpectedAnswer = normalizeSuggestionText(expectedAnswer);
  const suggestedVariants: AppStudyNoteAcceptedVariant[] = [];
  const seenVariantTexts = new Set<string>();

  for (const candidate of listStudyNoteRecallQuestionCandidates({
    sessionResults: input.sessionResults,
    studyNoteId: input.studyNoteId,
  })) {
    if (candidate.rating !== "good" && candidate.rating !== "easy") {
      continue;
    }

    if (!isMeaningfulAcceptedVariantCandidateText(candidate.typedAnswer)) {
      continue;
    }

    const normalizedCandidate = normalizeSuggestionText(candidate.typedAnswer);

    if (
      normalizedCandidate.length === 0 ||
      normalizedCandidate === normalizedExpectedAnswer ||
      seenVariantTexts.has(normalizedCandidate)
    ) {
      continue;
    }

    const existingVariantMatch = findAcceptedVariantMatch({
      acceptedVariants: [...input.draft.acceptedVariants, ...suggestedVariants],
      typedAnswer: candidate.typedAnswer,
    });

    if (existingVariantMatch !== undefined) {
      continue;
    }

    suggestedVariants.push({
      id: input.createId(),
      text: candidate.typedAnswer,
    });
    seenVariantTexts.add(normalizedCandidate);

    if (suggestedVariants.length >= 3) {
      break;
    }
  }

  return suggestedVariants;
}

function inferProhibitedPhraseSuggestions(
  input: StudyNoteAnswerCheckSuggestionInput,
): AppStudyNoteProhibitedPhrase[] {
  if (input.studyNoteId === null) {
    return [];
  }

  const normalizedExpectedAnswer = normalizeSuggestionText(
    input.draft.expectedAnswer,
  );
  const savedProhibitedTexts = new Set(
    input.draft.prohibitedPhrases.map((phrase) =>
      normalizeSuggestionText(phrase.text),
    ),
  );
  const repeatedWeakAnswers = new Map<
    string,
    { count: number; latestCompletedAt: string; text: string }
  >();

  for (const candidate of listStudyNoteRecallQuestionCandidates({
    sessionResults: input.sessionResults,
    studyNoteId: input.studyNoteId,
  })) {
    if (candidate.rating !== "forgot" && candidate.rating !== "hard") {
      continue;
    }

    const normalizedCandidate = normalizeSuggestionText(candidate.typedAnswer);

    if (
      normalizedCandidate.length === 0 ||
      normalizedCandidate === normalizedExpectedAnswer ||
      normalizedCandidate.length > 120 ||
      savedProhibitedTexts.has(normalizedCandidate)
    ) {
      continue;
    }

    const current = repeatedWeakAnswers.get(normalizedCandidate);

    if (current === undefined) {
      repeatedWeakAnswers.set(normalizedCandidate, {
        count: 1,
        latestCompletedAt: candidate.completedAt,
        text: candidate.typedAnswer,
      });
      continue;
    }

    repeatedWeakAnswers.set(normalizedCandidate, {
      count: current.count + 1,
      latestCompletedAt:
        candidate.completedAt > current.latestCompletedAt
          ? candidate.completedAt
          : current.latestCompletedAt,
      text: current.text,
    });
  }

  return [...repeatedWeakAnswers.values()]
    .filter((candidate) => candidate.count >= 2)
    .sort((left, right) => {
      return (
        right.count - left.count ||
        right.latestCompletedAt.localeCompare(left.latestCompletedAt) ||
        left.text.localeCompare(right.text)
      );
    })
    .slice(0, 3)
    .map((candidate) => ({
      id: input.createId(),
      text: candidate.text,
    }));
}

export function inferStudyNoteAnswerCheckReferenceSuggestions(
  input: StudyNoteAnswerCheckSuggestionInput,
): StudyNoteAnswerCheckReferenceSuggestions {
  return {
    acceptedVariants: inferAcceptedVariantSuggestions(input),
    keyIdeas: inferKeyIdeaSuggestions(input),
    prohibitedPhrases: inferProhibitedPhraseSuggestions(input),
  };
}

export function hasStudyNoteAnswerCheckReferenceSuggestions(
  suggestions: StudyNoteAnswerCheckReferenceSuggestions,
): boolean {
  return (
    suggestions.keyIdeas.length > 0 ||
    suggestions.acceptedVariants.length > 0 ||
    suggestions.prohibitedPhrases.length > 0
  );
}

export function applyStudyNoteAnswerCheckReferenceSuggestions(input: {
  draft: UpdateStudyNoteInput;
  suggestions: StudyNoteAnswerCheckReferenceSuggestions;
}): UpdateStudyNoteInput {
  return {
    ...input.draft,
    acceptedVariants: [
      ...input.draft.acceptedVariants.map((variant) => ({ ...variant })),
      ...input.suggestions.acceptedVariants.map((variant) => ({ ...variant })),
    ],
    keyIdeas: [
      ...input.draft.keyIdeas.map((keyIdea) => ({
        ...keyIdea,
        acceptedPhrases: [...keyIdea.acceptedPhrases],
        prohibitedPhrases: [...keyIdea.prohibitedPhrases],
      })),
      ...input.suggestions.keyIdeas.map((keyIdea) => ({
        ...keyIdea,
        acceptedPhrases: [...keyIdea.acceptedPhrases],
        prohibitedPhrases: [...keyIdea.prohibitedPhrases],
      })),
    ],
    prohibitedPhrases: [
      ...input.draft.prohibitedPhrases.map((phrase) => ({ ...phrase })),
      ...input.suggestions.prohibitedPhrases.map((phrase) => ({ ...phrase })),
    ],
  };
}
