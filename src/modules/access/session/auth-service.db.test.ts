import { drizzle } from "drizzle-orm/postgres-js";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "../../../lib/db/migrate";
import {
  closePostgresIntegrationDatabases,
  createPostgresIntegrationDatabase,
  type PostgresIntegrationDatabase,
} from "../../../lib/db/postgres-integration-test-db";
import { authSchema } from "./auth-schema";
import { createAuthService } from "./auth-service";

function createCookieJar() {
  let sessionToken: string | null = null;

  return {
    clear() {
      sessionToken = null;
    },
    get() {
      return sessionToken;
    },
    set(value: string, _options?: unknown) {
      sessionToken = value;
    },
  };
}

describe("createAuthService PostgreSQL integration", () => {
  const databases = new Set<PostgresIntegrationDatabase>();

  afterEach(async () => {
    await closePostgresIntegrationDatabases(databases);
  });

  it("persists separate users and restores only the matching account for each session cookie", async () => {
    const database = await createPostgresIntegrationDatabase();
    databases.add(database);

    const db = drizzle(database.client, { schema: authSchema });
    await migrateDatabase(db, database.client);

    const caseyCookie = createCookieJar();
    const jordanCookie = createCookieJar();
    const sharedOptions = {
      db,
      pilotRegistrationCode: "pilot-123",
      secureCookies: false,
      sessionSecret: "12345678901234567890123456789012",
    } as const;

    const caseyAuth = createAuthService({
      ...sharedOptions,
      cookie: caseyCookie,
    });

    await caseyAuth.register({
      displayName: "Casey Learner",
      email: "casey@example.com",
      password: "correct horse battery staple",
      pilotRegistrationCode: "pilot-123",
    });

    await caseyAuth.updatePreferences({
      displayName: "Casey Rivers",
      interfaceLanguage: "pt-BR",
      studyObjective: "specific_exam",
      studyLanguage: "es",
      userTimeZone: "America/New_York",
    });

    await caseyAuth.logout();

    const jordanAuth = createAuthService({
      ...sharedOptions,
      cookie: jordanCookie,
    });

    await jordanAuth.register({
      displayName: "Jordan Review",
      email: "jordan@example.com",
      password: "second secure password",
      pilotRegistrationCode: "pilot-123",
    });

    await jordanAuth.updatePreferences({
      displayName: "Jordan Rivera",
      interfaceLanguage: "en",
      studyObjective: null,
      studyLanguage: "pt-BR",
      userTimeZone: "Europe/Lisbon",
    });

    await caseyAuth.login({
      email: "casey@example.com",
      password: "correct horse battery staple",
    });

    const restoredCasey = createAuthService({
      ...sharedOptions,
      cookie: caseyCookie,
    });
    const restoredJordan = createAuthService({
      ...sharedOptions,
      cookie: jordanCookie,
    });

    await expect(restoredCasey.getSessionSnapshot()).resolves.toMatchObject({
      user: {
        displayName: "Casey Rivers",
        email: "casey@example.com",
        interfaceLanguage: "pt-BR",
        studyObjective: "specific_exam",
        studyLanguage: "es",
        userTimeZone: "America/New_York",
      },
    });
    await expect(restoredJordan.getSessionSnapshot()).resolves.toMatchObject({
      user: {
        displayName: "Jordan Rivera",
        email: "jordan@example.com",
        interfaceLanguage: "en",
        studyObjective: null,
        studyLanguage: "pt-BR",
        userTimeZone: "Europe/Lisbon",
      },
    });

    await expect(
      caseyAuth.login({
        email: "casey@example.com",
        password: "second secure password",
      }),
    ).rejects.toMatchObject({
      code: "invalid_credentials",
    });
  });
});
