import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPgliteServiceTestDatabase } from "../../lib/db/pglite-service-test-db";
import { authSchema, usersTable } from "../access/session/auth-schema";
import {
  labelsSchema,
  labelsTable,
  studyNoteLabelsTable,
} from "../labels/labels-schema";
import { notesSchema, notesTable } from "../notes/notes-schema";
import {
  studyNoteAcceptedVariantsTable,
  studyNoteAcronymsTable,
  studyNoteKeyIdeasTable,
  studyNoteMetaphorsTable,
  studyNoteProhibitedPhrasesTable,
  studyNotesSchema,
  studyNotesTable,
} from "./study-notes-schema";
import { createStudyNotesService } from "./study-notes-service";

const studyNotesTestSchema = {
  ...authSchema,
  ...labelsSchema,
  ...notesSchema,
  ...studyNotesSchema,
};

function createDeterministicCrypto() {
  let index = 0;

  return {
    randomUUID() {
      index += 1;
      return `id-${index}`;
    },
  };
}

const TEST_CREATED_AT = new Date("2026-05-02T12:00:00.000Z");
const TEST_UPDATED_AT = new Date("2026-05-02T12:30:00.000Z");

type TestUserInsert = typeof usersTable.$inferInsert;

function createUserValues(
  overrides: Pick<TestUserInsert, "displayName" | "email" | "id">,
): TestUserInsert {
  return {
    createdAt: TEST_CREATED_AT,
    passwordHash: "hash",
    updatedAt: TEST_CREATED_AT,
    userLanguage: "en",
    ...overrides,
  };
}

