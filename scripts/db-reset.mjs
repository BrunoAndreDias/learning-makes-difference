import postgres from "postgres";

import { resolveDatabaseUrl } from "./local-db-url.mjs";

const DATABASE_URL = resolveDatabaseUrl();
const APP_TABLES = [
  "focus_records",
  "focus_sessions",
  "session_results",
  "recall_sessions",
  "note_labels",
  "label_edges",
  "labels",
  "note_acronyms",
  "note_metaphors",
  "notes",
  "auth_sessions",
  "users",
  "__drizzle_migrations",
];

const sql = postgres(DATABASE_URL, {
  max: 1,
  prepare: false,
});

try {
  await sql.unsafe(
    APP_TABLES.map((tableName) => `drop table if exists ${tableName};`).join(
      "\n",
    ),
  );
  console.log("Dropped app tables and migration history.");
} finally {
  await sql.end();
}
