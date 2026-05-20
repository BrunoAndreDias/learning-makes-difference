// @vitest-environment jsdom

import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppSessionSnapshot } from "../../modules/access/session/session";
import {
  createAppFocusContext,
  createCompletedRecallSession,
  createDeterministicRecallTestContexts,
  createLearningLoopTestContexts,
  createRecallNote,
  renderRoute,
} from "./app-shell-test-support";

type DeterministicRecallTestContexts = ReturnType<
  typeof createDeterministicRecallTestContexts
>;

function getWorkspaceHeader() {
  const workspaceHeader = document.querySelector(
    ".app-frame__workspace-header",
  );
  expect(workspaceHeader).toBeInstanceOf(HTMLElement);

  return workspaceHeader as HTMLElement;
}

function getHeaderFocusDock(name = "Focus now") {
  return within(getWorkspaceHeader()).getByRole("region", { name });
}

function createRecallableStudyNote(
  contexts: DeterministicRecallTestContexts,
  input: {
    expectedAnswer: string;
    prompt: string;
    sourceBody: string;
    sourceTitle: string;
    userId: string;
  },
) {
  const studyNote = contexts.studyNotesContext.createStudyNote(input.userId, {
    sourceBody: input.sourceBody,
    sourceTitle: input.sourceTitle,
  });

  return contexts.studyNotesContext.updateStudyNote(
    input.userId,
    studyNote.id,
    {
      acronyms: [],
      expectedAnswer: input.expectedAnswer,
      labelIds: [],
      metaphors: [],
      prompt: input.prompt,
      sourceBody: input.sourceBody,
      sourceTitle: input.sourceTitle,
    },
  );
}

function completeStudyNoteRecall(
  contexts: DeterministicRecallTestContexts,
  input: {
    rating: "easy" | "forgot" | "good" | "hard";
    studyNoteId: string;
    userId: string;
  },
) {
  act(() => {
    const session = contexts.recallContext.startFlashCardSession({
      studyNoteIds: [input.studyNoteId],
      userId: input.userId,
    });

    contexts.recallContext.revealFlashCardAnswer({
      sessionId: session.id,
      userId: input.userId,
    });
    contexts.recallContext.rateFlashCardAnswer({
      rating: input.rating,
      sessionId: session.id,
      userId: input.userId,
    });
  });
}

