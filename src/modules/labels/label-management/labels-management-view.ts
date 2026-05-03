import type { AppNote } from "../../notes";
import type { AppLabel } from "./labels";

export type LabelsFilterValue = "all" | "top-level" | "unused";

export type LabelsSortValue = "children-desc" | "name-asc" | "notes-desc";

export type DerivedLabelRow = {
  childCount: number;
  directNoteCount: number;
  id: string;
  isTopLevel: boolean;
  isUnused: boolean;
  label: string;
  parentCount: number;
  parentNames: string[];
};

export type DerivedLabelsSummary = {
  relationshipCount: number;
  topLevelCount: number;
  totalCount: number;
  unusedCount: number;
};

export type ParentLabelOption = {
  directNoteCount: number;
  id: string;
  label: string;
};

function compareNameAscending(left: string, right: string) {
  return left.localeCompare(right);
}

function incrementCount(counts: Map<string, number>, id: string) {
  counts.set(id, (counts.get(id) ?? 0) + 1);
}

export function parseLabelsFilterValue(
  value: string,
): LabelsFilterValue | null {
  switch (value) {
    case "all":
    case "top-level":
    case "unused":
      return value;
    default:
      return null;
  }
}

export function parseLabelsSortValue(value: string): LabelsSortValue | null {
  switch (value) {
    case "children-desc":
    case "name-asc":
    case "notes-desc":
      return value;
    default:
      return null;
  }
}

export function deriveLabelRows(input: {
  labels: readonly AppLabel[];
  notes: readonly Pick<AppNote, "labelIds">[];
}): DerivedLabelRow[] {
  const labelsById = new Map(input.labels.map((label) => [label.id, label]));
  const directNoteCountByLabelId = new Map<string, number>();
  const childCountByLabelId = new Map(
    input.labels.map((label) => [label.id, 0]),
  );

  for (const note of input.notes) {
    for (const labelId of note.labelIds) {
      incrementCount(directNoteCountByLabelId, labelId);
    }
  }

  for (const label of input.labels) {
    for (const parentId of label.parentIds) {
      incrementCount(childCountByLabelId, parentId);
    }
  }

  return input.labels.map((label) => {
    const parentNames = label.parentIds
      .map((parentId) => labelsById.get(parentId)?.name)
      .filter((name): name is string => name !== undefined)
      .sort(compareNameAscending);
    const directNoteCount = directNoteCountByLabelId.get(label.id) ?? 0;
    const childCount = childCountByLabelId.get(label.id) ?? 0;

    return {
      childCount,
      directNoteCount,
      id: label.id,
      isTopLevel: label.parentIds.length === 0,
      isUnused: directNoteCount === 0,
      label: label.name,
      parentCount: label.parentIds.length,
      parentNames,
    };
  });
}

export function deriveLabelsSummary(
  rows: readonly DerivedLabelRow[],
): DerivedLabelsSummary {
  return {
    relationshipCount: rows.reduce((total, row) => total + row.parentCount, 0),
    topLevelCount: rows.filter((row) => row.isTopLevel).length,
    totalCount: rows.length,
    unusedCount: rows.filter((row) => row.isUnused).length,
  };
}

export function deriveVisibleLabelRows(input: {
  filterValue: LabelsFilterValue;
  rows: readonly DerivedLabelRow[];
  searchQuery: string;
  sortValue: LabelsSortValue;
}): DerivedLabelRow[] {
  const normalizedSearch = input.searchQuery.trim().toLowerCase();
  const filteredRows = input.rows.filter((row) => {
    if (
      normalizedSearch.length > 0 &&
      !row.label.toLowerCase().includes(normalizedSearch)
    ) {
      return false;
    }

    switch (input.filterValue) {
      case "top-level":
        return row.isTopLevel;
      case "unused":
        return row.isUnused;
      case "all":
        return true;
    }

    return true;
  });

  return [...filteredRows].sort((left, right) => {
    switch (input.sortValue) {
      case "notes-desc":
        if (left.directNoteCount !== right.directNoteCount) {
          return right.directNoteCount - left.directNoteCount;
        }

        return compareNameAscending(left.label, right.label);
      case "children-desc":
        if (left.childCount !== right.childCount) {
          return right.childCount - left.childCount;
        }

        return compareNameAscending(left.label, right.label);
      case "name-asc":
        return compareNameAscending(left.label, right.label);
    }

    return compareNameAscending(left.label, right.label);
  });
}

export function deriveSelectableParentOptions(input: {
  blockedParentIds?: readonly string[];
  rows: readonly DerivedLabelRow[];
  searchQuery: string;
  selectedParentIds: readonly string[];
}): ParentLabelOption[] {
  const normalizedSearch = input.searchQuery.trim().toLowerCase();
  const selectedParentIds = new Set(input.selectedParentIds);
  const blockedParentIds = new Set(input.blockedParentIds ?? []);

  return input.rows
    .filter((row) => {
      if (selectedParentIds.has(row.id)) {
        return false;
      }
      if (blockedParentIds.has(row.id)) {
        return false;
      }

      if (normalizedSearch.length === 0) {
        return true;
      }

      return row.label.toLowerCase().includes(normalizedSearch);
    })
    .map((row) => ({
      directNoteCount: row.directNoteCount,
      id: row.id,
      label: row.label,
    }))
    .sort((left, right) => compareNameAscending(left.label, right.label));
}

export function formatCreateRelationshipPreview(
  parentNames: readonly string[],
): string {
  if (parentNames.length === 0) {
    return "New label will be top-level.";
  }

  if (parentNames.length === 1) {
    return `New label will have 1 parent: ${parentNames[0]}.`;
  }

  return `New label will have ${parentNames.length} parents: ${parentNames.join(", ")}.`;
}

function normalizeNameForComparison(name: string): string {
  return name.trim().toLowerCase();
}

export function deriveDuplicateLabelName(input: {
  existingLabelNames: readonly string[];
  sourceLabelName: string;
}): string {
  const sourceName = input.sourceLabelName.trim();
  const existingNames = new Set(
    input.existingLabelNames.map(normalizeNameForComparison),
  );
  const baseCopyName = `${sourceName} (copy)`;

  if (!existingNames.has(normalizeNameForComparison(baseCopyName))) {
    return baseCopyName;
  }

  let copyIndex = 2;

  while (true) {
    const candidateName = `${sourceName} (copy ${copyIndex})`;

    if (!existingNames.has(normalizeNameForComparison(candidateName))) {
      return candidateName;
    }

    copyIndex += 1;
  }
}
