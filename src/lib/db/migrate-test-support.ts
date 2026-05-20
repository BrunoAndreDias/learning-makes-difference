import { copyFile, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const DROP_LABEL_EDGES_MIGRATION = "0012_drop_label_edges.sql";

const migrationsDir = path.resolve(process.cwd(), "drizzle", "migrations");

export const legacyLabelHierarchyFixtureSql = `
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
`;

export const expectedLegacyFixtureLabels = [
  {
    id: "label-biology",
    name: "Biology",
  },
  {
    id: "label-science",
    name: "Science",
  },
];

export const expectedLegacyFixtureStudyNoteLabels = [
  {
    label_id: "label-biology",
    study_note_id: "study-note-1",
  },
];

export const selectLabelEdgesTableSql = `
  select table_name
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'label_edges';
`;

async function readMigrationFileNames() {
  return (await readdir(migrationsDir))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();
}

export async function readExpectedMigrationHistory() {
  return (await readMigrationFileNames()).map((name) => ({ name }));
}

export async function createMigrationsDirBefore(
  migrationName: string,
  temporaryMigrationDirs: Set<string>,
) {
  const migrationFiles = await readMigrationFileNames();

  if (!migrationFiles.includes(migrationName)) {
    throw new Error(`Missing migration file: ${migrationName}`);
  }

  const temporaryDir = await mkdtemp(
    path.join(os.tmpdir(), "lmd-legacy-migrations-"),
  );
  temporaryMigrationDirs.add(temporaryDir);

  await Promise.all(
    migrationFiles
      .filter((fileName) => fileName < migrationName)
      .map((fileName) =>
        copyFile(
          path.join(migrationsDir, fileName),
          path.join(temporaryDir, fileName),
        ),
      ),
  );

  return temporaryDir;
}

export async function removeTemporaryMigrationDirs(
  temporaryMigrationDirs: Set<string>,
) {
  await Promise.all(
    Array.from(temporaryMigrationDirs, (temporaryDir) =>
      rm(temporaryDir, {
        force: true,
        recursive: true,
      }),
    ),
  );
  temporaryMigrationDirs.clear();
}
