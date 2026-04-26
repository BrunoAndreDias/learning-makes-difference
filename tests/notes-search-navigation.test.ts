// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import type { AppNoteSearchResult } from "../src/features/notes/note-search";
import { resolveNotesSearchTargetElement } from "../src/features/notes/note-search-navigation";

function createSearchResult(
  target: AppNoteSearchResult["target"],
): AppNoteSearchResult {
  return {
    matchChip: "Metaphor",
    note: {
      acronyms: [],
      body: "Body",
      createdAt: "2026-04-20T10:00:00.000Z",
      id: "note-target",
      labelIds: [],
      metaphors: [],
      title: "Target note",
      updatedAt: "2026-04-25T10:00:00.000Z",
    },
    target,
  };
}

describe("notes search navigation", () => {
  it("resolves attached search targets to editor fields in visible order", () => {
    const firstMetaphor = document.createElement("input");
    const secondMetaphor = document.createElement("input");
    const acronymExpansion = document.createElement("textarea");

    expect(
      resolveNotesSearchTargetElement(
        {
          acronymExpansions: [acronymExpansion],
          acronymShortForms: [],
          body: null,
          metaphorExplanations: [],
          metaphorTitles: [firstMetaphor, secondMetaphor],
          title: null,
        },
        createSearchResult({
          field: "metaphorTitle",
          index: 1,
          match: {
            end: 10,
            start: 4,
          },
        }),
      ),
    ).toBe(secondMetaphor);

    expect(
      resolveNotesSearchTargetElement(
        {
          acronymExpansions: [acronymExpansion],
          acronymShortForms: [],
          body: null,
          metaphorExplanations: [],
          metaphorTitles: [firstMetaphor, secondMetaphor],
          title: null,
        },
        createSearchResult({
          field: "acronymExpansion",
          index: 0,
          match: {
            end: 12,
            start: 0,
          },
        }),
      ),
    ).toBe(acronymExpansion);
  });
});
