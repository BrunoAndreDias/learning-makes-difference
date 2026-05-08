import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, describe, expect, it } from "vitest";

import { migrateDatabase } from "../../../lib/db/migrate";
import { authSchema, authSessionsTable, usersTable } from "./auth-schema";
import { createAuthService } from "./auth-service";

function createCookieJar() {
  let sessionToken: string | null = null;
  let lastOptions: Record<string, unknown> | null = null;

  return {
    clear() {
      sessionToken = null;
      lastOptions = null;
    },
    get() {
      return sessionToken;
    },
    getLastOptions() {
      return lastOptions;
    },
    set(value: string, options: Record<string, unknown>) {
      sessionToken = value;
      lastOptions = options;
    },
  };
}

describe("createAuthService", () => {
  const databases = new Set<PGlite>();

  afterEach(async () => {
    await Promise.all(Array.from(databases, (database) => database.close()));
    databases.clear();
  });

  it("registers a pilot user in the migration-backed auth store, hashes the password, and restores the session from the cookie token", async () => {
    const client = new PGlite();
    databases.add(client);
    const db = drizzle(client, { schema: authSchema });
    await migrateDatabase(db, client);

    const cookieJar = createCookieJar();
    const auth = createAuthService({
      cookie: cookieJar,
      db,
      now: () => new Date("2026-05-02T12:00:00.000Z"),
      pilotRegistrationCode: "pilot-123",
      sessionSecret: "12345678901234567890123456789012",
      secureCookies: false,
    });

    const registration = await auth.register({
      displayName: "Casey Learner",
      email: "casey@example.com",
      password: "correct horse battery staple",
      pilotRegistrationCode: "pilot-123",
    });

    expect(registration.user).toMatchObject({
      displayName: "Casey Learner",
      email: "casey@example.com",
      interfaceLanguage: "en",
      studyObjective: null,
      studyLanguage: "en",
      userTimeZone: "UTC",
    });
    expect(cookieJar.get()).toBeTruthy();
    expect(cookieJar.get()).not.toContain("casey@example.com");
    expect(cookieJar.get()).not.toBe(registration.user?.id);
    expect(cookieJar.getLastOptions()).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
    });

    const storedUsers = await db.select().from(usersTable);
    expect(storedUsers).toHaveLength(1);
    expect(storedUsers[0]?.passwordHash).toContain("$argon2id$");
    expect(storedUsers[0]?.passwordHash).not.toContain(
      "correct horse battery staple",
    );

    const storedSessions = await db.select().from(authSessionsTable);
    expect(storedSessions).toHaveLength(1);
    expect(storedSessions[0]?.userId).toBe(registration.user?.id);

    const restoredAuth = createAuthService({
      cookie: cookieJar,
      db,
      now: () => new Date("2026-05-02T12:00:00.000Z"),
      pilotRegistrationCode: "pilot-123",
      sessionSecret: "12345678901234567890123456789012",
      secureCookies: false,
    });

    await expect(restoredAuth.getSessionSnapshot()).resolves.toEqual(
      registration,
    );
    await expect(
      db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, "casey@example.com")),
    ).resolves.toHaveLength(1);
  });

  it("rejects missing or invalid pilot registration codes without creating a user", async () => {
    const client = new PGlite();
    databases.add(client);
    const db = drizzle(client, { schema: authSchema });
    await migrateDatabase(db, client);

    const cookieJar = createCookieJar();
    const auth = createAuthService({
      cookie: cookieJar,
      db,
      pilotRegistrationCode: "pilot-123",
      sessionSecret: "12345678901234567890123456789012",
      secureCookies: false,
    });

    await expect(
      auth.register({
        displayName: "Casey Learner",
        email: "casey@example.com",
        password: "correct horse battery staple",
        pilotRegistrationCode: "",
      }),
    ).rejects.toMatchObject({
      code: "invalid_registration_code",
    });

    await expect(
      db
        .select({
          id: usersTable.id,
        })
        .from(usersTable),
    ).resolves.toHaveLength(0);
    expect(cookieJar.get()).toBeNull();
  });

  it("invalidates sessions on logout, then restores the same account and preferences on login", async () => {
    const client = new PGlite();
    databases.add(client);
    const db = drizzle(client, { schema: authSchema });
    await migrateDatabase(db, client);

    const cookieJar = createCookieJar();
    const auth = createAuthService({
      cookie: cookieJar,
      db,
      pilotRegistrationCode: "pilot-123",
      sessionSecret: "12345678901234567890123456789012",
      secureCookies: false,
    });

    await auth.register({
      displayName: "Casey Learner",
      email: "casey@example.com",
      password: "correct horse battery staple",
      pilotRegistrationCode: "pilot-123",
    });

    await auth.updatePreferences({
      displayName: "Casey Rivers",
      interfaceLanguage: "pt-BR",
      studyObjective: "specific_exam",
      studyLanguage: "es",
      userTimeZone: "America/New_York",
    });
    await auth.logout();

    await expect(auth.getSessionSnapshot()).resolves.toEqual({ user: null });
    await expect(db.select().from(authSessionsTable)).resolves.toHaveLength(0);

    await auth.login({
      email: "casey@example.com",
      password: "correct horse battery staple",
    });

    const restoredAuth = createAuthService({
      cookie: cookieJar,
      db,
      pilotRegistrationCode: "pilot-123",
      sessionSecret: "12345678901234567890123456789012",
      secureCookies: false,
    });

    await expect(restoredAuth.getSessionSnapshot()).resolves.toMatchObject({
      user: {
        displayName: "Casey Rivers",
        interfaceLanguage: "pt-BR",
        studyObjective: "specific_exam",
        studyLanguage: "es",
        userTimeZone: "America/New_York",
      },
    });
  });

  it("rejects invalid account preference updates", async () => {
    const client = new PGlite();
    databases.add(client);
    const db = drizzle(client, { schema: authSchema });
    await migrateDatabase(db, client);

    const auth = createAuthService({
      cookie: createCookieJar(),
      db,
      pilotRegistrationCode: "pilot-123",
      sessionSecret: "12345678901234567890123456789012",
      secureCookies: false,
    });

    await auth.register({
      displayName: "Casey Learner",
      email: "casey@example.com",
      password: "correct horse battery staple",
      pilotRegistrationCode: "pilot-123",
      userTimeZone: "Europe/Lisbon",
    });

    await expect(
      auth.updatePreferences({
        displayName: "Casey Learner",
        interfaceLanguage: "en",
        studyObjective: "career_change" as never,
        studyLanguage: "en",
        userTimeZone: "Europe/Lisbon",
      }),
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: "Study Objective must be one of the supported options.",
    });

    await expect(
      auth.updatePreferences({
        displayName: "Casey Learner",
        interfaceLanguage: "en",
        studyObjective: null,
        studyLanguage: "en",
        userTimeZone: "Mars/Base",
      }),
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: "User Time Zone must be a supported IANA time zone.",
    });
  });
});
