import { describe, expect, it, vi } from "vitest";
import type { FocusRecord, FocusSession } from "./focus";
import type { AppPersistentFocusService } from "./persistent-focus";
import { createPersistentFocusContext } from "./persistent-focus";

function createSession(
  override: Partial<FocusSession> & Pick<FocusSession, "id">,
): FocusSession {
  const { id, ...rest } = override;

  return {
    breakIntervalMinutes: 5,
    completedBreakIntervalCount: 0,
    completedFocusIntervalCount: 0,
    createdAt: "2026-05-02T12:00:00.000Z",
    currentInterval: "Focus",
    focusIntervalMinutes: 25,
    focusTargets: [],
    id,
    intervalState: "Focus",
    isStale: false,
    method: "Pomodoro",
    plannedFocusIntervalCount: null,
    remainingSeconds: 1500,
    stateEndsAt: "2026-05-02T12:25:00.000Z",
    stateStartedAt: "2026-05-02T12:00:00.000Z",
    targets: [],
    ...rest,
  };
}

function createRecord(
  override: Partial<FocusRecord> & Pick<FocusRecord, "id">,
): FocusRecord {
  const { id, ...rest } = override;

  return {
    breakIntervalMinutes: 5,
    completedBreakIntervalCount: 0,
    completedFocusIntervalCount: 1,
    createdAt: "2026-05-02T12:25:12.000Z",
    endedAt: "2026-05-02T12:25:12.000Z",
    focusIntervalMinutes: 25,
    focusTargets: [],
    id,
    intervals: [
      {
        endedAt: "2026-05-02T12:25:00.000Z",
        kind: "Focus",
        startedAt: "2026-05-02T12:00:00.000Z",
      },
    ],
    method: "Pomodoro",
    plannedFocusIntervalCount: null,
    startedAt: "2026-05-02T12:00:00.000Z",
    targets: [],
    ...rest,
  };
}

