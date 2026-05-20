import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPgliteServiceTestDatabase } from "../../lib/db/pglite-service-test-db";
import { authSchema, usersTable } from "../access/session/auth-schema";
import { labelEdgesTable, labelsSchema } from "./labels-schema";
import { createLabelsService } from "./labels-service";

const labelsTestSchema = {
  ...authSchema,
  ...labelsSchema,
};

describe("createLabelsService", () => {
  let testDatabase: Awaited<
    ReturnType<typeof createPgliteServiceTestDatabase<typeof labelsTestSchema>>
  >;

  beforeAll(async () => {
    testDatabase = await createPgliteServiceTestDatabase(labelsTestSchema);
  });

  afterEach(async () => {
    await testDatabase.reset();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  it("returns flat labels across create, rename, list, and delete while ignoring legacy edges", async () => {
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

    const ids = [
      "00000000-0000-0000-0000-000000000001",
      "00000000-0000-0000-0000-000000000002",
    ] as const;
    let nextIdIndex = 0;
    const labels = createLabelsService({
      crypto: {
        randomUUID: () => {
          const id = ids[nextIdIndex];
          nextIdIndex += 1;

          if (id === undefined) {
            throw new Error("Missing test label id.");
          }

          return id;
        },
      },
      db,
      now: () => new Date("2026-05-02T12:00:00.000Z"),
    });

    await expect(
      labels.createLabel({
        name: "Science",
        userId: "user-casey",
      }),
    ).resolves.toEqual({
      id: "00000000-0000-0000-0000-000000000001",
      name: "Science",
    });

    const biology = await labels.createLabel({
      name: "Biology",
      userId: "user-casey",
    });

    await db.insert(labelEdgesTable).values({
      childLabelId: biology.id,
      parentLabelId: "00000000-0000-0000-0000-000000000001",
    });

    await expect(
      labels.listLabels({
        userId: "user-casey",
      }),
    ).resolves.toEqual([
      {
        id: biology.id,
        name: "Biology",
      },
      {
        id: "00000000-0000-0000-0000-000000000001",
        name: "Science",
      },
    ]);

    await expect(
      labels.renameLabel({
        labelId: biology.id,
        name: "Life Science",
        userId: "user-casey",
      }),
    ).resolves.toEqual({
      id: biology.id,
      name: "Life Science",
    });

    await labels.deleteLabel({
      labelId: biology.id,
      userId: "user-casey",
    });

    await expect(
      labels.listLabels({
        userId: "user-casey",
      }),
    ).resolves.toEqual([
      {
        id: "00000000-0000-0000-0000-000000000001",
        name: "Science",
      },
    ]);
  });

  it("keeps label reads and mutations scoped to the owning account", async () => {
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

    const labels = createLabelsService({
      crypto: {
        randomUUID: () => "10000000-0000-0000-0000-000000000001",
      },
      db,
      now: () => new Date("2026-05-02T12:00:00.000Z"),
    });

    const createdLabel = await labels.createLabel({
      name: "Private topic",
      userId: "user-casey",
    });

    await expect(
      labels.renameLabel({
        labelId: createdLabel.id,
        name: "Leaked topic",
        userId: "user-jordan",
      }),
    ).rejects.toMatchObject({
      code: "not_found",
    });

    await expect(
      Promise.all([
        labels.listLabels({
          userId: "user-casey",
        }),
        labels.listLabels({
          userId: "user-jordan",
        }),
      ]),
    ).resolves.toEqual([
      [
        {
          id: createdLabel.id,
          name: "Private topic",
        },
      ],
      [],
    ]);
  });

  it("trims names and rejects blank labels", async () => {
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

    const labels = createLabelsService({
      crypto: {
        randomUUID: () => "20000000-0000-0000-0000-000000000001",
      },
      db,
      now: () => new Date("2026-05-02T12:00:00.000Z"),
    });

    await expect(
      labels.createLabel({
        name: "  Biology  ",
        userId: "user-casey",
      }),
    ).resolves.toEqual({
      id: "20000000-0000-0000-0000-000000000001",
      name: "Biology",
    });

    await expect(
      labels.renameLabel({
        labelId: "20000000-0000-0000-0000-000000000001",
        name: " ",
        userId: "user-casey",
      }),
    ).rejects.toMatchObject({
      code: "invalid_input",
    });
  });
});
