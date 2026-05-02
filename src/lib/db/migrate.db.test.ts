import { afterEach, describe, expect, it } from "vitest";

import { migrateDatabase } from "./migrate";
import {
  createPostgresIntegrationDatabase,
  type PostgresIntegrationDatabase,
} from "./postgres-integration-test-db";

describe("migrateDatabase PostgreSQL integration", () => {
  const databases = new Set<PostgresIntegrationDatabase>();

  afterEach(async () => {
    await Promise.all(
      Array.from(databases, async (database) => {
        await database.close();
      }),
    );
    databases.clear();
  });

  it("migrates a clean PostgreSQL database repeatedly without duplicating migration history", async () => {
    const database = await createPostgresIntegrationDatabase();
    databases.add(database);

    await migrateDatabase(null, database.client);
    await migrateDatabase(null, database.client);

    const migrations = await database.client.unsafe<Array<{ name: string }>>(
      "select name from __drizzle_migrations order by name;",
    );

    expect(migrations).toEqual([
      {
        name: "0000_pilot_users_and_sessions.sql",
      },
    ]);

    const tables = await database.client.unsafe<Array<{ table_name: string }>>(`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('__drizzle_migrations', 'auth_sessions', 'users')
      order by table_name;
    `);

    expect(
      tables.map((table: { table_name: string }) => table.table_name),
    ).toEqual(["__drizzle_migrations", "auth_sessions", "users"]);
  });
});