describe("createPersistentFocusContext", () => {
  it("refreshes and mutates the in-memory focus snapshot from the async focus service", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-02T12:10:00.000Z"));

    let activeSession: FocusSession | null = createSession({
      id: "focus-session-1",
      targets: [
        {
          kind: "Note",
          labels: [],
          note: {
            acronyms: [],
            body: "Stored body",
            createdAt: "2026-05-02T11:30:00.000Z",
            id: "note-1",
            labelIds: [],
            metaphors: [],
            title: "Stored title",
            updatedAt: "2026-05-02T11:30:00.000Z",
          },
        },
      ],
    });
    let focusRecords: FocusRecord[] = [
      createRecord({
        id: "focus-record-1",
      }),
    ];

    const service: AppPersistentFocusService = {
      captureNoteStudyActivity: vi.fn(async ({ note }) => {
        if (activeSession === null) {
          return;
        }

        activeSession = {
          ...activeSession,
          focusTargets: [
            {
              kind: "Note",
              labels: [],
              note,
            },
          ],
          targets: [
            {
              kind: "Note",
              labels: [],
              note,
            },
          ],
        };
      }),
      captureRecallSessionStudyActivity: vi.fn(async ({ recallSession }) => {
        if (activeSession === null) {
          return;
        }

        activeSession = {
          ...activeSession,
          focusTargets: [
            {
              kind: "RecallSession",
              labels: [],
              notes: recallSession.notes,
              recallSession: {
                createdAt: recallSession.createdAt,
                id: recallSession.id,
                mode: recallSession.mode,
              },
            },
          ],
          targets: [
            {
              kind: "RecallSession",
              labels: [],
              notes: recallSession.notes,
              recallSession: {
                createdAt: recallSession.createdAt,
                id: recallSession.id,
                mode: recallSession.mode,
              },
            },
          ],
        };
      }),
      endFocusSession: vi.fn(async () => {
        const endedSession = activeSession;

        if (endedSession === null) {
          return null;
        }

        const nextRecord = createRecord({
          id: "focus-session-1",
          focusTargets: endedSession.focusTargets,
          startedAt: endedSession.createdAt,
          targets: endedSession.targets,
        });
        activeSession = null;
        focusRecords = [nextRecord, ...focusRecords];

        return nextRecord;
      }),
      getActiveSession: vi.fn(async () => activeSession),
      listFocusRecords: vi.fn(async () => focusRecords),
      startFocusSession: vi.fn(
        async ({
          breakIntervalMinutes,
          focusIntervalMinutes,
          plannedFocusIntervalCount,
        }) => {
          activeSession = createSession({
            breakIntervalMinutes: breakIntervalMinutes ?? 5,
            focusIntervalMinutes: focusIntervalMinutes ?? 25,
            id: "focus-session-2",
            plannedFocusIntervalCount: plannedFocusIntervalCount ?? null,
          });

          return activeSession;
        },
      ),
      startNextFocusInterval: vi.fn(async () => {
        if (activeSession === null) {
          throw new Error("Missing session");
        }

        activeSession = {
          ...activeSession,
          completedFocusIntervalCount: 1,
          currentInterval: "Focus",
          intervalState: "Focus",
          remainingSeconds: 1500,
          stateEndsAt: "2026-05-02T13:00:00.000Z",
          stateStartedAt: "2026-05-02T12:35:00.000Z",
        };

        return activeSession;
      }),
    };

    const persistentFocus = createPersistentFocusContext({
      service,
    });

    await expect(persistentFocus.refresh("user-casey")).resolves.toMatchObject({
      activeSession: [
        {
          id: "focus-session-1",
        },
      ],
      focusRecords: [
        {
          id: "focus-record-1",
        },
      ],
    });
    expect(
      persistentFocus.readonlyContext.getActiveSession({
        userId: "user-casey",
      }),
    ).toMatchObject({
      id: "focus-session-1",
    });

    await persistentFocus.captureNoteStudyActivity("user-casey", {
      labels: [],
      note: {
        acronyms: [],
        body: "Freshly captured body",
        createdAt: "2026-05-02T11:40:00.000Z",
        id: "note-2",
        labelIds: [],
        metaphors: [],
        title: "Freshly captured title",
        updatedAt: "2026-05-02T11:45:00.000Z",
      },
    });
    expect(
      persistentFocus.readonlyContext.getActiveSession({
        userId: "user-casey",
      }),
    ).toMatchObject({
      targets: [
        {
          kind: "Note",
          note: {
            id: "note-2",
            title: "Freshly captured title",
          },
        },
      ],
    });

    await persistentFocus.startNextFocusInterval("user-casey");
    expect(
      persistentFocus.readonlyContext.getActiveSession({
        userId: "user-casey",
      }),
    ).toMatchObject({
      completedFocusIntervalCount: 1,
      intervalState: "Focus",
    });

    await expect(
      persistentFocus.endFocusSession("user-casey"),
    ).resolves.toMatchObject({
      id: "focus-session-1",
      targets: [
        {
          kind: "Note",
          note: {
            id: "note-2",
          },
        },
      ],
    });
    expect(
      persistentFocus.readonlyContext.getActiveSession({
        userId: "user-casey",
      }),
    ).toBeNull();
    expect(
      persistentFocus.readonlyContext.getFocusRecords({
        userId: "user-casey",
      }),
    ).toMatchObject([
      {
        id: "focus-session-1",
      },
      {
        id: "focus-record-1",
      },
    ]);

    await expect(
      persistentFocus.startFocusSession("user-casey", {
        breakIntervalMinutes: 10,
        focusIntervalMinutes: 40,
        plannedFocusIntervalCount: 4,
      }),
    ).resolves.toMatchObject({
      breakIntervalMinutes: 10,
      focusIntervalMinutes: 40,
      id: "focus-session-2",
      plannedFocusIntervalCount: 4,
    });

    vi.useRealTimers();
  });
});
