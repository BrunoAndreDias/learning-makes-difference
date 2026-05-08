import { drizzle } from "drizzle-orm/postgres-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { migrateDatabase } from "../../lib/db/migrate";
import {
  closePostgresIntegrationDatabases,
  createPostgresIntegrationDatabase,
  type PostgresIntegrationDatabase,
} from "../../lib/db/postgres-integration-test-db";
import { authSchema, usersTable } from "../access/session/auth-schema";
import { labelsSchema, labelsTable } from "../labels/labels-schema";
import { focusSchema } from "./focus-schema";
import { createFocusService } from "./focus-service";

describe("createFocusService PostgreSQL integration", () => {
  const databases = new Set<PostgresIntegrationDatabase>();

  afterEach(async () => {
    vi.useRealTimers();
    await closePostgresIntegrationDatabases(databases);
  });

  it("persists the active session and completed record across service reloads", async () => {
    const database = await createPostgresIntegrationDatabase();
    databases.add(database);

    const db = drizzle(database.client, {
      schema: {
        ...authSchema,
        ...labelsSchema,
        ...focusSchema,
      },
    });
    await migrateDatabase(db, database.client);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-02T12:00:00.000Z"));
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

    let sessionCounter = 0;
    let recordCounter = 0;
    const service = createFocusService({
      crypto: {
        randomUUID: () => {
          sessionCounter += 1;

          if (sessionCounter === 1) {
            return "focus-session-1" as `${string}-${string}-${string}-${string}-${string}`;
          }

          recordCounter += 1;
          return `focus-record-${recordCounter}` as `${string}-${string}-${string}-${string}-${string}`;
        },
      },
      db,
    });

    await expect(
      service.startFocusSession({
        breakIntervalMinutes: 5,
        focusIntervalMinutes: 25,
        plannedFocusIntervalCount: 2,
        userId: "user-casey",
      }),
    ).resolves.toMatchObject({
      currentInterval: "Focus",
      focusIntervalMinutes: 25,
      id: "focus-session-1",
      intervalState: "Focus",
      plannedFocusIntervalCount: 2,
    });

    await service.captureNoteStudyActivity({
      labels: [
        {
          id: "label-biology",
          name: "Biology",
          parentIds: [],
        },
      ],
      note: {
        acronyms: [],
        body: "Repeated retrieval strengthens memory traces.",
        createdAt: "2026-05-02T11:30:00.000Z",
        id: "note-1",
        labelIds: ["label-biology"],
        metaphors: [],
        title: "Memory pathways",
        updatedAt: "2026-05-02T11:45:00.000Z",
      },
      userId: "user-casey",
    });

    const reloadedService = createFocusService({
      db,
    });

    await expect(
      reloadedService.getActiveSession({
        userId: "user-casey",
      }),
    ).resolves.toMatchObject({
      focusTargets: [
        {
          kind: "Note",
          labels: [{ id: "label-biology", name: "Biology" }],
          note: {
            id: "note-1",
            title: "Memory pathways",
          },
        },
      ],
      id: "focus-session-1",
    });

    vi.setSystemTime(new Date("2026-05-02T12:25:12.000Z"));

    await expect(
      reloadedService.endFocusSession({
        userId: "user-casey",
      }),
    ).resolves.toMatchObject({
      completedFocusIntervalCount: 1,
      endedAt: "2026-05-02T12:25:12.000Z",
      focusTargets: [
        {
          kind: "Note",
          labels: [{ id: "label-biology", name: "Biology" }],
          note: {
            id: "note-1",
            title: "Memory pathways",
          },
        },
      ],
      intervals: [
        {
          endedAt: "2026-05-02T12:25:00.000Z",
          kind: "Focus",
          startedAt: "2026-05-02T12:00:00.000Z",
        },
      ],
    });

    const historyService = createFocusService({
      db,
    });

    await expect(
      historyService.getActiveSession({
        userId: "user-casey",
      }),
    ).resolves.toBeNull();
    await expect(
      historyService.listFocusRecords({
        userId: "user-casey",
      }),
    ).resolves.toMatchObject([
      {
        completedFocusIntervalCount: 1,
        focusTargets: [
          {
            kind: "Note",
            labels: [{ id: "label-biology", name: "Biology" }],
            note: {
              id: "note-1",
              title: "Memory pathways",
            },
          },
        ],
        id: "focus-record-1",
      },
    ]);
  });
});
