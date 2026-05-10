import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import { migrateDatabase } from "./migrate";

type PgliteTableRow = {
  table_name: string;
};

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function listApplicationTables(client: PGlite) {
  const result = await client.query<PgliteTableRow>(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
      and table_name <> '__drizzle_migrations'
    order by table_name;
  `);

  return result.rows.map((row) => row.table_name);
}

async function truncateApplicationTables(client: PGlite) {
  const tableNames = await listApplicationTables(client);

  if (tableNames.length === 0) {
    return;
  }

  await client.exec(
    `truncate table ${tableNames
      .map(quoteIdentifier)
      .join(", ")} restart identity cascade;`,
  );
}

export async function createPgliteServiceTestDatabase<
  TSchema extends Record<string, unknown>,
>(schema: TSchema) {
  const client = new PGlite();
  const db = drizzle(client, {
    schema,
  });

  await migrateDatabase(db, client);

  return {
    client,
    async close() {
      await client.close();
    },
    db,
    async reset() {
      await truncateApplicationTables(client);
    },
  };
}
