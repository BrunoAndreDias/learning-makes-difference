import {
  formatStudyNoteLearningStateScoreLabel,
  type StudyNoteLearningState,
} from "./learning-state";

export type StudyNotePracticeRepairSuggestion = {
  id: "edit-expected-answer" | "split-or-sibling" | "optional-memory-aids";
  text: string;
};

export type StudyNotePracticeRepair = {
  recallTodayActionLabel: string;
  summary: string;
  suggestions: readonly StudyNotePracticeRepairSuggestion[];
  title: string;
};

const practiceRepairSuggestions: readonly StudyNotePracticeRepairSuggestion[] =
  [
    {
      id: "edit-expected-answer",
      text: "Tighten the expected answer: name the reason, steps, limit, or one example.",
    },
    {
      id: "split-or-sibling",
      text: "If the prompt is doing too much, split it or create a sibling Study Note from the explanation.",
    },
    {
      id: "optional-memory-aids",
      text: "Use a Metaphor or Acronym only when it solves this recall problem.",
    },
  ] as const;

export function getStudyNotePracticeRepair(
  learningState: StudyNoteLearningState | null,
): StudyNotePracticeRepair | null {
  if (learningState === null || !learningState.needsPractice) {
    return null;
  }

  const ratingLabel = formatStudyNoteLearningStateScoreLabel(
    learningState.latestScore,
  );
  const summary =
    ratingLabel === null
      ? "Latest recall needs repair before the next attempt."
      : `Latest recall: ${ratingLabel}. Repair before the next attempt or alongside Recall Today.`;

  return {
    recallTodayActionLabel: "Open Recall Today",
    summary,
    suggestions: practiceRepairSuggestions,
    title: "Practice Repair",
  };
}
