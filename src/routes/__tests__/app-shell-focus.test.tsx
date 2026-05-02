// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  screen,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  type AppSessionSnapshot,
  completeRecallSessionAt,
  createAppFocusContext,
  createAppLabelsContext,
  createAppNotesContext,
  createAppRecallContext,
  createAppSessionContext,
  createCompletedRecallSession,
  createDeterministicRecallTestContexts,
  createLearningLoopTestContexts,
  createRecallNote,
  expectReturnedToRecall,
  getSelectedSessionResultRegion,
  listNotesForUser,
  openAccountMenu,
  renderRecallSelection,
  renderRoute,
  selectRecallableNote,
  startSelectedRecallSession,
} from "./app-shell-test-support";

describe("authenticated app shell", () => {
  it("renders completed focus records newest first with metrics, targets, aggregate, and read-only history", async () => {
    vi.useFakeTimers();

    const userId = "user-focus-history";
    const { focusContext, labelsContext, notesContext, recallContext } =
      createLearningLoopTestContexts({
        shuffleNotes: (sessionNotes) => [...sessionNotes],
      });
    const biologyLabel = labelsContext.createLabel({
      name: "Biology",
      userId,
    });
    const recallLabel = labelsContext.createLabel({
      name: "Recall label",
      userId,
    });
    const labeledNote = createRecallNote(notesContext, userId, {
      body: "Cells and systems.",
      labelIds: [biologyLabel.id],
      title: "Biology notes",
    });
    const unlabeledNote = createRecallNote(notesContext, userId, {
      body: "Draft ideas without labels.",
      title: "Loose draft",
    });
    const recallNote = createRecallNote(notesContext, userId, {
      body: "Recall practice body.",
      labelIds: [recallLabel.id],
      title: "Recall target note",
    });

    vi.setSystemTime(new Date("2026-04-30T08:00:00.000Z"));
    focusContext.startFocusSession({ focusIntervalMinutes: 25, userId });
    focusContext.captureNoteStudyActivity({
      labels: labelsContext.getLabelsForUser(userId),
      note: labeledNote,
      userId,
    });
    vi.setSystemTime(new Date("2026-04-30T08:25:12.000Z"));
    focusContext.endFocusSession({ userId });

    vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));
    focusContext.startFocusSession({
      breakIntervalMinutes: 5,
      focusIntervalMinutes: 25,
      userId,
    });
    focusContext.captureNoteStudyActivity({
      labels: labelsContext.getLabelsForUser(userId),
      note: unlabeledNote,
      userId,
    });
    vi.setSystemTime(new Date("2026-04-30T10:30:30.000Z"));
    focusContext.startNextFocusInterval({ userId });
    createCompletedRecallSession(recallContext, {
      noteId: recallNote.id,
      rating: "nailed",
      timestamp: "2026-04-30T10:31:00.000Z",
      userId,
    });
    vi.setSystemTime(new Date("2026-04-30T10:55:42.000Z"));
    focusContext.endFocusSession({ userId });
    vi.useRealTimers();

    renderRoute("/focus", {
      focusContext,
      labelsContext,
      notesContext,
      recallContext,
      session: {
        user: {
          displayName: "Casey Focus History",
          email: "casey.focus.history@example.com",
          id: userId,
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 3, name: "Study sessions" }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Study sessions stay read-only in v1\./),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /edit focus record/i }),
    ).toBeNull();

    const metricHeadings = screen.getAllByRole("heading", { level: 4 });
    expect(metricHeadings.map((heading) => heading.textContent)).toEqual([
      "50 minutes focused",
      "25 minutes focused",
    ]);

    expect(screen.getByText("1 break, 5 minutes")).toBeInTheDocument();
    expect(screen.getByText("0 breaks, 0 minutes")).toBeInTheDocument();
    const recentCompletedFocus = screen.getByLabelText("Recent study time");
    expect(
      within(recentCompletedFocus).getByText("75 minutes"),
    ).toBeInTheDocument();
    expect(
      within(recentCompletedFocus).getByText("5 minutes"),
    ).toBeInTheDocument();
    expect(within(recentCompletedFocus).getByText("2")).toBeInTheDocument();

    expect(
      screen.getByText("Note: Loose draft | Unlabeled note work"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Note: Biology notes | Labels: Biology"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Recall session: Recall | Notes: Recall target note | Labels: Recall label",
      ),
    ).toBeInTheDocument();
  });

  it("starts a configured FocusSession from the focus route without leaving the current screen", async () => {
    const focusContext = createAppFocusContext({
      keyPrefix: `test-focus-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-focus";
    const { router } = renderRoute("/focus", {
      focusContext,
      session: {
        user: {
          displayName: "Casey Focus",
          email: "casey@example.com",
          id: userId,
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 3, name: "Study sessions" }),
    ).toBeInTheDocument();

    const focusControls = screen.getByRole("form", {
      name: "Focus session start",
    });
    fireEvent.change(within(focusControls).getByLabelText("Focus minutes"), {
      target: { value: "30" },
    });
    fireEvent.change(within(focusControls).getByLabelText("Break minutes"), {
      target: { value: "10" },
    });
    fireEvent.change(
      within(focusControls).getByLabelText("Planned focus intervals"),
      {
        target: { value: "4" },
      },
    );
    fireEvent.submit(focusControls);

    expect(router.state.location.pathname).toBe("/focus");
    expect(
      screen.getByRole("button", { name: "End focus" }),
    ).toBeInTheDocument();
    expect(focusContext.getActiveSession({ userId })).toMatchObject({
      breakIntervalMinutes: 10,
      currentInterval: "Focus",
      focusIntervalMinutes: 30,
      method: "Pomodoro",
      plannedFocusIntervalCount: 4,
    });
  });

  it("starts a default FocusSession from settings without leaving the current screen", async () => {
    const focusContext = createAppFocusContext({
      keyPrefix: `test-focus-default-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-focus-default";
    const { router } = renderRoute("/settings", {
      focusContext,
      session: {
        user: {
          displayName: "Casey Default",
          email: "casey.default@example.com",
          id: userId,
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start Focus" }));

    expect(router.state.location.pathname).toBe("/settings");
    expect(
      screen.getByRole("button", { name: "End focus" }),
    ).toBeInTheDocument();
    expect(focusContext.getActiveSession({ userId })).toMatchObject({
      breakIntervalMinutes: 5,
      currentInterval: "Focus",
      focusIntervalMinutes: 25,
      method: "Pomodoro",
      plannedFocusIntervalCount: null,
    });
  });

  it("keeps the global FocusSession control available across notes, labels, recall, and settings", async () => {
    const focusContext = createAppFocusContext({
      keyPrefix: `test-focus-global-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-focus-global";
    const { router } = renderRoute("/recall", {
      focusContext,
      session: {
        user: {
          displayName: "Casey Global",
          email: "casey.global@example.com",
          id: userId,
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 3, name: "Results" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start Focus" }));

    expect(
      screen.getByRole("button", { name: "End focus" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Labels" }));
    expect(
      await screen.findByRole("heading", { level: 2, name: "Labels" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/labels");
    expect(
      screen.getByRole("button", { name: "End focus" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Notes" }));
    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/notes");
    expect(
      screen.getByRole("button", { name: "End focus" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }));
    expect(
      await screen.findByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/settings");
    expect(
      screen.getByRole("button", { name: "End focus" }),
    ).toBeInTheDocument();
  });

  it("restores an active FocusSession after a reload for the same user", async () => {
    const keyPrefix = `test-focus-reload-${Math.random().toString(36).slice(2)}`;
    const userId = "user-focus-reload";
    const firstFocusContext = createAppFocusContext({
      keyPrefix,
      storage: window.localStorage,
    });
    const session = {
      user: {
        displayName: "Casey Reload",
        email: "casey.reload@example.com",
        id: userId,
        interfaceLanguage: "en",
        studyLanguage: "en",
      },
    } satisfies AppSessionSnapshot;

    const firstRender = renderRoute("/focus", {
      focusContext: firstFocusContext,
      session,
    });

    expect(
      await screen.findByRole("heading", { level: 3, name: "Study sessions" }),
    ).toBeInTheDocument();

    const focusControls = screen.getByRole("form", {
      name: "Focus session start",
    });
    fireEvent.change(within(focusControls).getByLabelText("Focus minutes"), {
      target: { value: "35" },
    });
    fireEvent.change(within(focusControls).getByLabelText("Break minutes"), {
      target: { value: "7" },
    });
    fireEvent.change(
      within(focusControls).getByLabelText("Planned focus intervals"),
      {
        target: { value: "5" },
      },
    );
    fireEvent.submit(focusControls);

    expect(
      screen.getByRole("button", { name: "End focus" }),
    ).toBeInTheDocument();

    firstRender.unmount();

    const reloadedFocusContext = createAppFocusContext({
      keyPrefix,
      storage: window.localStorage,
    });

    renderRoute("/notes", {
      focusContext: reloadedFocusContext,
      session,
    });

    expect(
      await screen.findByRole("button", { name: "End focus" }),
    ).toBeInTheDocument();
    expect(reloadedFocusContext.getActiveSession({ userId })).toMatchObject({
      breakIntervalMinutes: 7,
      currentInterval: "Focus",
      focusIntervalMinutes: 35,
      method: "Pomodoro",
      plannedFocusIntervalCount: 5,
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
          interfaceLanguage: "en",
          studyLanguage: "en",
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
          level: 3,
          name: "Study sessions",
        }),
      ).toBeInTheDocument();

      const focusControls = screen.getByRole("form", {
        name: "Focus session start",
      });
      fireEvent.change(within(focusControls).getByLabelText("Focus minutes"), {
        target: { value: "25" },
      });
      fireEvent.change(within(focusControls).getByLabelText("Break minutes"), {
        target: { value: "5" },
      });
      fireEvent.submit(focusControls);

      expect(screen.getByText("25:00 left")).toBeInTheDocument();
      expect(
        screen.getByRole("status", { name: "Focus timer status" }),
      ).toHaveTextContent("Focus: 25:00 left");
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
      expect(
        screen.getByRole("status", { name: "Focus timer status" }),
      ).toHaveTextContent(/Transition window: \d{2}:\d{2} left/);

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

      const focusReviewHeading = await screen.findByRole("heading", {
        level: 3,
        name: "Study sessions",
      });
      expect(focusReviewHeading).toHaveFocus();
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
        interfaceLanguage: "en",
        studyLanguage: "en",
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
      await screen.findByRole("heading", { name: "Notes workspace" }),
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
    expect(screen.getByText(/Transition window:/)).toHaveClass("sr-only");

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
    expect(screen.getByText(/Break:/)).toBeInTheDocument();

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
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    const overlay = screen.getByRole("region", {
      name: "Break interval reminder",
    });
    const bodyField = screen.getByLabelText("Body");
    const addMetaphorButton = screen.getByRole("button", {
      name: "Add metaphor",
    });

    expect(bodyField).toBeDisabled();
    expect(addMetaphorButton).toBeDisabled();
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
    expect(addMetaphorButton).not.toBeDisabled();

    fireEvent.change(bodyField, {
      target: { value: "Updated after break" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(listNotesForUser(notesContext.getSnapshot(), userId)).toMatchObject([
      {
        body: "Updated after break",
        id: note.id,
      },
    ]);
  });

  it("shows completed-break waiting state and stale-session prompt without ending the session", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const keyPrefix = `test-focus-stale-${Math.random().toString(36).slice(2)}`;
    const userId = "user-focus-stale";
    const session = {
      user: {
        displayName: "Casey Stale",
        email: "casey.stale@example.com",
        id: userId,
        interfaceLanguage: "en",
        studyLanguage: "en",
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
      await screen.findByRole("heading", { name: "Notes workspace" }),
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
      await screen.findByRole("heading", { name: "Notes workspace" }),
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

    expect(
      await screen.findByRole("status", { name: "Focus timer status" }),
    ).toHaveTextContent("Focus session stale");

    staleFocusContext.startNextFocusInterval({ userId });

    expect(staleFocusContext.getActiveSession({ userId })).toMatchObject({
      completedBreakIntervalCount: 1,
      completedFocusIntervalCount: 1,
      currentInterval: "Focus",
      intervalState: "Focus",
      isStale: false,
    });
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
        interfaceLanguage: "en",
        studyLanguage: "en",
      },
    } satisfies AppSessionSnapshot;

    vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

    renderRoute("/notes", {
      focusContext,
      session,
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
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
        interfaceLanguage: "en",
        studyLanguage: "en",
      },
    } satisfies AppSessionSnapshot;

    vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

    renderRoute("/notes", {
      focusContext,
      session,
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
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
        interfaceLanguage: "en",
        studyLanguage: "en",
      },
    } satisfies AppSessionSnapshot;

    vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

    renderRoute("/notes", {
      focusContext,
      notesContext,
      session,
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
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
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Recall session" }),
    ).toBeInTheDocument();

    const overlay = screen.getByRole("region", {
      name: "Break interval reminder",
    });
    const revealButton = screen.getByRole("button", { name: "Reveal answer" });

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
    fireEvent.click(screen.getByRole("button", { name: "Nailed it" }));

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
