import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { appSchema } from "../../lib/db/schema";
import { loadAppEnv } from "../../lib/env";

type FocusDatabase = ReturnType<typeof drizzle<typeof appSchema>>;

let cachedDatabase: FocusDatabase | null = null;
let cachedDatabaseUrl: string | null = null;
let cachedClient: postgres.Sql | null = null;

export function getFocusDb(): FocusDatabase {
  const env = loadAppEnv();

  if (cachedDatabase !== null && cachedDatabaseUrl === env.DATABASE_URL) {
    return cachedDatabase;
  }

  cachedClient = postgres(env.DATABASE_URL, {
    max: 1,
    prepare: false,
  });
  cachedDatabase = drizzle(cachedClient, {
    schema: appSchema,
  });
  cachedDatabaseUrl = env.DATABASE_URL;

  return cachedDatabase;
}

export function getFocusSqlClient(): postgres.Sql {
  getFocusDb();

  if (cachedClient === null) {
    throw new Error("Focus SQL client was not initialized.");
  }

  return cachedClient;
}
