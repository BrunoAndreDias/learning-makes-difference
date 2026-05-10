import { describe, expect, it } from "vitest";

import {
  type AppStudyNotesError,
  createAppStudyNotesContext,
  listStudyNotesForUser,
} from "./study-notes";

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

function createDeterministicCrypto() {
  let index = 0;

  return {
    randomUUID() {
      index += 1;
      return `id-${index}`;
    },
  };
}

describe("app study notes context", () => {
  it("creates a Study Note with a supporting source Note and copied defaults", () => {
    const studyNotes = createAppStudyNotesContext({
      crypto: createDeterministicCrypto(),
      keyPrefix: "study-notes-create-test",
      storage: createMemoryStorage(),
    });

    const createdStudyNote = studyNotes.createStudyNote("user-casey", {
      sourceBody: "Retrieval practice strengthens access to memory.",
      sourceTitle: "Retrieval practice",
    });

    expect(createdStudyNote).toMatchObject({
      acronyms: [],
      expectedAnswer: "Retrieval practice strengthens access to memory.",
      id: "id-2",
      labelIds: [],
      metaphors: [],
      prompt: "Retrieval practice",
      source: {
        body: "Retrieval practice strengthens access to memory.",
        id: "id-1",
        title: "Retrieval practice",
      },
      sourceNoteId: "id-1",
    });
    expect(
      listStudyNotesForUser(studyNotes.getSnapshot(), "user-casey"),
    ).toEqual([createdStudyNote]);
  });

  it("keeps Study Note fields, labels, and memory hooks independent after creation", () => {
    const studyNotes = createAppStudyNotesContext({
      crypto: createDeterministicCrypto(),
      keyPrefix: "study-notes-independent-test",
      storage: createMemoryStorage(),
    });
    const createdStudyNote = studyNotes.createStudyNote("user-casey", {
      sourceBody: "The hippocampus helps bind memory context.",
      sourceTitle: "Hippocampus",
    });

    const updatedStudyNote = studyNotes.updateStudyNote(
      "user-casey",
      createdStudyNote.id,
      {
        acronyms: [{ description: "HIP keeps the structure memorable." }],
        expectedAnswer: "It binds context for recall.",
        labelIds: [],
        metaphors: [
          { description: "The hippocampus is a library index for memory." },
        ],
        prompt: "What does the hippocampus support?",
        sourceBody: "The hippocampus helps bind memory context and navigation.",
        sourceTitle: "Hippocampus source",
      },
    );

    expect(updatedStudyNote).toMatchObject({
      acronyms: [{ description: "HIP keeps the structure memorable." }],
      expectedAnswer: "It binds context for recall.",
      metaphors: [
        { description: "The hippocampus is a library index for memory." },
      ],
      prompt: "What does the hippocampus support?",
      source: {
        body: "The hippocampus helps bind memory context and navigation.",
        title: "Hippocampus source",
      },
    });
  });

  it("saves incomplete Study Notes with a prompt and rejects saving without a prompt", () => {
    const studyNotes = createAppStudyNotesContext({
      crypto: createDeterministicCrypto(),
      keyPrefix: "study-notes-readiness-test",
      storage: createMemoryStorage(),
    });

    const incompleteStudyNote = studyNotes.createStudyNote("user-casey", {
      expectedAnswer: " ",
      prompt: "What still needs an answer?",
      sourceBody: "",
      sourceTitle: "",
    });

    expect(incompleteStudyNote).toMatchObject({
      expectedAnswer: "",
      prompt: "What still needs an answer?",
      source: {
        body: "",
        title: "",
      },
    });
    expect(() =>
      studyNotes.createStudyNote("user-casey", {
        expectedAnswer: "Answer without prompt.",
        prompt: " ",
        sourceBody: "",
        sourceTitle: "",
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "invalid_input",
        message: "Prompt is required.",
      } satisfies Pick<AppStudyNotesError, "code" | "message">),
    );
  });

  it("keeps Study Notes recallable when their expected answer is filled and source body is blank", () => {
    const studyNotes = createAppStudyNotesContext({
      crypto: createDeterministicCrypto(),
      keyPrefix: "study-notes-recallable-blank-source-test",
      storage: createMemoryStorage(),
    });

    const studyNote = studyNotes.createStudyNote("user-casey", {
      expectedAnswer: "The expected answer drives recall.",
      prompt: "What drives recall?",
      sourceBody: "",
      sourceTitle: "",
    });

    expect(studyNote).toMatchObject({
      expectedAnswer: "The expected answer drives recall.",
      prompt: "What drives recall?",
      source: {
        body: "",
        title: "",
      },
    });
  });

  it("adds sibling Study Notes from untitled sources with a saveable prompt", () => {
    const studyNotes = createAppStudyNotesContext({
      crypto: createDeterministicCrypto(),
      keyPrefix: "study-notes-sibling-untitled-source-test",
      storage: createMemoryStorage(),
    });
    const firstStudyNote = studyNotes.createStudyNote("user-casey", {
      expectedAnswer: "",
      prompt: "First prompt",
      sourceBody: "",
      sourceTitle: "",
    });

    const siblingStudyNote = studyNotes.createStudyNoteFromSource(
      "user-casey",
      {
        sourceNoteId: firstStudyNote.sourceNoteId,
      },
    );

    expect(siblingStudyNote).toMatchObject({
      expectedAnswer: "",
      prompt: "New Study Note",
      source: {
        body: "",
        title: "",
      },
    });
  });

  it("creates another Study Note from an existing source and shares source edits", () => {
    const studyNotes = createAppStudyNotesContext({
      crypto: createDeterministicCrypto(),
      keyPrefix: "study-notes-shared-source-test",
      storage: createMemoryStorage(),
    });
    const firstStudyNote = studyNotes.createStudyNote("user-casey", {
      sourceBody: "Broad source about spacing and retrieval.",
      sourceTitle: "Practice source",
    });

    const secondStudyNote = studyNotes.createStudyNoteFromSource("user-casey", {
      sourceNoteId: firstStudyNote.sourceNoteId,
    });
    studyNotes.updateStudyNote("user-casey", secondStudyNote.id, {
      acronyms: [{ description: "SPA cues spacing." }],
      expectedAnswer: "Use spacing for durable access.",
      labelIds: [],
      metaphors: [{ description: "Spacing is a path worn in over time." }],
      prompt: "How does spacing help?",
      sourceBody: "Edited shared source context.",
      sourceTitle: "Edited practice source",
    });

    expect(
      listStudyNotesForUser(studyNotes.getSnapshot(), "user-casey"),
    ).toMatchObject([
      {
        acronyms: [{ description: "SPA cues spacing." }],
        expectedAnswer: "Use spacing for durable access.",
        metaphors: [{ description: "Spacing is a path worn in over time." }],
        prompt: "How does spacing help?",
        source: {
          body: "Edited shared source context.",
          title: "Edited practice source",
        },
        sourceNoteId: firstStudyNote.sourceNoteId,
      },
      {
        acronyms: [],
        expectedAnswer: "Broad source about spacing and retrieval.",
        metaphors: [],
        prompt: "Practice source",
        source: {
          body: "Edited shared source context.",
          title: "Edited practice source",
        },
        sourceNoteId: firstStudyNote.sourceNoteId,
      },
    ]);
  });

  it("deletes shared Study Notes without orphaning the last source Note", () => {
    const studyNotes = createAppStudyNotesContext({
      crypto: createDeterministicCrypto(),
      keyPrefix: "study-notes-delete-test",
      storage: createMemoryStorage(),
    });
    const firstStudyNote = studyNotes.createStudyNote("user-casey", {
      sourceBody: "Shared source body.",
      sourceTitle: "Shared source",
    });
    const secondStudyNote = studyNotes.createStudyNoteFromSource("user-casey", {
      sourceNoteId: firstStudyNote.sourceNoteId,
    });

    studyNotes.deleteStudyNote("user-casey", secondStudyNote.id, {
      deleteSource: false,
    });

    expect(
      listStudyNotesForUser(studyNotes.getSnapshot(), "user-casey"),
    ).toMatchObject([
      {
        id: firstStudyNote.id,
        sourceNoteId: firstStudyNote.sourceNoteId,
      },
    ]);
    expect(() =>
      studyNotes.deleteStudyNote("user-casey", firstStudyNote.id, {
        deleteSource: false,
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "invalid_input",
      } satisfies Pick<AppStudyNotesError, "code">),
    );

    studyNotes.deleteStudyNote("user-casey", firstStudyNote.id, {
      deleteSource: true,
    });

    expect(
      listStudyNotesForUser(studyNotes.getSnapshot(), "user-casey"),
    ).toEqual([]);
  });

  it("keeps Study Notes scoped to the owning account", () => {
    const studyNotes = createAppStudyNotesContext({
      keyPrefix: "study-notes-scope-test",
      storage: createMemoryStorage(),
    });
    const createdStudyNote = studyNotes.createStudyNote("user-casey", {
      sourceBody: "Spacing creates desirable difficulty.",
      sourceTitle: "Spacing effect",
    });

    expect(() =>
      studyNotes.updateStudyNote("user-jordan", createdStudyNote.id, {
        acronyms: [],
        expectedAnswer: "Cross-account answer.",
        labelIds: [],
        metaphors: [],
        prompt: "Cross-account prompt",
        sourceBody: "Cross-account source.",
        sourceTitle: "Cross-account source",
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "not_found",
      } satisfies Pick<AppStudyNotesError, "code">),
    );
  });
});
