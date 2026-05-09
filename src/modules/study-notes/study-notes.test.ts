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
        acronyms: [],
        expectedAnswer: "It binds context for recall.",
        metaphors: [],
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
