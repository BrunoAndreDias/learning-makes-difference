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

const RECALL_ANSWER_CHECK_ALGORITHM_VERSION = "baseline_expected_answer_v1";

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
  | "expected_answer_exact_match"
  | "expected_answer_close_match"
  | "expected_answer_partial_match"
  | "expected_answer_short_attempt"
  | "expected_answer_low_coverage";

export type RecallAnswerCheckEvidence = {
  matchedExpectedTerms: string[];
  missingExpectedTerms: string[];
  phraseCoverage: number;
  tfidfCosineSimilarity: number;
  tokenCoverage: number;
};

export type RecallAnswerCheckResult = {
  algorithmVersion: typeof RECALL_ANSWER_CHECK_ALGORITHM_VERSION;
  confidence: RecallAnswerCheckConfidence;
  evidence: RecallAnswerCheckEvidence;
  primaryReason: RecallAnswerCheckReason;
  status: RecallAnswerCheckStatus;
  suggestedSelfRating: RecallAnswerCheckSuggestedSelfRating;
};

type AnswerCheckToken = {
  display: string;
  normalized: string;
};

type ScoreRecallAnswerCheckInput = {
  expectedAnswer: string;
  typedAnswer: string;
};

type RecallAnswerCheckAssessment = {
  confidence: RecallAnswerCheckConfidence;
  primaryReason: RecallAnswerCheckReason;
  status: RecallAnswerCheckStatus;
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

function isRecallAnswerCheckReason(
  value: unknown,
): value is RecallAnswerCheckReason {
  return (
    value === "expected_answer_exact_match" ||
    value === "expected_answer_close_match" ||
    value === "expected_answer_partial_match" ||
    value === "expected_answer_short_attempt" ||
    value === "expected_answer_low_coverage"
  );
}

function isRecallAnswerCheckSuggestedSelfRating(
  value: unknown,
): value is RecallAnswerCheckSuggestedSelfRating {
  return value === "forgot" || value === "hard" || value === "good";
}

export function isRecallAnswerCheckResult(
  value: unknown,
): value is RecallAnswerCheckResult {
  const candidate = asRecord(value);
  const evidence = asRecord(candidate?.evidence);

  return (
    candidate !== null &&
    candidate.algorithmVersion === RECALL_ANSWER_CHECK_ALGORITHM_VERSION &&
    isRecallAnswerCheckConfidence(candidate.confidence) &&
    isRecallAnswerCheckReason(candidate.primaryReason) &&
    isRecallAnswerCheckStatus(candidate.status) &&
    isRecallAnswerCheckSuggestedSelfRating(candidate.suggestedSelfRating) &&
    evidence !== null &&
    isStringArray(evidence.matchedExpectedTerms) &&
    isStringArray(evidence.missingExpectedTerms) &&
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

  return {
    ...answerCheck,
    evidence: {
      ...answerCheck.evidence,
      matchedExpectedTerms: [...answerCheck.evidence.matchedExpectedTerms],
      missingExpectedTerms: [...answerCheck.evidence.missingExpectedTerms],
    },
  };
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

function getRecallAnswerCheckAssessment(input: {
  answerIsShort: boolean;
  expectedAnswerSimilarity: number;
  expectedIsShort: boolean;
  exactMatch: boolean;
  isMeaningfulAttempt: boolean;
  matchedExpectedTermCount: number;
  partialMatch: boolean;
  strongMatch: boolean;
  tfidfCosineSimilarity: number;
  tokenCoverage: number;
}): RecallAnswerCheckAssessment {
  if (input.exactMatch) {
    return {
      confidence: "high",
      primaryReason: "expected_answer_exact_match",
      status: "likely_correct",
    };
  }

  if (
    input.answerIsShort &&
    !input.expectedIsShort &&
    input.tokenCoverage < 0.9
  ) {
    return {
      confidence: input.matchedExpectedTermCount > 0 ? "medium" : "low",
      primaryReason: "expected_answer_short_attempt",
      status: "likely_incomplete",
    };
  }

  if (input.strongMatch) {
    return {
      confidence:
        input.tokenCoverage >= 1 &&
        (input.tfidfCosineSimilarity >= 0.8 ||
          input.expectedAnswerSimilarity >= 0.85)
          ? "high"
          : "medium",
      primaryReason: "expected_answer_close_match",
      status: "likely_correct",
    };
  }

  if (input.partialMatch) {
    return {
      confidence:
        input.tokenCoverage >= 0.65 || input.tfidfCosineSimilarity >= 0.45
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

export function scoreRecallAnswerCheck(
  input: ScoreRecallAnswerCheckInput,
): RecallAnswerCheckResult | null {
  const expectedNormalized = normalizeRecallAnswerCheckText(
    input.expectedAnswer,
  );
  const answerNormalized = normalizeRecallAnswerCheckText(input.typedAnswer);

  if (expectedNormalized.length === 0 || answerNormalized.length === 0) {
    return null;
  }

  const expectedTokens = tokenizeAnswerCheckText(input.expectedAnswer);
  const answerTokens = tokenizeAnswerCheckText(input.typedAnswer);
  const expectedTerms = getDistinctiveTerms(expectedTokens);
  const answerTerms = getDistinctiveTerms(answerTokens);
  const matchedExpectedTerms = expectedTerms.filter((expectedTerm) =>
    isMatchedExpectedTerm(expectedTerm, answerTerms),
  );
  const missingExpectedTerms = getMissingExpectedTerms({
    expectedTerms,
    matchedExpectedTerms,
  });
  const tokenCoverage = getTokenCoverage({
    expectedTermCount: expectedTerms.length,
    matchedExpectedTermCount: matchedExpectedTerms.length,
  });
  const phraseCoverage = getPhraseCoverage({
    answerNormalized,
    answerTokens,
    expectedTokens,
  });
  const tfidfCosineSimilarity = getTfIdfCosineSimilarity(
    expectedTerms,
    answerTerms,
  );
  const expectedAnswerSimilarity = getDiceSimilarity(
    expectedNormalized,
    answerNormalized,
  );
  const expectedIsShort =
    expectedTerms.length <= 2 || expectedNormalized.length <= 24;
  const answerIsShort =
    answerTerms.length <=
      Math.max(2, Math.floor(expectedTerms.length * 0.45)) ||
    answerNormalized.length <=
      Math.max(18, Math.floor(expectedNormalized.length * 0.45));
  const exactMatch = expectedNormalized === answerNormalized;
  const strongMatch =
    tokenCoverage >= 0.82 &&
    (phraseCoverage >= 0.5 ||
      tfidfCosineSimilarity >= 0.55 ||
      expectedAnswerSimilarity >= 0.75);
  const partialMatch =
    tokenCoverage >= 0.5 &&
    (phraseCoverage >= 0.25 ||
      tfidfCosineSimilarity >= 0.3 ||
      expectedAnswerSimilarity >= 0.5);
  const isMeaningfulAttempt =
    matchedExpectedTerms.length >= 1 ||
    ((answerTerms.length >= 2 || answerNormalized.length >= 18) &&
      (tfidfCosineSimilarity >= 0.18 || expectedAnswerSimilarity >= 0.3));

  const { confidence, primaryReason, status } = getRecallAnswerCheckAssessment({
    answerIsShort,
    expectedAnswerSimilarity,
    expectedIsShort,
    exactMatch,
    isMeaningfulAttempt,
    matchedExpectedTermCount: matchedExpectedTerms.length,
    partialMatch,
    strongMatch,
    tfidfCosineSimilarity,
    tokenCoverage,
  });

  return {
    algorithmVersion: RECALL_ANSWER_CHECK_ALGORITHM_VERSION,
    confidence,
    evidence: {
      matchedExpectedTerms: matchedExpectedTerms.map((term) => term.display),
      missingExpectedTerms: missingExpectedTerms.map((term) => term.display),
      phraseCoverage,
      tfidfCosineSimilarity,
      tokenCoverage,
    },
    primaryReason,
    status,
    suggestedSelfRating: getSuggestedSelfRating({
      isMeaningfulAttempt,
      status,
    }),
  };
}
