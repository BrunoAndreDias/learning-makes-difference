import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";

import { migrateDatabase } from "./migrate";
import {
  createMigrationsDirBefore,
  DROP_LABEL_EDGES_MIGRATION,
  expectedLegacyFixtureLabels,
  expectedLegacyFixtureStudyNoteLabels,
  legacyLabelHierarchyFixtureSql,
  removeTemporaryMigrationDirs,
  selectLabelEdgesTableSql,
} from "./migrate-test-support";

describe("migrateDatabase", () => {
  const clients = new Set<PGlite>();
  const temporaryMigrationDirs = new Set<string>();

  afterEach(async () => {
    try {
      await Promise.all(Array.from(clients, (client) => client.close()));
      clients.clear();
    } finally {
      await removeTemporaryMigrationDirs(temporaryMigrationDirs);
    }
  });

  it("drops label hierarchy edges while preserving active Study Note label assignments", async () => {
    const client = new PGlite();
    clients.add(client);

    const legacyMigrationsDir = await createMigrationsDirBefore(
      DROP_LABEL_EDGES_MIGRATION,
      temporaryMigrationDirs,
    );

    await migrateDatabase(null, client, {
      migrationsDir: legacyMigrationsDir,
    });

    await client.exec(legacyLabelHierarchyFixtureSql);

    await migrateDatabase(null, client);

    const labels = await client.query<{ id: string; name: string }>(`
      select id, name
      from labels
      order by id;
    `);

    expect(labels.rows).toEqual(expectedLegacyFixtureLabels);

    const studyNoteLabels = await client.query<{
      label_id: string;
      study_note_id: string;
    }>(`
      select label_id, study_note_id
      from study_note_labels;
    `);

    expect(studyNoteLabels.rows).toEqual(expectedLegacyFixtureStudyNoteLabels);

    const labelEdgesTable = await client.query<{ table_name: string }>(
      selectLabelEdgesTableSql,
    );

    expect(labelEdgesTable.rows).toEqual([]);
  });
});
