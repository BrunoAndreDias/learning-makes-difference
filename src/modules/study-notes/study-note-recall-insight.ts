import type { RecallGuidanceEntry, RecallSelfRating } from "../recall";

import { getStudyNoteReadiness } from "./study-note-readiness";
import type { UpdateStudyNoteInput } from "./study-notes";

export type StudyNoteRecallInsightKind =
  | "incomplete"
  | "new"
  | "on-track"
  | "practice";

export type StudyNoteRecallInsight = {
  description: string;
  kind: StudyNoteRecallInsightKind;
  lastResult: string;
  nextRecall: string;
  statusLabel: string;
  suggestedAction: string;
};

function formatScoreResultLabel(rating: RecallSelfRating | null) {
  switch (rating) {
    case "easy":
      return "Easy (5/5)";
    case "forgot":
      return "Forgot (1/5)";
    case "good":
      return "Good (4/5)";
    case "hard":
      return "Hard (2/5)";
    case null:
      return "—";
  }
}

export function deriveStudyNoteRecallInsight(input: {
  draft: UpdateStudyNoteInput;
  nextRecall: string;
  recallGuidance: RecallGuidanceEntry | null;
}): StudyNoteRecallInsight {
  const readiness = getStudyNoteReadiness({
    expectedAnswer: input.draft.expectedAnswer,
    prompt: input.draft.prompt,
  });

  if (!readiness.recallable) {
    return {
      description: "Complete the note to enable recall.",
      kind: "incomplete",
      lastResult: "—",
      nextRecall: "—",
      statusLabel: "New",
      suggestedAction: "Add expected answer",
    };
  }

  if (input.recallGuidance === null) {
    return {
      description: "Ready for recall after saving.",
      kind: "new",
      lastResult: "—",
      nextRecall: input.nextRecall,
      statusLabel: "New",
      suggestedAction: "Save to enable recall",
    };
  }

  if (input.recallGuidance.notRecalledYet) {
    return {
      description: "Not enough recall data yet.",
      kind: "new",
      lastResult: "—",
      nextRecall: input.nextRecall,
      statusLabel: "New",
      suggestedAction: input.recallGuidance.dueForRecall
        ? "Review this note"
        : "Review when due",
    };
  }

  if (input.recallGuidance.needsPractice) {
    return {
      description: "This note needs more attention.",
      kind: "practice",
      lastResult: formatScoreResultLabel(input.recallGuidance.lastScore),
      nextRecall: input.nextRecall,
      statusLabel: "Needs practice",
      suggestedAction: "Review this note",
    };
  }

  return {
    description: "You're recalling this well. Keep it up.",
    kind: "on-track",
    lastResult: formatScoreResultLabel(input.recallGuidance.lastScore),
    nextRecall: input.nextRecall,
    statusLabel: "On track",
    suggestedAction: input.recallGuidance.dueForRecall
      ? "Review this note"
      : "Keep it up",
  };
}
