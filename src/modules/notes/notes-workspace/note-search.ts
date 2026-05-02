import type { AppNote } from "./notes";

export type AppNoteSearchMatchChip = "Title" | "Body" | "Metaphor" | "Acronym";

export type AppNoteSearchTargetField =
  | "title"
  | "body"
  | "metaphorTitle"
  | "metaphorExplanation"
  | "acronymShortForm"
  | "acronymExpansion";

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
    const titleMatch = findNormalizedQueryMatch(
      metaphor.title,
      normalizedQuery,
    );

    if (titleMatch !== null) {
      return {
        matchChip: "Metaphor",
        target: {
          field: "metaphorTitle",
          index,
          match: titleMatch,
        },
      };
    }

    const explanationMatch = findNormalizedQueryMatch(
      metaphor.explanation,
      normalizedQuery,
    );

    if (explanationMatch !== null) {
      return {
        matchChip: "Metaphor",
        target: {
          field: "metaphorExplanation",
          index,
          match: explanationMatch,
        },
      };
    }
  }

  for (const [index, acronym] of note.acronyms.entries()) {
    const shortFormMatch = findNormalizedQueryMatch(
      acronym.shortForm,
      normalizedQuery,
    );

    if (shortFormMatch !== null) {
      return {
        matchChip: "Acronym",
        target: {
          field: "acronymShortForm",
          index,
          match: shortFormMatch,
        },
      };
    }

    const expansionMatch = findNormalizedQueryMatch(
      acronym.expansion,
      normalizedQuery,
    );

    if (expansionMatch !== null) {
      return {
        matchChip: "Acronym",
        target: {
          field: "acronymExpansion",
          index,
          match: expansionMatch,
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

function trimPreviewWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function createTextMatchPreview(
  value: string,
  match: AppNoteSearchTarget["match"],
): string {
  const rawStart = Math.max(0, match.start - 24);
  const rawEnd = Math.min(value.length, match.end + 48);
  const prefix = rawStart > 0 ? "..." : "";
  const suffix = rawEnd < value.length ? "..." : "";

  return `${prefix}${trimPreviewWhitespace(value.slice(rawStart, rawEnd))}${suffix}`;
}

export function formatNoteSearchResultPreview(
  result: AppNoteSearchResult,
): string | null {
  switch (result.target.field) {
    case "title":
      return null;
    case "body":
      return createTextMatchPreview(result.note.body, result.target.match);
    case "metaphorTitle":
    case "metaphorExplanation": {
      const metaphor = result.note.metaphors[result.target.index ?? -1];

      if (metaphor === undefined) {
        return null;
      }

      return trimPreviewWhitespace(
        `${metaphor.title} ${metaphor.explanation}`.trim(),
      );
    }
    case "acronymShortForm":
    case "acronymExpansion": {
      const acronym = result.note.acronyms[result.target.index ?? -1];

      if (acronym === undefined) {
        return null;
      }

      return trimPreviewWhitespace(
        `${acronym.shortForm} ${acronym.expansion}`.trim(),
      );
    }
  }
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
