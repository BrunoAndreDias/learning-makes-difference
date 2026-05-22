import type { AppTranslationKey } from "../language";
import type { RecallMode, RecallSelfRating } from "./recall";
import type {
  RecallAnswerCheckConfidence,
  RecallAnswerCheckReason,
  RecallAnswerCheckStatus,
} from "./recall-answer-check";

export type RecallRatingTone = RecallSelfRating | "unattempted";

export function formatRecallModeLabel(mode: RecallMode): string {
  switch (mode) {
    case "FlashCard":
      return "FlashCard";
    case "AiAssisted":
      return "AI Assisted";
    case "AiGraded":
      return "AI Graded";
  }
}

export function getRecallModeTranslationKey(
  mode: RecallMode,
): AppTranslationKey {
  switch (mode) {
    case "FlashCard":
      return "recall.mode.flashCard";
    case "AiAssisted":
      return "recall.mode.aiAssisted";
    case "AiGraded":
      return "recall.mode.aiGraded";
  }
}

export function getRecallSelectionHelperTranslationKey(
  mode: RecallMode,
): AppTranslationKey {
  switch (mode) {
    case "FlashCard":
      return "recall.selection.helper.flashCard";
    case "AiAssisted":
      return "recall.selection.helper.aiAssisted";
    case "AiGraded":
      return "recall.selection.helper.aiGraded";
  }
}

export function getRecallRatingTranslationKey(
  rating: RecallSelfRating,
): AppTranslationKey {
  switch (rating) {
    case "forgot":
      return "recall.rating.forgot";
    case "hard":
      return "recall.rating.hard";
    case "good":
      return "recall.rating.good";
    case "easy":
      return "recall.rating.easy";
  }
}

export function getRecallRatingTone(
  rating: RecallSelfRating | null,
): RecallRatingTone {
  switch (rating) {
    case "forgot":
      return "forgot";
    case "hard":
      return "hard";
    case "good":
      return "good";
    case "easy":
      return "easy";
    case null:
      return "unattempted";
  }
}

export function getRecallRatingDescriptionTranslationKey(
  rating: RecallSelfRating,
): AppTranslationKey {
  switch (rating) {
    case "forgot":
      return "recall.session.rating.forgot.description";
    case "hard":
      return "recall.session.rating.hard.description";
    case "good":
      return "recall.session.rating.good.description";
    case "easy":
      return "recall.session.rating.easy.description";
  }
}

export function getRecallAnswerCheckStatusTranslationKey(
  status: RecallAnswerCheckStatus,
): AppTranslationKey {
  switch (status) {
    case "likely_correct":
      return "recall.answerCheck.status.likelyCorrect";
    case "uncertain":
      return "recall.answerCheck.status.uncertain";
    case "likely_incomplete":
      return "recall.answerCheck.status.likelyIncomplete";
  }
}

export function getRecallAnswerCheckConfidenceTranslationKey(
  confidence: RecallAnswerCheckConfidence,
): AppTranslationKey {
  switch (confidence) {
    case "low":
      return "recall.answerCheck.confidence.low";
    case "medium":
      return "recall.answerCheck.confidence.medium";
    case "high":
      return "recall.answerCheck.confidence.high";
  }
}

export function getRecallAnswerCheckReasonTranslationKey(
  reason: RecallAnswerCheckReason,
): AppTranslationKey {
  switch (reason) {
    case "accepted_variant_close_match":
      return "recall.answerCheck.reason.acceptedVariantMatch";
    case "expected_answer_exact_match":
      return "recall.answerCheck.reason.exactMatch";
    case "expected_answer_close_match":
      return "recall.answerCheck.reason.closeMatch";
    case "expected_answer_partial_match":
      return "recall.answerCheck.reason.partialMatch";
    case "expected_answer_short_attempt":
      return "recall.answerCheck.reason.shortAttempt";
    case "expected_answer_low_coverage":
      return "recall.answerCheck.reason.lowCoverage";
    case "key_idea_concepts_covered":
      return "recall.answerCheck.reason.keyIdeasCovered";
    case "key_idea_required_missing":
      return "recall.answerCheck.reason.requiredKeyIdeaMissing";
    case "key_idea_supporting_partial":
      return "recall.answerCheck.reason.supportingKeyIdeaPartial";
  }
}
