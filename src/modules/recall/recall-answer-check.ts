import type {
  AppStudyNoteAcceptedVariant,
  AppStudyNoteKeyIdea,
  AppStudyNoteProhibitedPhrase,
  StudyNoteKeyIdeaImportance,
} from "../study-notes";
import type { RecallSelfRating } from "./recall";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "by",
  "da",
  "das",
  "de",
  "del",
  "do",
  "dos",
  "el",
  "en",
  "for",
  "from",
  "in",
  "into",
  "is",
  "la",
  "las",
  "los",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "of",
  "on",
  "or",
  "os",
  "para",
  "por",
  "que",
  "the",
  "to",
  "um",
  "uma",
  "unas",
  "unos",
  "with",
  "y",
]);

const BASELINE_RECALL_ANSWER_CHECK_ALGORITHM_VERSION =
  "baseline_expected_answer_v1";
const KEY_IDEA_RECALL_ANSWER_CHECK_ALGORITHM_VERSION = "key_idea_coverage_v1";
const ACCEPTED_VARIANT_RECALL_ANSWER_CHECK_ALGORITHM_VERSION =
  "expected_answer_and_accepted_variant_v2";
const KEY_IDEA_AND_ACCEPTED_VARIANT_RECALL_ANSWER_CHECK_ALGORITHM_VERSION =
  "key_idea_and_accepted_variant_v3";
const KEY_IDEA_ACCEPTED_VARIANT_AND_PROHIBITED_PHRASE_RECALL_ANSWER_CHECK_ALGORITHM_VERSION =
  "key_idea_accepted_variant_and_prohibited_phrase_v4";
const CURRENT_RECALL_ANSWER_CHECK_ALGORITHM_VERSION =
  KEY_IDEA_ACCEPTED_VARIANT_AND_PROHIBITED_PHRASE_RECALL_ANSWER_CHECK_ALGORITHM_VERSION;

const RECALL_ANSWER_CHECK_ALGORITHM_VERSIONS = [
  BASELINE_RECALL_ANSWER_CHECK_ALGORITHM_VERSION,
  KEY_IDEA_RECALL_ANSWER_CHECK_ALGORITHM_VERSION,
  ACCEPTED_VARIANT_RECALL_ANSWER_CHECK_ALGORITHM_VERSION,
  KEY_IDEA_AND_ACCEPTED_VARIANT_RECALL_ANSWER_CHECK_ALGORITHM_VERSION,
  CURRENT_RECALL_ANSWER_CHECK_ALGORITHM_VERSION,
] as const;

export type RecallAnswerCheckAlgorithmVersion =
  (typeof RECALL_ANSWER_CHECK_ALGORITHM_VERSIONS)[number];

export type RecallAnswerCheckStatus =
  | "likely_correct"
  | "uncertain"
  | "likely_incomplete";

export type RecallAnswerCheckConfidence = "low" | "medium" | "high";

export type RecallAnswerCheckSuggestedSelfRating = Exclude<
  RecallSelfRating,
  "easy"
>;

export type RecallAnswerCheckReason =
  | "accepted_variant_close_match"
  | "expected_answer_exact_match"
  | "expected_answer_close_match"
  | "expected_answer_partial_match"
  | "expected_answer_short_attempt"
  | "expected_answer_low_coverage"
  | "key_idea_concepts_covered"
  | "key_idea_prohibited_phrase_match"
  | "key_idea_required_missing"
  | "key_idea_supporting_partial"
  | "study_note_prohibited_phrase_match";

export type RecallAnswerCheckConcept = {
  id: string;
  importance: StudyNoteKeyIdeaImportance;
  text: string;
};

export type RecallAnswerCheckMatchedProhibitedPhrase = {
  concept?: RecallAnswerCheckConcept;
  scope: "study_note" | "key_idea";
  text: string;
};

export type RecallAnswerCheckEvidence = {
  contradictedConcepts?: RecallAnswerCheckConcept[];
  coveredConcepts?: RecallAnswerCheckConcept[];
  matchedExpectedTerms: string[];
  matchedProhibitedPhrases?: RecallAnswerCheckMatchedProhibitedPhrase[];
  missingConcepts?: RecallAnswerCheckConcept[];
  missingExpectedTerms: string[];
  notDetectedExpectedTerms?: string[];
  partialConcepts?: RecallAnswerCheckConcept[];
  phraseCoverage: number;
  tfidfCosineSimilarity: number;
  tokenCoverage: number;
};

export type RecallAnswerCheckResult = {
  algorithmVersion: RecallAnswerCheckAlgorithmVersion;
  confidence: RecallAnswerCheckConfidence;
  evidence: RecallAnswerCheckEvidence;
  matchedAcceptedVariant?: AppStudyNoteAcceptedVariant;
  primaryReason: RecallAnswerCheckReason;
  status: RecallAnswerCheckStatus;
  suggestedSelfRating: RecallAnswerCheckSuggestedSelfRating;
};

type AnswerCheckToken = {
  display: string;
  normalized: string;
};

type ScoreRecallAnswerCheckInput = {
  acceptedVariants?: readonly AppStudyNoteAcceptedVariant[];
  expectedAnswer: string;
  keyIdeas?: readonly AppStudyNoteKeyIdea[];
  prohibitedPhrases?: readonly AppStudyNoteProhibitedPhrase[];
  typedAnswer: string;
};

type AcceptedVariantMatchInput = {
  acceptedVariants: readonly AppStudyNoteAcceptedVariant[];
  typedAnswer: string;
};

type RecallAnswerCheckAssessment = {
  confidence: RecallAnswerCheckConfidence;
  primaryReason: RecallAnswerCheckReason;
  status: RecallAnswerCheckStatus;
};

type RecallAnswerCheckConceptCoverageState = "covered" | "partial" | "missing";

