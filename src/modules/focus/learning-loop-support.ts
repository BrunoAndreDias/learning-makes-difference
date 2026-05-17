import { deriveRecallGuidance, type RecallGuidanceInput } from "../recall";

export type FocusLearningLoopSupportSuggestion =
  | {
      actionId: "practice-repair";
      href: "/study-notes";
    }
  | {
      actionId: "recall-today";
      href: "/recall";
    };

type FocusLearningLoopSupportInput = RecallGuidanceInput;

export function getFocusLearningLoopSupportSuggestions(
  input: FocusLearningLoopSupportInput,
): FocusLearningLoopSupportSuggestion[] {
  const recallGuidance = deriveRecallGuidance(input);
  const suggestions: FocusLearningLoopSupportSuggestion[] = [];
  const hasPracticeRepair = recallGuidance.some(
    (guidanceEntry) => guidanceEntry.needsPractice,
  );
  const hasRecallToday = recallGuidance.some(
    (guidanceEntry) => guidanceEntry.recallToday,
  );

  if (hasPracticeRepair) {
    suggestions.push({
      actionId: "practice-repair",
      href: "/study-notes",
    });
  }

  if (hasRecallToday) {
    suggestions.push({
      actionId: "recall-today",
      href: "/recall",
    });
  }

  return suggestions;
}
