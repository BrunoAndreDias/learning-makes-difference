import type { RecallMode } from "./recall";

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
