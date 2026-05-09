import type { AppTranslationKey } from "../language";
import type { RecallMode, RecallSelfRating } from "./recall";

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