describe("authenticated app shell", () => {
  it("presents Focus as a guided session dashboard", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-focus-dashboard";
    const studyNote = createRecallableStudyNote(contexts, {
      expectedAnswer: "Cell membranes control what enters the cell.",
      prompt: "What does the cell membrane do?",
      sourceBody: "The membrane is selectively permeable.",
      sourceTitle: "Cell membrane",
      userId,
    });

    vi.setSystemTime(new Date("2026-05-15T09:05:00.000Z"));
    contexts.focusContext.startFocusSession({
      breakIntervalMinutes: 5,
      focusIntervalMinutes: 25,
      plannedFocusIntervalCount: 4,
      userId,
    });
    vi.setSystemTime(new Date("2026-05-15T09:30:00.000Z"));
    contexts.focusContext.endFocusSession({ userId });

    vi.setSystemTime(new Date("2026-05-15T09:35:00.000Z"));
    contexts.focusContext.startFocusSession({
      breakIntervalMinutes: 5,
      focusIntervalMinutes: 25,
      plannedFocusIntervalCount: 4,
      userId,
    });
    vi.setSystemTime(new Date("2026-05-15T10:00:00.000Z"));
    contexts.focusContext.endFocusSession({ userId });

    vi.setSystemTime(new Date("2026-05-15T10:05:00.000Z"));
    contexts.focusContext.startFocusSession({
      breakIntervalMinutes: 5,
      focusIntervalMinutes: 15,
      plannedFocusIntervalCount: 4,
      userId,
    });
    vi.setSystemTime(new Date("2026-05-15T10:20:00.000Z"));
    contexts.focusContext.endFocusSession({ userId });

    completeStudyNoteRecall(contexts, {
      rating: "hard",
      studyNoteId: studyNote.id,
      userId,
    });

    vi.setSystemTime(new Date("2026-05-15T12:00:00.000Z"));
    renderRoute("/focus", {
      ...contexts,
      session: {
        user: {
          displayName: "Casey Focus Dashboard",
          email: "casey.focus.dashboard@example.com",
          id: userId,
          userLanguage: "en",
          userTimeZone: "America/New_York",
        },
      },
    });

    const pageHeading = await screen.findByRole("heading", {
      level: 1,
      name: "Focus",
    });
    expect(pageHeading).toHaveClass("page-header__title");
    expect(
      screen.getAllByRole("heading", { level: 1, name: "Focus" }),
    ).toHaveLength(1);
    expect(
      screen.getByText(
        "Focus time supports your attention and recovery so you can study well. It does not count as recall evidence.",
      ),
    ).toHaveClass("page-header__description");
    expect(screen.getByText("May 15, 2026")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Help" })).toBeNull();
    expect(
      screen.queryByText("Focus time supports attention and recovery."),
    ).toBeNull();
    expect(
      screen.queryByText(
        "Learning evidence comes from recall and improved study notes.",
      ),
    ).toBeNull();
    expect(
      document.querySelector(".app-frame__actions .app-focus-session-start"),
    ).toBeNull();
    expect(screen.queryByRole("region", { name: "Focus now" })).toBeNull();
    const sidebar = screen.getByRole("complementary", {
      name: "Study Notes workspace",
    });
    const appSections = within(sidebar).getByRole("navigation", {
      name: "App sections",
    });
    expect(
      within(appSections).getByRole("link", { name: "Focus" }),
    ).toHaveAttribute("aria-current", "page");
    expect(within(appSections).queryByRole("button")).toBeNull();

    const sessionDashboard = screen.getByRole("region", {
      name: "Start a focus session",
    });
    expect(within(sessionDashboard).getByText("25:00")).toBeInTheDocument();
    expect(
      within(sessionDashboard).getByRole("button", {
        name: "Session settings",
      }),
    ).toBeInTheDocument();
    expect(
      within(sessionDashboard).getByRole("button", {
        name: "Start focus session",
      }),
    ).toBeEnabled();
    const sessionPlan = within(sessionDashboard).getByRole("list", {
      name: "Today's session plan",
    });
    expect(within(sessionPlan).getAllByText("Focus")).toHaveLength(4);
    expect(within(sessionPlan).getAllByText("25 min")).toHaveLength(4);
    expect(within(sessionPlan).getAllByText("Break")).toHaveLength(3);
    expect(within(sessionPlan).getAllByText("5 min")).toHaveLength(3);
    expect(
      within(sessionDashboard).getByText("Long break"),
    ).toBeInTheDocument();

    const activity = screen.getByRole("region", {
      name: "Today's focus activity",
    });
    const totalFocusMetric = within(activity)
      .getByText("Total focus time")
      .closest("div");
    expect(totalFocusMetric).not.toBeNull();
    expect(
      within(totalFocusMetric as HTMLElement).getByText("65m"),
    ).toBeInTheDocument();
    expect(
      within(totalFocusMetric as HTMLElement).getByText("3 sessions"),
    ).toBeInTheDocument();

    const completedSessionsMetric = within(activity)
      .getByText("Sessions completed")
      .closest("div");
    expect(completedSessionsMetric).not.toBeNull();
    expect(
      within(completedSessionsMetric as HTMLElement).getByText("3"),
    ).toBeInTheDocument();

    const longestStreakMetric = within(activity)
      .getByText("Longest streak")
      .closest("div");
    expect(longestStreakMetric).not.toBeNull();
    expect(
      within(longestStreakMetric as HTMLElement).getByText("days"),
    ).toBeInTheDocument();
    expect(within(activity).getAllByText("Focus")).toHaveLength(3);

    const support = screen.getByRole("region", {
      name: "Learning Loop support",
    });
    expect(
      within(support).getByRole("heading", { name: "Suggested next step" }),
    ).toBeInTheDocument();
    expect(
      within(support).getByRole("link", { name: /Recall Today/ }),
    ).toHaveAttribute("href", "/recall");

    vi.useRealTimers();
  });

  it("surfaces Practice Repair and Recall Today from actual recall facts on Focus", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-focus-learning-loop-support";
    const studyNote = createRecallableStudyNote(contexts, {
      expectedAnswer: "Expected answer for repair.",
      prompt: "Why is this Study Note still weak?",
      sourceBody: "Source explanation that still needs better recall support.",
      sourceTitle: "Practice repair source",
      userId,
    });

    completeStudyNoteRecall(contexts, {
      rating: "hard",
      studyNoteId: studyNote.id,
      userId,
    });

    renderRoute("/focus", {
      ...contexts,
      session: {
        user: {
          displayName: "Casey Focus Support",
          email: "casey.focus.support@example.com",
          id: userId,
          userLanguage: "en",
          userTimeZone: "America/New_York",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Focus" }),
    ).toBeInTheDocument();

    const supportPanel = screen.getByRole("region", {
      name: "Learning Loop support",
    });
    expect(
      within(supportPanel).getByRole("heading", { name: "Practice Repair" }),
    ).toBeInTheDocument();
    expect(
      within(supportPanel).getByRole("heading", { name: "Recall Today" }),
    ).toBeInTheDocument();
    expect(
      within(supportPanel).getByRole("link", { name: "Open Study Notes" }),
    ).toHaveAttribute("href", "/study-notes");
    expect(
      within(supportPanel).getByRole("link", { name: "Open Recall Today" }),
    ).toHaveAttribute("href", "/recall");
  });

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
        level: 1,
        name: "Foco",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "O tempo de foco apoia a sua atencao e recuperacao para estudar bem. Nao conta como evidencia de recordacao.",
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
      await screen.findByRole("heading", { level: 1, name: "Focus" }),
    ).toBeInTheDocument();

    const activePanel = screen.getByRole("region", {
      name: "Active focus session",
    });
    expect(within(activePanel).getByText("Focus session")).toBeInTheDocument();
    expect(within(activePanel).getByText("In progress")).toBeInTheDocument();
    expect(within(activePanel).getByText("25:00")).toBeInTheDocument();
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
      await screen.findByRole("heading", { level: 1, name: "Focus" }),
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
      await screen.findByRole("heading", { level: 1, name: "Focus" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Focus time supports your attention and recovery so you can study well. It does not count as recall evidence.",
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
      await screen.findByRole("heading", { level: 1, name: "Focus" }),
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
      screen.queryByRole("region", { name: "Learning Loop support" }),
    ).toBeNull();
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
      await screen.findByRole("heading", { level: 1, name: "Focus" }),
    ).toBeInTheDocument();

    const focusControls = screen.getByRole("form", {
      name: "Session setup",
    });
    fireEvent.change(within(focusControls).getByLabelText("Focus minutes"), {
      target: { value: "30" },
    });
    expect(within(focusControls).getByDisplayValue("30")).toBeInTheDocument();
    expect(screen.getByText("30:00")).toBeInTheDocument();
    fireEvent.change(within(focusControls).getByLabelText("Break minutes"), {
      target: { value: "10" },
    });
    fireEvent.change(
      within(focusControls).getByLabelText("Planned intervals"),
      {
        target: { value: "4" },
      },
    );
    fireEvent.click(
      within(focusControls).getByRole("button", {
        name: "Start focus session",
      }),
    );

    expect(router.state.location.pathname).toBe("/focus");
    expect(
      screen.getByRole("button", { name: "End focus session" }),
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

    const focusDock = getHeaderFocusDock();

    fireEvent.click(
      within(focusDock).getByRole("button", { name: "Start focus" }),
    );

    expect(router.state.location.pathname).toBe("/settings");
    expect(
      within(focusDock).getByRole("button", { name: /End focus/ }),
    ).toBeInTheDocument();
    expect(focusContext.getActiveSession({ userId })).toMatchObject({
      breakIntervalMinutes: 5,
      currentInterval: "Focus",
      focusIntervalMinutes: 25,
      method: "Pomodoro",
      plannedFocusIntervalCount: null,
    });
  });

  it("keeps the global header Focus Dock available across recall, Study Notes, and settings", async () => {
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

    let focusDock = getHeaderFocusDock();
    fireEvent.click(
      within(focusDock).getByRole("button", { name: "Start focus" }),
    );

    expect(
      within(focusDock).getByRole("button", { name: /End focus/ }),
    ).toBeInTheDocument();

    await router.navigate({ to: "/study-notes" });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Study Notes" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/study-notes");
    focusDock = getHeaderFocusDock();
    expect(
      within(focusDock).getByRole("button", { name: /End focus/ }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }));
    expect(
      await screen.findByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/settings");
    focusDock = getHeaderFocusDock();
    expect(
      within(focusDock).getByRole("button", { name: /End focus/ }),
    ).toBeInTheDocument();
  });

  it("renders the header Focus Dock copy for idle, active, paused, break, and complete states", async () => {
    const session = {
      user: {
        displayName: "Casey Dock",
        email: "casey.dock@example.com",
        id: "user-focus-dock-copy",
        userLanguage: "en",
      },
    } satisfies AppSessionSnapshot;

    function collapseSidebar() {
      const sidebar = screen.getByRole("complementary", {
        name: "Study Notes workspace",
      });

      fireEvent.click(
        within(sidebar).getByRole("button", { name: "Collapse sidebar" }),
      );
    }

    const idleRender = renderRoute("/settings", { session });
    await screen.findByRole("heading", { name: "Settings" });
    collapseSidebar();
    const idleDock = await screen.findByRole("region", { name: "Focus now" });
    expect(
      within(idleDock).getByRole("button", { name: "Start focus" }),
    ).toBeInTheDocument();
    idleRender.unmount();

    function createTimedFocusContext() {
      let currentTime = new Date("2026-05-01T10:00:00.000Z");
      const focusContext = createAppFocusContext({
        keyPrefix: `test-focus-dock-${Math.random().toString(36).slice(2)}`,
        now: () => new Date(currentTime),
        storage: window.localStorage,
      });

      return {
        focusContext,
        setCurrentTime(nextTime: string) {
          currentTime = new Date(nextTime);
        },
      };
    }

    const activeState = createTimedFocusContext();
    activeState.focusContext.startFocusSession({
      breakIntervalMinutes: 5,
      focusIntervalMinutes: 25,
      plannedFocusIntervalCount: 2,
      userId: session.user.id,
    });
    const activeRender = renderRoute("/settings", {
      focusContext: activeState.focusContext,
      session,
    });
    await screen.findByRole("heading", { name: "Settings" });
    collapseSidebar();
    expect(
      await screen.findByText(`Focus session \u00b7 25:00`),
    ).toBeInTheDocument();
    activeRender.unmount();

    const pausedState = createTimedFocusContext();
    pausedState.focusContext.startFocusSession({
      breakIntervalMinutes: 5,
      focusIntervalMinutes: 25,
      plannedFocusIntervalCount: 2,
      userId: session.user.id,
    });
    pausedState.setCurrentTime("2026-05-01T10:25:05.000Z");
    const pausedRender = renderRoute("/settings", {
      focusContext: pausedState.focusContext,
      session,
    });
    await screen.findByRole("heading", { name: "Settings" });
    collapseSidebar();
    expect(
      await screen.findByText(`Focus paused \u00b7 00:25`),
    ).toBeInTheDocument();
    pausedRender.unmount();

    const breakState = createTimedFocusContext();
    breakState.focusContext.startFocusSession({
      breakIntervalMinutes: 5,
      focusIntervalMinutes: 25,
      plannedFocusIntervalCount: 2,
      userId: session.user.id,
    });
    breakState.setCurrentTime("2026-05-01T10:25:35.000Z");
    const breakRender = renderRoute("/settings", {
      focusContext: breakState.focusContext,
      session,
    });
    await screen.findByRole("heading", { name: "Settings" });
    collapseSidebar();
    expect(await screen.findByText(`Break \u00b7 04:55`)).toBeInTheDocument();
    breakRender.unmount();

    const completeState = createTimedFocusContext();
    completeState.focusContext.startFocusSession({
      breakIntervalMinutes: 5,
      focusIntervalMinutes: 25,
      plannedFocusIntervalCount: 1,
      userId: session.user.id,
    });
    completeState.setCurrentTime("2026-05-01T10:25:35.000Z");
    renderRoute("/settings", {
      focusContext: completeState.focusContext,
      session,
    });
    await screen.findByRole("heading", { name: "Settings" });
    collapseSidebar();
    expect(await screen.findByText("Focus complete")).toBeInTheDocument();
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
      await screen.findByRole("heading", { level: 1, name: "Focus" }),
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
      screen.getByRole("button", { name: "End focus session" }),
    ).toBeInTheDocument();

    firstRender.unmount();

    const reloadedFocusContext = createAppFocusContext({
      keyPrefix,
      storage: window.localStorage,
    });

    renderRoute("/study-notes", {
      focusContext: reloadedFocusContext,
      session,
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Study Notes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /End focus/ }),
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
