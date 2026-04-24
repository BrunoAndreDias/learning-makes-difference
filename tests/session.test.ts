import { describe, expect, it } from "vitest";

import {
  AppAuthError,
  createAppSessionContext,
  hasActiveSession,
} from "../src/lib/session";

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

describe("app session context", () => {
  it("registers users with hashed credentials and restores the correct account on login", async () => {
    const storage = createMemoryStorage();
    const session = createAppSessionContext({
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
});
