import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { loadAppEnv } from "../../../lib/env";
import { authSessionsTable, usersTable } from "./auth-schema";

type AuthDatabase = ReturnType<typeof drizzle<typeof authSchema>>;

const authSchema = {
  authSessionsTable,
  usersTable,
};

let cachedDatabase: AuthDatabase | null = null;
let cachedDatabaseUrl: string | null = null;
let cachedClient: postgres.Sql | null = null;

export function getAuthDb(): AuthDatabase {
  const env = loadAppEnv();

  if (cachedDatabase !== null && cachedDatabaseUrl === env.DATABASE_URL) {
    return cachedDatabase;
  }

  cachedClient = postgres(env.DATABASE_URL, {
    max: 1,
    prepare: false,
  });
  cachedDatabase = drizzle(cachedClient, {
    schema: authSchema,
  });
  cachedDatabaseUrl = env.DATABASE_URL;

  return cachedDatabase;
}

export function getAuthSqlClient(): postgres.Sql {
  getAuthDb();

  if (cachedClient === null) {
    throw new Error("Auth SQL client was not initialized.");
  }

  return cachedClient;
}
