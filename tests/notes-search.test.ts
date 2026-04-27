import { describe, expect, it } from "vitest";

import {
  filterNotesByQuery,
  searchNoteResults,
} from "../src/features/notes/note-search";
import type { AppNote } from "../src/features/notes/notes";
import {
  createAppNotesContext,
  listNotesForUser,
} from "../src/features/notes/notes";

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe("notes search results", () => {
  it("matches note search against note text and attached memory aids while returning owning notes", () => {
    const notes = createAppNotesContext({
      keyPrefix: "notes-test-search",
      storage: createMemoryStorage(),
    });

    notes.createNote("user-casey", {
      acronyms: [
        {
          expansion: "Long-Term Potentiation",
          shortForm: "LTP",
        },
      ],
      body: "Stronger synapses become easier to activate after repeated use.",
      labelIds: [],
      metaphors: [
        {
          explanation:
            "It is like carving a groove into a trail so the next walk follows it more easily.",
          title: "Forest trail",
        },
      ],
      title: "Synaptic plasticity",
    });
    notes.createNote("user-casey", {
      acronyms: [],
      body: "Working memory holds a small amount of information temporarily.",
      labelIds: [],
      metaphors: [],
      title: "Working memory",
    });
    notes.createNote("user-jordan", {
      acronyms: [
        {
          expansion: "Long-Term Potentiation",
          shortForm: "LTP",
        },
      ],
      body: "Another account should stay invisible to Casey's search.",
      labelIds: [],
      metaphors: [],
      title: "Hidden note",
    });

    const visibleNotes = listNotesForUser(notes.getSnapshot(), "user-casey");

    expect(filterNotesByQuery(visibleNotes, "groove")).toMatchObject([
      { title: "Synaptic plasticity" },
    ]);
    expect(
      filterNotesByQuery(visibleNotes, "long-term potentiation"),
    ).toMatchObject([{ title: "Synaptic plasticity" }]);
    expect(filterNotesByQuery(visibleNotes, "working")).toMatchObject([
      { title: "Working memory" },
    ]);
    expect(filterNotesByQuery(visibleNotes, "hidden note")).toEqual([]);
    expect(
      searchNoteResults(visibleNotes, "synaptic plasticity"),
    ).toMatchObject([
      { matchChip: "Title", note: { title: "Synaptic plasticity" } },
    ]);
    expect(searchNoteResults(visibleNotes, "small amount")).toMatchObject([
      { matchChip: "Body", note: { title: "Working memory" } },
    ]);
    expect(searchNoteResults(visibleNotes, "forest trail")).toMatchObject([
      { matchChip: "Metaphor", note: { title: "Synaptic plasticity" } },
    ]);
    expect(searchNoteResults(visibleNotes, "ltp")).toMatchObject([
      { matchChip: "Acronym", note: { title: "Synaptic plasticity" } },
    ]);
  });

  it("ranks note search results by match chip priority and note recency", () => {
    const notes: AppNote[] = [
      {
        acronyms: [],
        body: "The shared cue appears in body copy.",
        createdAt: "2026-04-20T10:00:00.000Z",
        id: "body-older",
        labelIds: [],
        metaphors: [],
        title: "Older body note",
        updatedAt: "2026-04-22T10:00:00.000Z",
      },
      {
        acronyms: [],
        body: "Another shared cue appears in body copy.",
        createdAt: "2026-04-20T10:00:00.000Z",
        id: "body-newer",
        labelIds: [],
        metaphors: [],
        title: "Newer body note",
        updatedAt: "2026-04-24T10:00:00.000Z",
      },
      {
        acronyms: [
          {
            expansion: "Shared Cue",
            shortForm: "SC",
          },
        ],
        body: "Mnemonic content only.",
        createdAt: "2026-04-20T10:00:00.000Z",
        id: "acronym",
        labelIds: [],
        metaphors: [],
        title: "Acronym note",
        updatedAt: "2026-04-25T10:00:00.000Z",
      },
      {
        acronyms: [],
        body: "Visual memory aid only.",
        createdAt: "2026-04-20T10:00:00.000Z",
        id: "metaphor",
        labelIds: [],
        metaphors: [
          {
            explanation: "A shared cue acts like a lighthouse.",
            title: "Lighthouse",
          },
        ],
        title: "Metaphor note",
        updatedAt: "2026-04-25T10:00:00.000Z",
      },
      {
        acronyms: [],
        body: "The shared cue also appears here.",
        createdAt: "2026-04-20T10:00:00.000Z",
        id: "title",
        labelIds: [],
        metaphors: [
          {
            explanation: "Shared cue also appears in an attached metaphor.",
            title: "Duplicate match",
          },
        ],
        title: "Shared cue title",
        updatedAt: "2026-04-21T10:00:00.000Z",
      },
    ];

    expect(searchNoteResults(notes, "shared cue")).toMatchObject([
      { matchChip: "Title", note: { id: "title" } },
      { matchChip: "Body", note: { id: "body-newer" } },
      { matchChip: "Body", note: { id: "body-older" } },
      { matchChip: "Metaphor", note: { id: "metaphor" } },
      { matchChip: "Acronym", note: { id: "acronym" } },
    ]);
  });

  it("includes first-occurrence editor targets for search navigation", () => {
    const notes: AppNote[] = [
      {
        acronyms: [
          {
            expansion: "Another cue before Target Cue appears.",
            shortForm: "TC",
          },
        ],
        body: "Body copy without the phrase.",
        createdAt: "2026-04-20T10:00:00.000Z",
        id: "target",
        labelIds: [],
        metaphors: [
          {
            explanation: "Later Target Cue should not win.",
            title: "First Target Cue field",
          },
        ],
        title: "Target note",
        updatedAt: "2026-04-25T10:00:00.000Z",
      },
    ];

    expect(searchNoteResults(notes, "target cue")).toMatchObject([
      {
        matchChip: "Metaphor",
        target: {
          field: "metaphorTitle",
          index: 0,
          match: {
            end: 16,
            start: 6,
          },
        },
      },
    ]);
  });
});
