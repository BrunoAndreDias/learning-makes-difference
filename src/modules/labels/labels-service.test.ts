import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, describe, expect, it } from "vitest";

import { migrateDatabase } from "../../lib/db/migrate";
import { authSchema, usersTable } from "../access/session/auth-schema";
import { labelsSchema } from "./labels-schema";
import { createLabelsService } from "./labels-service";

describe("createLabelsService", () => {
  const databases = new Set<PGlite>();

  afterEach(async () => {
    await Promise.all(Array.from(databases, (database) => database.close()));
    databases.clear();
  });

  it("persists label DAG edges and rejects cycle-causing relationships", async () => {
    const client = new PGlite();
    databases.add(client);
    const db = drizzle(client, {
      schema: {
        ...authSchema,
        ...labelsSchema,
      },
    });
    await migrateDatabase(db, client);
    await db.insert(usersTable).values({
      id: "user-casey",
      displayName: "Casey Learner",
      email: "casey@example.com",
      passwordHash: "hash",
      interfaceLanguage: "en",
      studyLanguage: "en",
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });

    const labels = createLabelsService({
      crypto: {
        randomUUID: (() => {
          const ids = [
            "00000000-0000-0000-0000-000000000001",
            "00000000-0000-0000-0000-000000000002",
            "00000000-0000-0000-0000-000000000003",
            "00000000-0000-0000-0000-000000000004",
          ] satisfies readonly [
            `${string}-${string}-${string}-${string}-${string}`,
            `${string}-${string}-${string}-${string}-${string}`,
            `${string}-${string}-${string}-${string}-${string}`,
            `${string}-${string}-${string}-${string}-${string}`,
          ];
          let nextIndex = 0;

          return () => {
            const id = ids[nextIndex];
            nextIndex += 1;

            if (id === undefined) {
              throw new Error("Missing test label id.");
            }

            return id;
          };
        })(),
      },
      db,
      now: () => new Date("2026-05-02T12:00:00.000Z"),
    });

    const science = await labels.createLabel({
      name: "Science",
      userId: "user-casey",
    });
    const biology = await labels.createLabel({
      name: "Biology",
      userId: "user-casey",
    });
    const chemistry = await labels.createLabel({
      name: "Chemistry",
      userId: "user-casey",
    });
    const biochemistry = await labels.createLabel({
      name: "Biochemistry",
      userId: "user-casey",
    });

    await labels.addParent({
      labelId: biology.id,
      parentId: science.id,
      userId: "user-casey",
    });
    await labels.addParent({
      labelId: chemistry.id,
      parentId: science.id,
      userId: "user-casey",
    });
    await labels.addParent({
      labelId: biochemistry.id,
      parentId: biology.id,
      userId: "user-casey",
    });
    await labels.addParent({
      labelId: biochemistry.id,
      parentId: chemistry.id,
      userId: "user-casey",
    });

    await expect(
      labels.listLabels({
        userId: "user-casey",
      }),
    ).resolves.toEqual([
      {
        id: biochemistry.id,
        name: "Biochemistry",
        parentIds: [biology.id, chemistry.id],
      },
      {
        id: biology.id,
        name: "Biology",
        parentIds: [science.id],
      },
      {
        id: chemistry.id,
        name: "Chemistry",
        parentIds: [science.id],
      },
      {
        id: science.id,
        name: "Science",
        parentIds: [],
      },
    ]);

    await expect(
      labels.addParent({
        labelId: science.id,
        parentId: biochemistry.id,
        userId: "user-casey",
      }),
    ).rejects.toMatchObject({
      code: "cycle_detected",
    });

    await expect(
      labels.removeParent({
        labelId: biochemistry.id,
        parentId: biology.id,
        userId: "user-casey",
      }),
    ).resolves.toEqual({
      id: biochemistry.id,
      name: "Biochemistry",
      parentIds: [chemistry.id],
    });

    await expect(
      labels.listLabels({
        userId: "user-casey",
      }),
    ).resolves.toContainEqual({
      id: biochemistry.id,
      name: "Biochemistry",
      parentIds: [chemistry.id],
    });
  });

  it("keeps label reads and mutations scoped to the owning account", async () => {
    const client = new PGlite();
    databases.add(client);
    const db = drizzle(client, {
      schema: {
        ...authSchema,
        ...labelsSchema,
      },
    });
    await migrateDatabase(db, client);
    await db.insert(usersTable).values([
      {
        id: "user-casey",
        displayName: "Casey Learner",
        email: "casey@example.com",
        passwordHash: "hash",
        interfaceLanguage: "en",
        studyLanguage: "en",
        createdAt: new Date("2026-05-02T12:00:00.000Z"),
        updatedAt: new Date("2026-05-02T12:00:00.000Z"),
      },
      {
        id: "user-jordan",
        displayName: "Jordan Learner",
        email: "jordan@example.com",
        passwordHash: "hash",
        interfaceLanguage: "en",
        studyLanguage: "en",
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
          parentIds: [],
        },
      ],
      [],
    ]);
  });

  it("creates labels with parent IDs and validates ownership, duplicates, and self-parent", async () => {
    const client = new PGlite();
    databases.add(client);
    const db = drizzle(client, {
      schema: {
        ...authSchema,
        ...labelsSchema,
      },
    });
    await migrateDatabase(db, client);
    await db.insert(usersTable).values([
      {
        id: "user-casey",
        displayName: "Casey Learner",
        email: "casey@example.com",
        passwordHash: "hash",
        interfaceLanguage: "en",
        studyLanguage: "en",
        createdAt: new Date("2026-05-02T12:00:00.000Z"),
        updatedAt: new Date("2026-05-02T12:00:00.000Z"),
      },
      {
        id: "user-jordan",
        displayName: "Jordan Learner",
        email: "jordan@example.com",
        passwordHash: "hash",
        interfaceLanguage: "en",
        studyLanguage: "en",
        createdAt: new Date("2026-05-02T12:00:00.000Z"),
        updatedAt: new Date("2026-05-02T12:00:00.000Z"),
      },
    ]);

    const ids = [
      "00000000-0000-0000-0000-000000000011",
      "00000000-0000-0000-0000-000000000012",
      "00000000-0000-0000-0000-000000000013",
      "00000000-0000-0000-0000-000000000011",
      "00000000-0000-0000-0000-000000000011",
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

    const caseyParent = await labels.createLabel({
      name: "Science",
      userId: "user-casey",
    });
    const jordanParent = await labels.createLabel({
      name: "Jordan topic",
      userId: "user-jordan",
    });

    await expect(
      labels.createLabel({
        name: "Biology",
        parentIds: [caseyParent.id, caseyParent.id],
        userId: "user-casey",
      }),
    ).resolves.toEqual({
      id: "00000000-0000-0000-0000-000000000013",
      name: "Biology",
      parentIds: [caseyParent.id],
    });

    await expect(
      labels.listLabels({
        userId: "user-casey",
      }),
    ).resolves.toEqual([
      {
        id: "00000000-0000-0000-0000-000000000013",
        name: "Biology",
        parentIds: [caseyParent.id],
      },
      {
        id: caseyParent.id,
        name: "Science",
        parentIds: [],
      },
    ]);

    await expect(
      labels.createLabel({
        name: "Invalid ownership",
        parentIds: [jordanParent.id],
        userId: "user-casey",
      }),
    ).rejects.toMatchObject({
      code: "not_found",
    });

    await expect(
      labels.createLabel({
        name: "Self-parent attempt",
        parentIds: [caseyParent.id],
        userId: "user-casey",
      }),
    ).rejects.toMatchObject({
      code: "cycle_detected",
    });
  });

  it("updates label name with full parent set and validates cycle-safe parent selections", async () => {
    const client = new PGlite();
    databases.add(client);
    const db = drizzle(client, {
      schema: {
        ...authSchema,
        ...labelsSchema,
      },
    });
    await migrateDatabase(db, client);
    await db.insert(usersTable).values([
      {
        id: "user-casey",
        displayName: "Casey Learner",
        email: "casey@example.com",
        passwordHash: "hash",
        interfaceLanguage: "en",
        studyLanguage: "en",
        createdAt: new Date("2026-05-02T12:00:00.000Z"),
        updatedAt: new Date("2026-05-02T12:00:00.000Z"),
      },
      {
        id: "user-jordan",
        displayName: "Jordan Learner",
        email: "jordan@example.com",
        passwordHash: "hash",
        interfaceLanguage: "en",
        studyLanguage: "en",
        createdAt: new Date("2026-05-02T12:00:00.000Z"),
        updatedAt: new Date("2026-05-02T12:00:00.000Z"),
      },
    ]);

    const ids = [
      "00000000-0000-0000-0000-000000000201",
      "00000000-0000-0000-0000-000000000202",
      "00000000-0000-0000-0000-000000000203",
      "00000000-0000-0000-0000-000000000204",
      "00000000-0000-0000-0000-000000000205",
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

    const science = await labels.createLabel({
      name: "Science",
      userId: "user-casey",
    });
    const chemistry = await labels.createLabel({
      name: "Chemistry",
      userId: "user-casey",
    });
    const biology = await labels.createLabel({
      name: "Biology",
      parentIds: [science.id],
      userId: "user-casey",
    });
    const molecularBiology = await labels.createLabel({
      name: "Molecular Biology",
      parentIds: [biology.id],
      userId: "user-casey",
    });
    const jordanTopic = await labels.createLabel({
      name: "Jordan topic",
      userId: "user-jordan",
    });

    await expect(
      labels.updateLabel({
        labelId: biology.id,
        name: "  Life Science  ",
        parentIds: [chemistry.id, chemistry.id],
        userId: "user-casey",
      }),
    ).resolves.toEqual({
      id: biology.id,
      name: "Life Science",
      parentIds: [chemistry.id],
    });

    await expect(
      labels.listLabels({
        userId: "user-casey",
      }),
    ).resolves.toEqual([
      {
        id: chemistry.id,
        name: "Chemistry",
        parentIds: [],
      },
      {
        id: biology.id,
        name: "Life Science",
        parentIds: [chemistry.id],
      },
      {
        id: molecularBiology.id,
        name: "Molecular Biology",
        parentIds: [biology.id],
      },
      {
        id: science.id,
        name: "Science",
        parentIds: [],
      },
    ]);

    await expect(
      labels.updateLabel({
        labelId: biology.id,
        name: "Life Science",
        parentIds: [biology.id],
        userId: "user-casey",
      }),
    ).rejects.toMatchObject({
      code: "cycle_detected",
    });

    await expect(
      labels.updateLabel({
        labelId: biology.id,
        name: "Life Science",
        parentIds: [molecularBiology.id],
        userId: "user-casey",
      }),
    ).rejects.toMatchObject({
      code: "cycle_detected",
    });

    await expect(
      labels.updateLabel({
        labelId: biology.id,
        name: "Life Science",
        parentIds: [jordanTopic.id],
        userId: "user-casey",
      }),
    ).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
