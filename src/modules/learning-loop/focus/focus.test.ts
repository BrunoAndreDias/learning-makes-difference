import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppNote } from "../notes-workspace/notes";
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

  it("ends a FocusSession and saves completed intervals as a FocusRecord", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

    const focus = createAppFocusContext({
      keyPrefix: "focus-test-end-record",
      storage: createMemoryStorage(),
    });

    focus.startFocusSession({
      breakIntervalMinutes: 5,
      focusIntervalMinutes: 25,
      userId: "owner",
    });

    vi.setSystemTime(new Date("2026-04-30T10:25:12.000Z"));

    const record = focus.endFocusSession({ userId: "owner" });

    expect(focus.getActiveSession({ userId: "owner" })).toBeNull();
    expect(record).toMatchObject({
      breakIntervalMinutes: 5,
      completedBreakIntervalCount: 0,
      completedFocusIntervalCount: 1,
      endedAt: "2026-04-30T10:25:12.000Z",
      focusIntervalMinutes: 25,
      intervals: [
        {
          endedAt: "2026-04-30T10:25:00.000Z",
          kind: "Focus",
          startedAt: "2026-04-30T10:00:00.000Z",
        },
      ],
      startedAt: "2026-04-30T10:00:00.000Z",
    });
    expect(focus.getFocusRecords({ userId: "owner" })).toEqual([record]);
  });

  it("captures note study activity and saves note plus label snapshots in the FocusRecord", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

    const focus = createAppFocusContext({
      keyPrefix: "focus-test-note-target",
      storage: createMemoryStorage(),
    });

    focus.startFocusSession({
      focusIntervalMinutes: 25,
      userId: "owner",
    });

    focus.captureNoteStudyActivity({
      labels: [
        {
          id: "label-biology",
          name: "Biology",
          parentIds: [],
        },
      ],
      note: {
        acronyms: [],
        body: "Neurons strengthen through repeated firing.",
        createdAt: "2026-04-29T10:00:00.000Z",
        id: "note-1",
        labelIds: ["label-biology"],
        metaphors: [],
        title: "Neural pathways",
        updatedAt: "2026-04-30T10:05:00.000Z",
      },
      userId: "owner",
    });

    vi.setSystemTime(new Date("2026-04-30T10:25:12.000Z"));

    const record = focus.endFocusSession({ userId: "owner" });

    expect(record).toMatchObject({
      targets: [
        {
          kind: "Note",
          labels: [
            {
              id: "label-biology",
              name: "Biology",
              parentIds: [],
            },
          ],
          note: {
            body: "Neurons strengthen through repeated firing.",
            id: "note-1",
            labelIds: ["label-biology"],
            title: "Neural pathways",
          },
        },
      ],
    });
  });

  it("ignores note study activity outside an active FocusInterval", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

    const focus = createAppFocusContext({
      keyPrefix: "focus-test-break-ignore",
      storage: createMemoryStorage(),
    });

    focus.startFocusSession({
      breakIntervalMinutes: 5,
      focusIntervalMinutes: 25,
      userId: "owner",
    });

    vi.setSystemTime(new Date("2026-04-30T10:25:31.000Z"));

    focus.captureNoteStudyActivity({
      labels: [],
      note: {
        acronyms: [],
        body: "Break work should not count.",
        createdAt: "2026-04-30T10:20:00.000Z",
        id: "note-break",
        labelIds: [],
        metaphors: [],
        title: "Break note",
        updatedAt: "2026-04-30T10:25:31.000Z",
      },
      userId: "owner",
    });

    vi.setSystemTime(new Date("2026-04-30T10:30:40.000Z"));

    const record = focus.endFocusSession({ userId: "owner" });

    expect(record).toMatchObject({
      completedFocusIntervalCount: 1,
      targets: [],
    });
  });

  it("reinforces an existing note target and keeps unlabeled work valid", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

    const focus = createAppFocusContext({
      keyPrefix: "focus-test-note-reinforce",
      storage: createMemoryStorage(),
    });

    focus.startFocusSession({
      focusIntervalMinutes: 25,
      userId: "owner",
    });

    const note: AppNote = {
      acronyms: [],
      body: "Initial draft body.",
      createdAt: "2026-04-30T09:58:00.000Z",
      id: "note-reinforced",
      labelIds: [],
      metaphors: [],
      title: "Draft note",
      updatedAt: "2026-04-30T10:02:00.000Z",
    };

    focus.captureNoteStudyActivity({
      labels: [],
      note,
      userId: "owner",
    });

    note.body = "Mutated outside the focus context.";
    note.labelIds = ["label-1"];
    note.title = "Mutated title";

    focus.captureNoteStudyActivity({
      labels: [
        {
          id: "label-1",
          name: "Biology",
          parentIds: [],
        },
      ],
      note: {
        ...note,
        body: "Saved note body.",
        title: "Saved note",
        updatedAt: "2026-04-30T10:10:00.000Z",
      },
      userId: "owner",
    });

    vi.setSystemTime(new Date("2026-04-30T10:25:12.000Z"));

    const record = focus.endFocusSession({ userId: "owner" });

    expect(record).toMatchObject({
      targets: [
        {
          labels: [
            {
              id: "label-1",
              name: "Biology",
            },
          ],
          note: {
            body: "Saved note body.",
            id: "note-reinforced",
            labelIds: ["label-1"],
            title: "Saved note",
          },
        },
      ],
    });
    expect(record?.targets).toHaveLength(1);
  });

  it("discards a FocusSession ended before any FocusInterval completes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

    const focus = createAppFocusContext({
      keyPrefix: "focus-test-end-discard",
      storage: createMemoryStorage(),
    });

    focus.startFocusSession({
      focusIntervalMinutes: 25,
      userId: "owner",
    });

    vi.setSystemTime(new Date("2026-04-30T10:10:00.000Z"));

    expect(focus.endFocusSession({ userId: "owner" })).toBeNull();
    expect(focus.getActiveSession({ userId: "owner" })).toBeNull();
    expect(focus.getFocusRecords({ userId: "owner" })).toEqual([]);
  });

  it("preserves completed breaks and discards an in-progress break when ending", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

    const focus = createAppFocusContext({
      keyPrefix: "focus-test-end-breaks",
      storage: createMemoryStorage(),
    });

    focus.startFocusSession({
      breakIntervalMinutes: 5,
      focusIntervalMinutes: 25,
      userId: "owner",
    });

    vi.setSystemTime(new Date("2026-04-30T10:30:30.000Z"));
    focus.startNextFocusInterval({ userId: "owner" });

    vi.setSystemTime(new Date("2026-04-30T10:56:00.000Z"));

    const record = focus.endFocusSession({ userId: "owner" });

    expect(record).toMatchObject({
      completedBreakIntervalCount: 1,
      completedFocusIntervalCount: 2,
      intervals: [
        {
          endedAt: "2026-04-30T10:25:00.000Z",
          kind: "Focus",
          startedAt: "2026-04-30T10:00:00.000Z",
        },
        {
          endedAt: "2026-04-30T10:30:00.000Z",
          kind: "Break",
          startedAt: "2026-04-30T10:25:00.000Z",
        },
        {
          endedAt: "2026-04-30T10:55:00.000Z",
          kind: "Focus",
          startedAt: "2026-04-30T10:30:00.000Z",
        },
      ],
    });
  });

  it("scopes FocusRecords to the owner and keeps stored records isolated from later mutation", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

    const storage = createMemoryStorage();
    const focus = createAppFocusContext({
      keyPrefix: "focus-test-record-ownership",
      storage,
    });

    focus.startFocusSession({
      focusIntervalMinutes: 25,
      userId: "owner",
    });
    focus.startFocusSession({
      focusIntervalMinutes: 25,
      userId: "other-user",
    });

    vi.setSystemTime(new Date("2026-04-30T10:25:12.000Z"));

    const ownerRecord = focus.endFocusSession({ userId: "owner" });
    focus.endFocusSession({ userId: "other-user" });

    expect(ownerRecord).not.toBeNull();
    expect(focus.getFocusRecords({ userId: "owner" })).toHaveLength(1);
    expect(focus.getFocusRecords({ userId: "other-user" })).toHaveLength(1);
    expect(focus.getFocusRecords({ userId: "owner" })).toEqual([ownerRecord]);

    if (ownerRecord !== null) {
      ownerRecord.completedFocusIntervalCount = 999;
      const [firstInterval] = ownerRecord.intervals;

      expect(firstInterval).toBeDefined();

      if (firstInterval !== undefined) {
        firstInterval.kind = "Break";
      }
    }

    const reloadedFocus = createAppFocusContext({
      keyPrefix: "focus-test-record-ownership",
      storage,
    });

    expect(reloadedFocus.getFocusRecords({ userId: "owner" })).toMatchObject([
      {
        completedFocusIntervalCount: 1,
        intervals: [
          {
            kind: "Focus",
          },
        ],
      },
    ]);
    expect(
      reloadedFocus.getFocusRecords({ userId: "other-user" }),
    ).toHaveLength(1);
  });
});
