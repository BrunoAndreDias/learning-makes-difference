import { describe, expect, it } from "vitest";

import { AppFocusError, createAppFocusContext } from "./focus";

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe("focus sessions", () => {
  it("starts a FocusSession with default Pomodoro timing", () => {
    const focus = createAppFocusContext({
      crypto: {
        randomUUID: () =>
          "focus-session-default-1" as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "focus-test-default",
      storage: createMemoryStorage(),
    });

    const session = focus.startFocusSession({
      userId: "owner",
    });

    expect(session).toEqual({
      breakIntervalMinutes: 5,
      createdAt: session.createdAt,
      currentInterval: "Focus",
      focusIntervalMinutes: 25,
      id: "focus-session-default-1",
      method: "Pomodoro",
      plannedFocusIntervalCount: null,
    });
    expect(focus.getActiveSession({ userId: "owner" })).toEqual(session);
  });

  it("starts a FocusSession with supported timing configuration", () => {
    const focus = createAppFocusContext({
      crypto: {
        randomUUID: () =>
          "focus-session-configured-1" as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "focus-test-configured",
      storage: createMemoryStorage(),
    });

    const session = focus.startFocusSession({
      breakIntervalMinutes: 10,
      focusIntervalMinutes: 40,
      plannedFocusIntervalCount: 6,
      userId: "owner",
    });

    expect(session).toMatchObject({
      breakIntervalMinutes: 10,
      currentInterval: "Focus",
      focusIntervalMinutes: 40,
      id: "focus-session-configured-1",
      method: "Pomodoro",
      plannedFocusIntervalCount: 6,
    });
  });

  it("rehydrates a configured active FocusSession from storage", () => {
    const storage = createMemoryStorage();
    const focus = createAppFocusContext({
      crypto: {
        randomUUID: () =>
          "focus-session-rehydrated-1" as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "focus-test-rehydrated",
      storage,
    });

    const session = focus.startFocusSession({
      breakIntervalMinutes: 15,
      focusIntervalMinutes: 45,
      plannedFocusIntervalCount: 3,
      userId: "owner",
    });
    const reloadedFocus = createAppFocusContext({
      keyPrefix: "focus-test-rehydrated",
      storage,
    });

    expect(reloadedFocus.getActiveSession({ userId: "owner" })).toEqual(
      session,
    );
  });

  it("rejects invalid timing configuration", () => {
    const focus = createAppFocusContext({
      keyPrefix: "focus-test-invalid",
      storage: createMemoryStorage(),
    });

    expect(() =>
      focus.startFocusSession({
        focusIntervalMinutes: 0,
        userId: "owner",
      }),
    ).toThrowError(
      new AppFocusError(
        "invalid_input",
        "Focus interval duration must be at least 1 minute.",
      ),
    );
    expect(() =>
      focus.startFocusSession({
        breakIntervalMinutes: -1,
        userId: "owner",
      }),
    ).toThrowError(
      new AppFocusError(
        "invalid_input",
        "Break interval duration must be at least 1 minute.",
      ),
    );
    expect(() =>
      focus.startFocusSession({
        plannedFocusIntervalCount: 0,
        userId: "owner",
      }),
    ).toThrowError(
      new AppFocusError(
        "invalid_input",
        "Planned focus interval count must be at least 1 when provided.",
      ),
    );
  });

  it("prevents a second active FocusSession for the same user", () => {
    const focus = createAppFocusContext({
      keyPrefix: "focus-test-single-active",
      storage: createMemoryStorage(),
    });

    focus.startFocusSession({ userId: "owner" });

    expect(() => focus.startFocusSession({ userId: "owner" })).toThrowError(
      new AppFocusError(
        "invalid_input",
        "User already has an active FocusSession.",
      ),
    );
  });

  it("scopes active FocusSession state to the owning user", () => {
    const storage = createMemoryStorage();
    const focus = createAppFocusContext({
      keyPrefix: "focus-test-ownership",
      storage,
    });

    const ownersSession = focus.startFocusSession({ userId: "owner" });
    const otherUsersSession = focus.startFocusSession({ userId: "other-user" });
    const reloadedFocus = createAppFocusContext({
      keyPrefix: "focus-test-ownership",
      storage,
    });

    expect(focus.getActiveSession({ userId: "owner" })).toEqual(ownersSession);
    expect(focus.getActiveSession({ userId: "other-user" })).toEqual(
      otherUsersSession,
    );
    expect(reloadedFocus.getActiveSession({ userId: "owner" })).toEqual(
      ownersSession,
    );
    expect(reloadedFocus.getActiveSession({ userId: "other-user" })).toEqual(
      otherUsersSession,
    );
  });
});
