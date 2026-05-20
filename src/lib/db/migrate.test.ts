import { copyFile, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";

import { migrateDatabase } from "./migrate";

const migrationsDir = path.resolve(process.cwd(), "drizzle", "migrations");

describe("migrateDatabase", () => {
  const clients = new Set<PGlite>();
  const temporaryMigrationDirs = new Set<string>();

  async function createLegacyMigrationsDir() {
    const temporaryDir = await mkdtemp(
      path.join(os.tmpdir(), "lmd-legacy-migrations-"),
    );
    temporaryMigrationDirs.add(temporaryDir);
    const migrationFiles = (await readdir(migrationsDir))
      .filter((fileName) => fileName.endsWith(".sql"))
      .sort()
      .filter((fileName) => fileName !== "0012_drop_label_edges.sql");

    await Promise.all(
      migrationFiles.map((fileName) =>
        copyFile(
          path.join(migrationsDir, fileName),
          path.join(temporaryDir, fileName),
        ),
      ),
    );

    return temporaryDir;
  }

  afterEach(async () => {
    await Promise.all(Array.from(clients, (client) => client.close()));
    clients.clear();
    await Promise.all(
      Array.from(temporaryMigrationDirs, (temporaryDir) =>
        rm(temporaryDir, {
          force: true,
          recursive: true,
        }),
      ),
    );
    temporaryMigrationDirs.clear();
  });

  it("drops label hierarchy edges while preserving active Study Note label assignments", async () => {
    const client = new PGlite();
    clients.add(client);

    const legacyMigrationsDir = await createLegacyMigrationsDir();

    await migrateDatabase(null, client, {
      migrationsDir: legacyMigrationsDir,
    });

    await client.exec(`
      insert into users (
        id,
        display_name,
        email,
        password_hash,
        created_at,
        updated_at,
        user_time_zone,
        user_language,
        show_study_note_templates
      ) values (
        'user-casey',
        'Casey Learner',
        'casey@example.com',
        'hash',
        '2026-05-02T12:00:00.000Z',
        '2026-05-02T12:00:00.000Z',
        'UTC',
        'en',
        true
      );

      insert into labels (
        id,
        user_id,
        name,
        created_at,
        updated_at
      ) values
        (
          'label-science',
          'user-casey',
          'Science',
          '2026-05-02T12:00:00.000Z',
          '2026-05-02T12:00:00.000Z'
        ),
        (
          'label-biology',
          'user-casey',
          'Biology',
          '2026-05-02T12:00:00.000Z',
          '2026-05-02T12:00:00.000Z'
        );

      insert into label_edges (
        child_label_id,
        parent_label_id
      ) values (
        'label-biology',
        'label-science'
      );

      insert into notes (
        id,
        user_id,
        title,
        body,
        label_ids,
        created_at,
        updated_at
      ) values (
        'note-1',
        'user-casey',
        'Cell respiration',
        'ATP stores transferable energy.',
        '{}',
        '2026-05-02T12:00:00.000Z',
        '2026-05-02T12:00:00.000Z'
      );

      insert into study_notes (
        id,
        source_note_id,
        prompt,
        expected_answer,
        created_at,
        updated_at
      ) values (
        'study-note-1',
        'note-1',
        'What stores transferable energy?',
        'ATP',
        '2026-05-02T12:00:00.000Z',
        '2026-05-02T12:00:00.000Z'
      );

      insert into study_note_labels (
        study_note_id,
        label_id
      ) values (
        'study-note-1',
        'label-biology'
      );
    `);

    await migrateDatabase(null, client);

    await expect(
      client.query<{ id: string; name: string }>(`
        select id, name
        from labels
        order by id;
      `),
    ).resolves.toMatchObject({
      rows: [
        {
          id: "label-biology",
          name: "Biology",
        },
        {
          id: "label-science",
          name: "Science",
        },
      ],
    });

    await expect(
      client.query<{ label_id: string; study_note_id: string }>(`
        select label_id, study_note_id
        from study_note_labels;
      `),
    ).resolves.toMatchObject({
      rows: [
        {
          label_id: "label-biology",
          study_note_id: "study-note-1",
        },
      ],
    });

    await expect(
      client.query<{ table_name: string }>(`
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'label_edges';
      `),
    ).resolves.toMatchObject({
      rows: [],
    });
  });
});
