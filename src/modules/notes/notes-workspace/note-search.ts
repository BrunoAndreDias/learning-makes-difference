import type { AppNote } from "./notes";

export type AppNoteSearchMatchChip = "Title" | "Body" | "Metaphor" | "Acronym";

export type AppNoteSearchTargetField =
  | "title"
  | "body"
  | "metaphorDescription"
  | "acronymDescription";

export type AppNoteSearchTarget = {
  field: AppNoteSearchTargetField;
  index?: number;
  match: {
    end: number;
    start: number;
  };
};

export type AppNoteSearchResult = {
  matchChip: AppNoteSearchMatchChip;
  note: AppNote;
  target: AppNoteSearchTarget;
};

type AppNoteSearchEvaluation = {
  matchChip: AppNoteSearchMatchChip;
  target: AppNoteSearchTarget;
};

const NOTE_SEARCH_MATCH_PRIORITY: Record<AppNoteSearchMatchChip, number> = {
  Title: 0,
  Body: 1,
  Metaphor: 2,
  Acronym: 3,
};

function normalizeSearchQuery(query: string): string {
  return query.trim().toLocaleLowerCase();
}

function findNormalizedQueryMatch(value: string, normalizedQuery: string) {
  const start = value.toLocaleLowerCase().indexOf(normalizedQuery);

  if (start === -1) {
    return null;
  }

  return {
    end: start + normalizedQuery.length,
    start,
  };
}

function getNoteSearchEvaluation(
  note: AppNote,
  normalizedQuery: string,
): AppNoteSearchEvaluation | null {
  const titleMatch = findNormalizedQueryMatch(note.title, normalizedQuery);

  if (titleMatch !== null) {
    return {
      matchChip: "Title",
      target: {
        field: "title",
        match: titleMatch,
      },
    };
  }

  const bodyMatch = findNormalizedQueryMatch(note.body, normalizedQuery);

  if (bodyMatch !== null) {
    return {
      matchChip: "Body",
      target: {
        field: "body",
        match: bodyMatch,
      },
    };
  }

  for (const [index, metaphor] of note.metaphors.entries()) {
    const descriptionMatch = findNormalizedQueryMatch(
      metaphor.description,
      normalizedQuery,
    );

    if (descriptionMatch !== null) {
      return {
        matchChip: "Metaphor",
        target: {
          field: "metaphorDescription",
          index,
          match: descriptionMatch,
        },
      };
    }
  }

  for (const [index, acronym] of note.acronyms.entries()) {
    const descriptionMatch = findNormalizedQueryMatch(
      acronym.description,
      normalizedQuery,
    );

    if (descriptionMatch !== null) {
      return {
        matchChip: "Acronym",
        target: {
          field: "acronymDescription",
          index,
          match: descriptionMatch,
        },
      };
    }
  }

  return null;
}

function noteMatchesQuery(note: AppNote, normalizedQuery: string): boolean {
  return getNoteSearchEvaluation(note, normalizedQuery) !== null;
}

function compareSearchResults(
  left: AppNoteSearchResult,
  right: AppNoteSearchResult,
): number {
  const priorityDifference =
    NOTE_SEARCH_MATCH_PRIORITY[left.matchChip] -
    NOTE_SEARCH_MATCH_PRIORITY[right.matchChip];

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  return right.note.updatedAt.localeCompare(left.note.updatedAt);
}

export function filterNotesByQuery(
  notes: readonly AppNote[],
  query: string,
): AppNote[] {
  const normalizedQuery = normalizeSearchQuery(query);

  if (normalizedQuery.length === 0) {
    return [...notes];
  }

  return notes.filter((note) => noteMatchesQuery(note, normalizedQuery));
}

export function searchNoteResults(
  notes: readonly AppNote[],
  query: string,
): AppNoteSearchResult[] {
  const normalizedQuery = normalizeSearchQuery(query);

  if (normalizedQuery.length === 0) {
    return [];
  }

  return notes
    .map((note): AppNoteSearchResult | null => {
      const evaluation = getNoteSearchEvaluation(note, normalizedQuery);

      if (evaluation === null) {
        return null;
      }

      return {
        matchChip: evaluation.matchChip,
        note,
        target: evaluation.target,
      };
    })
    .filter((result): result is AppNoteSearchResult => result !== null)
    .sort(compareSearchResults);
}
