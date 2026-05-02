import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { loadAppEnv } from "../../lib/env";
import { notesSchema } from "./notes-schema";

type NotesDatabase = ReturnType<typeof drizzle<typeof notesSchema>>;

let cachedDatabase: NotesDatabase | null = null;
let cachedDatabaseUrl: string | null = null;
let cachedClient: postgres.Sql | null = null;

export function getNotesDb(): NotesDatabase {
  const env = loadAppEnv();

  if (cachedDatabase !== null && cachedDatabaseUrl === env.DATABASE_URL) {
    return cachedDatabase;
  }

  cachedClient = postgres(env.DATABASE_URL, {
    max: 1,
    prepare: false,
  });
  cachedDatabase = drizzle(cachedClient, {
    schema: notesSchema,
  });
  cachedDatabaseUrl = env.DATABASE_URL;

  return cachedDatabase;
}

export function getNotesSqlClient(): postgres.Sql {
  getNotesDb();

  if (cachedClient === null) {
    throw new Error("Notes SQL client was not initialized.");
  }

  return cachedClient;
}