describe("createStudyNotesService", () => {
  let testDatabase: Awaited<
    ReturnType<
      typeof createPgliteServiceTestDatabase<typeof studyNotesTestSchema>
    >
  >;

  beforeAll(async () => {
    testDatabase = await createPgliteServiceTestDatabase(studyNotesTestSchema);
  });

  afterEach(async () => {
    await testDatabase.reset();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  function byId(left: { id: string }, right: { id: string }) {
    return left.id.localeCompare(right.id);
  }

  async function createStudyNotesHarness(
    options: { now?: () => Date; users?: TestUserInsert[] } = {},
  ) {
    const db = testDatabase.db;
    await db.insert(usersTable).values(
      options.users ?? [
        createUserValues({
          displayName: "Casey Learner",
          email: "casey@example.com",
          id: "user-casey",
        }),
      ],
    );
    const studyNotes = createStudyNotesService({
      crypto: createDeterministicCrypto(),
      db,
      now: options.now ?? (() => TEST_CREATED_AT),
    });

    return { db, studyNotes };
  }

  it("persists Study Notes with default source Notes and independent copied fields", async () => {
    const { db, studyNotes } = await createStudyNotesHarness();

    const createdStudyNote = await studyNotes.createStudyNote({
      input: {
        sourceBody: "Practice recall before reviewing the answer.",
        sourceTitle: "Active recall",
      },
      userId: "user-casey",
    });

    expect(createdStudyNote).toMatchObject({
      acronyms: [],
      expectedAnswer: "Practice recall before reviewing the answer.",
      id: "id-2",
      labelIds: [],
      metaphors: [],
      prompt: "Active recall",
      source: {
        body: "Practice recall before reviewing the answer.",
        id: "id-1",
        title: "Active recall",
      },
      sourceNoteId: "id-1",
    });

    const updatedStudyNote = await studyNotes.updateStudyNote({
      input: {
        acceptedVariants: [],
        acronyms: [],
        expectedAnswer: "Recall first, then review.",
        keyIdeas: [],
        labelIds: [],
        metaphors: [],
        prompt: "How should active recall feel?",
        prohibitedPhrases: [],
        sourceBody: "Practice recall before reviewing the answer. Add context.",
        sourceTitle: "Active recall source",
        studyNoteId: createdStudyNote.id,
      },
      userId: "user-casey",
    });

    await expect(
      Promise.all([
        studyNotes.listStudyNotes({ userId: "user-casey" }),
        db.select().from(notesTable),
      ]),
    ).resolves.toMatchObject([
      [
        {
          expectedAnswer: "Recall first, then review.",
          prompt: "How should active recall feel?",
          source: {
            body: "Practice recall before reviewing the answer. Add context.",
            title: "Active recall source",
          },
        },
      ],
      [
        {
          body: "Practice recall before reviewing the answer. Add context.",
          id: updatedStudyNote.sourceNoteId,
          title: "Active recall source",
          userId: "user-casey",
        },
      ],
    ]);
  });

  it("persists incomplete Study Notes with prompt-only readiness and optional source fields", async () => {
    const { studyNotes } = await createStudyNotesHarness();

    const incompleteStudyNote = await studyNotes.createStudyNote({
      input: {
        expectedAnswer: " ",
        prompt: "What still needs an answer?",
        sourceBody: "",
        sourceTitle: "",
      },
      userId: "user-casey",
    });

    expect(incompleteStudyNote).toMatchObject({
      expectedAnswer: "",
      prompt: "What still needs an answer?",
      source: {
        body: "",
        title: "",
      },
    });
    await expect(
      studyNotes.createStudyNote({
        input: {
          expectedAnswer: "Answer without prompt.",
          prompt: " ",
          sourceBody: "",
          sourceTitle: "",
        },
        userId: "user-casey",
      }),
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: "Prompt is required.",
    });
  });

  it("defaults answer-check reference material to empty arrays and persists saved reference material", async () => {
    const { db, studyNotes } = await createStudyNotesHarness();

    const createdStudyNote = await studyNotes.createStudyNote({
      input: {
        expectedAnswer: "Retrieval practice strengthens access to memory.",
        prompt: "Why does retrieval practice help learning?",
        sourceBody: "Practice recalling before review.",
        sourceTitle: "Retrieval practice",
      },
      userId: "user-casey",
    });

    expect(createdStudyNote).toMatchObject({
      acceptedVariants: [],
      keyIdeas: [],
      prohibitedPhrases: [],
    });

    const updatedStudyNote = await studyNotes.updateStudyNote({
      input: {
        acceptedVariants: [
          {
            id: "variant-1",
            text: "It strengthens retrieval routes before review.",
          },
        ],
        acronyms: [],
        expectedAnswer: "Retrieval practice strengthens access to memory.",
        keyIdeas: [
          {
            acceptedPhrases: ["strengthens retrieval routes"],
            id: "key-1",
            importance: "required",
            prohibitedPhrases: ["just rereading"],
            text: "Practice recalling before review.",
          },
          {
            acceptedPhrases: [],
            id: "key-2",
            importance: "supporting",
            prohibitedPhrases: [],
            text: "The retrieval path gets stronger with effort.",
          },
        ],
        labelIds: [],
        metaphors: [],
        prompt: "Why does retrieval practice help learning?",
        prohibitedPhrases: [
          {
            id: "prohibited-1",
            text: "Recognition is enough.",
          },
        ],
        sourceBody: "Practice recalling before review.",
        sourceTitle: "Retrieval practice",
        studyNoteId: createdStudyNote.id,
      },
      userId: "user-casey",
    });

    expect(updatedStudyNote).toMatchObject({
      acceptedVariants: [
        {
          id: "variant-1",
          text: "It strengthens retrieval routes before review.",
        },
      ],
      keyIdeas: [
        {
          acceptedPhrases: ["strengthens retrieval routes"],
          id: "key-1",
          importance: "required",
          prohibitedPhrases: ["just rereading"],
          text: "Practice recalling before review.",
        },
        {
          acceptedPhrases: [],
          id: "key-2",
          importance: "supporting",
          prohibitedPhrases: [],
          text: "The retrieval path gets stronger with effort.",
        },
      ],
      prohibitedPhrases: [
        {
          id: "prohibited-1",
          text: "Recognition is enough.",
        },
      ],
    });

    await expect(
      Promise.all([
        studyNotes.listStudyNotes({ userId: "user-casey" }),
        db.select().from(studyNoteKeyIdeasTable),
        db.select().from(studyNoteAcceptedVariantsTable),
        db.select().from(studyNoteProhibitedPhrasesTable),
      ]),
    ).resolves.toMatchObject([
      [
        {
          acceptedVariants: [
            {
              id: "variant-1",
              text: "It strengthens retrieval routes before review.",
            },
          ],
          keyIdeas: [
            {
              acceptedPhrases: ["strengthens retrieval routes"],
              id: "key-1",
              importance: "required",
              prohibitedPhrases: ["just rereading"],
              text: "Practice recalling before review.",
            },
            {
              acceptedPhrases: [],
              id: "key-2",
              importance: "supporting",
              prohibitedPhrases: [],
              text: "The retrieval path gets stronger with effort.",
            },
          ],
          prohibitedPhrases: [
            {
              id: "prohibited-1",
              text: "Recognition is enough.",
            },
          ],
        },
      ],
      [
        {
          acceptedPhrases: ["strengthens retrieval routes"],
          id: "key-1",
          importance: "required",
          position: 0,
          prohibitedPhrases: ["just rereading"],
          studyNoteId: createdStudyNote.id,
          text: "Practice recalling before review.",
        },
        {
          acceptedPhrases: [],
          id: "key-2",
          importance: "supporting",
          position: 1,
          prohibitedPhrases: [],
          studyNoteId: createdStudyNote.id,
          text: "The retrieval path gets stronger with effort.",
        },
      ],
      [
        {
          id: "variant-1",
          position: 0,
          studyNoteId: createdStudyNote.id,
          text: "It strengthens retrieval routes before review.",
        },
      ],
      [
        {
          id: "prohibited-1",
          position: 0,
          studyNoteId: createdStudyNote.id,
          text: "Recognition is enough.",
        },
      ],
    ]);
  });

  it("persists recallable Study Notes with a blank source body", async () => {
    const { studyNotes } = await createStudyNotesHarness();

    await expect(
      studyNotes.createStudyNote({
        input: {
          expectedAnswer: "The expected answer drives recall.",
          prompt: "What drives recall?",
          sourceBody: "",
          sourceTitle: "",
        },
        userId: "user-casey",
      }),
    ).resolves.toMatchObject({
      expectedAnswer: "The expected answer drives recall.",
      prompt: "What drives recall?",
      source: {
        body: "",
        title: "",
      },
    });
  });

  it("persists sibling Study Notes from untitled sources with a saveable prompt", async () => {
    const { studyNotes } = await createStudyNotesHarness();
    const firstStudyNote = await studyNotes.createStudyNote({
      input: {
        expectedAnswer: "",
        prompt: "First prompt",
        sourceBody: "",
        sourceTitle: "",
      },
      userId: "user-casey",
    });

    await expect(
      studyNotes.createStudyNoteFromSource({
        input: {
          sourceNoteId: firstStudyNote.sourceNoteId,
        },
        userId: "user-casey",
      }),
    ).resolves.toMatchObject({
      expectedAnswer: "",
      prompt: "First prompt",
      source: {
        body: "",
        displayName: "First prompt",
        title: "",
      },
    });
  });

  it("does not rewrite copied Study Note fields when the source Note changes", async () => {
    const { studyNotes } = await createStudyNotesHarness();
    const createdStudyNote = await studyNotes.createStudyNote({
      input: {
        sourceBody: "Original source body.",
        sourceTitle: "Original source",
      },
      userId: "user-casey",
    });

    await studyNotes.updateSourceNote({
      input: {
        body: "Edited source body.",
        sourceNoteId: createdStudyNote.sourceNoteId,
        title: "Edited source",
      },
      userId: "user-casey",
    });

    await expect(
      studyNotes
        .listStudyNotes({ userId: "user-casey" })
        .then((listedStudyNotes) => [...listedStudyNotes].sort(byId)),
    ).resolves.toMatchObject([
      {
        expectedAnswer: "Original source body.",
        prompt: "Original source",
        source: {
          body: "Edited source body.",
          title: "Edited source",
        },
      },
    ]);
  });

  it("persists blank source Note titles and returns display names from each owning Study Note prompt", async () => {
    const { db, studyNotes } = await createStudyNotesHarness();

    const firstStudyNote = await studyNotes.createStudyNote({
      input: {
        expectedAnswer: "First answer.",
        prompt: "Oldest prompt",
        sourceBody: "Shared source body.",
        sourceTitle: "",
      },
      userId: "user-casey",
    });
    const secondStudyNote = await studyNotes.createStudyNoteFromSource({
      input: {
        sourceNoteId: firstStudyNote.sourceNoteId,
      },
      userId: "user-casey",
    });

    expect(firstStudyNote.source).toMatchObject({
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

    await studyNotes.updateStudyNote({
      input: {
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
        studyNoteId: secondStudyNote.id,
      },
      userId: "user-casey",
    });
    await studyNotes.updateStudyNote({
      input: {
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
        studyNoteId: firstStudyNote.id,
      },
      userId: "user-casey",
    });

    await expect(
      Promise.all([
        studyNotes
          .listStudyNotes({ userId: "user-casey" })
          .then((listedStudyNotes) => [...listedStudyNotes].sort(byId)),
        db.select().from(notesTable),
      ]),
    ).resolves.toMatchObject([
      [
        {
          prompt: "Renamed oldest prompt",
          source: {
            displayName: "Renamed oldest prompt",
            title: "",
          },
        },
        {
          prompt: "Newer prompt",
          source: {
            displayName: "Renamed oldest prompt",
            title: "",
          },
        },
      ],
      expect.arrayContaining([
        expect.objectContaining({
          id: firstStudyNote.sourceNoteId,
          title: "",
        }),
        expect.objectContaining({
          id: secondStudyNote.sourceNoteId,
          title: "",
        }),
      ]),
    ]);
  });

  it("creates sibling Study Notes with shared source material and independent deletion until the last source Note", async () => {
    const { db, studyNotes } = await createStudyNotesHarness();
    const firstStudyNote = await studyNotes.createStudyNote({
      input: {
        sourceBody: "Shared source body.",
        sourceTitle: "Shared source",
      },
      userId: "user-casey",
    });
    const secondStudyNote = await studyNotes.createStudyNoteFromSource({
      input: {
        sourceNoteId: firstStudyNote.sourceNoteId,
      },
      userId: "user-casey",
    });

    expect(secondStudyNote).toMatchObject({
      acronyms: [],
      expectedAnswer: "Shared source body.",
      labelIds: [],
      metaphors: [],
      prompt: "Shared source",
    });
    expect(secondStudyNote.sourceNoteId).toBe(firstStudyNote.sourceNoteId);

    await studyNotes.deleteStudyNote({
      input: {
        deleteSource: false,
        studyNoteId: secondStudyNote.id,
      },
      userId: "user-casey",
    });

    await expect(
      Promise.all([
        studyNotes.listStudyNotes({ userId: "user-casey" }),
        db.select().from(notesTable),
      ]),
    ).resolves.toMatchObject([
      [
        {
          id: firstStudyNote.id,
          sourceNoteId: firstStudyNote.sourceNoteId,
        },
      ],
      [
        {
          id: firstStudyNote.sourceNoteId,
        },
      ],
    ]);
  });

  it("keeps a shared source linked when only Study Note-owned fields change", async () => {
    const { studyNotes } = await createStudyNotesHarness();
    const firstStudyNote = await studyNotes.createStudyNote({
      input: {
        sourceBody: "Shared source body.",
        sourceTitle: "Shared source",
      },
      userId: "user-casey",
    });
    const secondStudyNote = await studyNotes.createStudyNoteFromSource({
      input: {
        sourceNoteId: firstStudyNote.sourceNoteId,
      },
      userId: "user-casey",
    });

    await expect(
      studyNotes.updateStudyNote({
        input: {
          acceptedVariants: [],
          acronyms: [],
          expectedAnswer: "Second answer.",
          keyIdeas: [],
          labelIds: [],
          metaphors: [],
          prompt: "Sibling recall target",
          prohibitedPhrases: [],
          sourceBody: "Shared source body.",
          sourceTitle: "Shared source",
          studyNoteId: secondStudyNote.id,
        },
        userId: "user-casey",
      }),
    ).resolves.toMatchObject({
      id: secondStudyNote.id,
      prompt: "Sibling recall target",
      sourceNoteId: firstStudyNote.sourceNoteId,
    });
  });

  it("assigns Labels to Study Notes independently from the source Note and protects label ownership", async () => {
    const { db, studyNotes } = await createStudyNotesHarness({
      users: [
        createUserValues({
          displayName: "Casey Learner",
          email: "casey@example.com",
          id: "user-casey",
        }),
        createUserValues({
          displayName: "Jordan Learner",
          email: "jordan@example.com",
          id: "user-jordan",
        }),
      ],
    });
    await db.insert(labelsTable).values([
      {
        createdAt: TEST_CREATED_AT,
        id: "label-biology",
        name: "Biology",
        updatedAt: TEST_CREATED_AT,
        userId: "user-casey",
      },
      {
        createdAt: TEST_CREATED_AT,
        id: "label-history",
        name: "History",
        updatedAt: TEST_CREATED_AT,
        userId: "user-casey",
      },
      {
        createdAt: TEST_CREATED_AT,
        id: "label-other",
        name: "Other",
        updatedAt: TEST_CREATED_AT,
        userId: "user-jordan",
      },
    ]);

    const first = await studyNotes.createStudyNote({
      input: {
        labelIds: ["label-biology"],
        sourceBody: "One source body.",
        sourceTitle: "Shared source one",
      },
      userId: "user-casey",
    });
    const second = await studyNotes.createStudyNote({
      input: {
        labelIds: ["label-history"],
        sourceBody: "One source body.",
        sourceTitle: "Shared source two",
      },
      userId: "user-casey",
    });

    await studyNotes.updateStudyNote({
      input: {
        acceptedVariants: [],
        acronyms: [],
        expectedAnswer: second.expectedAnswer,
        keyIdeas: [],
        labelIds: [],
        metaphors: [],
        prompt: second.prompt,
        prohibitedPhrases: [],
        sourceBody: second.source.body,
        sourceTitle: second.source.title,
        studyNoteId: second.id,
      },
      userId: "user-casey",
    });

    const [biologyStudyNotes, allStudyNotes, sourceNotes, studyNoteLabels] =
      await Promise.all([
        studyNotes.listStudyNotes({
          labelId: "label-biology",
          userId: "user-casey",
        }),
        studyNotes.listStudyNotes({ userId: "user-casey" }),
        db.select().from(notesTable),
        db.select().from(studyNoteLabelsTable),
      ]);

    expect(biologyStudyNotes).toMatchObject([
      {
        id: first.id,
        labelIds: ["label-biology"],
      },
    ]);
    expect(allStudyNotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: first.id,
          labelIds: ["label-biology"],
        }),
        expect.objectContaining({
          id: second.id,
          labelIds: [],
        }),
      ]),
    );
    expect(sourceNotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: first.sourceNoteId,
          labelIds: [],
        }),
        expect.objectContaining({
          id: second.sourceNoteId,
          labelIds: [],
        }),
      ]),
    );
    expect(studyNoteLabels).toEqual([
      {
        labelId: "label-biology",
        studyNoteId: first.id,
      },
    ]);

    await expect(
      studyNotes.updateStudyNote({
        input: {
          acceptedVariants: [],
          acronyms: [],
          expectedAnswer: first.expectedAnswer,
          keyIdeas: [],
          labelIds: ["label-other"],
          metaphors: [],
          prompt: first.prompt,
          prohibitedPhrases: [],
          sourceBody: first.source.body,
          sourceTitle: first.source.title,
          studyNoteId: first.id,
        },
        userId: "user-casey",
      }),
    ).rejects.toThrow("Study Notes can only be assigned");
  });

  it("drops deleted Labels from active Study Note assignments", async () => {
    const { db, studyNotes } = await createStudyNotesHarness({
      users: [
        createUserValues({
          displayName: "Casey Learner",
          email: "casey@example.com",
          id: "user-casey",
        }),
      ],
    });
    await db.insert(labelsTable).values([
      {
        createdAt: TEST_CREATED_AT,
        id: "label-biology",
        name: "Biology",
        updatedAt: TEST_CREATED_AT,
        userId: "user-casey",
      },
      {
        createdAt: TEST_CREATED_AT,
        id: "label-history",
        name: "History",
        updatedAt: TEST_CREATED_AT,
        userId: "user-casey",
      },
    ]);

    const createdStudyNote = await studyNotes.createStudyNote({
      input: {
        labelIds: ["label-biology", "label-history"],
        sourceBody: "One source body.",
        sourceTitle: "Shared source one",
      },
      userId: "user-casey",
    });

    await db.delete(labelsTable).where(eq(labelsTable.id, "label-history"));

    await expect(
      studyNotes.listStudyNotes({ userId: "user-casey" }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createdStudyNote.id,
          labelIds: ["label-biology"],
        }),
      ]),
    );

    await expect(db.select().from(studyNoteLabelsTable)).resolves.toEqual([
      {
        labelId: "label-biology",
        studyNoteId: createdStudyNote.id,
      },
    ]);
  });

  it("keeps memory aids owned by each Study Note while legacy shared source material stays shared until edited", async () => {
    const { db, studyNotes } = await createStudyNotesHarness({
      now: () => TEST_UPDATED_AT,
      users: [
        createUserValues({
          displayName: "Casey Learner",
          email: "casey@example.com",
          id: "user-casey",
        }),
        createUserValues({
          displayName: "Jordan Learner",
          email: "jordan@example.com",
          id: "user-jordan",
        }),
      ],
    });
    await db.insert(notesTable).values({
      body: "One source can support several precise recall targets.",
      createdAt: TEST_CREATED_AT,
      id: "source-shared",
      labelIds: [],
      title: "Shared source",
      updatedAt: TEST_CREATED_AT,
      userId: "user-casey",
    });
    await db.insert(studyNotesTable).values([
      {
        createdAt: TEST_CREATED_AT,
        expectedAnswer: "Answer one",
        id: "study-one",
        prompt: "Prompt one",
        sourceNoteId: "source-shared",
        updatedAt: TEST_CREATED_AT,
      },
      {
        createdAt: TEST_CREATED_AT,
        expectedAnswer: "Answer two",
        id: "study-two",
        prompt: "Prompt two",
        sourceNoteId: "source-shared",
        updatedAt: TEST_CREATED_AT,
      },
    ]);

    await studyNotes.updateStudyNote({
      input: {
        acceptedVariants: [],
        acronyms: [{ description: "ONE keeps the first target distinct." }],
        expectedAnswer: "Answer one",
        keyIdeas: [],
        labelIds: [],
        metaphors: [
          { description: "First support description belongs to study one." },
        ],
        prompt: "Prompt one",
        prohibitedPhrases: [],
        sourceBody: "One source can support several precise recall targets.",
        sourceTitle: "Shared source",
        studyNoteId: "study-one",
      },
      userId: "user-casey",
    });
    await studyNotes.updateStudyNote({
      input: {
        acceptedVariants: [],
        acronyms: [{ description: "TWO keeps the second target distinct." }],
        expectedAnswer: "Answer two",
        keyIdeas: [],
        labelIds: [],
        metaphors: [
          { description: "Second support description belongs to study two." },
        ],
        prompt: "Prompt two",
        prohibitedPhrases: [],
        sourceBody: "One source can support several precise recall targets.",
        sourceTitle: "Shared source",
        studyNoteId: "study-two",
      },
      userId: "user-casey",
    });

    const listedStudyNotes = [
      ...(await studyNotes.listStudyNotes({ userId: "user-casey" })),
    ].sort(byId);
    expect(listedStudyNotes[0]?.sourceNoteId).toBe(
      listedStudyNotes[1]?.sourceNoteId,
    );
    expect(listedStudyNotes).toMatchObject([
      {
        acronyms: [{ description: "ONE keeps the first target distinct." }],
        id: "study-one",
        metaphors: [
          { description: "First support description belongs to study one." },
        ],
        source: {
          body: "One source can support several precise recall targets.",
          title: "Shared source",
        },
      },
      {
        acronyms: [{ description: "TWO keeps the second target distinct." }],
        id: "study-two",
        metaphors: [
          { description: "Second support description belongs to study two." },
        ],
        source: {
          body: "One source can support several precise recall targets.",
          title: "Shared source",
        },
      },
    ]);

    await studyNotes.updateStudyNote({
      input: {
        acceptedVariants: [],
        acronyms: [],
        expectedAnswer: "Answer one",
        keyIdeas: [],
        labelIds: [],
        metaphors: [],
        prompt: "Prompt one",
        prohibitedPhrases: [],
        sourceBody: "One source can support several precise recall targets.",
        sourceTitle: "Shared source",
        studyNoteId: "study-one",
      },
      userId: "user-casey",
    });
    await expect(
      studyNotes.updateStudyNote({
        input: {
          acceptedVariants: [],
          acronyms: [],
          expectedAnswer: "Cross-account answer",
          keyIdeas: [],
          labelIds: [],
          metaphors: [],
          prompt: "Cross-account prompt",
          prohibitedPhrases: [],
          sourceBody: "Cross-account source",
          sourceTitle: "Cross-account source",
          studyNoteId: "study-two",
        },
        userId: "user-jordan",
      }),
    ).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(
      Promise.all([
        studyNotes
          .listStudyNotes({ userId: "user-casey" })
          .then((listedStudyNotes) => [...listedStudyNotes].sort(byId)),
        db.select().from(studyNoteMetaphorsTable),
        db.select().from(studyNoteAcronymsTable),
      ]),
    ).resolves.toMatchObject([
      [
        {
          acronyms: [],
          id: "study-one",
          metaphors: [],
        },
        {
          acronyms: [{ description: "TWO keeps the second target distinct." }],
          id: "study-two",
          metaphors: [
            { description: "Second support description belongs to study two." },
          ],
        },
      ],
      [
        {
          description: "Second support description belongs to study two.",
          studyNoteId: "study-two",
        },
      ],
      [
        {
          description: "TWO keeps the second target distinct.",
          studyNoteId: "study-two",
        },
      ],
    ]);
  });

  it("persists one Metaphor description and one Acronym description per Study Note", async () => {
    const { db, studyNotes } = await createStudyNotesHarness();

    const createdStudyNote = await studyNotes.createStudyNote({
      input: {
        acronyms: [{ description: "HIP keeps the structure memorable." }],
        metaphors: [
          { description: "The hippocampus is a library index for memory." },
        ],
        sourceBody: "The hippocampus helps bind memory context.",
        sourceTitle: "Hippocampus",
      },
      userId: "user-casey",
    });

    await expect(
      studyNotes.updateStudyNote({
        input: {
          acceptedVariants: [],
          acronyms: [
            { description: "HIP keeps the structure memorable." },
            { description: "IDX means index." },
          ],
          expectedAnswer: "It binds context for recall.",
          keyIdeas: [],
          labelIds: [],
          metaphors: [
            { description: "The hippocampus is a library index for memory." },
          ],
          prompt: "What does the hippocampus support?",
          prohibitedPhrases: [],
          sourceBody: "The hippocampus helps bind memory context.",
          sourceTitle: "Hippocampus",
          studyNoteId: createdStudyNote.id,
        },
        userId: "user-casey",
      }),
    ).rejects.toThrow("Only one acronym can be saved per Study Note.");
    await expect(
      studyNotes
        .listStudyNotes({ userId: "user-casey" })
        .then((listedStudyNotes) => listedStudyNotes[0]),
    ).resolves.toMatchObject({
      acronyms: [{ description: "HIP keeps the structure memorable." }],
      metaphors: [
        { description: "The hippocampus is a library index for memory." },
      ],
    });
    await expect(
      Promise.all([
        db.select().from(studyNoteMetaphorsTable),
        db.select().from(studyNoteAcronymsTable),
      ]),
    ).resolves.toMatchObject([
      [
        {
          description: "The hippocampus is a library index for memory.",
          studyNoteId: createdStudyNote.id,
        },
      ],
      [
        {
          description: "HIP keeps the structure memorable.",
          studyNoteId: createdStudyNote.id,
        },
      ],
    ]);
  });
});
