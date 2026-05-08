import { afterEach, describe, expect, it } from "vitest";

import { migrateDatabase } from "./migrate";
import {
  closePostgresIntegrationDatabases,
  createPostgresIntegrationDatabase,
  type PostgresIntegrationDatabase,
} from "./postgres-integration-test-db";

describe("migrateDatabase PostgreSQL integration", () => {
  const databases = new Set<PostgresIntegrationDatabase>();

  afterEach(async () => {
    await closePostgresIntegrationDatabases(databases);
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
      {
        name: "0001_notes_with_metaphors_and_acronyms.sql",
      },
      {
        name: "0002_labels_and_note_label_assignments.sql",
      },
      {
        name: "0003_recall_sessions_and_results.sql",
      },
      {
        name: "0004_focus_sessions_and_records.sql",
      },
      {
        name: "0005_user_time_zone_preference.sql",
      },
    ]);

    const tables = await database.client.unsafe<Array<{ table_name: string }>>(`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in (
          '__drizzle_migrations',
          'auth_sessions',
          'focus_records',
          'focus_sessions',
          'label_edges',
          'labels',
          'note_acronyms',
          'note_labels',
          'note_metaphors',
          'notes',
          'recall_sessions',
          'session_results',
          'users'
        )
      order by table_name;
    `);

    expect(tables.map((table) => table.table_name)).toEqual([
      "__drizzle_migrations",
      "auth_sessions",
      "focus_records",
      "focus_sessions",
      "label_edges",
      "labels",
      "note_acronyms",
      "note_labels",
      "note_metaphors",
      "notes",
      "recall_sessions",
      "session_results",
      "users",
    ]);
  });
});
