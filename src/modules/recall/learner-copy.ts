import type { RecallMode } from "./recall";

export function formatRecallModeLabel(mode: RecallMode): string {
  switch (mode) {
    case "FlashCard":
      return "Recall";
    case "AiAssisted":
      return "AI recall";
    case "AiGraded":
      return "AI review";
  }
}
