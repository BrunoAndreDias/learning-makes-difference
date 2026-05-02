export const recallWorkspaceSearchSections = [
  "due",
  "results",
  "weak",
] as const;

export type RecallWorkspaceSearchSection =
  (typeof recallWorkspaceSearchSections)[number];

export type RecallWorkspaceSection = "practice" | RecallWorkspaceSearchSection;

function isRecallWorkspaceSearchSection(
  section: string,
): section is RecallWorkspaceSearchSection {
  return recallWorkspaceSearchSections.some((value) => value === section);
}

export function getRecallWorkspaceSection(
  search: unknown,
): RecallWorkspaceSection {
  if (
    typeof search !== "object" ||
    search === null ||
    !("section" in search) ||
    typeof search.section !== "string"
  ) {
    return "practice";
  }

  if (isRecallWorkspaceSearchSection(search.section)) {
    return search.section;
  }

  return "practice";
}

export function getRecallWorkspaceSearch(section: RecallWorkspaceSection): {
  section?: RecallWorkspaceSearchSection;
} {
  if (section === "practice") {
    return {};
  }

  return { section };
}