type AnswerCheckTextContext = {
  normalized: string;
  terms: AnswerCheckToken[];
  tokens: AnswerCheckToken[];
};

type AnswerCheckReferenceMatch = {
  containsExactPhrase: boolean;
  exactMatch: boolean;
  matchedTerms: AnswerCheckToken[];
  phraseCoverage: number;
  referenceIsShort: boolean;
  similarity: number;
  tfidfCosineSimilarity: number;
  tokenCoverage: number;
};

type RecallAnswerCheckConceptCoverage = {
  contradictedConcepts: RecallAnswerCheckConcept[];
  coveredConcepts: RecallAnswerCheckConcept[];
  missingConcepts: RecallAnswerCheckConcept[];
  partialConcepts: RecallAnswerCheckConcept[];
  requiredMissingCount: number;
  requiredPartialCount: number;
  supportingMissingCount: number;
};

type RecallAnswerCheckProhibitedPhraseMatches = {
  contradictedKeyIdeaIds: ReadonlySet<string>;
  contradictedConcepts: RecallAnswerCheckConcept[];
  hasStudyNoteMatch: boolean;
  matchedProhibitedPhrases: RecallAnswerCheckMatchedProhibitedPhrase[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item: unknown) => typeof item === "string")
  );
}

function isRecallAnswerCheckStatus(
  value: unknown,
): value is RecallAnswerCheckStatus {
  return (
    value === "likely_correct" ||
    value === "uncertain" ||
    value === "likely_incomplete"
  );
}

function isRecallAnswerCheckConfidence(
  value: unknown,
): value is RecallAnswerCheckConfidence {
  return value === "low" || value === "medium" || value === "high";
}

function isRecallAnswerCheckAlgorithmVersion(
  value: unknown,
): value is RecallAnswerCheckAlgorithmVersion {
  return (
    typeof value === "string" &&
    RECALL_ANSWER_CHECK_ALGORITHM_VERSIONS.includes(
      value as RecallAnswerCheckAlgorithmVersion,
    )
  );
}

function isRecallAnswerCheckReason(
  value: unknown,
): value is RecallAnswerCheckReason {
  return (
    value === "accepted_variant_close_match" ||
    value === "expected_answer_exact_match" ||
    value === "expected_answer_close_match" ||
    value === "expected_answer_partial_match" ||
    value === "expected_answer_short_attempt" ||
    value === "expected_answer_low_coverage" ||
    value === "key_idea_concepts_covered" ||
    value === "key_idea_prohibited_phrase_match" ||
    value === "key_idea_required_missing" ||
    value === "key_idea_supporting_partial" ||
    value === "study_note_prohibited_phrase_match"
  );
}

function isRecallAnswerCheckSuggestedSelfRating(
  value: unknown,
): value is RecallAnswerCheckSuggestedSelfRating {
  return value === "forgot" || value === "hard" || value === "good";
}

function isAcceptedVariantReference(
  value: unknown,
): value is AppStudyNoteAcceptedVariant {
  const candidate = asRecord(value);

  return (
    candidate !== null &&
    typeof candidate.id === "string" &&
    typeof candidate.text === "string"
  );
}

function isRecallAnswerCheckConcept(
  value: unknown,
): value is RecallAnswerCheckConcept {
  const candidate = asRecord(value);

  return (
    candidate !== null &&
    typeof candidate.id === "string" &&
    typeof candidate.text === "string" &&
    (candidate.importance === "required" ||
      candidate.importance === "supporting")
  );
}

function isRecallAnswerCheckConceptArray(
  value: unknown,
): value is RecallAnswerCheckConcept[] {
  return (
    Array.isArray(value) &&
    value.every((item: unknown) => isRecallAnswerCheckConcept(item))
  );
}

function isRecallAnswerCheckMatchedProhibitedPhrase(
  value: unknown,
): value is RecallAnswerCheckMatchedProhibitedPhrase {
  const candidate = asRecord(value);

  return (
    candidate !== null &&
    typeof candidate.text === "string" &&
    (candidate.scope === "study_note" || candidate.scope === "key_idea") &&
    (!("concept" in candidate) ||
      candidate.concept === undefined ||
      isRecallAnswerCheckConcept(candidate.concept))
  );
}

function isRecallAnswerCheckMatchedProhibitedPhraseArray(
  value: unknown,
): value is RecallAnswerCheckMatchedProhibitedPhrase[] {
  return (
    Array.isArray(value) &&
    value.every((item: unknown) =>
      isRecallAnswerCheckMatchedProhibitedPhrase(item),
    )
  );
}

export function isRecallAnswerCheckResult(
  value: unknown,
): value is RecallAnswerCheckResult {
  const candidate = asRecord(value);
  const evidence = asRecord(candidate?.evidence);

  return (
    candidate !== null &&
    isRecallAnswerCheckAlgorithmVersion(candidate.algorithmVersion) &&
    isRecallAnswerCheckConfidence(candidate.confidence) &&
    isRecallAnswerCheckReason(candidate.primaryReason) &&
    isRecallAnswerCheckStatus(candidate.status) &&
    isRecallAnswerCheckSuggestedSelfRating(candidate.suggestedSelfRating) &&
    (!("matchedAcceptedVariant" in candidate) ||
      candidate.matchedAcceptedVariant === undefined ||
      isAcceptedVariantReference(candidate.matchedAcceptedVariant)) &&
    evidence !== null &&
    (!("contradictedConcepts" in evidence) ||
      isRecallAnswerCheckConceptArray(evidence.contradictedConcepts)) &&
    (!("coveredConcepts" in evidence) ||
      isRecallAnswerCheckConceptArray(evidence.coveredConcepts)) &&
    isStringArray(evidence.matchedExpectedTerms) &&
    (!("matchedProhibitedPhrases" in evidence) ||
      isRecallAnswerCheckMatchedProhibitedPhraseArray(
        evidence.matchedProhibitedPhrases,
      )) &&
    (!("missingConcepts" in evidence) ||
      isRecallAnswerCheckConceptArray(evidence.missingConcepts)) &&
    isStringArray(evidence.missingExpectedTerms) &&
    (!("notDetectedExpectedTerms" in evidence) ||
      isStringArray(evidence.notDetectedExpectedTerms)) &&
    (!("partialConcepts" in evidence) ||
      isRecallAnswerCheckConceptArray(evidence.partialConcepts)) &&
    typeof evidence.phraseCoverage === "number" &&
    typeof evidence.tfidfCosineSimilarity === "number" &&
    typeof evidence.tokenCoverage === "number"
  );
}

