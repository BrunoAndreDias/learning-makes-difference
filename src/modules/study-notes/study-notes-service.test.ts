import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, describe, expect, it } from "vitest";

import { migrateDatabase } from "../../lib/db/migrate";
import { authSchema, usersTable } from "../access/session/auth-schema";
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

describe("createStudyNotesService", () => {
  const databases = new Set<PGlite>();

  afterEach(async () => {
    await Promise.all(Array.from(databases, (database) => database.close()));
    databases.clear();
  });

  function byId(left: { id: string }, right: { id: string }) {
    return left.id.localeCompare(right.id);
  }

  it("persists Study Notes with default source Notes and independent copied fields", async () => {
    const client = new PGlite();
    databases.add(client);
    const db = drizzle(client, {
      schema: {
        ...authSchema,
        ...notesSchema,
        ...studyNotesSchema,
      },
    });
    await migrateDatabase(db, client);
    await db.insert(usersTable).values({
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      displayName: "Casey Learner",
      email: "casey@example.com",
      id: "user-casey",
      passwordHash: "hash",
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
      userLanguage: "en",
    });
    const studyNotes = createStudyNotesService({
      crypto: createDeterministicCrypto(),
      db,
      now: () => new Date("2026-05-02T12:00:00.000Z"),
    });

    const createdStudyNote = await studyNotes.createStudyNote({
      input: {
        sourceBody: "Practice recall before reviewing the answer.",
        sourceTitle: "Active recall",
      },
      userId: "user-casey",
    });

    expect(createdStudyNote).toMatchObject({
      expectedAnswer: "Practice recall before reviewing the answer.",
      id: "id-2",
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
    const client = new PGlite();
    databases.add(client);
    const db = drizzle(client, {
      schema: {
        ...authSchema,
        ...notesSchema,
        ...studyNotesSchema,
      },
    });
    await migrateDatabase(db, client);
    await db.insert(usersTable).values({
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      displayName: "Casey Learner",
      email: "casey@example.com",
      id: "user-casey",
      passwordHash: "hash",
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
      userLanguage: "en",
    });
    const studyNotes = createStudyNotesService({
      crypto: createDeterministicCrypto(),
      db,
      now: () => new Date("2026-05-02T12:00:00.000Z"),
    });
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

  it("keeps memory hooks owned by each Study Note across shared sources, clearing, and account boundaries", async () => {
    const client = new PGlite();
    databases.add(client);
    const db = drizzle(client, {
      schema: {
        ...authSchema,
        ...notesSchema,
        ...studyNotesSchema,
      },
    });
    await migrateDatabase(db, client);
    await db.insert(usersTable).values([
      {
        createdAt: new Date("2026-05-02T12:00:00.000Z"),
        displayName: "Casey Learner",
        email: "casey@example.com",
        id: "user-casey",
        passwordHash: "hash",
        updatedAt: new Date("2026-05-02T12:00:00.000Z"),
        userLanguage: "en",
      },
      {
        createdAt: new Date("2026-05-02T12:00:00.000Z"),
        displayName: "Jordan Learner",
        email: "jordan@example.com",
        id: "user-jordan",
        passwordHash: "hash",
        updatedAt: new Date("2026-05-02T12:00:00.000Z"),
        userLanguage: "en",
      },
    ]);
    await db.insert(notesTable).values({
      body: "One source can support several precise recall targets.",
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      id: "source-shared",
      labelIds: [],
      title: "Shared source",
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
      userId: "user-casey",
    });
    await db.insert(studyNotesTable).values([
      {
        createdAt: new Date("2026-05-02T12:00:00.000Z"),
        expectedAnswer: "Answer one",
        id: "study-one",
        prompt: "Prompt one",
        sourceNoteId: "source-shared",
        updatedAt: new Date("2026-05-02T12:00:00.000Z"),
      },
      {
        createdAt: new Date("2026-05-02T12:00:00.000Z"),
        expectedAnswer: "Answer two",
        id: "study-two",
        prompt: "Prompt two",
        sourceNoteId: "source-shared",
        updatedAt: new Date("2026-05-02T12:00:00.000Z"),
      },
    ]);
    const studyNotes = createStudyNotesService({
      db,
      now: () => new Date("2026-05-02T12:30:00.000Z"),
    });

    await studyNotes.updateStudyNote({
      input: {
        acronyms: [{ description: "ONE keeps the first target distinct." }],
        expectedAnswer: "Answer one",
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
        metaphors: [{ description: "Second hook belongs to study two." }],
        prompt: "Prompt two",
        sourceBody: "One source can support several precise recall targets.",
        sourceTitle: "Shared source",
        studyNoteId: "study-two",
      },
      userId: "user-casey",
    });

    await expect(
      studyNotes.listStudyNotes({ userId: "user-casey" }),
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
