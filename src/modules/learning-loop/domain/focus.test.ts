import { afterEach, describe, expect, it, vi } from "vitest";

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
  afterEach(() => {
    vi.useRealTimers();
  });

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

    expect(session).toMatchObject({
      breakIntervalMinutes: 5,
      completedBreakIntervalCount: 0,
      completedFocusIntervalCount: 0,
      createdAt: session.createdAt,
      currentInterval: "Focus",
      focusIntervalMinutes: 25,
      id: "focus-session-default-1",
      intervalState: "Focus",
      isStale: false,
      method: "Pomodoro",
      plannedFocusIntervalCount: null,
      remainingSeconds: 1500,
      stateEndsAt: session.stateEndsAt,
      stateStartedAt: session.createdAt,
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

  it("derives focus completion from elapsed wall-clock time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

    const focus = createAppFocusContext({
      crypto: {
        randomUUID: () =>
          "focus-session-timer-1" as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "focus-test-timer",
      storage: createMemoryStorage(),
    });

    focus.startFocusSession({
      focusIntervalMinutes: 25,
      userId: "owner",
    });

    vi.setSystemTime(new Date("2026-04-30T10:25:12.000Z"));

    expect(focus.getActiveSession({ userId: "owner" })).toMatchObject({
      completedBreakIntervalCount: 0,
      completedFocusIntervalCount: 1,
      currentInterval: "Focus",
      intervalState: "Transition",
      isStale: false,
      remainingSeconds: 18,
    });
  });

  it("starts a BreakInterval after the transition window elapses", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

    const focus = createAppFocusContext({
      keyPrefix: "focus-test-break-start",
      storage: createMemoryStorage(),
    });

    focus.startFocusSession({
      focusIntervalMinutes: 25,
      userId: "owner",
    });

    vi.setSystemTime(new Date("2026-04-30T10:25:31.000Z"));

    expect(focus.getActiveSession({ userId: "owner" })).toMatchObject({
      completedBreakIntervalCount: 0,
      completedFocusIntervalCount: 1,
      currentInterval: "Break",
      intervalState: "Break",
      isStale: false,
      remainingSeconds: 299,
    });
  });

  it("starts the next FocusInterval explicitly from the transition window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

    const focus = createAppFocusContext({
      keyPrefix: "focus-test-transition-continue",
      storage: createMemoryStorage(),
    });

    focus.startFocusSession({
      focusIntervalMinutes: 25,
      userId: "owner",
    });

    vi.setSystemTime(new Date("2026-04-30T10:25:12.000Z"));

    const session = focus.startNextFocusInterval({
      userId: "owner",
    });

    expect(session).toMatchObject({
      completedBreakIntervalCount: 0,
      completedFocusIntervalCount: 1,
      currentInterval: "Focus",
      intervalState: "Focus",
      isStale: false,
      remainingSeconds: 1500,
    });
    expect(session.stateStartedAt).toBe("2026-04-30T10:25:12.000Z");
  });

  it("waits for explicit action after a completed BreakInterval", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

    const focus = createAppFocusContext({
      keyPrefix: "focus-test-break-complete",
      storage: createMemoryStorage(),
    });

    focus.startFocusSession({
      breakIntervalMinutes: 5,
      focusIntervalMinutes: 25,
      userId: "owner",
    });

    vi.setSystemTime(new Date("2026-04-30T10:30:30.000Z"));

    expect(focus.getActiveSession({ userId: "owner" })).toMatchObject({
      completedBreakIntervalCount: 1,
      completedFocusIntervalCount: 1,
      currentInterval: "Break",
      intervalState: "AwaitingNextFocus",
      isStale: false,
      remainingSeconds: null,
      stateEndsAt: null,
    });

    vi.setSystemTime(new Date("2026-04-30T10:40:30.000Z"));

    expect(focus.getActiveSession({ userId: "owner" })).toMatchObject({
      completedBreakIntervalCount: 1,
      completedFocusIntervalCount: 1,
      intervalState: "AwaitingNextFocus",
      isStale: true,
    });
  });

  it("waits instead of starting a break when the planned focus count is reached", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

    const focus = createAppFocusContext({
      keyPrefix: "focus-test-planned-count",
      storage: createMemoryStorage(),
    });

    focus.startFocusSession({
      focusIntervalMinutes: 25,
      plannedFocusIntervalCount: 1,
      userId: "owner",
    });

    vi.setSystemTime(new Date("2026-04-30T10:25:31.000Z"));

    expect(focus.getActiveSession({ userId: "owner" })).toMatchObject({
      completedBreakIntervalCount: 0,
      completedFocusIntervalCount: 1,
      currentInterval: "Focus",
      intervalState: "AwaitingNextFocus",
      isStale: true,
      remainingSeconds: null,
      stateEndsAt: null,
    });
  });

  it("rehydrates with wall-clock-derived resume state", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

    const storage = createMemoryStorage();
    const focus = createAppFocusContext({
      keyPrefix: "focus-test-wall-clock-resume",
      storage,
    });

    focus.startFocusSession({
      breakIntervalMinutes: 5,
      focusIntervalMinutes: 25,
      userId: "owner",
    });

    vi.setSystemTime(new Date("2026-04-30T10:27:00.000Z"));

    const reloadedFocus = createAppFocusContext({
      keyPrefix: "focus-test-wall-clock-resume",
      storage,
    });

    expect(reloadedFocus.getActiveSession({ userId: "owner" })).toMatchObject({
      completedBreakIntervalCount: 0,
      completedFocusIntervalCount: 1,
      currentInterval: "Break",
      intervalState: "Break",
      isStale: false,
      remainingSeconds: 210,
    });
  });
});