export function cloneRecallAnswerCheckResult(
  answerCheck: RecallAnswerCheckResult | undefined,
): RecallAnswerCheckResult | undefined {
  if (answerCheck === undefined) {
    return undefined;
  }

  const { matchedAcceptedVariant, ...answerCheckWithoutMatchedVariant } =
    answerCheck;
  const clonedAnswerCheck: RecallAnswerCheckResult = {
    ...answerCheckWithoutMatchedVariant,
    evidence: {
      ...answerCheck.evidence,
      contradictedConcepts: cloneRecallAnswerCheckConcepts(
        answerCheck.evidence.contradictedConcepts,
      ),
      coveredConcepts: cloneRecallAnswerCheckConcepts(
        answerCheck.evidence.coveredConcepts,
      ),
      matchedExpectedTerms: [...answerCheck.evidence.matchedExpectedTerms],
      matchedProhibitedPhrases: cloneRecallAnswerCheckMatchedProhibitedPhrases(
        answerCheck.evidence.matchedProhibitedPhrases,
      ),
      missingConcepts: cloneRecallAnswerCheckConcepts(
        answerCheck.evidence.missingConcepts,
      ),
      missingExpectedTerms: [...answerCheck.evidence.missingExpectedTerms],
      notDetectedExpectedTerms: [
        ...(answerCheck.evidence.notDetectedExpectedTerms ?? []),
      ],
      partialConcepts: cloneRecallAnswerCheckConcepts(
        answerCheck.evidence.partialConcepts,
      ),
    },
  };

  if (matchedAcceptedVariant !== undefined) {
    clonedAnswerCheck.matchedAcceptedVariant = { ...matchedAcceptedVariant };
  }

  return clonedAnswerCheck;
}

function cloneRecallAnswerCheckConcepts(
  concepts: readonly RecallAnswerCheckConcept[] | undefined,
): RecallAnswerCheckConcept[] {
  return (concepts ?? []).map((concept) => ({ ...concept }));
}

function cloneRecallAnswerCheckMatchedProhibitedPhrases(
  matches: readonly RecallAnswerCheckMatchedProhibitedPhrase[] | undefined,
): RecallAnswerCheckMatchedProhibitedPhrase[] {
  return (matches ?? []).map((match) => ({
    ...match,
    concept: match.concept === undefined ? undefined : { ...match.concept },
  }));
}

function normalizeRecallAnswerCheckText(text: string): string {
  return text
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .replace(/['’`]/gu, "")
    .replace(/[-_/]+/gu, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeAnswerCheckText(text: string): AnswerCheckToken[] {
  const matches = text.match(/[\p{L}\p{N}]+/gu) ?? [];

  return matches
    .map((token) => ({
      display: token,
      normalized: normalizeRecallAnswerCheckText(token),
    }))
    .filter((token) => token.normalized.length > 0);
}

function createAnswerCheckTextContext(text: string): AnswerCheckTextContext {
  const tokens = tokenizeAnswerCheckText(text);

  return {
    normalized: normalizeRecallAnswerCheckText(text),
    terms: getDistinctiveTerms(tokens),
    tokens,
  };
}

function getUniqueTerms(
  tokens: readonly AnswerCheckToken[],
  options: { includeStopWords: boolean; minimumLength: number },
): AnswerCheckToken[] {
  const terms: AnswerCheckToken[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const normalized = token.normalized;
    const isNumeric = /^\d+$/.test(normalized);

    if (
      normalized.length < options.minimumLength &&
      !isNumeric &&
      !/^[a-z0-9]{2,3}$/i.test(token.display)
    ) {
      continue;
    }

    if (!options.includeStopWords && STOP_WORDS.has(normalized)) {
      continue;
    }

    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    terms.push(token);
  }

  return terms;
}

function getDistinctiveTerms(tokens: readonly AnswerCheckToken[]) {
  const contentTerms = getUniqueTerms(tokens, {
    includeStopWords: false,
    minimumLength: 3,
  });

  if (contentTerms.length > 0) {
    return contentTerms;
  }

  return getUniqueTerms(tokens, {
    includeStopWords: true,
    minimumLength: 2,
  });
}

function computeLevenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  if (left.length === 0) {
    return right.length;
  }

  if (right.length === 0) {
    return left.length;
  }

  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );
  const current = new Array<number>(right.length + 1).fill(0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }

    for (let index = 0; index < current.length; index += 1) {
      previous[index] = current[index] ?? 0;
    }
  }

  return previous[right.length] ?? 0;
}

function getLevenshteinSimilarity(left: string, right: string): number {
  const maxLength = Math.max(left.length, right.length);

  if (maxLength === 0) {
    return 1;
  }

  return 1 - computeLevenshteinDistance(left, right) / maxLength;
}

function toCharacterBigrams(text: string): string[] {
  if (text.length < 2) {
    return text.length === 0 ? [] : [text];
  }

  const paddedText = ` ${text} `;
  const bigrams: string[] = [];

  for (let index = 0; index < paddedText.length - 1; index += 1) {
    bigrams.push(paddedText.slice(index, index + 2));
  }

  return bigrams;
}

function getDiceSimilarity(left: string, right: string): number {
  if (left === right) {
    return 1;
  }

  const leftBigrams = toCharacterBigrams(left);
  const rightBigrams = toCharacterBigrams(right);

  if (leftBigrams.length === 0 || rightBigrams.length === 0) {
    return 0;
  }

  const rightCounts = new Map<string, number>();

  for (const bigram of rightBigrams) {
    rightCounts.set(bigram, (rightCounts.get(bigram) ?? 0) + 1);
  }

  let overlap = 0;

  for (const bigram of leftBigrams) {
    const remaining = rightCounts.get(bigram) ?? 0;

    if (remaining > 0) {
      overlap += 1;
      rightCounts.set(bigram, remaining - 1);
    }
  }

  return (2 * overlap) / (leftBigrams.length + rightBigrams.length);
}

function getTokenSimilarityThreshold(token: string): number {
  if (token.length <= 3) {
    return 1;
  }

  if (token.length === 4) {
    return 0.92;
  }

  return 0.84;
}

function getBestTokenSimilarity(
  expected: string,
  answerTerms: readonly AnswerCheckToken[],
): number {
  let bestSimilarity = 0;

  for (const answerTerm of answerTerms) {
    if (answerTerm.normalized === expected) {
      return 1;
    }

    const similarity = getLevenshteinSimilarity(
      expected,
      answerTerm.normalized,
    );

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
    }
  }

  return bestSimilarity;
}

