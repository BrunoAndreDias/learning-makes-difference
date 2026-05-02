import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

type PGliteLike = {
  exec: (query: string) => Promise<unknown>;
  query: <TRow extends Record<string, unknown>>(
    query: string,
  ) => Promise<{ rows: TRow[] }>;
};

type PostgresJsLike = {
  unsafe: <TRow extends Record<string, unknown>>(
    query: string,
  ) => Promise<TRow[]>;
};

const DEFAULT_MIGRATIONS_DIR = path.resolve(
  process.cwd(),
  "drizzle",
  "migrations",
);

function isPGliteClient(client: unknown): client is PGliteLike {
  return (
    typeof client === "object" &&
    client !== null &&
    "exec" in client &&
    "query" in client
  );
}

function isPostgresJsClient(client: unknown): client is PostgresJsLike {
  return (
    typeof client === "object" &&
    client !== null &&
    "unsafe" in client &&
    typeof client.unsafe === "function"
  );
}

async function executeStatement(
  client: PGliteLike | PostgresJsLike,
  sql: string,
) {
  if (isPGliteClient(client)) {
    await client.exec(sql);
    return;
  }

  await client.unsafe(sql);
}

async function queryRows<TRow extends Record<string, unknown>>(
  client: PGliteLike | PostgresJsLike,
  sql: string,
): Promise<TRow[]> {
  if (isPGliteClient(client)) {
    const result = await client.query<TRow>(sql);
    return result.rows;
  }

  return client.unsafe<TRow>(sql);
}

export async function migrateDatabase(
  _db: unknown,
  client: PGliteLike | PostgresJsLike,
  options: {
    migrationsDir?: string;
  } = {},
) {
  const migrationsDir = options.migrationsDir ?? DEFAULT_MIGRATIONS_DIR;
  const migrationFiles = (await readdir(migrationsDir))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  await executeStatement(
    client,
    `
      create table if not exists __drizzle_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      );
    `,
  );

  const appliedMigrations = new Set(
    (
      await queryRows<{ name: string }>(
        client,
        "select name from __drizzle_migrations order by name;",
      )
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
      await executeStatement(client, "begin;");
      await executeStatement(client, migrationSql);
      await executeStatement(
        client,
        `insert into __drizzle_migrations (name) values ('${fileName.replaceAll("'", "''")}');`,
      );
      await executeStatement(client, "commit;");
    } catch (error) {
      await executeStatement(client, "rollback;");
      throw error;
    }
  }
}
