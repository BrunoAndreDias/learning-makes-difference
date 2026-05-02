import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { appSchema } from "../../lib/db/schema";
import { loadAppEnv } from "../../lib/env";

type RecallDatabase = ReturnType<typeof drizzle<typeof appSchema>>;

let cachedDatabase: RecallDatabase | null = null;
let cachedDatabaseUrl: string | null = null;
let cachedClient: postgres.Sql | null = null;

export function getRecallDb(): RecallDatabase {
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

export function getRecallSqlClient(): postgres.Sql {
  getRecallDb();

  if (cachedClient === null) {
    throw new Error("Recall SQL client was not initialized.");
  }

  return cachedClient;
}