function isMatchedExpectedTerm(
  expectedTerm: AnswerCheckToken,
  answerTerms: readonly AnswerCheckToken[],
): boolean {
  return (
    getBestTokenSimilarity(expectedTerm.normalized, answerTerms) >=
    getTokenSimilarityThreshold(expectedTerm.normalized)
  );
}

function buildMeaningfulPhrases(tokens: readonly AnswerCheckToken[]): string[] {
  const filteredTokens = tokens.filter(
    (token) => !STOP_WORDS.has(token.normalized),
  );

  if (filteredTokens.length < 2) {
    return [];
  }

  const phrases: string[] = [];
  const seen = new Set<string>();

  for (let size = 3; size >= 2; size -= 1) {
    for (let index = 0; index <= filteredTokens.length - size; index += 1) {
      const phrase = filteredTokens
        .slice(index, index + size)
        .map((token) => token.normalized)
        .join(" ");

      if (phrase.length === 0 || seen.has(phrase)) {
        continue;
      }

      seen.add(phrase);
      phrases.push(phrase);
    }
  }

  return phrases.slice(0, 6);
}

function getPhraseCoverage(input: {
  answerNormalized: string;
  answerTokens: readonly AnswerCheckToken[];
  expectedTokens: readonly AnswerCheckToken[];
}): number {
  const phrases = buildMeaningfulPhrases(input.expectedTokens);

  if (phrases.length === 0) {
    return 0;
  }

  const answerPhraseCandidates = Array.from(
    new Set(
      buildMeaningfulPhrases(input.answerTokens).concat(input.answerNormalized),
    ),
  );
  const answerPhrases = new Set(answerPhraseCandidates);
  let matchedPhraseCount = 0;

  for (const phrase of phrases) {
    if (input.answerNormalized.includes(phrase) || answerPhrases.has(phrase)) {
      matchedPhraseCount += 1;
      continue;
    }

    const bestSimilarity = answerPhraseCandidates.reduce((best, candidate) => {
      return Math.max(best, getDiceSimilarity(phrase, candidate));
    }, 0);

    if (bestSimilarity >= 0.78) {
      matchedPhraseCount += 1;
    }
  }

  return matchedPhraseCount / phrases.length;
}

function getTermFrequencyMap(tokens: readonly AnswerCheckToken[]) {
  const map = new Map<string, number>();

  for (const token of tokens) {
    map.set(token.normalized, (map.get(token.normalized) ?? 0) + 1);
  }

  return map;
}

function getTfIdfCosineSimilarity(
  expectedTerms: readonly AnswerCheckToken[],
  answerTerms: readonly AnswerCheckToken[],
): number {
  if (expectedTerms.length === 0 || answerTerms.length === 0) {
    return 0;
  }

  const expectedFrequencies = getTermFrequencyMap(expectedTerms);
  const answerFrequencies = getTermFrequencyMap(answerTerms);
  const vocabulary = new Set([
    ...expectedFrequencies.keys(),
    ...answerFrequencies.keys(),
  ]);
  const documentCount = 2;
  let dotProduct = 0;
  let expectedMagnitude = 0;
  let answerMagnitude = 0;

  for (const term of vocabulary) {
    const documentFrequency =
      (expectedFrequencies.has(term) ? 1 : 0) +
      (answerFrequencies.has(term) ? 1 : 0);
    const inverseDocumentFrequency =
      Math.log((documentCount + 1) / (documentFrequency + 1)) + 1;
    const expectedWeight =
      (expectedFrequencies.get(term) ?? 0) * inverseDocumentFrequency;
    const answerWeight =
      (answerFrequencies.get(term) ?? 0) * inverseDocumentFrequency;

    dotProduct += expectedWeight * answerWeight;
    expectedMagnitude += expectedWeight * expectedWeight;
    answerMagnitude += answerWeight * answerWeight;
  }

  if (expectedMagnitude === 0 || answerMagnitude === 0) {
    return 0;
  }

  return dotProduct / Math.sqrt(expectedMagnitude * answerMagnitude);
}

function getSuggestedSelfRating(input: {
  isMeaningfulAttempt: boolean;
  status: RecallAnswerCheckStatus;
}): RecallAnswerCheckSuggestedSelfRating {
  if (input.status === "likely_correct") {
    return "good";
  }

  if (input.status === "uncertain") {
    return "hard";
  }

  return input.isMeaningfulAttempt ? "hard" : "forgot";
}

