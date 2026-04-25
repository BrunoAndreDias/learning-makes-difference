import { describe, expect, it } from "vitest";

import {
  type AppNote,
  type AppNotesError,
  createAppNotesContext,
  filterNotesByQuery,
  listNotesForUser,
  searchNoteResults,
} from "../src/lib/notes";

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

describe("app notes context", () => {
  it("creates and updates notes for the active account", () => {
    const notes = createAppNotesContext({
      keyPrefix: "notes-test",
      storage: createMemoryStorage(),
    });

    const createdNote = notes.createNote("user-casey", {
      acronyms: [],
      body: "Flash cards reveal the answer after an honest recall attempt.",
      labelIds: [],
      metaphors: [],
      title: "Flash cards",
    });
    const updatedNote = notes.updateNote("user-casey", createdNote.id, {
      acronyms: [],
      body: "Flash cards reveal the answer only after an honest recall attempt.",
      labelIds: [],
      metaphors: [],
      title: "Flash cards",
    });

    expect(updatedNote.id).toBe(createdNote.id);
    expect(listNotesForUser(notes.getSnapshot(), "user-casey")[0]?.body).toBe(
      "Flash cards reveal the answer only after an honest recall attempt.",
    );
  });

  it("keeps notes scoped to the owning account", () => {
    const notes = createAppNotesContext({
      keyPrefix: "notes-test-scope",
      storage: createMemoryStorage(),
    });

    const caseyNote = notes.createNote("user-casey", {
      acronyms: [],
      body: "Concepts can stay unlabeled until the learner is ready to organize.",
      labelIds: [],
      metaphors: [],
      title: "Unlabeled notes",
    });

    notes.createNote("user-jordan", {
      acronyms: [],
      body: "Start with the note, then connect it to labels later.",
      labelIds: [],
      metaphors: [],
      title: "Capture first",
    });

    expect(listNotesForUser(notes.getSnapshot(), "user-casey")).toHaveLength(1);
    expect(listNotesForUser(notes.getSnapshot(), "user-jordan")).toHaveLength(
      1,
    );
    expect(listNotesForUser(notes.getSnapshot(), "user-jordan")[0]?.title).toBe(
      "Capture first",
    );

    expect(() =>
      notes.updateNote("user-jordan", caseyNote.id, {
        acronyms: [],
        body: "This update should be rejected.",
        labelIds: [],
        metaphors: [],
        title: "Cross-account edit",
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "not_found",
      } satisfies Pick<AppNotesError, "code">),
    );
  });

  it("allows unlabeled notes and rejects label assignments outside the account scope", () => {
    const notes = createAppNotesContext({
      keyPrefix: "notes-test-labels",
      storage: createMemoryStorage(),
      getOwnedLabelIdsForUser: (userId) => {
        if (userId === "user-casey") {
          return ["label-science", "label-biology"];
        }

        return ["label-other"];
      },
    });

    const unlabeledNote = notes.createNote("user-casey", {
      acronyms: [],
      body: "Capture first, organize later remains a valid study flow.",
      labelIds: [],
      metaphors: [],
      title: "Unlabeled capture",
    });

    expect(unlabeledNote.labelIds).toEqual([]);

    const labeledNote = notes.updateNote("user-casey", unlabeledNote.id, {
      acronyms: [],
      body: "Now this concept belongs to multiple study topics.",
      labelIds: ["label-science", "label-biology"],
      metaphors: [],
      title: "Organized capture",
    });

    expect(labeledNote.labelIds).toEqual(["label-science", "label-biology"]);

    expect(() =>
      notes.updateNote("user-casey", unlabeledNote.id, {
        acronyms: [],
        body: "Cross-account labels must be rejected.",
        labelIds: ["label-science", "label-other"],
        metaphors: [],
        title: "Invalid labels",
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "invalid_input",
      } satisfies Pick<AppNotesError, "code">),
    );
  });

  it("stores note-owned metaphors and keeps their lifecycle scoped to the owning account", () => {
    const notes = createAppNotesContext({
      keyPrefix: "notes-test-metaphors",
      storage: createMemoryStorage(),
    });

    const createdNote = notes.createNote("user-casey", {
      acronyms: [],
      body: "Mitochondria produce ATP for the cell.",
      labelIds: [],
      metaphors: [
        {
          explanation:
            "It works like a power plant that converts fuel into usable energy.",
          title: "Cell power plant",
        },
      ],
      title: "Mitochondria",
    });

    expect(createdNote.metaphors).toEqual([
      {
        explanation:
          "It works like a power plant that converts fuel into usable energy.",
        title: "Cell power plant",
      },
    ]);

    const updatedNote = notes.updateNote("user-casey", createdNote.id, {
      acronyms: [],
      body: "Mitochondria produce ATP for the cell.",
      labelIds: [],
      metaphors: [
        {
          explanation:
            "It behaves like a rechargeable battery that stores usable energy.",
          title: "Cell battery",
        },
        {
          explanation:
            "It also resembles a power plant that processes incoming fuel.",
          title: "Cell power plant",
        },
      ],
      title: "Mitochondria",
    });

    expect(updatedNote.metaphors).toEqual([
      {
        explanation:
          "It behaves like a rechargeable battery that stores usable energy.",
        title: "Cell battery",
      },
      {
        explanation:
          "It also resembles a power plant that processes incoming fuel.",
        title: "Cell power plant",
      },
    ]);

    const withoutWeakMetaphor = notes.updateNote("user-casey", createdNote.id, {
      acronyms: [],
      body: "Mitochondria produce ATP for the cell.",
      labelIds: [],
      metaphors: [
        {
          explanation:
            "It behaves like a rechargeable battery that stores usable energy.",
          title: "Cell battery",
        },
      ],
      title: "Mitochondria",
    });

    expect(withoutWeakMetaphor.metaphors).toEqual([
      {
        explanation:
          "It behaves like a rechargeable battery that stores usable energy.",
        title: "Cell battery",
      },
    ]);

    expect(() =>
      notes.updateNote("user-jordan", createdNote.id, {
        acronyms: [],
        body: "Cross-account edits must fail.",
        labelIds: [],
        metaphors: [],
        title: "Mitochondria",
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "not_found",
      } satisfies Pick<AppNotesError, "code">),
    );
  });

  it("stores note-owned acronyms and keeps their lifecycle scoped to the owning account", () => {
    const notes = createAppNotesContext({
      keyPrefix: "notes-test-acronyms",
      storage: createMemoryStorage(),
    });

    const createdNote = notes.createNote("user-casey", {
      acronyms: [
        {
          expansion: "First In, First Out",
          shortForm: "FIFO",
        },
      ],
      body: "Queue ordering returns items in insertion order.",
      labelIds: [],
      metaphors: [],
      title: "Queue",
    });

    expect(createdNote.acronyms).toEqual([
      {
        expansion: "First In, First Out",
        shortForm: "FIFO",
      },
    ]);

    const updatedNote = notes.updateNote("user-casey", createdNote.id, {
      acronyms: [
        {
          expansion: "First In, First Out",
          shortForm: "FIFO",
        },
        {
          expansion: "Last In, First Out",
          shortForm: "LIFO",
        },
      ],
      body: "Stacks reverse retrieval order.",
      labelIds: [],
      metaphors: [],
      title: "Queue and stack order",
    });

    expect(updatedNote.acronyms).toEqual([
      {
        expansion: "First In, First Out",
        shortForm: "FIFO",
      },
      {
        expansion: "Last In, First Out",
        shortForm: "LIFO",
      },
    ]);

    const withoutWeakAcronym = notes.updateNote("user-casey", createdNote.id, {
      acronyms: [
        {
          expansion: "Last In, First Out",
          shortForm: "LIFO",
        },
      ],
      body: "Stacks reverse retrieval order.",
      labelIds: [],
      metaphors: [],
      title: "Queue and stack order",
    });

    expect(withoutWeakAcronym.acronyms).toEqual([
      {
        expansion: "Last In, First Out",
        shortForm: "LIFO",
      },
    ]);

    expect(() =>
      notes.updateNote("user-jordan", createdNote.id, {
        acronyms: [],
        body: "Cross-account edits must fail.",
        labelIds: [],
        metaphors: [],
        title: "Queue",
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "not_found",
      } satisfies Pick<AppNotesError, "code">),
    );
  });

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
