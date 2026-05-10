import { drizzle } from "drizzle-orm/postgres-js";
import { afterEach, describe, expect, it } from "vitest";

import { migrateDatabase } from "../../lib/db/migrate";
import {
  closePostgresIntegrationDatabases,
  createPostgresIntegrationDatabase,
  type PostgresIntegrationDatabase,
} from "../../lib/db/postgres-integration-test-db";
import { authSchema, usersTable } from "../access/session/auth-schema";
import { labelEdgesTable, labelsSchema, labelsTable } from "./labels-schema";

function findSqlState(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }

  if ("cause" in error) {
    return findSqlState(error.cause);
  }

  return undefined;
}

async function expectSqlState(promise: Promise<unknown>, expectedCode: string) {
  try {
    await promise;
  } catch (error) {
    expect(findSqlState(error)).toBe(expectedCode);
    return;
  }

  throw new Error(`Expected PostgreSQL SQLSTATE ${expectedCode}.`);
}

describe("labels schema PostgreSQL integration", () => {
  const databases = new Set<PostgresIntegrationDatabase>();

  afterEach(async () => {
    await closePostgresIntegrationDatabases(databases);
  });

  it("rejects duplicate edges and self-parent edges with database constraints", async () => {
    const database = await createPostgresIntegrationDatabase();
    databases.add(database);

    const db = drizzle(database.client, {
      schema: {
        ...authSchema,
        ...labelsSchema,
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

    await db.insert(labelEdgesTable).values({
      childLabelId: "label-biology",
      parentLabelId: "label-science",
    });

    await expectSqlState(
      db.insert(labelEdgesTable).values({
        childLabelId: "label-biology",
        parentLabelId: "label-science",
      }),
      "23505",
    );
    await expectSqlState(
      db.insert(labelEdgesTable).values({
        childLabelId: "label-science",
        parentLabelId: "label-science",
      }),
      "23514",
    );
  });
});