function getMissingExpectedTerms(input: {
  expectedTerms: readonly AnswerCheckToken[];
  matchedExpectedTerms: readonly AnswerCheckToken[];
}): AnswerCheckToken[] {
  const matchedTermKeys = new Set(
    input.matchedExpectedTerms.map((term) => term.normalized),
  );

  return input.expectedTerms.filter(
    (expectedTerm) => !matchedTermKeys.has(expectedTerm.normalized),
  );
}

function getTokenCoverage(input: {
  expectedTermCount: number;
  matchedExpectedTermCount: number;
}) {
  if (input.expectedTermCount === 0) {
    return 0;
  }

  return input.matchedExpectedTermCount / input.expectedTermCount;
}

function containsNormalizedPhrase(
  haystackNormalized: string,
  needleNormalized: string,
) {
  if (needleNormalized.length === 0) {
    return false;
  }

  return ` ${haystackNormalized} `.includes(` ${needleNormalized} `);
}

function getMatchedProhibitedPhraseText(
  answerNormalized: string,
  prohibitedPhrase: string,
) {
  const phraseText = prohibitedPhrase.trim();
  const normalizedPhrase = normalizeRecallAnswerCheckText(phraseText);

  if (normalizedPhrase.length === 0) {
    return undefined;
  }

  return containsNormalizedPhrase(answerNormalized, normalizedPhrase)
    ? phraseText
    : undefined;
}

function getReferenceMatch(input: {
  answer: AnswerCheckTextContext;
  reference: AnswerCheckTextContext;
}): AnswerCheckReferenceMatch {
  const matchedTerms = input.reference.terms.filter((referenceTerm) =>
    isMatchedExpectedTerm(referenceTerm, input.answer.terms),
  );

  return {
    containsExactPhrase: containsNormalizedPhrase(
      input.answer.normalized,
      input.reference.normalized,
    ),
    exactMatch: input.reference.normalized === input.answer.normalized,
    matchedTerms,
    phraseCoverage: getPhraseCoverage({
      answerNormalized: input.answer.normalized,
      answerTokens: input.answer.tokens,
      expectedTokens: input.reference.tokens,
    }),
    referenceIsShort:
      input.reference.terms.length <= 2 ||
      input.reference.normalized.length <= 24,
    similarity: getDiceSimilarity(
      input.reference.normalized,
      input.answer.normalized,
    ),
    tfidfCosineSimilarity: getTfIdfCosineSimilarity(
      input.reference.terms,
      input.answer.terms,
    ),
    tokenCoverage: getTokenCoverage({
      expectedTermCount: input.reference.terms.length,
      matchedExpectedTermCount: matchedTerms.length,
    }),
  };
}

function isStrongReferenceMatch(match: AnswerCheckReferenceMatch) {
  return (
    match.tokenCoverage >= 0.82 &&
    (match.phraseCoverage >= 0.5 ||
      match.tfidfCosineSimilarity >= 0.55 ||
      match.similarity >= 0.75)
  );
}

function isPartialReferenceMatch(match: AnswerCheckReferenceMatch) {
  return (
    match.tokenCoverage >= 0.5 &&
    (match.phraseCoverage >= 0.25 ||
      match.tfidfCosineSimilarity >= 0.3 ||
      match.similarity >= 0.5)
  );
}

function isAcceptedVariantCloseMatch(match: AnswerCheckReferenceMatch) {
  if (match.exactMatch || match.containsExactPhrase) {
    return true;
  }

  if (match.tokenCoverage < 0.75) {
    return false;
  }

  return (
    match.phraseCoverage >= 0.45 ||
    match.tfidfCosineSimilarity >= 0.5 ||
    match.similarity >= 0.72
  );
}

function isBetterAcceptedVariantMatch(
  candidate: AnswerCheckReferenceMatch,
  currentBest: AnswerCheckReferenceMatch,
): boolean {
  if (candidate.exactMatch !== currentBest.exactMatch) {
    return candidate.exactMatch;
  }

  if (candidate.tokenCoverage !== currentBest.tokenCoverage) {
    return candidate.tokenCoverage > currentBest.tokenCoverage;
  }

  if (candidate.phraseCoverage !== currentBest.phraseCoverage) {
    return candidate.phraseCoverage > currentBest.phraseCoverage;
  }

  return candidate.similarity > currentBest.similarity;
}

function isFullTermKeyIdeaMatch(match: AnswerCheckReferenceMatch) {
  return (
    match.tokenCoverage >= 1 &&
    (match.referenceIsShort ||
      match.phraseCoverage >= 0.25 ||
      match.tfidfCosineSimilarity >= 0.2 ||
      match.similarity >= 0.4)
  );
}

function isStrongKeyIdeaMatch(match: AnswerCheckReferenceMatch) {
  return (
    isStrongReferenceMatch(match) ||
    (match.tokenCoverage >= 0.82 &&
      (match.phraseCoverage >= 0.2 ||
        match.tfidfCosineSimilarity >= 0.2 ||
        match.similarity >= 0.45))
  );
}

function isPartialKeyIdeaMatch(match: AnswerCheckReferenceMatch) {
  return (
    match.matchedTerms.length > 0 &&
    (isPartialReferenceMatch(match) ||
      match.tfidfCosineSimilarity >= 0.18 ||
      match.similarity >= 0.32)
  );
}

function toRecallAnswerCheckConcept(
  keyIdea: AppStudyNoteKeyIdea,
): RecallAnswerCheckConcept {
  return {
    id: keyIdea.id,
    importance: keyIdea.importance,
    text: keyIdea.text,
  };
}

