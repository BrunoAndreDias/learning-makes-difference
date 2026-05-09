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
      expectedAnswer: "Retrieval practice strengthens access to memory.",
      id: "id-2",
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

  it("keeps Study Note fields and source Note fields independent after creation", () => {
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
        expectedAnswer: "It binds context for recall.",
        labelIds: [],
        prompt: "What does the hippocampus support?",
        sourceBody: "The hippocampus helps bind memory context and navigation.",
        sourceTitle: "Hippocampus source",
      },
    );

    expect(updatedStudyNote).toMatchObject({
      expectedAnswer: "It binds context for recall.",
      prompt: "What does the hippocampus support?",
      source: {
        body: "The hippocampus helps bind memory context and navigation.",
        title: "Hippocampus source",
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
      expectedAnswer: "Use spacing for durable access.",
      labelIds: [],
      prompt: "How does spacing help?",
      sourceBody: "Edited shared source context.",
      sourceTitle: "Edited practice source",
    });

    expect(
      listStudyNotesForUser(studyNotes.getSnapshot(), "user-casey"),
    ).toMatchObject([
      {
        expectedAnswer: "Use spacing for durable access.",
        prompt: "How does spacing help?",
        source: {
          body: "Edited shared source context.",
          title: "Edited practice source",
        },
        sourceNoteId: firstStudyNote.sourceNoteId,
      },
      {
        expectedAnswer: "Broad source about spacing and retrieval.",
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
        expectedAnswer: "Cross-account answer.",
        labelIds: [],
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
