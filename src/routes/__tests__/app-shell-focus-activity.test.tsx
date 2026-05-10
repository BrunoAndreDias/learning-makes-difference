// @vitest-environment jsdom

import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppSessionSnapshot } from "../../modules/access/session/session";
import {
  type AppPersistentFocusService,
  createPersistentFocusContext,
  type FocusSession,
} from "../../modules/focus";
import {
  createAppFocusContext,
  createAppNotesContext,
  createAppRecallContext,
  createRecallNote,
  createRouteHydratedSessionContext,
  listNotesForUser,
  renderRoute,
} from "./app-shell-test-support";

describe("authenticated app shell", () => {
  it("restores an active FocusSession from the persistent focus service on route entry", async () => {
    const now = new Date();
    const stateStartedAt = new Date(
      now.getTime() - 10 * 60 * 1000,
    ).toISOString();
    const stateEndsAt = new Date(now.getTime() + 25 * 60 * 1000).toISOString();

    const activeSession: FocusSession = {
      breakIntervalMinutes: 7,
      completedBreakIntervalCount: 0,
      completedFocusIntervalCount: 0,
      createdAt: stateStartedAt,
      currentInterval: "Focus",
      focusIntervalMinutes: 35,
      focusTargets: [],
      id: "persistent-focus-session-1",
      intervalState: "Focus",
      isStale: false,
      method: "Pomodoro" as const,
      plannedFocusIntervalCount: 5,
      remainingSeconds: 2100,
      stateEndsAt,
      stateStartedAt,
      targets: [],
    };
    const focusRecords: [] = [];
    const service: AppPersistentFocusService = {
      captureNoteStudyActivity: vi.fn(async () => undefined),
      captureRecallSessionStudyActivity: vi.fn(async () => undefined),
      captureStudyNoteStudyActivity: vi.fn(async () => undefined),
      endFocusSession: vi.fn(async () => null),
      getActiveSession: vi.fn(async () => activeSession),
      listFocusRecords: vi.fn(async () => focusRecords),
      startFocusSession: vi.fn(async () => activeSession),
      startNextFocusInterval: vi.fn(async () => activeSession),
    };
    const session = {
      user: {
        displayName: "Casey Persistent Focus",
        email: "casey.persistent.focus@example.com",
        id: "user-persistent-focus",
        userLanguage: "en",
      },
    } satisfies AppSessionSnapshot;
    const firstPersistentFocus = createPersistentFocusContext({
      service,
    });

    const firstRender = renderRoute("/focus", {
      persistentFocusContext: firstPersistentFocus,
      session,
    });

    expect(
      await screen.findByRole("button", { name: "End focus" }),
    ).toBeInTheDocument();
    expect(
      firstPersistentFocus.readonlyContext.getActiveSession({
        userId: "user-persistent-focus",
      }),
    ).toMatchObject({
      id: "persistent-focus-session-1",
      plannedFocusIntervalCount: 5,
    });

    firstRender.unmount();
    window.localStorage.clear();

    const reloadedPersistentFocus = createPersistentFocusContext({
      service,
    });

    renderRoute("/notes", {
      persistentFocusContext: reloadedPersistentFocus,
      session,
    });

    expect(
      await screen.findByRole("button", { name: "End focus" }),
    ).toBeInTheDocument();
    expect(
      reloadedPersistentFocus.readonlyContext.getActiveSession({
        userId: "user-persistent-focus",
      }),
    ).toMatchObject({
      breakIntervalMinutes: 7,
      focusIntervalMinutes: 35,
      id: "persistent-focus-session-1",
    });
  });

  it("uses the routed authenticated session to hydrate the Focus workspace immediately", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-05-07T09:10:00.000Z"));

    const userId = "user-route-hydrated-focus";
    const refreshSpy = vi.fn<AppPersistentFocusService["getActiveSession"]>(
      async () => ({
        breakIntervalMinutes: 5,
        completedBreakIntervalCount: 0,
        completedFocusIntervalCount: 0,
        createdAt: "2026-05-07T09:00:00.000Z",
        currentInterval: "Focus",
        focusIntervalMinutes: 25,
        focusTargets: [],
        id: "route-hydrated-focus-session",
        intervalState: "Focus",
        isStale: false,
        method: "Pomodoro",
        plannedFocusIntervalCount: 4,
        remainingSeconds: 1500,
        stateEndsAt: "2026-05-07T09:25:00.000Z",
        stateStartedAt: "2026-05-07T09:00:00.000Z",
        targets: [],
      }),
    );
    const service: AppPersistentFocusService = {
      captureNoteStudyActivity: vi.fn(async () => undefined),
      captureRecallSessionStudyActivity: vi.fn(async () => undefined),
      captureStudyNoteStudyActivity: vi.fn(async () => undefined),
      endFocusSession: vi.fn(async () => null),
      getActiveSession: refreshSpy,
      listFocusRecords: vi.fn(async () => []),
      startFocusSession: vi.fn(async () => {
        throw new Error("Not used in this test.");
      }),
      startNextFocusInterval: vi.fn(async () => {
        throw new Error("Not used in this test.");
      }),
    };
    const persistentFocusContext = createPersistentFocusContext({
      service,
    });
    const routedSessionSnapshot: AppSessionSnapshot = {
      user: {
        displayName: "Casey Routed Focus",
        email: "casey.routed.focus@example.com",
        id: userId,
        userLanguage: "en",
      },
    };

    renderRoute("/focus", {
      persistentFocusContext,
      sessionContext: createRouteHydratedSessionContext(routedSessionSnapshot),
    });

    const activePanel = await screen.findByRole("region", {
      name: "Active focus session",
    });
    expect(
      within(activePanel).getByRole("button", { name: "End focus session" }),
    ).toBeInTheDocument();
    expect(within(activePanel).getByText("In progress")).toBeInTheDocument();
    expect(service.getActiveSession).toHaveBeenCalledTimes(1);
    expect(
      persistentFocusContext.readonlyContext.getActiveSession({ userId }),
    ).toMatchObject({
      id: "route-hydrated-focus-session",
      plannedFocusIntervalCount: 4,
    });
  });

  it("polishes FocusSession controls for keyboard, status, focus handoff, and quiet interval changes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const notificationSpy = vi.fn();
    const audioSpy = vi.fn();
    const originalNotification = window.Notification;
    const originalAudio = window.Audio;

    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: notificationSpy,
    });
    Object.defineProperty(window, "Audio", {
      configurable: true,
      value: audioSpy,
    });
    try {
      const keyPrefix = `test-focus-a11y-${Math.random().toString(36).slice(2)}`;
      const userId = "user-focus-a11y";
      const session = {
        user: {
          displayName: "Casey Focus A11y",
          email: "casey.focus.a11y@example.com",
          id: userId,
          userLanguage: "en",
        },
      } satisfies AppSessionSnapshot;

      vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

      const initialFocusContext = createAppFocusContext({
        keyPrefix,
        storage: window.localStorage,
      });
      const initialRender = renderRoute("/focus", {
        focusContext: initialFocusContext,
        session,
      });

      expect(
        await screen.findByRole("heading", {
          level: 2,
          name: "Focus",
        }),
      ).toBeInTheDocument();

      const focusControls = screen.getByRole("form", {
        name: "Session setup",
      });
      fireEvent.change(within(focusControls).getByLabelText("Focus minutes"), {
        target: { value: "25" },
      });
      fireEvent.change(within(focusControls).getByLabelText("Break minutes"), {
        target: { value: "5" },
      });
      fireEvent.submit(focusControls);

      expect(screen.getAllByText("25:00")).not.toHaveLength(0);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getAllByText("24:59")).not.toHaveLength(0);
      expect(screen.getByRole("button", { name: "End focus" })).toHaveFocus();

      initialRender.unmount();

      vi.setSystemTime(new Date("2026-04-30T10:25:12.000Z"));

      const transitionFocusContext = createAppFocusContext({
        keyPrefix,
        storage: window.localStorage,
      });
      const transitionRender = renderRoute("/notes", {
        focusContext: transitionFocusContext,
        session,
      });

      const endFocusButton = await screen.findByRole("button", {
        name: "End focus",
      });
      expect(endFocusButton).toHaveFocus();
      expect(endFocusButton).toHaveTextContent(/\d{2}:\d{2}/);

      transitionFocusContext.startNextFocusInterval({ userId });
      transitionRender.unmount();

      vi.setSystemTime(new Date("2026-04-30T10:50:50.000Z"));

      const breakFocusContext = createAppFocusContext({
        keyPrefix,
        storage: window.localStorage,
      });
      const breakRender = renderRoute("/notes", {
        focusContext: breakFocusContext,
        session,
      });

      const breakOverlay = await screen.findByRole("region", {
        name: "Break interval reminder",
      });
      const skipBreakButton = within(breakOverlay).getByRole("button", {
        name: "Skip break",
      });
      expect(skipBreakButton).toHaveFocus();
      expect(breakOverlay).toHaveAttribute("aria-live", "assertive");

      fireEvent.click(skipBreakButton);
      breakRender.unmount();

      renderRoute("/focus", {
        focusContext: breakFocusContext,
        session,
      });

      const focusHeading = await screen.findByRole("heading", {
        level: 3,
        name: "Focus",
      });
      expect(focusHeading).toHaveFocus();
      expect(
        screen.getByText(
          "Run a Pomodoro session to stay focused and make steady progress.",
        ),
      ).toBeInTheDocument();
      expect(notificationSpy).not.toHaveBeenCalled();
      expect(audioSpy).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: originalNotification,
      });
      Object.defineProperty(window, "Audio", {
        configurable: true,
        value: originalAudio,
      });
    }
  });

  it("lets the user continue from transition and skip an active break", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const keyPrefix = `test-focus-actions-${Math.random().toString(36).slice(2)}`;
    const userId = "user-focus-actions";
    const session = {
      user: {
        displayName: "Casey Actions",
        email: "casey.actions@example.com",
        id: userId,
        userLanguage: "en",
      },
    } satisfies AppSessionSnapshot;

    vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

    const initialFocusContext = createAppFocusContext({
      keyPrefix,
      storage: window.localStorage,
    });
    const initialRender = renderRoute("/notes", {
      focusContext: initialFocusContext,
      session,
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start Focus" }));

    initialRender.unmount();

    vi.setSystemTime(new Date("2026-04-30T10:25:12.000Z"));

    const transitionFocusContext = createAppFocusContext({
      keyPrefix,
      storage: window.localStorage,
    });
    const transitionRender = renderRoute("/notes", {
      focusContext: transitionFocusContext,
      session,
    });

    expect(
      await screen.findByRole("button", { name: "End focus" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End focus" })).toHaveTextContent(
      /\d{2}:\d{2}/,
    );

    transitionFocusContext.startNextFocusInterval({ userId });

    expect(transitionFocusContext.getActiveSession({ userId })).toMatchObject({
      completedBreakIntervalCount: 0,
      completedFocusIntervalCount: 1,
      currentInterval: "Focus",
      intervalState: "Focus",
    });

    transitionRender.unmount();

    vi.setSystemTime(new Date("2026-04-30T10:50:50.000Z"));

    const breakFocusContext = createAppFocusContext({
      keyPrefix,
      storage: window.localStorage,
    });
    renderRoute("/notes", {
      focusContext: breakFocusContext,
      session,
    });

    const breakOverlay = await screen.findByRole("region", {
      name: "Break interval reminder",
    });
    expect(screen.getByRole("button", { name: "End focus" })).toHaveTextContent(
      /\d{2}:\d{2}/,
    );

    fireEvent.click(
      within(breakOverlay).getByRole("button", { name: "Skip break" }),
    );

    expect(breakFocusContext.getActiveSession({ userId })).toMatchObject({
      completedBreakIntervalCount: 0,
      completedFocusIntervalCount: 2,
      currentInterval: "Focus",
      intervalState: "Focus",
    });
  });

  it("blocks note editing during a BreakInterval until the user skips the break", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

    const keyPrefix = `test-focus-break-notes-${Math.random().toString(36).slice(2)}`;
    const userId = "user-focus-break-notes";
    const focusContext = createAppFocusContext({
      keyPrefix,
      storage: window.localStorage,
    });
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-break-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const note = notesContext.createNote(userId, {
      acronyms: [],
      body: "Original body",
      labelIds: [],
      metaphors: [],
      title: "Break editing note",
    });

    focusContext.startFocusSession({
      breakIntervalMinutes: 5,
      focusIntervalMinutes: 25,
      userId,
    });

    vi.setSystemTime(new Date("2026-04-30T10:25:31.000Z"));

    renderRoute("/notes", {
      focusContext,
      notesContext,
      session: {
        user: {
          displayName: "Casey Break",
          email: "casey.break@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();

    const overlay = screen.getByRole("region", {
      name: "Break interval reminder",
    });
    const bodyField = screen.getByLabelText("Body");
    const metaphorField = screen.getByLabelText("Your metaphor");

    expect(bodyField).toBeDisabled();
    expect(metaphorField).toBeDisabled();
    expect(within(overlay).getByText("Break in progress")).toBeInTheDocument();

    fireEvent.click(
      within(overlay).getByRole("button", { name: "Skip break" }),
    );

    expect(focusContext.getActiveSession({ userId })).toMatchObject({
      completedBreakIntervalCount: 0,
      completedFocusIntervalCount: 1,
      currentInterval: "Focus",
      intervalState: "Focus",
    });
    expect(
      screen.queryByRole("region", { name: "Break interval reminder" }),
    ).toBeNull();
    expect(bodyField).not.toBeDisabled();
    expect(metaphorField).not.toBeDisabled();

    fireEvent.change(bodyField, {
      target: { value: "Updated after break" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(listNotesForUser(notesContext.getSnapshot(), userId)).toMatchObject([
      {
        body: "Updated after break",
        id: note.id,
      },
    ]);
  });

  it("replaces a stale completed-break session with a new FocusSession", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const keyPrefix = `test-focus-stale-${Math.random().toString(36).slice(2)}`;
    const userId = "user-focus-stale";
    const session = {
      user: {
        displayName: "Casey Stale",
        email: "casey.stale@example.com",
        id: userId,
        userLanguage: "en",
      },
    } satisfies AppSessionSnapshot;

    vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

    const initialFocusContext = createAppFocusContext({
      keyPrefix,
      storage: window.localStorage,
    });
    const initialRender = renderRoute("/notes", {
      focusContext: initialFocusContext,
      session,
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start Focus" }));

    initialRender.unmount();

    vi.setSystemTime(new Date("2026-04-30T10:30:30.000Z"));

    const completedBreakFocusContext = createAppFocusContext({
      keyPrefix,
      storage: window.localStorage,
    });
    const completedBreakRender = renderRoute("/notes", {
      focusContext: completedBreakFocusContext,
      session,
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();
    expect(
      completedBreakFocusContext.getActiveSession({ userId }),
    ).toMatchObject({
      completedBreakIntervalCount: 1,
      completedFocusIntervalCount: 1,
      intervalState: "AwaitingNextFocus",
    });

    completedBreakRender.unmount();

    vi.setSystemTime(new Date("2026-04-30T10:40:30.000Z"));

    const staleFocusContext = createAppFocusContext({
      keyPrefix,
      storage: window.localStorage,
    });
    renderRoute("/notes", {
      focusContext: staleFocusContext,
      session,
    });

    const startNewFocusButton = await screen.findByRole("button", {
      name: "Start new focus",
    });
    expect(
      screen.queryByRole("button", { name: "End focus" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.click(startNewFocusButton);

    expect(staleFocusContext.getActiveSession({ userId })).toMatchObject({
      completedBreakIntervalCount: 0,
      completedFocusIntervalCount: 0,
      currentInterval: "Focus",
      intervalState: "Focus",
      isStale: false,
    });
    expect(staleFocusContext.getFocusRecords({ userId })).toHaveLength(1);
  });

  it("ends an active FocusSession explicitly and returns to the start control", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const keyPrefix = `test-focus-end-${Math.random().toString(36).slice(2)}`;
    const userId = "user-focus-end";
    const focusContext = createAppFocusContext({
      keyPrefix,
      storage: window.localStorage,
    });
    const session = {
      user: {
        displayName: "Casey End",
        email: "casey.end@example.com",
        id: userId,
        userLanguage: "en",
      },
    } satisfies AppSessionSnapshot;

    vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

    renderRoute("/notes", {
      focusContext,
      session,
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start Focus" }));

    vi.setSystemTime(new Date("2026-04-30T10:25:12.000Z"));
    fireEvent.click(screen.getByRole("button", { name: "End focus" }));

    expect(
      screen.getByRole("button", { name: "Start Focus" }),
    ).toBeInTheDocument();
    expect(focusContext.getActiveSession({ userId })).toBeNull();
    expect(focusContext.getFocusRecords({ userId })).toHaveLength(1);
  });

  it("captures unlabeled note saves as FocusTargets during an active FocusInterval", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const keyPrefix = `test-focus-note-save-${Math.random().toString(36).slice(2)}`;
    const userId = "user-focus-note-save";
    const focusContext = createAppFocusContext({
      keyPrefix,
      storage: window.localStorage,
    });
    const session = {
      user: {
        displayName: "Casey Note Save",
        email: "casey.note.save@example.com",
        id: userId,
        userLanguage: "en",
      },
    } satisfies AppSessionSnapshot;

    vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

    renderRoute("/notes", {
      focusContext,
      session,
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start Focus" }));

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Focus-captured draft" },
    });
    fireEvent.change(screen.getByLabelText("Body"), {
      target: { value: "Unlabeled note work should still count." },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Note editor" }));

    act(() => {
      vi.advanceTimersByTime(25 * 60 * 1000 + 12 * 1000);
    });

    fireEvent.click(screen.getByRole("button", { name: "End focus" }));

    expect(focusContext.getFocusRecords({ userId })).toMatchObject([
      {
        targets: [
          {
            labels: [],
            note: {
              body: "Unlabeled note work should still count.",
              title: "Focus-captured draft",
            },
          },
        ],
      },
    ]);
  });

  it("captures selected note review after 30 visible seconds during an active FocusInterval", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const keyPrefix = `test-focus-note-review-${Math.random().toString(36).slice(2)}`;
    const userId = "user-focus-note-review";
    const focusContext = createAppFocusContext({
      keyPrefix,
      storage: window.localStorage,
    });
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const reviewedNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "Selected review time should count after the threshold.",
      labelIds: [],
      metaphors: [],
      title: "Review target",
    });
    const session = {
      user: {
        displayName: "Casey Note Review",
        email: "casey.note.review@example.com",
        id: userId,
        userLanguage: "en",
      },
    } satisfies AppSessionSnapshot;

    vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

    renderRoute("/notes", {
      focusContext,
      notesContext,
      session,
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        "Selected review time should count after the threshold.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start Focus" }));

    act(() => {
      vi.advanceTimersByTime(30 * 1000);
      vi.advanceTimersByTime(24 * 60 * 1000 + 42 * 1000);
    });

    fireEvent.click(screen.getByRole("button", { name: "End focus" }));

    expect(focusContext.getFocusRecords({ userId })).toMatchObject([
      {
        targets: [
          {
            note: {
              id: reviewedNote.id,
              title: "Review target",
            },
          },
        ],
      },
    ]);
  });

  it("blocks recall answers during a BreakInterval until the user skips the break", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

    const keyPrefix = `test-focus-break-recall-${Math.random().toString(36).slice(2)}`;
    const userId = "user-focus-break-recall";
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-break-recall-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const focusContext = createAppFocusContext({
      keyPrefix,
      storage: window.localStorage,
    });
    const recallContext = createAppRecallContext({
      keyPrefix: `test-recall-break-${Math.random().toString(36).slice(2)}`,
      notes: notesContext,
      onStudyActivity: focusContext.captureRecallSessionStudyActivity,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage: window.localStorage,
    });
    const note = createRecallNote(notesContext, userId, {
      body: "Break recall body",
      title: "Break recall note",
    });

    recallContext.startFlashCardSession({
      noteIds: [note.id],
      userId,
    });
    focusContext.startFocusSession({
      breakIntervalMinutes: 5,
      focusIntervalMinutes: 25,
      userId,
    });

    vi.setSystemTime(new Date("2026-04-30T10:25:31.000Z"));

    const { router } = renderRoute("/recall/session", {
      focusContext,
      notesContext,
      recallContext,
      session: {
        user: {
          displayName: "Casey Recall Break",
          email: "casey.recall.break@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("navigation", { name: "Breadcrumb" }),
    ).toHaveTextContent(/Recall\s*\/\s*Session/);

    const overlay = screen.getByRole("region", {
      name: "Break interval reminder",
    });
    const revealButton = screen.getByRole("button", {
      name: "Reveal Study Note",
    });

    expect(revealButton).toBeDisabled();
    fireEvent.click(
      within(overlay).getByRole("button", { name: "Skip break" }),
    );

    expect(focusContext.getActiveSession({ userId })).toMatchObject({
      completedBreakIntervalCount: 0,
      completedFocusIntervalCount: 1,
      currentInterval: "Focus",
      intervalState: "Focus",
    });
    expect(revealButton).not.toBeDisabled();

    fireEvent.click(revealButton);
    fireEvent.click(screen.getByRole("button", { name: "Easy" }));
    fireEvent.click(screen.getByRole("button", { name: "Next Study Note" }));

    expect(router.state.location.pathname).toBe("/recall");
    expect(
      focusContext.getActiveSession({ userId })?.focusTargets,
    ).toMatchObject([
      {
        kind: "RecallSession",
        notes: [{ id: note.id, title: "Break recall note" }],
      },
    ]);
  });
});