function getProhibitedPhraseMatches(input: {
  answer: AnswerCheckTextContext;
  keyIdeas: readonly AppStudyNoteKeyIdea[];
  prohibitedPhrases: readonly AppStudyNoteProhibitedPhrase[];
}): RecallAnswerCheckProhibitedPhraseMatches {
  const matchedProhibitedPhrases: RecallAnswerCheckMatchedProhibitedPhrase[] =
    [];
  const contradictedConcepts: RecallAnswerCheckConcept[] = [];
  const contradictedKeyIdeaIds = new Set<string>();
  const seenMatches = new Set<string>();
  let hasStudyNoteMatch = false;

  function addMatchedProhibitedPhrase(
    match: RecallAnswerCheckMatchedProhibitedPhrase,
  ) {
    const matchKey = [
      match.scope,
      match.concept?.id ?? "",
      normalizeRecallAnswerCheckText(match.text),
    ].join(":");

    if (seenMatches.has(matchKey)) {
      return;
    }

    seenMatches.add(matchKey);
    matchedProhibitedPhrases.push(match);
  }

  for (const prohibitedPhrase of input.prohibitedPhrases) {
    const matchedText = getMatchedProhibitedPhraseText(
      input.answer.normalized,
      prohibitedPhrase.text,
    );

    if (matchedText === undefined) {
      continue;
    }

    hasStudyNoteMatch = true;
    addMatchedProhibitedPhrase({
      scope: "study_note",
      text: matchedText,
    });
  }

  for (const keyIdea of input.keyIdeas) {
    const concept = toRecallAnswerCheckConcept(keyIdea);

    for (const prohibitedPhrase of keyIdea.prohibitedPhrases) {
      const matchedText = getMatchedProhibitedPhraseText(
        input.answer.normalized,
        prohibitedPhrase,
      );

      if (matchedText === undefined) {
        continue;
      }

      if (!contradictedKeyIdeaIds.has(keyIdea.id)) {
        contradictedKeyIdeaIds.add(keyIdea.id);
        contradictedConcepts.push(concept);
      }

      addMatchedProhibitedPhrase({
        concept,
        scope: "key_idea",
        text: matchedText,
      });
    }
  }

  return {
    contradictedKeyIdeaIds,
    contradictedConcepts,
    hasStudyNoteMatch,
    matchedProhibitedPhrases,
  };
}

function getKeyIdeaCoverageState(input: {
  answer: AnswerCheckTextContext;
  keyIdea: AppStudyNoteKeyIdea;
}): RecallAnswerCheckConceptCoverageState {
  const candidates = [input.keyIdea.text, ...input.keyIdea.acceptedPhrases];
  let bestState: RecallAnswerCheckConceptCoverageState = "missing";

  for (const candidateText of candidates) {
    const candidate = createAnswerCheckTextContext(candidateText);
    const match = getReferenceMatch({
      answer: input.answer,
      reference: candidate,
    });

    if (
      match.exactMatch ||
      match.containsExactPhrase ||
      isFullTermKeyIdeaMatch(match) ||
      isStrongKeyIdeaMatch(match)
    ) {
      return "covered";
    }

    if (bestState !== "partial" && isPartialKeyIdeaMatch(match)) {
      bestState = "partial";
    }
  }

  return bestState;
}

function getKeyIdeaCoverage(input: {
  answer: AnswerCheckTextContext;
  keyIdeas: readonly AppStudyNoteKeyIdea[];
  prohibitedPhraseMatches: RecallAnswerCheckProhibitedPhraseMatches;
}): RecallAnswerCheckConceptCoverage {
  const contradictedConcepts = cloneRecallAnswerCheckConcepts(
    input.prohibitedPhraseMatches.contradictedConcepts,
  );
  const coveredConcepts: RecallAnswerCheckConcept[] = [];
  const partialConcepts: RecallAnswerCheckConcept[] = [];
  const missingConcepts: RecallAnswerCheckConcept[] = [];
  let requiredMissingCount = 0;
  let requiredPartialCount = 0;
  let supportingMissingCount = 0;

  for (const keyIdea of input.keyIdeas) {
    if (input.prohibitedPhraseMatches.contradictedKeyIdeaIds.has(keyIdea.id)) {
      continue;
    }

    const concept = toRecallAnswerCheckConcept(keyIdea);
    const coverageState = getKeyIdeaCoverageState({
      answer: input.answer,
      keyIdea,
    });

    switch (coverageState) {
      case "covered":
        coveredConcepts.push(concept);
        break;
      case "partial":
        partialConcepts.push(concept);
        if (keyIdea.importance === "required") {
          requiredPartialCount += 1;
        }
        break;
      case "missing":
        missingConcepts.push(concept);
        if (keyIdea.importance === "required") {
          requiredMissingCount += 1;
        } else {
          supportingMissingCount += 1;
        }
        break;
    }
  }

  return {
    contradictedConcepts,
    coveredConcepts,
    missingConcepts,
    partialConcepts,
    requiredMissingCount,
    requiredPartialCount,
    supportingMissingCount,
  };
}

function getMatchedAcceptedVariant(input: {
  acceptedVariants: readonly AppStudyNoteAcceptedVariant[];
  answer: AnswerCheckTextContext;
}):
  | {
      match: AnswerCheckReferenceMatch;
      variant: AppStudyNoteAcceptedVariant;
    }
  | undefined {
  let bestMatch:
    | {
        match: AnswerCheckReferenceMatch;
        variant: AppStudyNoteAcceptedVariant;
      }
    | undefined;

  for (const variant of input.acceptedVariants) {
    const reference = createAnswerCheckTextContext(variant.text);

    if (reference.normalized.length === 0) {
      continue;
    }

    const match = getReferenceMatch({
      answer: input.answer,
      reference,
    });

    if (!isAcceptedVariantCloseMatch(match)) {
      continue;
    }

    if (
      bestMatch === undefined ||
      isBetterAcceptedVariantMatch(match, bestMatch.match)
    ) {
      bestMatch = {
        match,
        variant,
      };
    }
  }

  return bestMatch;
}

