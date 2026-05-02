import { describe, expect, it } from "vitest";
import {
  type AppAuthError,
  createAppSessionContext,
  createGuestSessionContext,
  hasActiveSession,
} from "./session";

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

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
    const storage = createMemoryStorage();
    const cookie = createMemoryCookieStore();
    const session = createAppSessionContext({
      cookie,
      keyPrefix: "session-test",
      storage,
    });

    await session.register({
      displayName: "Casey Learner",
      email: "casey@example.com",
      password: "correct horse battery staple",
    });

    expect(hasActiveSession(session.getSnapshot())).toBe(true);
    expect(session.getSnapshot().user?.displayName).toBe("Casey Learner");
    expect(cookie.get()).not.toBe("casey@example.com");

    const storedUsers = storage.getItem("session-test:users");

    expect(storedUsers).not.toContain("correct horse battery staple");
    expect(storedUsers).toContain("passwordHash");
    expect(storedUsers).toContain("passwordSalt");

    session.logout();

    expect(hasActiveSession(session.getSnapshot())).toBe(false);

    await session.login({
      email: "casey@example.com",
      password: "correct horse battery staple",
    });

    expect(session.getSnapshot().user?.email).toBe("casey@example.com");
  });

  it("restores the active user from an opaque persisted session and clears it on sign-out", async () => {
    const storage = createMemoryStorage();
    const cookie = createMemoryCookieStore();
    const firstSession = createAppSessionContext({
      cookie,
      keyPrefix: "session-test-refresh",
      storage,
    });

    await firstSession.register({
      displayName: "Casey Learner",
      email: "casey@example.com",
      password: "correct horse battery staple",
    });

    const activeSessionId = cookie.get();

    expect(activeSessionId).toBeTruthy();
    expect(activeSessionId).not.toBe(firstSession.getSnapshot().user?.id);
    expect(storage.getItem("session-test-refresh:sessions")).toContain(
      activeSessionId,
    );

    const refreshedSession = createAppSessionContext({
      cookie,
      keyPrefix: "session-test-refresh",
      storage,
    });

    expect(refreshedSession.getSnapshot().user).toMatchObject({
      displayName: "Casey Learner",
      email: "casey@example.com",
    });

    refreshedSession.logout();

    expect(cookie.get()).toBeNull();
    expect(hasActiveSession(refreshedSession.getSnapshot())).toBe(false);
    expect(storage.getItem("session-test-refresh:sessions")).not.toContain(
      activeSessionId,
    );
  });

  it("rejects cross-account access when credentials do not match", async () => {
    const storage = createMemoryStorage();
    const session = createAppSessionContext({
      keyPrefix: "session-test-isolation",
      storage,
    });

    await session.register({
      displayName: "Casey Learner",
      email: "casey@example.com",
      password: "correct horse battery staple",
    });
    session.logout();
    await session.register({
      displayName: "Jordan Review",
      email: "jordan@example.com",
      password: "second secure password",
    });
    session.logout();

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
    const storage = createMemoryStorage();
    const cookie = createMemoryCookieStore();
    const session = createAppSessionContext({
      cookie,
      keyPrefix: "session-test-duplicate-email",
      storage,
    });

    await session.register({
      displayName: "Casey Learner",
      email: "casey@example.com",
      password: "correct horse battery staple",
    });

    await expect(
      session.register({
        displayName: "Casey Learner Two",
        email: "CASEY@example.com",
        password: "another secure password",
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
    const storage = createMemoryStorage();
    const session = createAppSessionContext({
      keyPrefix: "session-test-preferences",
      storage,
    });

    await session.register({
      displayName: "Casey Learner",
      email: "casey@example.com",
      password: "correct horse battery staple",
    });
    session.logout();

    await session.register({
      displayName: "Jordan Review",
      email: "jordan@example.com",
      password: "second secure password",
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

    session.logout();

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
