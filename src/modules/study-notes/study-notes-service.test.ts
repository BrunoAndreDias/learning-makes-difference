import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, describe, expect, it } from "vitest";

import { migrateDatabase } from "../../lib/db/migrate";
import { authSchema, usersTable } from "../access/session/auth-schema";
import { notesSchema, notesTable } from "../notes/notes-schema";
import { studyNotesSchema } from "./study-notes-schema";
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
        expectedAnswer: "Recall first, then review.",
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
      studyNotes.listStudyNotes({ userId: "user-casey" }),
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
      expectedAnswer: "Shared source body.",
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
});