export function findAcceptedVariantMatch(
  input: AcceptedVariantMatchInput,
): AppStudyNoteAcceptedVariant | undefined {
  const answer = createAnswerCheckTextContext(input.typedAnswer);

  if (answer.normalized.length === 0) {
    return undefined;
  }

  return getMatchedAcceptedVariant({
    acceptedVariants: input.acceptedVariants,
    answer,
  })?.variant;
}

export function isMeaningfulAcceptedVariantCandidateText(
  text: string,
): boolean {
  const normalized = normalizeRecallAnswerCheckText(text);

  if (normalized.length === 0) {
    return false;
  }

  const terms = getDistinctiveTerms(tokenizeAnswerCheckText(text));

  return terms.length >= 2 || normalized.length >= 18;
}

function lowerConfidence(
  confidence: RecallAnswerCheckConfidence,
): RecallAnswerCheckConfidence {
  switch (confidence) {
    case "high":
      return "medium";
    case "medium":
      return "low";
    case "low":
      return "low";
  }
}

function getRecallAnswerCheckAssessment(input: {
  answerIsShort: boolean;
  expectedAnswerMatch: AnswerCheckReferenceMatch;
  isMeaningfulAttempt: boolean;
}): RecallAnswerCheckAssessment {
  if (input.expectedAnswerMatch.exactMatch) {
    return {
      confidence: "high",
      primaryReason: "expected_answer_exact_match",
      status: "likely_correct",
    };
  }

  if (
    input.answerIsShort &&
    !input.expectedAnswerMatch.referenceIsShort &&
    input.expectedAnswerMatch.tokenCoverage < 0.9
  ) {
    return {
      confidence:
        input.expectedAnswerMatch.matchedTerms.length > 0 ? "medium" : "low",
      primaryReason: "expected_answer_short_attempt",
      status: "likely_incomplete",
    };
  }

  if (isStrongReferenceMatch(input.expectedAnswerMatch)) {
    return {
      confidence:
        input.expectedAnswerMatch.tokenCoverage >= 1 &&
        (input.expectedAnswerMatch.tfidfCosineSimilarity >= 0.8 ||
          input.expectedAnswerMatch.similarity >= 0.85)
          ? "high"
          : "medium",
      primaryReason: "expected_answer_close_match",
      status: "likely_correct",
    };
  }

  if (isPartialReferenceMatch(input.expectedAnswerMatch)) {
    return {
      confidence:
        input.expectedAnswerMatch.tokenCoverage >= 0.65 ||
        input.expectedAnswerMatch.tfidfCosineSimilarity >= 0.45
          ? "medium"
          : "low",
      primaryReason: "expected_answer_partial_match",
      status: "uncertain",
    };
  }

  return {
    confidence: input.isMeaningfulAttempt ? "medium" : "low",
    primaryReason: "expected_answer_low_coverage",
    status: "likely_incomplete",
  };
}

function hasCoveredOrPartialConcepts(
  coverage: RecallAnswerCheckConceptCoverage,
) {
  return (
    coverage.coveredConcepts.length > 0 || coverage.partialConcepts.length > 0
  );
}

function getRequiredKeyIdeaConfidence(
  coverage: RecallAnswerCheckConceptCoverage,
): RecallAnswerCheckConfidence {
  return hasCoveredOrPartialConcepts(coverage) ? "medium" : "low";
}

function getKeyIdeaAssessment(input: {
  baselineAssessment: RecallAnswerCheckAssessment;
  keyIdeaCoverage: RecallAnswerCheckConceptCoverage;
}): RecallAnswerCheckAssessment {
  const { baselineAssessment, keyIdeaCoverage } = input;

  if (keyIdeaCoverage.requiredMissingCount > 0) {
    return {
      confidence: getRequiredKeyIdeaConfidence(keyIdeaCoverage),
      primaryReason: "key_idea_required_missing",
      status: "likely_incomplete",
    };
  }

  if (keyIdeaCoverage.requiredPartialCount > 0) {
    return {
      confidence: getRequiredKeyIdeaConfidence(keyIdeaCoverage),
      primaryReason: "key_idea_required_missing",
      status: "uncertain",
    };
  }

  if (keyIdeaCoverage.coveredConcepts.length === 0) {
    return {
      confidence: lowerConfidence(baselineAssessment.confidence),
      primaryReason: baselineAssessment.primaryReason,
      status: baselineAssessment.status,
    };
  }

  if (
    keyIdeaCoverage.partialConcepts.length > 0 ||
    keyIdeaCoverage.supportingMissingCount > 0
  ) {
    return {
      confidence: "medium",
      primaryReason: "key_idea_supporting_partial",
      status: "likely_correct",
    };
  }

  return {
    confidence: baselineAssessment.confidence === "high" ? "high" : "medium",
    primaryReason: "key_idea_concepts_covered",
    status: "likely_correct",
  };
}

function getAssessmentForReferenceCoverage(input: {
  baselineAssessment: RecallAnswerCheckAssessment;
  keyIdeaCoverage: RecallAnswerCheckConceptCoverage;
  keyIdeas: readonly AppStudyNoteKeyIdea[];
}): RecallAnswerCheckAssessment {
  if (input.keyIdeas.length === 0) {
    return {
      ...input.baselineAssessment,
      confidence: lowerConfidence(input.baselineAssessment.confidence),
    };
  }

  return getKeyIdeaAssessment({
    baselineAssessment: input.baselineAssessment,
    keyIdeaCoverage: input.keyIdeaCoverage,
  });
}

