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

  it("keeps Study Note fields, labels, and memory aids independent after creation", () => {
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
        acceptedVariants: [],
        acronyms: [{ description: "HIP keeps the structure memorable." }],
        expectedAnswer: "It binds context for recall.",
        keyIdeas: [],
        labelIds: [],
        metaphors: [
          { description: "The hippocampus is a library index for memory." },
        ],
        prompt: "What does the hippocampus support?",
        prohibitedPhrases: [],
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

  it("keeps Metaphor and Acronym create input to one support description each", () => {
    const studyNotes = createAppStudyNotesContext({
      crypto: createDeterministicCrypto(),
      keyPrefix: "study-notes-single-memory-aid-create-test",
      storage: createMemoryStorage(),
    });

    const createdStudyNote = studyNotes.createStudyNote("user-casey", {
      acronyms: [{ description: "HIP keeps the structure memorable." }],
      expectedAnswer: "It binds context for recall.",
      metaphors: [
        { description: "The hippocampus is a library index for memory." },
      ],
      prompt: "What does the hippocampus support?",
      sourceBody: "The hippocampus helps bind memory context.",
      sourceTitle: "Hippocampus",
    });

    expect(createdStudyNote).toMatchObject({
      acronyms: [{ description: "HIP keeps the structure memorable." }],
      metaphors: [
        { description: "The hippocampus is a library index for memory." },
      ],
    });
    expect(() =>
      studyNotes.createStudyNote("user-casey", {
        acronyms: [
          { description: "HIP keeps the structure memorable." },
          { description: "IDX means index." },
        ],
        expectedAnswer: "It binds context for recall.",
        metaphors: [
          { description: "The hippocampus is a library index for memory." },
          { description: "The hippocampus is a checkout desk." },
        ],
        prompt: "What does the hippocampus support?",
        sourceBody: "The hippocampus helps bind memory context.",
        sourceTitle: "Hippocampus",
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "invalid_input",
        message: "Only one acronym can be saved per Study Note.",
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

  it("keeps Metaphor and Acronym update input to one support description each", () => {
    const studyNotes = createAppStudyNotesContext({
      crypto: createDeterministicCrypto(),
      keyPrefix: "study-notes-single-memory-aid-update-test",
      storage: createMemoryStorage(),
    });
    const createdStudyNote = studyNotes.createStudyNote("user-casey", {
      expectedAnswer: "It binds context for recall.",
      prompt: "What does the hippocampus support?",
      sourceBody: "The hippocampus helps bind memory context.",
      sourceTitle: "Hippocampus",
    });

    expect(() =>
      studyNotes.updateStudyNote("user-casey", createdStudyNote.id, {
        acceptedVariants: [],
        acronyms: [{ description: "HIP." }, { description: "CTX." }],
        expectedAnswer: "It binds context for recall.",
        keyIdeas: [],
        labelIds: [],
        metaphors: [
          { description: "The hippocampus is a library index." },
          { description: "The hippocampus is a checkout desk." },
        ],
        prompt: "What does the hippocampus support?",
        prohibitedPhrases: [],
        sourceBody: "The hippocampus helps bind memory context.",
        sourceTitle: "Hippocampus source",
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "invalid_input",
        message: "Only one acronym can be saved per Study Note.",
      } satisfies Pick<AppStudyNotesError, "code" | "message">),
    );
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
      prompt: "First prompt",
      source: {
        body: "",
        displayName: "First prompt",
        title: "",
      },
    });
  });

  it("shares source material across sibling Study Notes until one is edited", () => {
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
    expect(secondStudyNote.sourceNoteId).toBe(firstStudyNote.sourceNoteId);

    const updatedSecondStudyNote = studyNotes.updateStudyNote(
      "user-casey",
      secondStudyNote.id,
      {
        acceptedVariants: [],
        acronyms: [{ description: "SPA cues spacing." }],
        expectedAnswer: "Use spacing for durable access.",
        keyIdeas: [],
        labelIds: [],
        metaphors: [{ description: "Spacing is a path worn in over time." }],
        prompt: "How does spacing help?",
        prohibitedPhrases: [],
        sourceBody: "Edited shared source context.",
        sourceTitle: "Edited practice source",
      },
    );

    expect(updatedSecondStudyNote.sourceNoteId).not.toBe(
      firstStudyNote.sourceNoteId,
    );

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
        sourceNoteId: updatedSecondStudyNote.sourceNoteId,
      },
      {
        acronyms: [],
        expectedAnswer: "Broad source about spacing and retrieval.",
        metaphors: [],
        prompt: "Practice source",
        source: {
          body: "Broad source about spacing and retrieval.",
          title: "Practice source",
        },
        sourceNoteId: firstStudyNote.sourceNoteId,
      },
    ]);
  });

  it("keeps a shared source linked when only Study Note-owned fields change", () => {
    const studyNotes = createAppStudyNotesContext({
      crypto: createDeterministicCrypto(),
      keyPrefix: "study-notes-shared-source-owned-fields-test",
      storage: createMemoryStorage(),
    });
    const firstStudyNote = studyNotes.createStudyNote("user-casey", {
      sourceBody: "Broad source about spacing and retrieval.",
      sourceTitle: "Practice source",
    });
    const secondStudyNote = studyNotes.createStudyNoteFromSource("user-casey", {
      sourceNoteId: firstStudyNote.sourceNoteId,
    });

    const updatedSecondStudyNote = studyNotes.updateStudyNote(
      "user-casey",
      secondStudyNote.id,
      {
        acceptedVariants: [],
        acronyms: [],
        expectedAnswer: "Use spacing for durable access.",
        keyIdeas: [],
        labelIds: [],
        metaphors: [],
        prompt: "How does spacing help?",
        prohibitedPhrases: [],
        sourceBody: "Broad source about spacing and retrieval.",
        sourceTitle: "Practice source",
      },
    );

    expect(updatedSecondStudyNote.sourceNoteId).toBe(
      firstStudyNote.sourceNoteId,
    );
    expect(
      listStudyNotesForUser(studyNotes.getSnapshot(), "user-casey"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: firstStudyNote.id,
          sourceNoteId: firstStudyNote.sourceNoteId,
        }),
        expect.objectContaining({
          id: secondStudyNote.id,
          prompt: "How does spacing help?",
          sourceNoteId: firstStudyNote.sourceNoteId,
        }),
      ]),
    );
  });

  it("detaches legacy shared source material when one Study Note is edited", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      "study-notes-legacy-detach-test:records",
      JSON.stringify([
        {
          acronyms: [],
          createdAt: "2025-01-01T00:00:00.000Z",
          expectedAnswer: "Answer one",
          id: "study-one",
          labelIds: [],
          metaphors: [],
          prompt: "Prompt one",
          source: {
            body: "Original shared source.",
            id: "source-shared",
            title: "Shared source",
            updatedAt: "2025-01-01T00:00:00.000Z",
          },
          sourceNoteId: "source-shared",
          updatedAt: "2025-01-01T00:00:00.000Z",
          userId: "user-casey",
        },
        {
          acronyms: [],
          createdAt: "2025-01-01T00:00:01.000Z",
          expectedAnswer: "Answer two",
          id: "study-two",
          labelIds: [],
          metaphors: [],
          prompt: "Prompt two",
          source: {
            body: "Original shared source.",
            id: "source-shared",
            title: "Shared source",
            updatedAt: "2025-01-01T00:00:00.000Z",
          },
          sourceNoteId: "source-shared",
          updatedAt: "2025-01-01T00:00:01.000Z",
          userId: "user-casey",
        },
      ]),
    );
    const studyNotes = createAppStudyNotesContext({
      crypto: createDeterministicCrypto(),
      keyPrefix: "study-notes-legacy-detach-test",
      storage,
    });

    studyNotes.updateStudyNote("user-casey", "study-one", {
      acceptedVariants: [],
      acronyms: [],
      expectedAnswer: "Answer one",
      keyIdeas: [],
      labelIds: [],
      metaphors: [],
      prompt: "Prompt one",
      prohibitedPhrases: [],
      sourceBody: "Edited source for one.",
      sourceTitle: "Edited source",
    });

    const listedStudyNotes = listStudyNotesForUser(
      studyNotes.getSnapshot(),
      "user-casey",
    );
    expect(listedStudyNotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "study-one",
          source: expect.objectContaining({
            body: "Edited source for one.",
            title: "Edited source",
          }),
          sourceNoteId: "id-1",
        }),
        expect.objectContaining({
          id: "study-two",
          source: expect.objectContaining({
            body: "Original shared source.",
            title: "Shared source",
          }),
          sourceNoteId: "source-shared",
        }),
      ]),
    );
  });

  it("defaults legacy answer-check reference material to empty arrays", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      "study-notes-legacy-answer-check-test:records",
      JSON.stringify([
        {
          acronyms: [],
          createdAt: "2025-01-01T00:00:00.000Z",
          expectedAnswer: "Answer one",
          id: "study-one",
          labelIds: [],
          metaphors: [],
          prompt: "Prompt one",
          source: {
            body: "Original shared source.",
            id: "source-shared",
            title: "Shared source",
            updatedAt: "2025-01-01T00:00:00.000Z",
          },
          sourceNoteId: "source-shared",
          updatedAt: "2025-01-01T00:00:00.000Z",
          userId: "user-casey",
        },
      ]),
    );
    const studyNotes = createAppStudyNotesContext({
      crypto: createDeterministicCrypto(),
      keyPrefix: "study-notes-legacy-answer-check-test",
      storage,
    });

    expect(
      listStudyNotesForUser(studyNotes.getSnapshot(), "user-casey"),
    ).toMatchObject([
      {
        acceptedVariants: [],
        keyIdeas: [],
        prohibitedPhrases: [],
      },
    ]);
  });

  it("validates answer-check reference material without requiring it", () => {
    const studyNotes = createAppStudyNotesContext({
      crypto: createDeterministicCrypto(),
      keyPrefix: "study-notes-answer-check-validation-test",
      storage: createMemoryStorage(),
    });

    expect(() =>
      studyNotes.createStudyNote("user-casey", {
        expectedAnswer: "Retrieval practice strengthens access to memory.",
        keyIdeas: [
          {
            acceptedPhrases: [],
            id: "key-1",
            importance: "required",
            prohibitedPhrases: [],
            text: " ",
          },
        ],
        prompt: "Why does retrieval practice help learning?",
        sourceBody: "Practice recalling before review.",
        sourceTitle: "Retrieval practice",
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "invalid_input",
        message: "Key Idea is required.",
      } satisfies Pick<AppStudyNotesError, "code" | "message">),
    );

    const createdStudyNote = studyNotes.createStudyNote("user-casey", {
      expectedAnswer: "Retrieval practice strengthens access to memory.",
      prompt: "Why does retrieval practice help learning?",
      sourceBody: "Practice recalling before review.",
      sourceTitle: "Retrieval practice",
    });

    expect(() =>
      studyNotes.updateStudyNote("user-casey", createdStudyNote.id, {
        acceptedVariants: [
          {
            id: "variant-1",
            text: "Test yourself before rereading.",
          },
          {
            id: "variant-1",
            text: "Practice recalling before review.",
          },
        ],
        acronyms: [],
        expectedAnswer: "Retrieval practice strengthens access to memory.",
        keyIdeas: [],
        labelIds: [],
        metaphors: [],
        prompt: "Why does retrieval practice help learning?",
        prohibitedPhrases: [],
        sourceBody: "Practice recalling before review.",
        sourceTitle: "Retrieval practice",
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "invalid_input",
        message: "Accepted Variant ids must be unique per Study Note.",
      } satisfies Pick<AppStudyNotesError, "code" | "message">),
    );
  });

  it("keeps source Note titles optional and derives copied source display names from each owning Study Note prompt", () => {
    const studyNotes = createAppStudyNotesContext({
      crypto: createDeterministicCrypto(),
      keyPrefix: "study-notes-untitled-source-test",
      storage: createMemoryStorage(),
    });
    const createdStudyNote = studyNotes.createStudyNote("user-casey", {
      expectedAnswer: "First answer.",
      prompt: "Oldest prompt",
      sourceBody: "Shared source body.",
      sourceTitle: "",
    });
    const secondStudyNote = studyNotes.createStudyNoteFromSource("user-casey", {
      sourceNoteId: createdStudyNote.sourceNoteId,
    });

    expect(createdStudyNote.source).toMatchObject({
      displayName: "Oldest prompt",
      title: "",
    });
    expect(secondStudyNote).toMatchObject({
      prompt: "Oldest prompt",
      source: {
        displayName: "Oldest prompt",
        title: "",
      },
    });

    studyNotes.updateStudyNote("user-casey", secondStudyNote.id, {
      acceptedVariants: [],
      acronyms: [],
      expectedAnswer: "Second answer.",
      keyIdeas: [],
      labelIds: [],
      metaphors: [],
      prompt: "Newer prompt",
      prohibitedPhrases: [],
      sourceBody: "Shared source body.",
      sourceTitle: "",
    });
    studyNotes.updateStudyNote("user-casey", createdStudyNote.id, {
      acceptedVariants: [],
      acronyms: [],
      expectedAnswer: "First answer.",
      keyIdeas: [],
      labelIds: [],
      metaphors: [],
      prompt: "Renamed oldest prompt",
      prohibitedPhrases: [],
      sourceBody: "Shared source body.",
      sourceTitle: "",
    });

    expect(
      listStudyNotesForUser(studyNotes.getSnapshot(), "user-casey"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          prompt: "Renamed oldest prompt",
          source: expect.objectContaining({
            displayName: "Renamed oldest prompt",
            title: "",
          }),
        }),
        expect.objectContaining({
          prompt: "Newer prompt",
          source: expect.objectContaining({
            displayName: "Renamed oldest prompt",
            title: "",
          }),
        }),
      ]),
    );
    expect(studyNotes.getSnapshot()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.objectContaining({
            title: "",
          }),
        }),
      ]),
    );
  });

  it("allows deleting a sibling without deleting the shared source but still protects the last source Note", () => {
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

  it("removes deleted Label assignments only from the owning account's active Study Notes", () => {
    const studyNotes = createAppStudyNotesContext({
      crypto: createDeterministicCrypto(),
      keyPrefix: "study-notes-delete-label-assignments-test",
      storage: createMemoryStorage(),
    });

    studyNotes.createStudyNote("user-casey", {
      labelIds: ["label-biology", "label-history"],
      sourceBody: "Casey source.",
      sourceTitle: "Casey note",
    });
    studyNotes.createStudyNote("user-jordan", {
      labelIds: ["label-biology"],
      sourceBody: "Jordan source.",
      sourceTitle: "Jordan note",
    });

    studyNotes.removeLabelAssignments("user-casey", "label-biology");

    expect(
      listStudyNotesForUser(studyNotes.getSnapshot(), "user-casey"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          labelIds: ["label-history"],
        }),
      ]),
    );
    expect(
      listStudyNotesForUser(studyNotes.getSnapshot(), "user-jordan"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          labelIds: ["label-biology"],
        }),
      ]),
    );
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
        acceptedVariants: [],
        acronyms: [],
        expectedAnswer: "Cross-account answer.",
        keyIdeas: [],
        labelIds: [],
        metaphors: [],
        prompt: "Cross-account prompt",
        prohibitedPhrases: [],
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
