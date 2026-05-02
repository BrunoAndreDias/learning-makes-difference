import type { AppLabel } from "../../labels/domain/labels";
import { type AppNoteSearchMatchChip, searchNoteResults } from "./note-search";
import type {
  FlashCardRecallNote,
  FlashCardSessionResult,
  RecallLabelSnapshot,
} from "./recall";

export type RecallSessionSearchMatchChip = AppNoteSearchMatchChip | "Label";

export type RecallSessionSearchResult = {
  matchChip: RecallSessionSearchMatchChip;
  matchedNoteTitle: string;
  sessionResult: FlashCardSessionResult;
};

const RECALL_SESSION_SEARCH_MATCH_PRIORITY: Record<
  RecallSessionSearchMatchChip,
  number
> = {
  Title: 0,
  Body: 1,
  Metaphor: 2,
  Acronym: 3,
  Label: 4,
};

function normalizeSearchQuery(query: string): string {
  return query.trim().toLocaleLowerCase();
}

function listSearchableNoteLabels(input: {
  labelsById: ReadonlyMap<string, AppLabel>;
  note: FlashCardRecallNote;
}): RecallLabelSnapshot[] {
  const storedLabels = input.note.labels ?? [];

  if (storedLabels.length > 0) {
    return storedLabels;
  }

  const labels: RecallLabelSnapshot[] = [];

  for (const labelId of input.note.labelIds) {
    const label = input.labelsById.get(labelId);

    if (label !== undefined) {
      labels.push({
        id: label.id,
        name: label.name,
      });
    }
  }

  return labels;
}

function getLabelMatchedNoteTitle(input: {
  labelsById: ReadonlyMap<string, AppLabel>;
  normalizedQuery: string;
  notes: readonly FlashCardRecallNote[];
}): string | null {
  for (const note of input.notes) {
    for (const label of listSearchableNoteLabels({
      labelsById: input.labelsById,
      note,
    })) {
      if (label.name.toLocaleLowerCase().includes(input.normalizedQuery)) {
        return note.title;
      }
    }
  }

  return null;
}

function compareRecallSessionSearchResults(
  left: RecallSessionSearchResult,
  right: RecallSessionSearchResult,
) {
  const priorityDifference =
    RECALL_SESSION_SEARCH_MATCH_PRIORITY[left.matchChip] -
    RECALL_SESSION_SEARCH_MATCH_PRIORITY[right.matchChip];

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  return (
    right.sessionResult.completedAt.localeCompare(
      left.sessionResult.completedAt,
    ) || right.sessionResult.id.localeCompare(left.sessionResult.id)
  );
}

export function searchRecallSessionResults(input: {
  labels: readonly AppLabel[];
  query: string;
  sessionResults: readonly FlashCardSessionResult[];
}): RecallSessionSearchResult[] {
  const normalizedQuery = normalizeSearchQuery(input.query);

  if (normalizedQuery.length === 0) {
    return input.sessionResults.map((sessionResult) => ({
      matchChip: "Title",
      matchedNoteTitle: sessionResult.notes[0]?.title ?? "Stored note",
      sessionResult,
    }));
  }

  const labelsById = new Map(input.labels.map((label) => [label.id, label]));

  return input.sessionResults
    .map((sessionResult): RecallSessionSearchResult | null => {
      const noteMatches = searchNoteResults(
        sessionResult.notes,
        normalizedQuery,
      );
      const firstNoteMatch = noteMatches[0];

      if (firstNoteMatch !== undefined) {
        return {
          matchChip: firstNoteMatch.matchChip,
          matchedNoteTitle: firstNoteMatch.note.title,
          sessionResult,
        };
      }

      const labelMatchedNoteTitle = getLabelMatchedNoteTitle({
        labelsById,
        normalizedQuery,
        notes: sessionResult.notes,
      });

      if (labelMatchedNoteTitle === null) {
        return null;
      }

      return {
        matchChip: "Label",
        matchedNoteTitle: labelMatchedNoteTitle,
        sessionResult,
      };
    })
    .filter((result): result is RecallSessionSearchResult => result !== null)
    .sort(compareRecallSessionSearchResults);
}