function getAssessmentForProhibitedPhraseMatches(input: {
  assessment: RecallAnswerCheckAssessment;
  prohibitedPhraseMatches: RecallAnswerCheckProhibitedPhraseMatches;
}): RecallAnswerCheckAssessment {
  const hasKeyIdeaMatch =
    input.prohibitedPhraseMatches.contradictedConcepts.length > 0;

  if (!input.prohibitedPhraseMatches.hasStudyNoteMatch && !hasKeyIdeaMatch) {
    return input.assessment;
  }

  return {
    confidence: lowerConfidence(input.assessment.confidence),
    primaryReason: input.prohibitedPhraseMatches.hasStudyNoteMatch
      ? "study_note_prohibited_phrase_match"
      : "key_idea_prohibited_phrase_match",
    status:
      input.assessment.status === "likely_incomplete"
        ? "likely_incomplete"
        : "uncertain",
  };
}

function getAcceptedVariantAssessment(): RecallAnswerCheckAssessment {
  return {
    confidence: "high",
    primaryReason: "accepted_variant_close_match",
    status: "likely_correct",
  };
}

function toDisplayedTerms(terms: readonly AnswerCheckToken[]): string[] {
  return terms.map((term) => term.display);
}

export function scoreRecallAnswerCheck(
  input: ScoreRecallAnswerCheckInput,
): RecallAnswerCheckResult | null {
  const expected = createAnswerCheckTextContext(input.expectedAnswer);
  const answer = createAnswerCheckTextContext(input.typedAnswer);

  if (expected.normalized.length === 0 || answer.normalized.length === 0) {
    return null;
  }

  const expectedAnswerMatch = getReferenceMatch({
    answer,
    reference: expected,
  });
  const missingExpectedTerms = getMissingExpectedTerms({
    expectedTerms: expected.terms,
    matchedExpectedTerms: expectedAnswerMatch.matchedTerms,
  });
  const answerIsShort =
    answer.terms.length <=
      Math.max(2, Math.floor(expected.terms.length * 0.45)) ||
    answer.normalized.length <=
      Math.max(18, Math.floor(expected.normalized.length * 0.45));
  const isMeaningfulAttempt =
    expectedAnswerMatch.matchedTerms.length >= 1 ||
    ((answer.terms.length >= 2 || answer.normalized.length >= 18) &&
      (expectedAnswerMatch.tfidfCosineSimilarity >= 0.18 ||
        expectedAnswerMatch.similarity >= 0.3));

  const baselineAssessment = getRecallAnswerCheckAssessment({
    answerIsShort,
    expectedAnswerMatch,
    isMeaningfulAttempt,
  });
  const keyIdeas = input.keyIdeas ?? [];
  const prohibitedPhraseMatches = getProhibitedPhraseMatches({
    answer,
    keyIdeas,
    prohibitedPhrases: input.prohibitedPhrases ?? [],
  });
  const keyIdeaCoverage = getKeyIdeaCoverage({
    answer,
    keyIdeas,
    prohibitedPhraseMatches,
  });
  const referenceCoverageAssessment = getAssessmentForReferenceCoverage({
    baselineAssessment,
    keyIdeaCoverage,
    keyIdeas,
  });
  const matchedAcceptedVariant = expectedAnswerMatch.exactMatch
    ? undefined
    : getMatchedAcceptedVariant({
        acceptedVariants: input.acceptedVariants ?? [],
        answer,
      });
  const assessment = getAssessmentForProhibitedPhraseMatches({
    assessment:
      matchedAcceptedVariant === undefined
        ? referenceCoverageAssessment
        : getAcceptedVariantAssessment(),
    prohibitedPhraseMatches,
  });
  const suggestedSelfRating = getSuggestedSelfRating({
    isMeaningfulAttempt,
    status: assessment.status,
  });

  if (matchedAcceptedVariant !== undefined) {
    return {
      algorithmVersion: CURRENT_RECALL_ANSWER_CHECK_ALGORITHM_VERSION,
      confidence: assessment.confidence,
      evidence: {
        contradictedConcepts: keyIdeaCoverage.contradictedConcepts,
        coveredConcepts: [],
        matchedExpectedTerms: toDisplayedTerms(
          expectedAnswerMatch.matchedTerms,
        ),
        matchedProhibitedPhrases:
          prohibitedPhraseMatches.matchedProhibitedPhrases,
        missingConcepts: [],
        missingExpectedTerms: [],
        notDetectedExpectedTerms: toDisplayedTerms(missingExpectedTerms),
        partialConcepts: [],
        phraseCoverage: matchedAcceptedVariant.match.phraseCoverage,
        tfidfCosineSimilarity:
          matchedAcceptedVariant.match.tfidfCosineSimilarity,
        tokenCoverage: matchedAcceptedVariant.match.tokenCoverage,
      },
      matchedAcceptedVariant: { ...matchedAcceptedVariant.variant },
      primaryReason: assessment.primaryReason,
      status: assessment.status,
      suggestedSelfRating,
    };
  }

  return {
    algorithmVersion: CURRENT_RECALL_ANSWER_CHECK_ALGORITHM_VERSION,
    confidence: assessment.confidence,
    evidence: {
      contradictedConcepts: keyIdeaCoverage.contradictedConcepts,
      coveredConcepts: keyIdeaCoverage.coveredConcepts,
      matchedExpectedTerms: toDisplayedTerms(expectedAnswerMatch.matchedTerms),
      matchedProhibitedPhrases:
        prohibitedPhraseMatches.matchedProhibitedPhrases,
      missingConcepts: keyIdeaCoverage.missingConcepts,
      missingExpectedTerms: toDisplayedTerms(missingExpectedTerms),
      notDetectedExpectedTerms: [],
      partialConcepts: keyIdeaCoverage.partialConcepts,
      phraseCoverage: expectedAnswerMatch.phraseCoverage,
      tfidfCosineSimilarity: expectedAnswerMatch.tfidfCosineSimilarity,
      tokenCoverage: expectedAnswerMatch.tokenCoverage,
    },
    primaryReason: assessment.primaryReason,
    status: assessment.status,
    suggestedSelfRating,
  };
}
