import type { AppNoteSearchMatchChip } from "./notes-workspace/note-search";

export function formatSearchMatchLabel(
  label: AppNoteSearchMatchChip | "Label",
): string {
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
