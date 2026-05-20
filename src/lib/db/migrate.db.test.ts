import { afterEach, describe, expect, it } from "vitest";

import { migrateDatabase } from "./migrate";
import {
  createMigrationsDirBefore,
  DROP_LABEL_EDGES_MIGRATION,
  expectedLegacyFixtureLabels,
  expectedLegacyFixtureStudyNoteLabels,
  legacyLabelHierarchyFixtureSql,
  readExpectedMigrationHistory,
  removeTemporaryMigrationDirs,
  selectLabelEdgesTableSql,
} from "./migrate-test-support";
import {
  closePostgresIntegrationDatabases,
  createPostgresIntegrationDatabase,
  type PostgresIntegrationDatabase,
} from "./postgres-integration-test-db";

describe("migrateDatabase PostgreSQL integration", () => {
  const databases = new Set<PostgresIntegrationDatabase>();
  const temporaryMigrationDirs = new Set<string>();

  afterEach(async () => {
    try {
      await closePostgresIntegrationDatabases(databases);
    } finally {
      await removeTemporaryMigrationDirs(temporaryMigrationDirs);
    }
  });

  it("migrates a clean PostgreSQL database repeatedly without duplicating migration history", async () => {
    const database = await createPostgresIntegrationDatabase();
    databases.add(database);

    await migrateDatabase(null, database.client);
    await migrateDatabase(null, database.client);

    const migrations = await database.client.unsafe<Array<{ name: string }>>(
      "select name from __drizzle_migrations order by name;",
    );

    expect(migrations).toEqual(await readExpectedMigrationHistory());

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
          'recall_schedules',
          'session_results',
          'study_note_labels',
          'study_notes',
          'users'
        )
      order by table_name;
    `);

    expect(tables.map((table) => table.table_name)).toEqual([
      "__drizzle_migrations",
      "auth_sessions",
      "focus_records",
      "focus_sessions",
      "labels",
      "note_acronyms",
      "note_labels",
      "note_metaphors",
      "notes",
      "recall_schedules",
      "recall_sessions",
      "session_results",
      "study_note_labels",
      "study_notes",
      "users",
    ]);
  });

  it("drops label hierarchy edges while preserving active Study Note label assignments", async () => {
    const database = await createPostgresIntegrationDatabase();
    databases.add(database);

    const legacyMigrationsDir = await createMigrationsDirBefore(
      DROP_LABEL_EDGES_MIGRATION,
      temporaryMigrationDirs,
    );

    await migrateDatabase(null, database.client, {
      migrationsDir: legacyMigrationsDir,
    });

    await database.client.unsafe(legacyLabelHierarchyFixtureSql);

    await migrateDatabase(null, database.client);

    await expect(
      database.client.unsafe<Array<{ id: string; name: string }>>(`
        select id, name
        from labels
        order by id;
      `),
    ).resolves.toEqual(expectedLegacyFixtureLabels);

    await expect(
      database.client.unsafe<
        Array<{ label_id: string; study_note_id: string }>
      >(`
        select label_id, study_note_id
        from study_note_labels;
      `),
    ).resolves.toEqual(expectedLegacyFixtureStudyNoteLabels);

    await expect(
      database.client.unsafe<Array<{ table_name: string }>>(
        selectLabelEdgesTableSql,
      ),
    ).resolves.toEqual([]);
  });
});
