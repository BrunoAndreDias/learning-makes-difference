import type { AppNoteSearchMatchChip } from "./note-search";
import type { RecallMode } from "./recall";

export function formatSearchMatchLabel(
  label: AppNoteSearchMatchChip | "Label",
) {
  switch (label) {
    case "Title":
      return "Prompt";
    case "Body":
      return "Notes";
    case "Metaphor":
    case "Acronym":
      return "Hook";
    case "Label":
      return "Label";
  }
}

export function formatRecallModeLabel(mode: RecallMode) {
  switch (mode) {
    case "FlashCard":
      return "Recall";
    case "AiAssisted":
      return "AI recall";
    case "AiGraded":
      return "AI review";
  }
}

export function formatFocusTargetKindLabel(kind: "RecallSession") {
  switch (kind) {
    case "RecallSession":
      return "Recall session";
  }
}
