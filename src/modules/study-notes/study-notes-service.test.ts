import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, describe, expect, it } from "vitest";

import { migrateDatabase } from "../../lib/db/migrate";
import { authSchema, usersTable } from "../access/session/auth-schema";
import {
  labelsSchema,
  labelsTable,
  studyNoteLabelsTable,
} from "../labels/labels-schema";
import { notesSchema, notesTable } from "../notes/notes-schema";
import {
  studyNoteAcronymsTable,
  studyNoteMetaphorsTable,
  studyNotesSchema,
  studyNotesTable,
} from "./study-notes-schema";
import { createStudyNotesService } from "./study-notes-service";

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
  const databases = new Set<PGlite>();

  afterEach(async () => {
    await Promise.all(Array.from(databases, (database) => database.close()));
    databases.clear();
  });

  function byId(left: { id: string }, right: { id: string }) {
    return left.id.localeCompare(right.id);
  }

  async function createTestDb() {
    const client = new PGlite();
    databases.add(client);
    const db = drizzle(client, {
      schema: {
        ...authSchema,
        ...labelsSchema,
        ...notesSchema,
        ...studyNotesSchema,
      },
    });
    await migrateDatabase(db, client);

    return db;
  }

  async function createStudyNotesHarness(
    options: { now?: () => Date; users?: TestUserInsert[] } = {},
  ) {
    const db = await createTestDb();
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
        acronyms: [],
        expectedAnswer: "Recall first, then review.",
        labelIds: [],
        metaphors: [],
        prompt: "How should active recall feel?",
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

  it("creates shared-source Study Notes and deletes the source only after last-link confirmation", async () => {
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
      sourceNoteId: firstStudyNote.sourceNoteId,
    });

    await studyNotes.deleteStudyNote({
      input: {
        deleteSource: false,
        studyNoteId: secondStudyNote.id,
      },
      userId: "user-casey",
    });

    await expect(
      studyNotes.deleteStudyNote({
        input: {
          deleteSource: false,
          studyNoteId: firstStudyNote.id,
        },
        userId: "user-casey",
      }),
    ).rejects.toMatchObject({
      code: "invalid_input",
    });

    await studyNotes.deleteStudyNote({
      input: {
        deleteSource: true,
        studyNoteId: firstStudyNote.id,
      },
      userId: "user-casey",
    });

    await expect(
      Promise.all([
        studyNotes.listStudyNotes({ userId: "user-casey" }),
        db.select().from(notesTable),
      ]),
    ).resolves.toEqual([[], []]);
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
        acronyms: [],
        expectedAnswer: second.expectedAnswer,
        labelIds: [],
        metaphors: [],
        prompt: second.prompt,
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
          acronyms: [],
          expectedAnswer: first.expectedAnswer,
          labelIds: ["label-other"],
          metaphors: [],
          prompt: first.prompt,
          sourceBody: first.source.body,
          sourceTitle: first.source.title,
          studyNoteId: first.id,
        },
        userId: "user-casey",
      }),
    ).rejects.toThrow("Study Notes can only be assigned");
  });

  it("keeps memory hooks owned by each Study Note across shared sources, clearing, and account boundaries", async () => {
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
        acronyms: [{ description: "ONE keeps the first target distinct." }],
        expectedAnswer: "Answer one",
        labelIds: [],
        metaphors: [{ description: "First hook belongs to study one." }],
        prompt: "Prompt one",
        sourceBody: "One source can support several precise recall targets.",
        sourceTitle: "Shared source",
        studyNoteId: "study-one",
      },
      userId: "user-casey",
    });
    await studyNotes.updateStudyNote({
      input: {
        acronyms: [{ description: "TWO keeps the second target distinct." }],
        expectedAnswer: "Answer two",
        labelIds: [],
        metaphors: [{ description: "Second hook belongs to study two." }],
        prompt: "Prompt two",
        sourceBody: "One source can support several precise recall targets.",
        sourceTitle: "Shared source",
        studyNoteId: "study-two",
      },
      userId: "user-casey",
    });

    await expect(
      studyNotes
        .listStudyNotes({ userId: "user-casey" })
        .then((listedStudyNotes) => [...listedStudyNotes].sort(byId)),
    ).resolves.toMatchObject([
      {
        acronyms: [{ description: "ONE keeps the first target distinct." }],
        id: "study-one",
        metaphors: [{ description: "First hook belongs to study one." }],
        sourceNoteId: "source-shared",
      },
      {
        acronyms: [{ description: "TWO keeps the second target distinct." }],
        id: "study-two",
        metaphors: [{ description: "Second hook belongs to study two." }],
        sourceNoteId: "source-shared",
      },
    ]);

    await studyNotes.updateStudyNote({
      input: {
        acronyms: [],
        expectedAnswer: "Answer one",
        labelIds: [],
        metaphors: [],
        prompt: "Prompt one",
        sourceBody: "One source can support several precise recall targets.",
        sourceTitle: "Shared source",
        studyNoteId: "study-one",
      },
      userId: "user-casey",
    });
    await expect(
      studyNotes.updateStudyNote({
        input: {
          acronyms: [],
          expectedAnswer: "Cross-account answer",
          labelIds: [],
          metaphors: [],
          prompt: "Cross-account prompt",
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
          metaphors: [{ description: "Second hook belongs to study two." }],
        },
      ],
      [
        {
          description: "Second hook belongs to study two.",
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
});
