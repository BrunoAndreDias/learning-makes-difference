export function formatFocusTargetKindLabel(
  kind: "Note" | "RecallSession",
): string {
  switch (kind) {
    case "Note":
      return "Note study";
    case "RecallSession":
      return "Recall practice";
  }
}
