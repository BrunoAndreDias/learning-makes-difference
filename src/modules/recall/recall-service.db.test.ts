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
import {
  labelsSchema,
  labelsTable,
  noteLabelsTable,
} from "../labels/labels-schema";
import {
  noteAcronymsTable,
  noteMetaphorsTable,
  notesSchema,
  notesTable,
} from "../notes/notes-schema";
import { recallSchema } from "./recall-schema";
import { createRecallService } from "./recall-service";

describe("createRecallService PostgreSQL integration", () => {
  const databases = new Set<PostgresIntegrationDatabase>();

  afterEach(async () => {
    await closePostgresIntegrationDatabases(databases);
  });

  it("persists one active session and preserves result snapshots across service reloads", async () => {
    const database = await createPostgresIntegrationDatabase();
    databases.add(database);

    const db = drizzle(database.client, {
      schema: {
        ...authSchema,
        ...labelsSchema,
        ...notesSchema,
        ...recallSchema,
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
      id: "label-science",
      userId: "user-casey",
      name: "Science",
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });
    await db.insert(notesTable).values([
      {
        id: "note-1",
        userId: "user-casey",
        title: "Stored title",
        body: "Stored body",
        labelIds: ["label-science"],
        createdAt: new Date("2026-05-02T12:00:00.000Z"),
        updatedAt: new Date("2026-05-02T12:00:00.000Z"),
      },
      {
        id: "note-2",
        userId: "user-casey",
        title: "Replacement title",
        body: "Replacement body",
        labelIds: [],
        createdAt: new Date("2026-05-02T12:05:00.000Z"),
        updatedAt: new Date("2026-05-02T12:05:00.000Z"),
      },
    ]);
    await db.insert(noteLabelsTable).values({
      noteId: "note-1",
      labelId: "label-science",
    });
    await db.insert(noteMetaphorsTable).values({
      noteId: "note-1",
      description: "Orbit metaphor",
    });
    await db.insert(noteAcronymsTable).values({
      noteId: "note-1",
      description: "S.T.O.R.E.D.",
    });

    let sessionCounter = 0;
    const service = createRecallService({
      crypto: {
        randomUUID: () =>
          `session-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      db,
      shuffleNotes: (notes) => [...notes],
    });

    const firstSession = await service.startFlashCardSession({
      noteIds: ["note-1"],
      userId: "user-casey",
    });

    await expect(
      service.getActiveSession({
        userId: "user-casey",
      }),
    ).resolves.toMatchObject({
      id: firstSession.id,
      notes: [
        {
          acronyms: [{ description: "S.T.O.R.E.D." }],
          body: "Stored body",
          labels: [{ id: "label-science", name: "Science" }],
          metaphors: [{ description: "Orbit metaphor" }],
          title: "Stored title",
        },
      ],
    });

    await db
      .update(notesTable)
      .set({
        title: "Edited title",
        body: "Edited body",
        updatedAt: new Date("2026-05-02T12:20:00.000Z"),
      })
      .where(eq(notesTable.id, "note-1"));
    await db
      .delete(noteLabelsTable)
      .where(eq(noteLabelsTable.noteId, "note-1"));
    await db
      .update(labelsTable)
      .set({
        name: "Edited science",
        updatedAt: new Date("2026-05-02T12:21:00.000Z"),
      })
      .where(eq(labelsTable.id, "label-science"));

    await expect(
      service.getActiveSession({
        userId: "user-casey",
      }),
    ).resolves.toMatchObject({
      id: firstSession.id,
      notes: [
        {
          body: "Stored body",
          labels: [{ id: "label-science", name: "Science" }],
          title: "Stored title",
        },
      ],
    });

    const replacementSession = await service.startFlashCardSession({
      noteIds: ["note-2"],
      userId: "user-casey",
    });

    expect(replacementSession.id).toBe("session-2");
    await expect(
      service.getActiveSession({
        userId: "user-casey",
      }),
    ).resolves.toMatchObject({
      id: "session-2",
      notes: [{ id: "note-2", title: "Replacement title" }],
    });

    await service.endFlashCardSession({
      sessionId: "session-2",
      userId: "user-casey",
    });
    await expect(
      service.listSessionResults({
        userId: "user-casey",
      }),
    ).resolves.toEqual([]);

    const attemptedSession = await service.startFlashCardSession({
      noteIds: ["note-1"],
      userId: "user-casey",
    });
    await service.updateFlashCardAttemptText({
      sessionId: attemptedSession.id,
      text: "Casey typed this.",
      userId: "user-casey",
    });
    await service.revealFlashCardAnswer({
      sessionId: attemptedSession.id,
      userId: "user-casey",
    });
    await expect(
      service.rateFlashCardAnswer({
        rating: "hard",
        sessionId: attemptedSession.id,
        userId: "user-casey",
      }),
    ).resolves.toBeNull();

    const reloadedService = createRecallService({
      db,
      shuffleNotes: (notes) => [...notes],
    });

    await expect(
      reloadedService.getActiveSession({
        userId: "user-casey",
      }),
    ).resolves.toBeNull();
    await expect(
      reloadedService.listSessionResults({
        userId: "user-casey",
      }),
    ).resolves.toMatchObject([
      {
        attempts: [
          {
            noteId: "note-1",
            rating: "hard",
            text: "Casey typed this.",
          },
        ],
        id: "session-3",
        notes: [
          {
            acronyms: [{ description: "S.T.O.R.E.D." }],
            body: "Edited body",
            labels: [],
            metaphors: [{ description: "Orbit metaphor" }],
            title: "Edited title",
          },
        ],
        questions: [
          {
            noteId: "note-1",
            selfRating: "hard",
            typedAnswer: "Casey typed this.",
          },
        ],
      },
    ]);
  });
});
