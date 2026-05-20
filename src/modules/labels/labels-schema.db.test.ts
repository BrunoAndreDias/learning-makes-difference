import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterEach, describe, expect, it } from "vitest";

import { migrateDatabase } from "../../lib/db/migrate";
import {
  closePostgresIntegrationDatabases,
  createPostgresIntegrationDatabase,
  type PostgresIntegrationDatabase,
} from "../../lib/db/postgres-integration-test-db";
import { authSchema, usersTable } from "../access/session/auth-schema";
import { notesSchema, notesTable } from "../notes/notes-schema";
import {
  studyNotesSchema,
  studyNotesTable,
} from "../study-notes/study-notes-schema";
import {
  labelsSchema,
  labelsTable,
  studyNoteLabelsTable,
} from "./labels-schema";

describe("labels schema PostgreSQL integration", () => {
  const databases = new Set<PostgresIntegrationDatabase>();

  afterEach(async () => {
    await closePostgresIntegrationDatabases(databases);
  });

  it("cascades deleted Labels out of active Study Note assignments", async () => {
    const database = await createPostgresIntegrationDatabase();
    databases.add(database);

    const db = drizzle(database.client, {
      schema: {
        ...authSchema,
        ...labelsSchema,
        ...notesSchema,
        ...studyNotesSchema,
      },
    });
    await migrateDatabase(db, database.client);
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
      id: "label-biology",
      userId: "user-casey",
      name: "Biology",
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });
    await db.insert(notesTable).values({
      id: "note-1",
      userId: "user-casey",
      title: "Cell respiration",
      body: "ATP stores transferable energy.",
      labelIds: [],
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });
    await db.insert(studyNotesTable).values({
      id: "study-note-1",
      sourceNoteId: "note-1",
      prompt: "What stores transferable energy?",
      expectedAnswer: "ATP",
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });
    await db.insert(studyNoteLabelsTable).values({
      studyNoteId: "study-note-1",
      labelId: "label-biology",
    });

    await db.delete(labelsTable).where(eq(labelsTable.id, "label-biology"));

    await expect(db.select().from(studyNoteLabelsTable)).resolves.toEqual([]);
  });
});
