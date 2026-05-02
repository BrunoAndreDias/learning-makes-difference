import { describe, expect, it } from "vitest";
import {
  type AppAuthError,
  createAppSessionContext,
  createGuestSessionContext,
  createMemorySessionService,
  createMemorySessionStore,
  hasActiveSession,
} from "./session";

const TEST_PILOT_REGISTRATION_CODE = "test-pilot-code";

function createMemoryCookieStore() {
  let value: string | null = null;

  return {
    clear() {
      value = null;
    },
    get() {
      return value;
    },
    set(nextValue: string) {
      value = nextValue;
    },
  };
}

describe("app session context", () => {
  it("keeps guest sessions unauthenticated", async () => {
    const session = createGuestSessionContext();

    expect(hasActiveSession(session.getSnapshot())).toBe(false);

    await expect(
      session.login({
        email: "guest@example.com",
        password: "correct horse battery staple",
      }),
    ).rejects.toMatchObject({
      code: "not_authenticated",
    } satisfies Pick<AppAuthError, "code">);
  });

  it("registers users with hashed credentials and restores the correct account on login", async () => {
    const store = createMemorySessionStore();
    const cookie = createMemoryCookieStore();
    const session = createAppSessionContext({
      service: createMemorySessionService({
        cookie,
        pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
        store,
      }),
    });

    await session.register({
      displayName: "Casey Learner",
      email: "casey@example.com",
      password: "correct horse battery staple",
      pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
    });

    expect(hasActiveSession(session.getSnapshot())).toBe(true);
    expect(session.getSnapshot().user?.displayName).toBe("Casey Learner");
    expect(cookie.get()).not.toBe("casey@example.com");
    expect(JSON.stringify(store.users)).not.toContain(
      "correct horse battery staple",
    );
    expect(store.users[0]?.passwordHash).toBeTruthy();
    expect(store.users[0]?.passwordSalt).toBeTruthy();

    await session.logout();

    expect(hasActiveSession(session.getSnapshot())).toBe(false);

    await session.login({
      email: "casey@example.com",
      password: "correct horse battery staple",
    });

    expect(session.getSnapshot().user?.email).toBe("casey@example.com");
  });

  it("restores the active user from an opaque persisted session and clears it on sign-out", async () => {
    const store = createMemorySessionStore();
    const cookie = createMemoryCookieStore();
    const firstSession = createAppSessionContext({
      service: createMemorySessionService({
        cookie,
        pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
        store,
      }),
    });

    await firstSession.register({
      displayName: "Casey Learner",
      email: "casey@example.com",
      password: "correct horse battery staple",
      pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
    });

    const activeSessionId = cookie.get();

    expect(activeSessionId).toBeTruthy();
    expect(activeSessionId).not.toBe(firstSession.getSnapshot().user?.id);
    expect(
      store.sessions.some((session) => session.id === activeSessionId),
    ).toBe(true);

    const refreshedSession = createAppSessionContext({
      service: createMemorySessionService({
        cookie,
        pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
        store,
      }),
    });

    await refreshedSession.refresh();

    expect(refreshedSession.getSnapshot().user).toMatchObject({
      displayName: "Casey Learner",
      email: "casey@example.com",
    });

    await refreshedSession.logout();

    expect(cookie.get()).toBeNull();
    expect(hasActiveSession(refreshedSession.getSnapshot())).toBe(false);
    expect(
      store.sessions.some((session) => session.id === activeSessionId),
    ).toBe(false);
  });

  it("rejects cross-account access when credentials do not match", async () => {
    const store = createMemorySessionStore();
    const session = createAppSessionContext({
      service: createMemorySessionService({
        pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
        store,
      }),
    });

    await session.register({
      displayName: "Casey Learner",
      email: "casey@example.com",
      password: "correct horse battery staple",
      pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
    });
    await session.logout();
    await session.register({
      displayName: "Jordan Review",
      email: "jordan@example.com",
      password: "second secure password",
      pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
    });
    await session.logout();

    await expect(
      session.login({
        email: "casey@example.com",
        password: "second secure password",
      }),
    ).rejects.toMatchObject({
      code: "invalid_credentials",
    } satisfies Pick<AppAuthError, "code">);

    expect(hasActiveSession(session.getSnapshot())).toBe(false);
  });

  it("rejects duplicate email registration without exposing credential fields in the session snapshot", async () => {
    const store = createMemorySessionStore();
    const cookie = createMemoryCookieStore();
    const session = createAppSessionContext({
      service: createMemorySessionService({
        cookie,
        pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
        store,
      }),
    });

    await session.register({
      displayName: "Casey Learner",
      email: "casey@example.com",
      password: "correct horse battery staple",
      pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
    });

    await expect(
      session.register({
        displayName: "Casey Learner Two",
        email: "CASEY@example.com",
        password: "another secure password",
        pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
      }),
    ).rejects.toMatchObject({
      code: "email_taken",
    } satisfies Pick<AppAuthError, "code">);

    expect(session.getSnapshot().user).toMatchObject({
      displayName: "Casey Learner",
      email: "casey@example.com",
    });
    expect(session.getSnapshot().user).not.toHaveProperty("passwordHash");
    expect(session.getSnapshot().user).not.toHaveProperty("passwordSalt");
  });

  it("persists account preferences per user without leaking across accounts", async () => {
    const store = createMemorySessionStore();
    const session = createAppSessionContext({
      service: createMemorySessionService({
        pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
        store,
      }),
    });

    await session.register({
      displayName: "Casey Learner",
      email: "casey@example.com",
      password: "correct horse battery staple",
      pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
    });
    await session.logout();

    await session.register({
      displayName: "Jordan Review",
      email: "jordan@example.com",
      password: "second secure password",
      pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
    });

    await session.updatePreferences({
      displayName: "Jordan Rivera",
      interfaceLanguage: "pt-BR",
      studyLanguage: "es",
    });

    expect(session.getSnapshot().user).toMatchObject({
      displayName: "Jordan Rivera",
      interfaceLanguage: "pt-BR",
      studyLanguage: "es",
    });

    await session.logout();

    await session.login({
      email: "casey@example.com",
      password: "correct horse battery staple",
    });

    expect(session.getSnapshot().user).toMatchObject({
      displayName: "Casey Learner",
      interfaceLanguage: "en",
      studyLanguage: "en",
    });
  });
});
