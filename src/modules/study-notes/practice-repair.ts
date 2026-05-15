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
      text: "Tighten the expected answer so this recall target names the reason, steps, limits, or one example more precisely.",
    },
    {
      id: "split-or-sibling",
      text: "If this prompt is doing too much, split it into smaller Study Notes or create a sibling Study Note from this explanation.",
    },
    {
      id: "optional-memory-aids",
      text: "Add a Metaphor or Acronym only if it solves this specific recall problem.",
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
      : `Latest recall was ${ratingLabel}. Repair this Study Note before or alongside Recall Today.`;

  return {
    recallTodayActionLabel: "Open Recall Today",
    summary,
    suggestions: practiceRepairSuggestions,
    title: "Practice Repair",
  };
}
