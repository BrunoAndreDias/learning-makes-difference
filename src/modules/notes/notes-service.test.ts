import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPgliteServiceTestDatabase } from "../../lib/db/pglite-service-test-db";
import { authSchema, usersTable } from "../access/session/auth-schema";
import {
  labelsSchema,
  labelsTable,
  noteLabelsTable,
} from "../labels/labels-schema";
import {
  noteAcronymsTable,
  noteMetaphorsTable,
  notesSchema,
} from "./notes-schema";
import { createNotesService } from "./notes-service";

const notesTestSchema = {
  ...authSchema,
  ...labelsSchema,
  ...notesSchema,
};

describe("createNotesService", () => {
  let testDatabase: Awaited<
    ReturnType<typeof createPgliteServiceTestDatabase<typeof notesTestSchema>>
  >;

  beforeAll(async () => {
    testDatabase = await createPgliteServiceTestDatabase(notesTestSchema);
  });

  afterEach(async () => {
    await testDatabase.reset();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  it("persists notes with metaphor and acronym child records in PostgreSQL", async () => {
    const db = testDatabase.db;
    await db.insert(usersTable).values({
      id: "user-casey",
      displayName: "Casey Learner",
      email: "casey@example.com",
      passwordHash: "hash",
      userLanguage: "en",
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });
    await db.insert(labelsTable).values({
      id: "label-neuroscience",
      userId: "user-casey",
      name: "Neuroscience",
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });

    const notes = createNotesService({
      db,
      now: () => new Date("2026-05-02T12:00:00.000Z"),
    });

    const createdNote = await notes.createNote({
      input: {
        acronyms: [
          {
            description: "LTP stands for Long-Term Potentiation.",
          },
        ],
        body: "Repeated activation strengthens the same path.",
        labelIds: ["label-neuroscience"],
        metaphors: [
          {
            description: "Forest trail: repeated walks carve a clearer path.",
          },
        ],
        title: "Synaptic plasticity",
      },
      userId: "user-casey",
    });

    await expect(
      notes.listNotes({
        userId: "user-casey",
      }),
    ).resolves.toEqual([createdNote]);
  });

  it("stores note-label assignments in PostgreSQL join rows", async () => {
    const db = testDatabase.db;
    await db.insert(usersTable).values({
      id: "user-casey",
      displayName: "Casey Learner",
      email: "casey@example.com",
      passwordHash: "hash",
      userLanguage: "en",
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });
    await db.insert(labelsTable).values([
      {
        id: "label-science",
        userId: "user-casey",
        name: "Science",
        createdAt: new Date("2026-05-02T12:00:00.000Z"),
        updatedAt: new Date("2026-05-02T12:00:00.000Z"),
      },
      {
        id: "label-biology",
        userId: "user-casey",
        name: "Biology",
        createdAt: new Date("2026-05-02T12:00:00.000Z"),
        updatedAt: new Date("2026-05-02T12:00:00.000Z"),
      },
    ]);

    const notes = createNotesService({
      db,
      now: () => new Date("2026-05-02T12:00:00.000Z"),
    });

    const createdNote = await notes.createNote({
      input: {
        acronyms: [],
        body: "Repeated activation strengthens the same path.",
        labelIds: ["label-science", "label-biology"],
        metaphors: [],
        title: "Synaptic plasticity",
      },
      userId: "user-casey",
    });

    await expect(
      Promise.all([
        notes.listNotes({
          userId: "user-casey",
        }),
        db.select().from(noteLabelsTable).orderBy(noteLabelsTable.labelId),
      ]),
    ).resolves.toEqual([
      [createdNote],
      [
        {
          labelId: "label-biology",
          noteId: createdNote.id,
        },
        {
          labelId: "label-science",
          noteId: createdNote.id,
        },
      ],
    ]);
  });

  it("keeps note updates scoped to the owning account", async () => {
    const db = testDatabase.db;
    await db.insert(usersTable).values([
      {
        id: "user-casey",
        displayName: "Casey Learner",
        email: "casey@example.com",
        passwordHash: "hash",
        userLanguage: "en",
        createdAt: new Date("2026-05-02T12:00:00.000Z"),
        updatedAt: new Date("2026-05-02T12:00:00.000Z"),
      },
      {
        id: "user-jordan",
        displayName: "Jordan Learner",
        email: "jordan@example.com",
        passwordHash: "hash",
        userLanguage: "en",
        createdAt: new Date("2026-05-02T12:00:00.000Z"),
        updatedAt: new Date("2026-05-02T12:00:00.000Z"),
      },
    ]);
    await db.insert(labelsTable).values({
      id: "label-neuroscience",
      userId: "user-casey",
      name: "Neuroscience",
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });

    const notes = createNotesService({
      db,
      now: () => new Date("2026-05-02T12:00:00.000Z"),
    });
    const createdNote = await notes.createNote({
      input: {
        acronyms: [],
        body: "Repeated activation strengthens the same path.",
        labelIds: [],
        metaphors: [],
        title: "Synaptic plasticity",
      },
      userId: "user-casey",
    });

    await expect(
      notes.updateNote({
        input: {
          acronyms: [
            {
              description: "LTP stands for Long-Term Potentiation.",
            },
          ],
          body: "Repeated activation strengthens a reused path.",
          labelIds: ["label-neuroscience"],
          metaphors: [
            {
              description: "Forest trail: repeated walks carve a clearer path.",
            },
          ],
          noteId: createdNote.id,
          title: "Updated synaptic plasticity",
        },
        userId: "user-casey",
      }),
    ).resolves.toMatchObject({
      acronyms: [
        {
          description: "LTP stands for Long-Term Potentiation.",
        },
      ],
      body: "Repeated activation strengthens a reused path.",
      id: createdNote.id,
      labelIds: ["label-neuroscience"],
      metaphors: [
        {
          description: "Forest trail: repeated walks carve a clearer path.",
        },
      ],
      title: "Updated synaptic plasticity",
    });

    await expect(
      notes.updateNote({
        input: {
          acronyms: [],
          body: "Cross-account edits must fail.",
          labelIds: [],
          metaphors: [],
          noteId: createdNote.id,
          title: "Forbidden edit",
        },
        userId: "user-jordan",
      }),
    ).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("rejects note-label assignments for labels owned by another account", async () => {
    const db = testDatabase.db;
    await db.insert(usersTable).values([
      {
        id: "user-casey",
        displayName: "Casey Learner",
        email: "casey@example.com",
        passwordHash: "hash",
        userLanguage: "en",
        createdAt: new Date("2026-05-02T12:00:00.000Z"),
        updatedAt: new Date("2026-05-02T12:00:00.000Z"),
      },
      {
        id: "user-jordan",
        displayName: "Jordan Learner",
        email: "jordan@example.com",
        passwordHash: "hash",
        userLanguage: "en",
        createdAt: new Date("2026-05-02T12:00:00.000Z"),
        updatedAt: new Date("2026-05-02T12:00:00.000Z"),
      },
    ]);
    await db.insert(labelsTable).values({
      id: "label-jordan-private",
      userId: "user-jordan",
      name: "Jordan private",
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });

    const notes = createNotesService({
      db,
      now: () => new Date("2026-05-02T12:00:00.000Z"),
    });

    await expect(
      notes.createNote({
        input: {
          acronyms: [],
          body: "Repeated activation strengthens the same path.",
          labelIds: ["label-jordan-private"],
          metaphors: [],
          title: "Synaptic plasticity",
        },
        userId: "user-casey",
      }),
    ).rejects.toMatchObject({
      code: "invalid_input",
    });
  });

  it("hard-deletes notes and removes their metaphor and acronym child records", async () => {
    const db = testDatabase.db;
    await db.insert(usersTable).values({
      id: "user-casey",
      displayName: "Casey Learner",
      email: "casey@example.com",
      passwordHash: "hash",
      userLanguage: "en",
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });

    const notes = createNotesService({
      db,
      now: () => new Date("2026-05-02T12:00:00.000Z"),
    });
    const createdNote = await notes.createNote({
      input: {
        acronyms: [
          {
            description: "LTP stands for Long-Term Potentiation.",
          },
        ],
        body: "Repeated activation strengthens the same path.",
        labelIds: [],
        metaphors: [
          {
            description: "Forest trail: repeated walks carve a clearer path.",
          },
        ],
        title: "Synaptic plasticity",
      },
      userId: "user-casey",
    });

    await expect(
      Promise.all([
        db.select().from(noteMetaphorsTable),
        db.select().from(noteAcronymsTable),
      ]),
    ).resolves.toEqual([
      [
        {
          noteId: createdNote.id,
          description: "Forest trail: repeated walks carve a clearer path.",
        },
      ],
      [
        {
          noteId: createdNote.id,
          description: "LTP stands for Long-Term Potentiation.",
        },
      ],
    ]);

    await notes.deleteNote({
      noteId: createdNote.id,
      userId: "user-casey",
    });

    await expect(
      Promise.all([
        notes.listNotes({ userId: "user-casey" }),
        db.select().from(noteMetaphorsTable),
        db.select().from(noteAcronymsTable),
      ]),
    ).resolves.toEqual([[], [], []]);
  });
});
