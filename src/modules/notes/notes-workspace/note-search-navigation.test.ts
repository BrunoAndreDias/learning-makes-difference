// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import type { AppNoteSearchResult } from "./note-search";
import { resolveNotesSearchTargetElement } from "./note-search-navigation";

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
    const firstMetaphor = document.createElement("textarea");
    const secondMetaphor = document.createElement("textarea");
    const acronymDescription = document.createElement("textarea");

    expect(
      resolveNotesSearchTargetElement(
        {
          acronymDescriptions: [acronymDescription],
          body: null,
          metaphorDescriptions: [firstMetaphor, secondMetaphor],
          title: null,
        },
        createSearchResult({
          field: "metaphorDescription",
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
          acronymDescriptions: [acronymDescription],
          body: null,
          metaphorDescriptions: [firstMetaphor, secondMetaphor],
          title: null,
        },
        createSearchResult({
          field: "acronymDescription",
          index: 0,
          match: {
            end: 12,
            start: 0,
          },
        }),
      ),
    ).toBe(acronymDescription);
  });
});
