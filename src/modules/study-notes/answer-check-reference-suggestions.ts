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

type RepeatedWeakAnswer = {
  count: number;
  latestCompletedAt: string;
  text: string;
};

const MAX_SUGGESTIONS = 3;
const MIN_KEY_IDEA_TEXT_LENGTH = 12;
const MAX_NORMALIZED_PROHIBITED_PHRASE_LENGTH = 120;

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

function listExpectedAnswerSuggestionCandidates(
  cleanedExpectedAnswer: string,
): string[] {
  const sentenceCandidates = cleanedExpectedAnswer
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  if (sentenceCandidates.length > 1) {
    return sentenceCandidates;
  }

  const clauseCandidates = cleanedExpectedAnswer
    .split(/[;\n]+/)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0);

  if (clauseCandidates.length > 0) {
    return clauseCandidates;
  }

  return [cleanedExpectedAnswer];
}

function splitExpectedAnswerIntoKeyIdeaTexts(expectedAnswer: string): string[] {
  const cleanedExpectedAnswer = expectedAnswer.trim();

  if (cleanedExpectedAnswer.length === 0) {
    return [];
  }

  const candidates = listExpectedAnswerSuggestionCandidates(
    cleanedExpectedAnswer,
  );
  const seenTexts = new Set<string>();

  return candidates
    .filter((candidate) => candidate.length >= MIN_KEY_IDEA_TEXT_LENGTH)
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
    .slice(0, MAX_SUGGESTIONS);
}

function listStudyNoteRecallQuestionCandidates(input: {
  sessionResults: readonly SessionResult[];
  studyNoteId: string;
}): RecallQuestionSuggestionCandidate[] {
  const sortedResults = input.sessionResults.slice().sort((left, right) => {
    return (
      right.completedAt.localeCompare(left.completedAt) ||
      right.id.localeCompare(left.id)
    );
  });
  const candidates: RecallQuestionSuggestionCandidate[] = [];

  for (const result of sortedResults) {
    for (const question of result.questions) {
      const typedAnswer = question.typedAnswer?.trim() ?? "";
      const rating = question.selfRating;

      if (
        question.noteId !== input.studyNoteId ||
        rating === null ||
        typedAnswer.length === 0
      ) {
        continue;
      }

      candidates.push({
        completedAt: result.completedAt,
        rating,
        typedAnswer,
      });
    }
  }

  return candidates;
}

function isAcceptedVariantRecallCandidate(
  candidate: RecallQuestionSuggestionCandidate,
) {
  return candidate.rating === "good" || candidate.rating === "easy";
}

function isWeakRecallCandidate(candidate: RecallQuestionSuggestionCandidate) {
  return candidate.rating === "forgot" || candidate.rating === "hard";
}

function cloneAnswerCheckTextReference<
  TReference extends AppStudyNoteAcceptedVariant | AppStudyNoteProhibitedPhrase,
>(reference: TReference): TReference {
  return { ...reference };
}

function cloneKeyIdea(keyIdea: AppStudyNoteKeyIdea): AppStudyNoteKeyIdea {
  return {
    ...keyIdea,
    acceptedPhrases: [...keyIdea.acceptedPhrases],
    prohibitedPhrases: [...keyIdea.prohibitedPhrases],
  };
}

function inferKeyIdeaSuggestions(
  input: StudyNoteAnswerCheckSuggestionInput,
): AppStudyNoteKeyIdea[] {
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
    if (!isAcceptedVariantRecallCandidate(candidate)) {
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

    if (suggestedVariants.length >= MAX_SUGGESTIONS) {
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
  const repeatedWeakAnswers = new Map<string, RepeatedWeakAnswer>();

  for (const candidate of listStudyNoteRecallQuestionCandidates({
    sessionResults: input.sessionResults,
    studyNoteId: input.studyNoteId,
  })) {
    if (!isWeakRecallCandidate(candidate)) {
      continue;
    }

    const normalizedCandidate = normalizeSuggestionText(candidate.typedAnswer);

    if (
      normalizedCandidate.length === 0 ||
      normalizedCandidate === normalizedExpectedAnswer ||
      normalizedCandidate.length > MAX_NORMALIZED_PROHIBITED_PHRASE_LENGTH ||
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

    let latestCompletedAt = current.latestCompletedAt;

    if (candidate.completedAt > latestCompletedAt) {
      latestCompletedAt = candidate.completedAt;
    }

    repeatedWeakAnswers.set(normalizedCandidate, {
      count: current.count + 1,
      latestCompletedAt,
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
    .slice(0, MAX_SUGGESTIONS)
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
      ...input.draft.acceptedVariants.map(cloneAnswerCheckTextReference),
      ...input.suggestions.acceptedVariants.map(cloneAnswerCheckTextReference),
    ],
    keyIdeas: [
      ...input.draft.keyIdeas.map(cloneKeyIdea),
      ...input.suggestions.keyIdeas.map(cloneKeyIdea),
    ],
    prohibitedPhrases: [
      ...input.draft.prohibitedPhrases.map(cloneAnswerCheckTextReference),
      ...input.suggestions.prohibitedPhrases.map(cloneAnswerCheckTextReference),
    ],
  };
}
