import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run DB migrations.");
}

const sql = postgres(DATABASE_URL, {
  max: 1,
  prepare: false,
});

const migrationsDir = path.resolve(process.cwd(), "drizzle", "migrations");

try {
  await sql.unsafe(`
    create table if not exists __drizzle_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const migrationFiles = (await readdir(migrationsDir))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();
  const appliedMigrations = new Set(
    (
      await sql.unsafe("select name from __drizzle_migrations order by name;")
    ).map((row) => row.name),
  );

  for (const fileName of migrationFiles) {
    if (appliedMigrations.has(fileName)) {
      continue;
    }

    const migrationSql = await readFile(
      path.join(migrationsDir, fileName),
      "utf8",
    );

    try {
      await sql.unsafe("begin;");
      await sql.unsafe(migrationSql);
      await sql.unsafe(
        `insert into __drizzle_migrations (name) values ('${fileName.replaceAll("'", "''")}');`,
      );
      await sql.unsafe("commit;");
      console.log(`Applied migration ${fileName}`);
    } catch (error) {
      await sql.unsafe("rollback;");
      throw error;
    }
  }
} finally {
  await sql.end();
}
