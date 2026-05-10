// @vitest-environment jsdom

import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppSessionSnapshot } from "../../modules/access/session/session";
import {
  createAppFocusContext,
  createCompletedRecallSession,
  createLearningLoopTestContexts,
  createRecallNote,
  renderRoute,
} from "./app-shell-test-support";

describe("authenticated app shell", () => {
  it("translates Focus chrome while preserving stored focus record data", async () => {
    vi.useFakeTimers();

    const userId = "user-focus-translated";
    const { focusContext, labelsContext, notesContext, recallContext } =
      createLearningLoopTestContexts();
    const label = labelsContext.createLabel({
      name: "Organic Chemistry",
      userId,
    });
    const note = createRecallNote(notesContext, userId, {
      body: "Carbon chain notes.",
      labelIds: [label.id],
      title: "SN1 reaction mechanism",
    });

    vi.setSystemTime(new Date("2026-05-06T08:00:00.000Z"));
    focusContext.startFocusSession({
      breakIntervalMinutes: 5,
      focusIntervalMinutes: 25,
      userId,
    });
    focusContext.captureNoteStudyActivity({
      labels: labelsContext.getLabelsForUser(userId),
      note,
      userId,
    });
    vi.setSystemTime(new Date("2026-05-06T08:25:00.000Z"));
    focusContext.endFocusSession({ userId });
    vi.useRealTimers();

    renderRoute("/focus", {
      focusContext,
      labelsContext,
      notesContext,
      recallContext,
      session: {
        user: {
          displayName: "Casey Focus Translated",
          email: "casey.focus.translated@example.com",
          id: userId,
          userLanguage: "pt-PT",
        },
      },
    });

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Foco",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Execute uma sessao Pomodoro para manter o foco e progredir de forma consistente.",
      ),
    ).toBeInTheDocument();

    const setupPanel = screen.getByRole("form", {
      name: "Configuracao da sessao",
    });
    expect(within(setupPanel).getByLabelText("Minutos de foco")).toHaveValue(
      25,
    );
    expect(
      within(setupPanel).getByRole("button", {
        name: "Iniciar sessao de foco",
      }),
    ).toBeEnabled();

    const analyticsStrip = screen.getByRole("region", {
      name: "Esta semana em resumo",
    });
    expect(
      within(analyticsStrip).getByText("Minutos de foco"),
    ).toBeInTheDocument();

    expect(focusContext.getFocusRecords({ userId })[0]).toMatchObject({
      targets: [
        expect.objectContaining({
          labels: [expect.objectContaining({ name: "Organic Chemistry" })],
          note: expect.objectContaining({
            title: "SN1 reaction mechanism",
          }),
        }),
      ],
    });
  });

  it("renders an active FocusSession workspace with supported actions and disabled setup controls", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-05-01T10:00:00.000Z"));

    const keyPrefix = `test-focus-workspace-active-${Math.random().toString(36).slice(2)}`;
    const userId = "user-focus-workspace-active";
    const focusContext = createAppFocusContext({
      keyPrefix,
      storage: window.localStorage,
    });

    focusContext.startFocusSession({
      breakIntervalMinutes: 5,
      focusIntervalMinutes: 25,
      plannedFocusIntervalCount: 4,
      userId,
    });

    renderRoute("/focus", {
      focusContext,
      session: {
        user: {
          displayName: "Casey Focus Workspace",
          email: "casey.focus.workspace@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 2, name: "Focus" }),
    ).toBeInTheDocument();

    const activePanel = screen.getByRole("region", {
      name: "Active focus session",
    });
    expect(within(activePanel).getByText("Focus session")).toBeInTheDocument();
    expect(within(activePanel).getByText("In progress")).toBeInTheDocument();
    expect(within(activePanel).getByText("25:00")).toBeInTheDocument();
    expect(within(activePanel).getByText("25 min")).toBeInTheDocument();
    expect(within(activePanel).getByText("5 min")).toBeInTheDocument();
    expect(within(activePanel).getByText("4")).toBeInTheDocument();
    expect(within(activePanel).getByText("0 / 4")).toBeInTheDocument();
    expect(
      within(activePanel).getByRole("button", { name: "End focus session" }),
    ).toBeInTheDocument();
    expect(
      within(activePanel).queryByRole("button", { name: /pause/i }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Keep focusing" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Skip break" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Start next focus" }),
    ).toBeNull();

    const setupPanel = screen.getByRole("form", { name: "Session setup" });
    expect(within(setupPanel).getByLabelText("Focus minutes")).toHaveValue(25);
    expect(within(setupPanel).getByLabelText("Break minutes")).toHaveValue(5);
    expect(within(setupPanel).getByLabelText("Planned intervals")).toHaveValue(
      4,
    );
    expect(within(setupPanel).getByLabelText("Focus minutes")).toBeDisabled();
    expect(within(setupPanel).getByLabelText("Break minutes")).toBeDisabled();
    expect(
      within(setupPanel).getByLabelText("Planned intervals"),
    ).toBeDisabled();
    expect(
      within(setupPanel).getByRole("button", { name: "Reset to defaults" }),
    ).toBeDisabled();
  });

  it("resets Focus session setup to the route defaults when inactive", async () => {
    const userId = "user-focus-setup-reset";
    renderRoute("/focus", {
      session: {
        user: {
          displayName: "Casey Focus Reset",
          email: "casey.focus.reset@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 2, name: "Focus" }),
    ).toBeInTheDocument();

    const setupPanel = screen.getByRole("form", { name: "Session setup" });
    const focusMinutes = within(setupPanel).getByLabelText("Focus minutes");
    const breakMinutes = within(setupPanel).getByLabelText("Break minutes");
    const plannedIntervals =
      within(setupPanel).getByLabelText("Planned intervals");

    fireEvent.change(focusMinutes, { target: { value: "40" } });
    fireEvent.change(breakMinutes, { target: { value: "8" } });
    fireEvent.change(plannedIntervals, { target: { value: "6" } });
    fireEvent.click(
      within(setupPanel).getByRole("button", { name: "Reset to defaults" }),
    );

    expect(focusMinutes).toHaveValue(25);
    expect(breakMinutes).toHaveValue(5);
    expect(plannedIntervals).toHaveValue(4);
    expect(
      within(setupPanel).getByRole("button", { name: "Start focus session" }),
    ).toBeEnabled();
  });

  it("keeps Focus history out of the workspace while preserving weekly analytics", async () => {
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
      rating: "easy",
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
          displayName: "Casey Focus Analytics",
          email: "casey.focus.analytics@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 2, name: "Focus" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Run a Pomodoro session to stay focused and make steady progress.",
      ),
    ).toBeInTheDocument();

    expect(screen.queryByText(/How capture works/i)).toBeNull();
    expect(screen.queryByText(/How focus works/i)).toBeNull();
    expect(
      screen.queryByRole("link", { name: /view all sessions/i }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /edit focus record/i }),
    ).toBeNull();
    expect(
      screen.queryByRole("table", { name: "Recent focus sessions" }),
    ).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Recent focus targets" }),
    ).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Completed study sessions" }),
    ).toBeNull();

    const analyticsStrip = screen.getByRole("region", {
      name: "This week at a glance",
    });
    expect(
      within(analyticsStrip).getByText("Focus minutes"),
    ).toBeInTheDocument();
    expect(
      within(analyticsStrip).getByText("Completed sessions"),
    ).toBeInTheDocument();
  });

  it("shows weekly analytics without empty history or target panels", async () => {
    const userId = "user-focus-empty-history";

    renderRoute("/focus", {
      session: {
        user: {
          displayName: "Casey Focus Empty",
          email: "casey.focus.empty@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 2, name: "Focus" }),
    ).toBeInTheDocument();

    const analyticsStrip = screen.getByRole("region", {
      name: "This week at a glance",
    });
    expect(within(analyticsStrip).getAllByText("0")).not.toHaveLength(0);
    expect(
      within(analyticsStrip).getAllByText("No change vs last week"),
    ).toHaveLength(6);
    expect(
      screen.queryByRole("table", { name: "Recent focus sessions" }),
    ).toBeNull();
    expect(screen.queryByText("Finish your first session")).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Recent focus targets" }),
    ).toBeNull();
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
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 2, name: "Focus" }),
    ).toBeInTheDocument();

    const focusControls = screen.getByRole("form", {
      name: "Session setup",
    });
    fireEvent.change(within(focusControls).getByLabelText("Focus minutes"), {
      target: { value: "30" },
    });
    fireEvent.change(within(focusControls).getByLabelText("Break minutes"), {
      target: { value: "10" },
    });
    fireEvent.change(
      within(focusControls).getByLabelText("Planned intervals"),
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
          userLanguage: "en",
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
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 2, name: "Recall" }),
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

    await router.navigate({ to: "/notes" });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
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
        userLanguage: "en",
      },
    } satisfies AppSessionSnapshot;

    const firstRender = renderRoute("/focus", {
      focusContext: firstFocusContext,
      session,
    });

    expect(
      await screen.findByRole("heading", { level: 2, name: "Focus" }),
    ).toBeInTheDocument();

    const focusControls = screen.getByRole("form", {
      name: "Session setup",
    });
    fireEvent.change(within(focusControls).getByLabelText("Focus minutes"), {
      target: { value: "35" },
    });
    fireEvent.change(within(focusControls).getByLabelText("Break minutes"), {
      target: { value: "7" },
    });
    fireEvent.change(
      within(focusControls).getByLabelText("Planned intervals"),
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
});
