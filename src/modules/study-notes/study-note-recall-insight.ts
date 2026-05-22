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

export function formatRecallSelfRatingResultLabel(
  rating: RecallSelfRating | null,
) {
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
  const { draft, nextRecall, recallGuidance } = input;
  const readiness = getStudyNoteReadiness({
    expectedAnswer: draft.expectedAnswer,
    prompt: draft.prompt,
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

  if (recallGuidance === null) {
    return {
      description: "Ready for recall after saving.",
      kind: "new",
      lastResult: "—",
      nextRecall,
      statusLabel: "New",
      suggestedAction: "Save to enable recall",
    };
  }

  if (recallGuidance.recallTodayPrimaryReason === "practice-follow-up") {
    return {
      description:
        "Repair is complete. Another recall attempt is still pending.",
      kind: "practice",
      lastResult: formatRecallSelfRatingResultLabel(recallGuidance.lastScore),
      nextRecall,
      statusLabel: "Practice Follow-up",
      suggestedAction: "Review this note",
    };
  }

  if (recallGuidance.notRecalledYet) {
    return {
      description: "Not enough recall data yet.",
      kind: "new",
      lastResult: "—",
      nextRecall,
      statusLabel: "New",
      suggestedAction: recallGuidance.dueForRecall
        ? "Review this note"
        : "Review when due",
    };
  }

  if (recallGuidance.needsPractice) {
    return {
      description: "This note needs more attention.",
      kind: "practice",
      lastResult: formatRecallSelfRatingResultLabel(recallGuidance.lastScore),
      nextRecall,
      statusLabel: "Needs practice",
      suggestedAction: "Review this note",
    };
  }

  return {
    description: "You're recalling this well. Keep it up.",
    kind: "on-track",
    lastResult: formatRecallSelfRatingResultLabel(recallGuidance.lastScore),
    nextRecall,
    statusLabel: "On track",
    suggestedAction: recallGuidance.dueForRecall
      ? "Review this note"
      : "Keep it up",
  };
}
