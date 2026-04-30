// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  type AppSessionContext,
  type AppSessionSnapshot,
  createAppSessionContext,
} from "../../modules/access/domain/session";
import {
  type AppLabelsContext,
  createAppLabelsContext,
} from "../../modules/labels/domain/labels";
import {
  type AppFocusContext,
  createAppFocusContext,
} from "../../modules/learning-loop/domain/focus";
import {
  type AppNotesContext,
  createAppNotesContext,
  listNotesForUser,
} from "../../modules/learning-loop/domain/notes";
import {
  type AppRecallContext,
  createAppRecallContext,
  type FlashCardRecallRating,
} from "../../modules/learning-loop/domain/recall";
import { routeTree } from "../../routeTree.gen";

function renderRoute(
  initialPath: string,
  options: {
    focusContext?: AppFocusContext;
    labelsContext?: AppLabelsContext;
    notesContext?: AppNotesContext;
    recallContext?: AppRecallContext;
    session?: AppSessionSnapshot;
    sessionContext?: AppSessionContext;
  } = {},
) {
  const staticSnapshot = options.session ?? {
    user: {
      displayName: "Placeholder user",
      email: "placeholder@example.com",
      id: "user-placeholder",
      interfaceLanguage: "en",
      studyLanguage: "en",
    },
  };
  const sessionContext = options.sessionContext ?? {
    getSnapshot: () => staticSnapshot,
    subscribe: () => () => undefined,
    login: () =>
      Promise.reject(new Error("Static test session cannot log in.")),
    logout: () => ({ user: null }),
    register: () =>
      Promise.reject(new Error("Static test session cannot register.")),
    updatePreferences: () =>
      Promise.reject(
        new Error("Static test session cannot update preferences."),
      ),
  };
  const labelsContext =
    options.labelsContext ??
    createAppLabelsContext({
      keyPrefix: `test-labels-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
  const notesContext =
    options.notesContext ??
    createAppNotesContext({
      getOwnedLabelIdsForUser: (userId) =>
        labelsContext.getLabelsForUser(userId).map((label) => label.id),
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
  const focusContext =
    options.focusContext ??
    createAppFocusContext({
      getLabelsForUser: (userId) => labelsContext.getLabelsForUser(userId),
      keyPrefix: `test-focus-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
  const recallContext =
    options.recallContext ??
    createAppRecallContext({
      keyPrefix: `test-recall-${Math.random().toString(36).slice(2)}`,
      notes: notesContext,
      onStudyActivity: focusContext.captureRecallSessionStudyActivity,
      storage: window.localStorage,
    });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [initialPath],
    }),
    context: {
      focus: focusContext,
      labels: labelsContext,
      notes: notesContext,
      recall: recallContext,
      session: sessionContext,
    },
    defaultPreload: "intent",
    scrollRestoration: true,
  });

  return {
    router,
    ...render(<RouterProvider router={router} />),
  };
}

function createLearningLoopTestContexts(
  recallOptions: Partial<
    Pick<
      Parameters<typeof createAppRecallContext>[0],
      "crypto" | "shuffleNotes"
    >
  > = {},
) {
  const labelsContext = createAppLabelsContext({
    keyPrefix: `test-labels-${Math.random().toString(36).slice(2)}`,
    storage: window.localStorage,
  });
  const notesContext = createAppNotesContext({
    getOwnedLabelIdsForUser: (userId) =>
      labelsContext.getLabelsForUser(userId).map((label) => label.id),
    keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
    storage: window.localStorage,
  });
  const focusContext = createAppFocusContext({
    getLabelsForUser: (userId) => labelsContext.getLabelsForUser(userId),
    keyPrefix: `test-focus-${Math.random().toString(36).slice(2)}`,
    storage: window.localStorage,
  });
  const recallContext = createAppRecallContext({
    keyPrefix: `test-recall-${Math.random().toString(36).slice(2)}`,
    notes: notesContext,
    onStudyActivity: focusContext.captureRecallSessionStudyActivity,
    storage: window.localStorage,
    ...recallOptions,
  });

  return {
    focusContext,
    labelsContext,
    notesContext,
    recallContext,
  };
}

type AppShellRouter = ReturnType<typeof renderRoute>["router"];
type RenderRouteOptions = NonNullable<Parameters<typeof renderRoute>[1]>;

function createDeterministicRecallTestContexts() {
  return createLearningLoopTestContexts({
    shuffleNotes: (sessionNotes) => [...sessionNotes],
  });
}

function createRecallNote(
  notesContext: AppNotesContext,
  userId: string,
  input: {
    body: string;
    labelIds?: string[];
    title: string;
  },
) {
  return notesContext.createNote(userId, {
    acronyms: [],
    body: input.body,
    labelIds: input.labelIds ?? [],
    metaphors: [],
    title: input.title,
  });
}

function createCompletedRecallSession(
  recallContext: AppRecallContext,
  input: {
    noteId: string;
    rating: FlashCardRecallRating;
    timestamp: string;
    userId: string;
  },
) {
  vi.setSystemTime(new Date(input.timestamp));
  const session = recallContext.startFlashCardSession({
    noteIds: [input.noteId],
    userId: input.userId,
  });

  recallContext.revealFlashCardAnswer({
    sessionId: session.id,
    userId: input.userId,
  });
  recallContext.rateFlashCardAnswer({
    rating: input.rating,
    sessionId: session.id,
    userId: input.userId,
  });
}

function completeRecallSessionAt({
  noteId,
  rating,
  recallContext,
  timestamp,
  userId,
}: {
  noteId: string;
  rating: FlashCardRecallRating;
  recallContext: AppRecallContext;
  timestamp: string;
  userId: string;
}) {
  createCompletedRecallSession(recallContext, {
    noteId,
    rating,
    timestamp,
    userId,
  });
}

async function renderRecallSelection(contexts: RenderRouteOptions) {
  const routeRender = renderRoute("/recall/select", contexts);

  expect(
    await screen.findByRole("heading", { level: 3, name: "Select Notes" }),
  ).toBeInTheDocument();

  return routeRender;
}

function selectRecallableNote(title: string, body: string) {
  fireEvent.click(
    within(screen.getByLabelText("Recallable notes")).getByRole("button", {
      name: `${title}${body}`,
    }),
  );
}

async function startSelectedRecallSession() {
  fireEvent.click(screen.getByRole("button", { name: "Start recall" }));

  expect(
    await screen.findByRole("heading", { name: "FlashCard session" }),
  ).toBeInTheDocument();
}

async function expectReturnedToRecall(router: AppShellRouter) {
  expect(
    await screen.findByRole("heading", { level: 3, name: "Results" }),
  ).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/recall");
}

function openAccountMenu() {
  fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
}

function getSelectedSessionResultRegion() {
  return screen.getByRole("region", {
    name: "Selected session result",
  });
}

let documentVisibilityState: DocumentVisibilityState = "visible";

beforeAll(() => {
  window.scrollTo = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => documentVisibilityState,
  });
});

afterEach(() => {
  cleanup();
  documentVisibilityState = "visible";
  vi.useRealTimers();
});

describe("authenticated app shell", () => {
  it("redirects anonymous visits to the root path into login", async () => {
    const { router } = renderRoute("/", { session: { user: null } });

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
  });

  it("redirects authenticated visits to the root path into the notes workspace", async () => {
    const { router } = renderRoute("/");

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/notes");
  });

  it("redirects anonymous visits to unknown paths into login", async () => {
    const { router } = renderRoute("/qweqwe", { session: { user: null } });

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search.redirect).toBeUndefined();
  });

  it("redirects authenticated visits to unknown paths into the notes workspace", async () => {
    const { router } = renderRoute("/qweqwe");

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/notes");
  });

  it("redirects the removed /recall/results route to the notes workspace", async () => {
    const { router } = renderRoute("/recall/results");

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/notes");
    expect(
      screen.queryByRole("heading", { level: 3, name: "Results" }),
    ).not.toBeInTheDocument();
  });

  it("redirects unauthenticated protected navigation into the public login area", async () => {
    const { router } = renderRoute("/settings", { session: { user: null } });

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search.redirect).toBe("/settings");
  });

  it("registers a new account into the intended protected route and logs out cleanly", async () => {
    const sessionContext = createAppSessionContext({
      keyPrefix: `test-auth-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const { router } = renderRoute("/settings", { sessionContext });

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("link", { name: "Sign up" })[0]);
    expect(
      await screen.findByRole("heading", { name: "Create your account" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Casey Learner" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "casey@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Sign up form" }));

    expect(
      await screen.findByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Casey Learner")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/settings");

    openAccountMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
  });

  it("logs a returning user into the requested protected route", async () => {
    const sessionContext = createAppSessionContext({
      keyPrefix: `test-auth-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    await sessionContext.register({
      displayName: "Jordan Review",
      email: "jordan@example.com",
      password: "correct horse battery staple",
    });
    sessionContext.logout();

    const { router } = renderRoute("/login?redirect=%2Frecall", {
      sessionContext,
    });

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "jordan@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Sign in form" }));

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Results",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Jordan Review")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
  });

  it("updates account preferences from settings and restores them for the same account", async () => {
    const sessionContext = createAppSessionContext({
      keyPrefix: `test-auth-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    await sessionContext.register({
      displayName: "Casey Learner",
      email: "casey@example.com",
      password: "correct horse battery staple",
    });

    renderRoute("/settings", { sessionContext });

    expect(
      await screen.findByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Casey Rivers" },
    });
    fireEvent.change(screen.getByLabelText("Interface language"), {
      target: { value: "pt-BR" },
    });
    fireEvent.change(screen.getByLabelText("Study language"), {
      target: { value: "es" },
    });
    fireEvent.submit(
      screen.getByRole("form", { name: "Account preferences form" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Preferences saved.",
    );
    expect(screen.getAllByText("Casey Rivers")).not.toHaveLength(0);
    expect(screen.getByLabelText("Interface language")).toHaveValue("pt-BR");
    expect(screen.getByLabelText("Study language")).toHaveValue("es");

    openAccountMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();

    cleanup();

    const { router } = renderRoute("/login?redirect=%2Fsettings", {
      sessionContext,
    });

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "casey@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Sign in form" }));

    expect(
      await screen.findByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/settings");
    expect(screen.getByLabelText("Display name")).toHaveValue("Casey Rivers");
    expect(screen.getByLabelText("Interface language")).toHaveValue("pt-BR");
    expect(screen.getByLabelText("Study language")).toHaveValue("es");
  });

  it("renders a Notes Workspace shell with an account menu instead of product navigation", async () => {
    renderRoute("/settings");

    const sidebar = await screen.findByRole("complementary", {
      name: "Notes workspace",
    });
    const accountMenuButton = within(sidebar).getByRole("button", {
      name: /Placeholder user placeholder@example\.com account menu/,
    });

    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(accountMenuButton).toBeVisible();
    expect(within(sidebar).queryByText("Learning Makes Difference")).toBeNull();

    const appSections = within(sidebar).getByRole("navigation", {
      name: "App sections",
    });
    expect(
      within(appSections).getByRole("link", { name: "Notes" }),
    ).toBeInTheDocument();
    expect(
      within(appSections).getByRole("link", { name: "Labels" }),
    ).toBeInTheDocument();
    expect(
      within(appSections).getByRole("link", { name: "Recall" }),
    ).toBeInTheDocument();
    expect(
      within(appSections).queryByRole("link", { name: "Settings" }),
    ).not.toBeInTheDocument();

    openAccountMenu();
    const accountMenu = screen.getByRole("menu", {
      name: "Account options",
    });
    const settingsLink = within(accountMenu).getByRole("menuitem", {
      name: "Settings",
    });
    const logoutButton = within(accountMenu).getByRole("menuitem", {
      name: "Log out",
    });

    expect(settingsLink).toHaveAttribute("href", "/settings");
    expect(settingsLink).toHaveAttribute("aria-current", "page");
    expect(logoutButton).toBeVisible();
    expect(sidebar).toHaveAttribute("data-sidebar-state", "expanded");

    fireEvent.click(
      within(sidebar).getByRole("button", { name: "Collapse sidebar" }),
    );

    expect(sidebar).toHaveAttribute("data-sidebar-state", "collapsed");
    expect(sidebar).not.toBeVisible();
    expect(
      within(sidebar).queryByRole("button", { name: "Expand sidebar" }),
    ).not.toBeInTheDocument();

    const headerSidebarToggle = screen.getByRole("button", {
      name: "Expand sidebar",
    });
    const shellHeading = screen.getByRole("heading", {
      level: 2,
      name: "Settings",
    });

    expect(headerSidebarToggle).toHaveAttribute("aria-controls", sidebar.id);
    expect(headerSidebarToggle).toHaveTextContent("");
    expect(
      headerSidebarToggle.compareDocumentPosition(shellHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(headerSidebarToggle);

    expect(sidebar).toHaveAttribute("data-sidebar-state", "expanded");
    expect(sidebar).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Expand sidebar" }),
    ).not.toBeInTheDocument();
    expect(
      within(sidebar).getByRole("button", { name: "Collapse sidebar" }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: "Open navigation menu" }),
    ).not.toBeInTheDocument();
  });

  it("renders global workspace navigation and updates the active link when navigating", async () => {
    const { router } = renderRoute("/notes");

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary", {
      name: "Notes workspace",
    });
    const appSections = within(sidebar).getByRole("navigation", {
      name: "App sections",
    });
    const notesLink = within(appSections).getByRole("link", { name: "Notes" });
    const labelsLink = within(appSections).getByRole("link", {
      name: "Labels",
    });
    const recallLink = within(appSections).getByRole("link", {
      name: "Recall",
    });
    const focusLink = within(appSections).getByRole("link", { name: "Focus" });

    expect(within(appSections).getAllByRole("link")).toEqual([
      focusLink,
      notesLink,
      labelsLink,
      recallLink,
    ]);
    expect(
      within(appSections).queryByRole("link", { name: "Recall history" }),
    ).not.toBeInTheDocument();
    expect(notesLink).toHaveAttribute("href", "/notes");
    expect(labelsLink).toHaveAttribute("href", "/labels");
    expect(recallLink).toHaveAttribute("href", "/recall");
    expect(notesLink).toHaveAttribute("aria-current", "page");

    fireEvent.click(labelsLink);

    expect(
      await screen.findByRole("heading", { level: 2, name: "Labels" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/labels");
    expect(labelsLink).toHaveAttribute("aria-current", "page");
    expect(notesLink).not.toHaveAttribute("aria-current");

    fireEvent.click(recallLink);

    expect(
      await screen.findByRole("heading", { level: 3, name: "Results" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
    expect(recallLink).toHaveAttribute("aria-current", "page");
    expect(labelsLink).not.toHaveAttribute("aria-current");
  });

  it("adds Focus to primary navigation and opens the Focus section", async () => {
    const { router } = renderRoute("/notes");

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary", {
      name: "Notes workspace",
    });
    const appSections = within(sidebar).getByRole("navigation", {
      name: "App sections",
    });
    const focusLink = within(appSections).getByRole("link", { name: "Focus" });

    expect(focusLink).toHaveAttribute("href", "/focus");

    fireEvent.click(focusLink);

    expect(
      await screen.findByRole("heading", { level: 3, name: "Focus records" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/focus");
    expect(focusLink).toHaveAttribute("aria-current", "page");
  });

  it("renders completed FocusRecords newest first with metrics, targets, aggregate, and read-only history", async () => {
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
      await screen.findByRole("heading", { level: 3, name: "Focus records" }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/FocusRecords are read-only in v1\./),
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
    const recentCompletedFocus = screen.getByLabelText(
      "Recent completed focus",
    );
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
        "RecallSession: FlashCard | Notes: Recall target note | Labels: Recall label",
      ),
    ).toBeInTheDocument();
  });

  it("supports skip navigation without a header menu opener", async () => {
    renderRoute("/notes");

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    const skipLink = screen.getByRole("link", { name: "Skip to main content" });
    const main = screen.getByRole("main");

    expect(skipLink).toHaveAttribute("href", "#main-content");
    expect(main).toHaveAttribute("id", "main-content");

    expect(
      screen.queryByRole("button", { name: "Open navigation menu" }),
    ).not.toBeInTheDocument();
  });

  it("uses the notes sidebar without a header menu opener", async () => {
    const notesContext = createAppNotesContext({
      getOwnedLabelIdsForUser: () => [],
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Repeated review strengthens long-term retention.",
      labelIds: [],
      metaphors: [],
      title: "Spaced repetition",
    });
    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Retrieval cues make later recall easier.",
      labelIds: [],
      metaphors: [],
      title: "Retrieval practice",
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary", {
      name: "Notes workspace",
    });

    const notesList = within(sidebar).getByRole("navigation", {
      name: "Notes list",
    });

    expect(sidebar).toHaveAttribute("data-mobile-open", "false");
    expect(
      within(sidebar).getByRole("button", { name: "New note" }),
    ).toBeInTheDocument();
    expect(
      within(sidebar).getByRole("navigation", { name: "App sections" }),
    ).toBeInTheDocument();
    expect(
      within(sidebar).getByRole("button", { name: /account menu/i }),
    ).toBeInTheDocument();

    const retrievalPracticeButton = within(notesList).getByRole("button", {
      name: "Retrieval practice",
    });

    retrievalPracticeButton.focus();
    expect(retrievalPracticeButton).toHaveFocus();

    fireEvent.click(retrievalPracticeButton);

    expect(sidebar).toHaveAttribute("data-mobile-open", "false");
    expect(
      screen.getByDisplayValue("Retrieval cues make later recall easier."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open navigation menu" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the discard dialog focused when a mobile sidebar note change is guarded", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "The protected phrase appears here.",
      labelIds: [],
      metaphors: [],
      title: "Older protected note",
    });
    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Current note has work in progress.",
      labelIds: [],
      metaphors: [],
      title: "Current draftable note",
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    const bodyEditor = await screen.findByDisplayValue(
      "Current note has work in progress.",
    );
    const sidebar = screen.getByRole("complementary", {
      name: "Notes workspace",
    });
    const notesList = within(sidebar).getByRole("navigation", {
      name: "Notes list",
    });

    fireEvent.change(bodyEditor, {
      target: {
        value: "Current note has work in progress and should stay guarded.",
      },
    });
    fireEvent.click(
      within(notesList).getByRole("button", {
        name: "Older protected note",
      }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Discard unsaved changes?",
    });

    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toHaveFocus();
    expect(screen.getByLabelText("Title")).not.toHaveFocus();
  });

  it("renders the notes list inside the app sidebar for the notes workspace", async () => {
    const labelsContext = createAppLabelsContext({
      keyPrefix: `test-labels-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const notesContext = createAppNotesContext({
      getOwnedLabelIdsForUser: (userId) =>
        labelsContext.getLabelsForUser(userId).map((label) => label.id),
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";
    const biology = labelsContext.createLabel({
      name: "Biology",
      userId,
    });

    notesContext.createNote(userId, {
      acronyms: [],
      body: "Patterns emerge after several careful comparison passes.",
      labelIds: [],
      metaphors: [],
      title: "Second note",
    });

    const firstNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "Signals travel across neurons and strengthen with repeated use.",
      labelIds: [biology.id],
      metaphors: [],
      title: "Neural pathways",
    });

    renderRoute("/notes", {
      labelsContext,
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary", {
      name: "Notes workspace",
    });
    const notesNavigation = within(sidebar).getByRole("navigation", {
      name: "Notes list",
    });
    const notesLinks = within(notesNavigation).getAllByRole("button", {
      name: /^(Neural pathways|Second note)$/,
    });

    expect(
      within(sidebar).getByRole("button", { name: "New note" }),
    ).toBeInTheDocument();
    expect(notesLinks).toHaveLength(2);
    expect(notesLinks[0]).toHaveTextContent("Neural pathways");
    expect(notesLinks[1]).toHaveTextContent("Second note");
    expect(notesLinks[0]).toHaveAttribute("aria-current", "page");
    expect(
      within(notesNavigation).getAllByRole("button", {
        name: /^Delete (Neural pathways|Second note)$/,
      }),
    ).toHaveLength(2);
    const shellHeader = screen.getByLabelText("Notes workspace toolbar");

    expect(
      within(shellHeader).getByRole("combobox", { name: "Search notes" }),
    ).toBeInTheDocument();
    expect(within(shellHeader).getByText("2 notes")).toBeInTheDocument();

    expect(screen.getByLabelText("Note editor surface")).toBeInTheDocument();
    expect(screen.queryByLabelText("Notes catalog")).not.toBeInTheDocument();
    expect(screen.getAllByText("Biology").length).toBeGreaterThan(0);
    expect(firstNote.title).toBe("Neural pathways");
  });

  it("lets an authenticated user delete notes from the sidebar notes list", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";

    notesContext.createNote(userId, {
      acronyms: [],
      body: "One note should remain after deleting the other.",
      labelIds: [],
      metaphors: [],
      title: "Remaining note",
    });
    notesContext.createNote(userId, {
      acronyms: [],
      body: "This note can be removed from the sidebar list.",
      labelIds: [],
      metaphors: [],
      title: "Disposable note",
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    const notesNavigation = screen.getByRole("navigation", {
      name: "Notes list",
    });
    const disposableNoteRow = within(notesNavigation)
      .getByRole("button", { name: "Disposable note" })
      .closest("li");

    expect(disposableNoteRow).not.toBeNull();

    fireEvent.click(
      within(disposableNoteRow as HTMLElement).getByRole("button", {
        name: "Delete Disposable note",
      }),
    );

    expect(
      within(notesNavigation).queryByRole("button", {
        name: "Disposable note",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(notesNavigation).getByRole("button", { name: "Remaining note" }),
    ).toBeInTheDocument();
    expect(
      listNotesForUser(notesContext.getSnapshot(), userId).map(
        (note) => note.title,
      ),
    ).not.toContain("Disposable note");
  });

  it("renders every note in the sidebar notes list without a fixed item cap", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";

    for (let index = 1; index <= 12; index += 1) {
      notesContext.createNote(userId, {
        acronyms: [],
        body: `Study note ${index} body`,
        labelIds: [],
        metaphors: [],
        title: `Study note ${index}`,
      });
    }

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    const notesNavigation = within(
      screen.getByRole("complementary", { name: "Notes workspace" }),
    ).getByRole("navigation", {
      name: "Notes list",
    });

    expect(
      within(notesNavigation).getAllByRole("button", {
        name: /^Study note \d+$/,
      }),
    ).toHaveLength(12);
    expect(
      within(notesNavigation).getByRole("button", { name: "Study note 12" }),
    ).toBeInTheDocument();
  });

  it("uses the app sidebar collapse as the only notes list visibility control", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Repeated review strengthens long-term retention.",
      labelIds: [],
      metaphors: [],
      title: "Spaced repetition",
    });
    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Retrieval cues make later recall easier.",
      labelIds: [],
      metaphors: [],
      title: "Retrieval practice",
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary", {
      name: "Notes workspace",
    });
    const notesList = within(sidebar).getByRole("navigation", {
      name: "Notes list",
    });
    const collapseSidebarButton = within(sidebar).getByRole("button", {
      name: "Collapse sidebar",
    });

    expect(notesList).toBeVisible();
    fireEvent.click(
      within(sidebar).getByRole("button", { name: "Spaced repetition" }),
    );
    expect(
      screen.getByDisplayValue(
        "Repeated review strengthens long-term retention.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Hide notes catalog" }),
    ).not.toBeInTheDocument();

    fireEvent.click(collapseSidebarButton);

    expect(sidebar).not.toBeVisible();
    expect(
      screen.getByRole("button", { name: "Expand sidebar" }),
    ).toHaveFocus();
    expect(
      screen.queryByRole("navigation", { name: "App sections" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Log out" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Show notes catalog" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Search notes" }), {
      target: { value: "retrieval practice" },
    });
    fireEvent.click(
      within(screen.getByLabelText("Notes search results")).getByRole(
        "option",
        { name: /Retrieval practice/ },
      ),
    );

    expect(
      screen.getByDisplayValue("Retrieval cues make later recall easier."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));

    expect(sidebar).toBeVisible();
    expect(
      within(sidebar).getByRole("navigation", { name: "Notes list" }),
    ).toBeVisible();
    expect(
      within(sidebar).getByRole("button", { name: "Retrieval practice" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("keeps account utilities at the top of the sidebar while long notes stay reachable", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const longTitle =
      "Very long note title that should still stay reachable from the notes sidebar navigation";

    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Repeated review strengthens long-term retention.",
      labelIds: [],
      metaphors: [],
      title: longTitle,
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Alexandria Review Coordinator",
          email: "jordan.alexandria.review.coordinator@example-learning.test",
          id: "user-jordan",
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary", {
      name: "Notes workspace",
    });
    const notesList = within(sidebar).getByRole("navigation", {
      name: "Notes list",
    });
    const accountMenuButton = within(sidebar).getByRole("button", {
      name: /Jordan Alexandria Review Coordinator .* account menu/,
    });

    expect(
      within(sidebar).getByRole("navigation", { name: "App sections" }),
    ).toBeInTheDocument();
    expect(
      within(notesList).getByRole("button", { name: longTitle }),
    ).toBeInTheDocument();
    expect(sidebar).toContainElement(accountMenuButton);
    expect(
      Boolean(
        accountMenuButton.compareDocumentPosition(notesList) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(
      within(accountMenuButton).getByText(/Jordan Alexandria Review/),
    ).toBeVisible();
    expect(
      within(accountMenuButton).getByText(
        "jordan.alexandria.review.coordinator@example-learning.test",
      ),
    ).toBeVisible();
    openAccountMenu();
    const accountMenu = screen.getByRole("menu", { name: "Account options" });
    expect(
      within(accountMenu).getByRole("menuitem", { name: "Settings" }),
    ).toBeVisible();
    expect(
      within(accountMenu).getByRole("menuitem", { name: "Log out" }),
    ).toBeVisible();
  });

  it("lets an authenticated user create and edit notes inside the notes workspace", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No notes yet")).toBeInTheDocument();
    expect(screen.getByLabelText("Title").closest("header")).toContainElement(
      screen.getByRole("button", { name: "Create note" }),
    );
    expect(
      within(
        screen.getByRole("complementary", { name: "Notes workspace" }),
      ).getByRole("button", { name: "New note" }),
    ).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Spaced repetition" },
    });
    fireEvent.change(screen.getByLabelText("Body"), {
      target: {
        value: "Reviewing at expanding intervals improves long-term retention.",
      },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Note editor" }));

    expect(
      await screen.findByRole("button", { name: "Spaced repetition" }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Spaced repetition")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        "Reviewing at expanding intervals improves long-term retention.",
      ),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Body"), {
      target: {
        value:
          "Reviewing at expanding intervals improves recall over long spans.",
      },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Note editor" }));
    fireEvent.click(
      within(
        screen.getByRole("complementary", { name: "Notes workspace" }),
      ).getByRole("button", { name: "New note" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Spaced repetition" }));

    expect(
      screen.getByDisplayValue(
        "Reviewing at expanding intervals improves recall over long spans.",
      ),
    ).toBeInTheDocument();
  });

  it("shows save changes only for unsaved note edits and places it near the title", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Reviewing at expanding intervals improves long-term retention.",
      labelIds: [],
      metaphors: [],
      title: "Spaced repetition",
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByDisplayValue("Spaced repetition"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Body"), {
      target: {
        value:
          "Reviewing at expanding intervals improves recall over long spans.",
      },
    });

    const saveButton = screen.getByRole("button", { name: "Save changes" });
    const titleHeader = screen.getByLabelText("Title").closest("header");
    const memoryHooks = screen.getByLabelText("Memory hooks");

    expect(titleHeader).not.toBeNull();
    expect(titleHeader).toContainElement(saveButton);
    expect(memoryHooks).not.toContainElement(saveButton);

    fireEvent.click(saveButton);

    expect(
      await screen.findByDisplayValue(
        "Reviewing at expanding intervals improves recall over long spans.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();
  });

  it("opens notes search results without live-filtering the stable sidebar notes list", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    notesContext.createNote("user-jordan", {
      acronyms: [
        {
          expansion: "Long-Term Potentiation",
          shortForm: "LTP",
        },
      ],
      body: "Repeated activation strengthens the pathway.",
      labelIds: [],
      metaphors: [
        {
          explanation:
            "It is like cutting a groove into a sled track so the next pass follows more easily.",
          title: "Sled track",
        },
      ],
      title: "Synaptic plasticity",
    });
    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Short-term storage supports active reasoning.",
      labelIds: [],
      metaphors: [],
      title: "Working memory",
    });
    notesContext.createNote("user-casey", {
      acronyms: [
        {
          expansion: "Long-Term Potentiation",
          shortForm: "LTP",
        },
      ],
      body: "This note belongs to another account.",
      labelIds: [],
      metaphors: [],
      title: "Hidden note",
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    const searchInput = screen.getByRole("combobox", {
      name: "Search notes",
    });
    const notesList = within(
      screen.getByRole("navigation", { name: "Notes list" }),
    );

    expect(searchInput).toHaveAttribute("placeholder", "Search notes");
    expect(
      screen.queryByLabelText("Notes search results"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Short-term storage supports active reasoning."),
    ).toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: { value: "sled track" },
    });

    expect(
      within(screen.getByLabelText("Notes search results")).getByRole(
        "option",
        { name: /Synaptic plasticity/ },
      ),
    ).toBeInTheDocument();
    expect(
      notesList.getByRole("button", { name: "Working memory" }),
    ).toBeInTheDocument();
    expect(
      notesList.getByRole("button", { name: "Synaptic plasticity" }),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Short-term storage supports active reasoning."),
    ).toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: { value: "long-term potentiation" },
    });

    expect(
      within(screen.getByLabelText("Notes search results")).getByRole(
        "option",
        { name: /Synaptic plasticity/ },
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Hidden note/ }),
    ).not.toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: { value: "missing concept" },
    });

    expect(screen.getByText("No notes found")).toBeInTheDocument();
    expect(
      notesList.getByRole("button", { name: "Working memory" }),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Short-term storage supports active reasoning."),
    ).toBeInTheDocument();
  });

  it("shows ranked notes search results with match chips and updated dates", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    notesContext.createNote("user-jordan", {
      acronyms: [
        {
          expansion: "Priority Cue",
          shortForm: "PC",
        },
      ],
      body: "Mnemonic content only.",
      labelIds: [],
      metaphors: [],
      title: "Acronym result",
    });
    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Visual memory aid only.",
      labelIds: [],
      metaphors: [
        {
          explanation: "A priority cue acts like a lighthouse.",
          title: "Lighthouse",
        },
      ],
      title: "Metaphor result",
    });
    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "This body contains a priority cue.",
      labelIds: [],
      metaphors: [],
      title: "Body result",
    });
    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "This body also contains a priority cue.",
      labelIds: [],
      metaphors: [
        {
          explanation: "Priority cue also appears here.",
          title: "Duplicate attached match",
        },
      ],
      title: "Priority cue title result",
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("combobox", {
        name: "Search notes",
      }),
      {
        target: { value: "priority cue" },
      },
    );

    const resultButtons = within(
      screen.getByLabelText("Notes search results"),
    ).getAllByRole("option");

    expect(resultButtons).toHaveLength(4);
    expect(resultButtons.map((button) => button.textContent)).toEqual([
      expect.stringMatching(/^Priority cue title resultTitleUpdated /),
      expect.stringMatching(/^Body resultBodyUpdated /),
      expect.stringMatching(/^Metaphor resultMetaphorUpdated /),
      expect.stringMatching(/^Acronym resultAcronymUpdated /),
    ]);
  });

  it("supports keyboard, shortcut, mobile submit, and accessible notes search combobox behavior", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Older spaced retrieval cue.",
      labelIds: [],
      metaphors: [],
      title: "Older retrieval",
    });
    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Newer spaced retrieval cue.",
      labelIds: [],
      metaphors: [],
      title: "Newer retrieval",
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    const searchInput = screen.getByRole("combobox", {
      name: "Search notes",
    });

    expect(searchInput).toHaveAttribute("autocomplete", "off");

    fireEvent.pointerDown(screen.getByText("Cmd K"));
    expect(searchInput).toHaveFocus();

    searchInput.blur();
    fireEvent.pointerDown(searchInput.closest("form") as HTMLFormElement);
    expect(searchInput).toHaveFocus();

    fireEvent.change(searchInput, {
      target: { value: "spaced retrieval cue" },
    });

    searchInput.blur();
    fireEvent.pointerDown(
      searchInput
        .closest("form")
        ?.querySelector(".notes-search__icon svg") as SVGElement,
    );
    expect(searchInput).not.toHaveFocus();

    fireEvent.pointerDown(screen.getByText("Cmd K"));
    expect(searchInput).toHaveFocus();
    expect(searchInput).toHaveProperty("selectionStart", 0);
    expect(searchInput).toHaveProperty(
      "selectionEnd",
      "spaced retrieval cue".length,
    );

    const listbox = screen.getByRole("listbox", {
      name: "Notes search results",
    });
    const options = within(listbox).getAllByRole("option");

    expect(searchInput).toHaveAttribute("aria-expanded", "true");
    expect(searchInput).toHaveAttribute("aria-activedescendant", options[0].id);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[0]).toHaveAccessibleName(
      expect.stringMatching(/Newer retrieval Body Updated /),
    );

    fireEvent.keyDown(searchInput, { key: "ArrowDown" });
    expect(searchInput).toHaveAttribute("aria-activedescendant", options[1].id);
    expect(options[1]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(searchInput, { key: "Escape" });
    expect(searchInput).toHaveValue("spaced retrieval cue");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Newer spaced retrieval cue."),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(searchInput).toHaveFocus();
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByLabelText("Note editor surface"));
    expect(searchInput).toHaveValue("spaced retrieval cue");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    fireEvent.submit(searchInput.closest("form") as HTMLFormElement);
    expect(searchInput).toHaveValue("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Newer spaced retrieval cue."),
    ).toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: { value: "spaced retrieval cue" },
    });
    fireEvent.keyDown(searchInput, { key: "ArrowDown" });
    fireEvent.keyDown(searchInput, { key: "Enter" });

    expect(searchInput).toHaveValue("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Older spaced retrieval cue."),
    ).toBeInTheDocument();
  });

  it("jumps to and temporarily selects matched content from a chosen search result", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "The selected phrase appears here.",
      labelIds: [],
      metaphors: [],
      title: "Older target note",
    });
    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Current note stays visible until the search result is chosen.",
      labelIds: [],
      metaphors: [],
      title: "Current note",
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByDisplayValue(
        "Current note stays visible until the search result is chosen.",
      ),
    ).toBeInTheDocument();

    vi.useFakeTimers();

    const searchInput = screen.getByRole("combobox", {
      name: "Search notes",
    });

    fireEvent.change(searchInput, {
      target: { value: "selected phrase" },
    });

    fireEvent.click(
      within(screen.getByLabelText("Notes search results")).getByRole(
        "option",
        { name: /Older target note/ },
      ),
    );

    const bodyEditor = screen.getByDisplayValue(
      "The selected phrase appears here.",
    );

    expect(searchInput).toHaveValue("");
    expect(
      screen.queryByLabelText("Notes search results"),
    ).not.toBeInTheDocument();
    expect(bodyEditor).toHaveFocus();
    expect(bodyEditor).toHaveProperty("selectionStart", 4);
    expect(bodyEditor).toHaveProperty("selectionEnd", 19);
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(bodyEditor).toHaveFocus();
    expect(bodyEditor).toHaveProperty("selectionStart", 19);
    expect(bodyEditor).toHaveProperty("selectionEnd", 19);
  });

  it("syncs the sidebar active note and reveals it after selecting a search result", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "The search phrase appears in this older note.",
      labelIds: [],
      metaphors: [],
      title: "Older target note",
    });
    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "This note stays selected before searching.",
      labelIds: [],
      metaphors: [],
      title: "Current note",
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByDisplayValue(
        "This note stays selected before searching.",
      ),
    ).toBeInTheDocument();

    const notesList = within(
      screen.getByRole("navigation", { name: "Notes list" }),
    );
    const currentSidebarNote = notesList.getByRole("button", {
      name: "Current note",
    });
    const targetSidebarNote = notesList.getByRole("button", {
      name: "Older target note",
    });
    const scrollIntoView = vi.mocked(HTMLElement.prototype.scrollIntoView);

    expect(currentSidebarNote).toHaveAttribute("aria-current", "page");
    expect(targetSidebarNote).not.toHaveAttribute("aria-current");

    scrollIntoView.mockClear();

    fireEvent.change(screen.getByRole("combobox", { name: "Search notes" }), {
      target: { value: "search phrase" },
    });
    fireEvent.click(
      within(screen.getByLabelText("Notes search results")).getByRole(
        "option",
        {
          name: /Older target note/,
        },
      ),
    );

    expect(
      await screen.findByDisplayValue(
        "The search phrase appears in this older note.",
      ),
    ).toBeInTheDocument();
    expect(targetSidebarNote).toHaveAttribute("aria-current", "page");
    expect(currentSidebarNote).not.toHaveAttribute("aria-current");
    expect(scrollIntoView).toHaveBeenCalled();
    expect(scrollIntoView.mock.contexts).toContain(targetSidebarNote);
  });

  it("guards search navigation when the current note has unsaved edits", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "The protected phrase appears here.",
      labelIds: [],
      metaphors: [],
      title: "Older protected note",
    });
    notesContext.createNote("user-jordan", {
      acronyms: [],
      body: "Current note has work in progress.",
      labelIds: [],
      metaphors: [],
      title: "Current draftable note",
    });

    renderRoute("/notes", {
      notesContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    const bodyEditor = await screen.findByDisplayValue(
      "Current note has work in progress.",
    );
    fireEvent.change(bodyEditor, {
      target: { value: "Current note has unsaved work in progress." },
    });

    const searchInput = screen.getByRole("combobox", {
      name: "Search notes",
    });

    fireEvent.change(searchInput, {
      target: { value: "protected phrase" },
    });

    const searchResults = screen.getByLabelText("Notes search results");
    fireEvent.click(
      within(searchResults).getByRole("option", {
        name: /Older protected note/,
      }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "Discard unsaved changes?",
    });
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Discard changes" }),
    ).toBeInTheDocument();
    expect(within(dialog).getAllByRole("button")).toHaveLength(2);
    expect(searchInput).toHaveValue("protected phrase");
    expect(screen.getByLabelText("Notes search results")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Current note has unsaved work in progress."),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(
      screen.queryByRole("dialog", { name: "Discard unsaved changes?" }),
    ).not.toBeInTheDocument();
    expect(searchInput).toHaveValue("protected phrase");
    expect(screen.getByLabelText("Notes search results")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Current note has unsaved work in progress."),
    ).toBeInTheDocument();

    vi.useFakeTimers();

    fireEvent.click(
      within(screen.getByLabelText("Notes search results")).getByRole(
        "option",
        {
          name: /Older protected note/,
        },
      ),
    );
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "Discard unsaved changes?" }),
      ).getByRole("button", { name: "Discard changes" }),
    );

    const targetEditor = screen.getByDisplayValue(
      "The protected phrase appears here.",
    );

    expect(searchInput).toHaveValue("");
    expect(
      screen.queryByLabelText("Notes search results"),
    ).not.toBeInTheDocument();
    expect(targetEditor).toHaveFocus();
    expect(targetEditor).toHaveProperty("selectionStart", 4);
    expect(targetEditor).toHaveProperty("selectionEnd", 20);
  });

  it("assigns and removes owned labels from a note inside the notes workspace", async () => {
    const labelsContext = createAppLabelsContext({
      keyPrefix: `test-labels-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";

    labelsContext.createLabel({
      name: "Biology",
      userId,
    });
    labelsContext.createLabel({
      name: "Science",
      userId,
    });

    renderRoute("/notes", {
      labelsContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No labels yet")).toBeInTheDocument();
    expect(screen.queryByText("Assign labels")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Cell respiration" },
    });
    fireEvent.change(screen.getByLabelText("Body"), {
      target: {
        value:
          "Cells convert glucose into usable energy through staged reactions.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add label" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Science" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Biology" }));
    fireEvent.submit(screen.getByRole("form", { name: "Note editor" }));

    const currentLabels = await screen.findByLabelText("Current labels");
    const assignedLabels =
      within(currentLabels).getByLabelText("Assigned labels");

    expect(within(assignedLabels).getByText("Science")).toBeInTheDocument();
    expect(within(assignedLabels).getByText("Biology")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Biology" }));
    fireEvent.submit(screen.getByRole("form", { name: "Note editor" }));

    expect(within(assignedLabels).getByText("Science")).toBeInTheDocument();
    expect(
      within(assignedLabels).queryByText("Biology"),
    ).not.toBeInTheDocument();
  });

  it("opens recall from notes without preselecting the edited note", async () => {
    const labelsContext = createAppLabelsContext({
      keyPrefix: `test-labels-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const recallContext = createAppRecallContext({
      keyPrefix: `test-recall-${Math.random().toString(36).slice(2)}`,
      notes: notesContext,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage: window.localStorage,
    });
    const userId = "user-jordan";
    notesContext.createNote(userId, {
      acronyms: [],
      body: "Retrieval is strengthened by effortful recall.",
      labelIds: [],
      metaphors: [],
      title: "Testing effect",
    });

    const { router } = renderRoute("/notes", {
      labelsContext,
      notesContext,
      recallContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByDisplayValue(
        "Retrieval is strengthened by effortful recall.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start Recall" }));

    expect(
      await screen.findByRole("heading", { level: 3, name: "Select Notes" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall/select");
    expect(
      within(screen.getByLabelText("Recall selection controls")).getByText(
        "0 notes selected",
      ),
    ).toBeInTheDocument();
    expect(recallContext.getSnapshot()).toBeNull();
    expect(recallContext.listSessionResults({ userId })).toHaveLength(0);
  });

  it("opens recall from notes even when the edited note has unsaved changes", async () => {
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const recallContext = createAppRecallContext({
      keyPrefix: `test-recall-${Math.random().toString(36).slice(2)}`,
      notes: notesContext,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage: window.localStorage,
    });
    const userId = "user-jordan";
    const note = notesContext.createNote(userId, {
      acronyms: [],
      body: "Original recall answer.",
      labelIds: [],
      metaphors: [],
      title: "Guarded recall start",
    });

    const { router } = renderRoute("/notes", {
      notesContext,
      recallContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    const bodyEditor = await screen.findByDisplayValue(
      "Original recall answer.",
    );

    fireEvent.change(bodyEditor, {
      target: { value: "Unsaved recall answer." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start Recall" }));

    expect(
      await screen.findByRole("heading", { level: 3, name: "Select Notes" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall/select");
    expect(
      within(screen.getByLabelText("Recall selection controls")).getByText(
        "0 notes selected",
      ),
    ).toBeInTheDocument();
    expect(recallContext.getSnapshot()).toBeNull();
    expect(
      listNotesForUser(notesContext.getSnapshot(), userId).find(
        (currentNote) => currentNote.id === note.id,
      )?.body,
    ).toBe("Original recall answer.");
    expect(
      screen.queryByRole("dialog", { name: "Discard unsaved changes?" }),
    ).toBeNull();
  });

  it("removes notes-owned recall selection controls from notes", async () => {
    renderRoute("/notes");

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start Recall" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Select for recall" }),
    ).toBeNull();
    expect(screen.queryByText("Selecting for recall")).toBeNull();
    expect(screen.queryByLabelText("Recall selection controls")).toBeNull();
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
      await screen.findByRole("heading", { level: 3, name: "Focus records" }),
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
      screen.getByRole("button", { name: "Focus active" }),
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
      screen.getByRole("button", { name: "Focus active" }),
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
      screen.getByRole("button", { name: "Focus active" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Labels" }));
    expect(
      await screen.findByRole("heading", { level: 2, name: "Labels" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/labels");
    expect(
      screen.getByRole("button", { name: "Focus active" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Notes" }));
    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/notes");
    expect(
      screen.getByRole("button", { name: "Focus active" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }));
    expect(
      await screen.findByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/settings");
    expect(
      screen.getByRole("button", { name: "Focus active" }),
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
      await screen.findByRole("heading", { level: 3, name: "Focus records" }),
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
      screen.getByRole("button", { name: "Focus active" }),
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
      await screen.findByRole("button", { name: "Focus active" }),
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
          name: "Focus records",
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

      const activeStatus = screen.getByRole("status", {
        name: "Focus session status",
      });
      expect(activeStatus).toHaveTextContent("Focus:");
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

      const continueFocusButton = await screen.findByRole("button", {
        name: "Continue focus",
      });
      expect(continueFocusButton).toHaveFocus();
      expect(
        screen.getByRole("status", { name: "Focus session status" }),
      ).toHaveTextContent("Transition window:");

      fireEvent.click(continueFocusButton);
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
        name: "Focus records",
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
      await screen.findByRole("button", { name: "Continue focus" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Transition window:/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue focus" }));

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

    expect(await screen.findByText("Focus session stale")).toBeInTheDocument();

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

  it("manages note metaphors inside the note workflow", async () => {
    renderRoute("/notes", {
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Action potentials" },
    });
    fireEvent.change(screen.getByLabelText("Body"), {
      target: {
        value: "Neurons fire once membrane voltage crosses threshold.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add metaphor" }));

    expect(screen.getAllByLabelText("Metaphor editor")).toHaveLength(1);

    fireEvent.change(screen.getAllByLabelText("Metaphor title")[0], {
      target: { value: "Domino line" },
    });
    fireEvent.change(screen.getAllByLabelText("Metaphor explanation")[0], {
      target: {
        value:
          "Crossing threshold is like tipping the first domino so the whole line falls.",
      },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Note editor" }));

    expect(await screen.findByDisplayValue("Domino line")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        "Crossing threshold is like tipping the first domino so the whole line falls.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add metaphor" }));

    expect(screen.getAllByLabelText("Metaphor editor")).toHaveLength(2);

    fireEvent.change(screen.getAllByLabelText("Metaphor explanation")[0], {
      target: {
        value:
          "Crossing threshold is like tipping the first domino and committing the whole chain.",
      },
    });
    fireEvent.change(screen.getAllByLabelText("Metaphor title")[1], {
      target: { value: "Fuse" },
    });
    fireEvent.change(screen.getAllByLabelText("Metaphor explanation")[1], {
      target: {
        value: "Threshold acts like lighting a fuse that runs to completion.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove metaphor 2" }));
    fireEvent.submit(screen.getByRole("form", { name: "Note editor" }));

    expect(await screen.findByDisplayValue("Domino line")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        "Crossing threshold is like tipping the first domino and committing the whole chain.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Fuse")).not.toBeInTheDocument();
  });

  it("manages note acronyms inside the note workflow", async () => {
    renderRoute("/notes", {
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Order of operations" },
    });
    fireEvent.change(screen.getByLabelText("Body"), {
      target: {
        value: "Acronyms help preserve the order of arithmetic steps.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add acronym" }));

    expect(screen.getAllByLabelText("Acronym editor")).toHaveLength(1);

    fireEvent.change(screen.getAllByLabelText("Acronym")[0], {
      target: { value: "PEMDAS" },
    });
    fireEvent.change(screen.getAllByLabelText("Acronym expansion")[0], {
      target: {
        value:
          "Parentheses, Exponents, Multiplication, Division, Addition, Subtraction.",
      },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Note editor" }));

    expect(await screen.findByDisplayValue("PEMDAS")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        "Parentheses, Exponents, Multiplication, Division, Addition, Subtraction.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add acronym" }));

    expect(screen.getAllByLabelText("Acronym editor")).toHaveLength(2);

    fireEvent.change(screen.getAllByLabelText("Acronym expansion")[0], {
      target: {
        value:
          "Parentheses, Exponents, Multiplication, Division, Addition, Subtraction",
      },
    });
    fireEvent.change(screen.getAllByLabelText("Acronym")[1], {
      target: { value: "BODMAS" },
    });
    fireEvent.change(screen.getAllByLabelText("Acronym expansion")[1], {
      target: {
        value:
          "Brackets, Orders, Division, Multiplication, Addition, Subtraction",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove acronym 2" }));
    fireEvent.submit(screen.getByRole("form", { name: "Note editor" }));

    expect(await screen.findByDisplayValue("PEMDAS")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        "Parentheses, Exponents, Multiplication, Division, Addition, Subtraction",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByDisplayValue("BODMAS")).not.toBeInTheDocument();
  });

  it("manages labels and rejects cycle-causing parent relationships", async () => {
    const sessionContext = createAppSessionContext({
      keyPrefix: `test-auth-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    await sessionContext.register({
      displayName: "Casey Learner",
      email: "casey@example.com",
      password: "correct horse battery staple",
    });

    renderRoute("/labels", { sessionContext });

    expect(
      await screen.findByRole("heading", { name: "Manage your label graph" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("New label name"), {
      target: { value: "Science" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Create label form" }));

    expect(await screen.findByDisplayValue("Science")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("New label name"), {
      target: { value: "Biology" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Create label form" }));

    const biologySection = (
      await screen.findByRole("heading", {
        name: "Biology",
      })
    ).closest("article");

    if (biologySection === null) {
      throw new Error("Biology card not found.");
    }

    const scienceOption = within(biologySection).getByRole("option", {
      name: "Science",
    }) as HTMLOptionElement;

    fireEvent.change(
      within(biologySection).getByLabelText("Add parent label"),
      {
        target: { value: scienceOption.value },
      },
    );
    fireEvent.submit(
      within(biologySection).getByRole("form", {
        name: "Add parent for Biology",
      }),
    );

    expect(within(biologySection).getByText("Science")).toBeInTheDocument();

    const scienceSection = (
      await screen.findByRole("heading", {
        name: "Science",
      })
    ).closest("article");

    if (scienceSection === null) {
      throw new Error("Science card not found.");
    }

    const biologyOption = within(scienceSection).getByRole("option", {
      name: "Biology",
    }) as HTMLOptionElement;

    fireEvent.change(
      within(scienceSection).getByLabelText("Add parent label"),
      {
        target: { value: biologyOption.value },
      },
    );
    fireEvent.submit(
      within(scienceSection).getByRole("form", {
        name: "Add parent for Science",
      }),
    );

    expect(
      await screen.findByRole("alert", {
        name: "Label management feedback",
      }),
    ).toHaveTextContent("create a cycle");

    fireEvent.change(within(scienceSection).getByLabelText("Label name"), {
      target: { value: "Natural Science" },
    });
    fireEvent.submit(
      within(scienceSection).getByRole("form", {
        name: "Rename Science",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Natural Science" }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(biologySection).getByRole("button", { name: "Delete Biology" }),
    );

    expect(
      screen.queryByRole("heading", { name: "Biology" }),
    ).not.toBeInTheDocument();
  });

  it("renders /recall as an empty results workspace with a start action", async () => {
    const { labelsContext, notesContext } = createLearningLoopTestContexts();
    const userId = "user-placeholder";

    notesContext.createNote(userId, {
      acronyms: [],
      body: "Retrieval practice compounds through repeated effort.",
      labelIds: [],
      metaphors: [],
      title: "Retrieval practice",
    });

    const { router } = renderRoute("/recall", {
      labelsContext,
      notesContext,
    });

    expect(
      await screen.findByRole("heading", { level: 3, name: "Results" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
    expect(screen.getByRole("link", { name: "Start Recall" })).toHaveAttribute(
      "href",
      "/recall/select",
    );
    expect(
      screen.getByRole("heading", { level: 4, name: "No results yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Complete a recall session to build reviewable results.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps no-note users on /recall with note-creation guidance", async () => {
    const { router } = renderRoute("/recall");

    expect(
      await screen.findByRole("heading", { level: 3, name: "Results" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
    expect(
      screen.getByRole("heading", {
        level: 4,
        name: "No recallable notes yet",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Create notes first, then come back to start recall and build results.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Notes" })).toHaveAttribute(
      "href",
      "/notes",
    );
  });

  it("runs dedicated recall selection mode from /recall/select without opening the note editor", async () => {
    const { labelsContext, notesContext, recallContext } =
      createLearningLoopTestContexts({
        shuffleNotes: (sessionNotes) => [...sessionNotes],
      });
    const userId = "user-placeholder";
    const titleNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "The title carries this selection cue.",
      labelIds: [],
      metaphors: [],
      title: "Encoding specificity",
    });
    const bodyNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "A distinctive body cue should be searchable for recall.",
      labelIds: [],
      metaphors: [],
      title: "Retrieval cues",
    });
    const metaphorNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "Visual aids support concept recall.",
      labelIds: [],
      metaphors: [
        {
          explanation: "The lighthouse beam points back to the safe harbor.",
          title: "Lighthouse harbor",
        },
      ],
      title: "Context reinstatement",
    });
    const acronymNote = notesContext.createNote(userId, {
      acronyms: [
        {
          expansion: "Plan Organize Monitor Evaluate",
          shortForm: "POME",
        },
      ],
      body: "Acronyms can carry a recall selection cue.",
      labelIds: [],
      metaphors: [],
      title: "Metacognition",
    });

    const { router } = renderRoute("/recall/select", {
      labelsContext,
      notesContext,
      recallContext,
    });

    expect(
      await screen.findByRole("heading", { level: 3, name: "Select Notes" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall/select");
    expect(screen.queryByRole("form", { name: "Note editor" })).toBeNull();
    let recallControls = within(
      screen.getByLabelText("Recall selection controls"),
    );
    expect(recallControls.getByText("0 notes selected")).toBeInTheDocument();
    expect(
      recallControls.getByRole("button", { name: "Start recall" }),
    ).toBeDisabled();

    const searchInput = screen.getByLabelText("Search notes");
    const searchResults = () =>
      within(screen.getByRole("listbox", { name: "Recall selection matches" }));

    fireEvent.change(searchInput, {
      target: { value: "encoding specificity" },
    });
    fireEvent.click(
      searchResults().getByRole("option", {
        name: /Encoding specificity Title/,
      }),
    );
    expect(recallControls.getByText("1 note selected")).toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: { value: "distinctive body cue" },
    });
    fireEvent.click(
      searchResults().getByRole("option", {
        name: /Retrieval cues Body/,
      }),
    );
    expect(recallControls.getByText("2 notes selected")).toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: { value: "safe harbor" },
    });
    fireEvent.click(
      searchResults().getByRole("option", {
        name: /Context reinstatement Metaphor/,
      }),
    );
    expect(recallControls.getByText("3 notes selected")).toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: { value: "plan organize monitor" },
    });
    fireEvent.click(
      searchResults().getByRole("option", {
        name: /Metacognition Acronym/,
      }),
    );
    expect(recallControls.getByText("4 notes selected")).toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: { value: "lighthouse harbor" },
    });
    fireEvent.click(
      searchResults().getByRole("option", {
        name: /Context reinstatement Metaphor/,
      }),
    );
    expect(recallControls.getByText("3 notes selected")).toBeInTheDocument();

    fireEvent.click(recallControls.getByRole("button", { name: "Cancel" }));

    expect(
      await screen.findByRole("heading", { level: 3, name: "Results" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");

    fireEvent.click(screen.getByRole("link", { name: "Start Recall" }));

    expect(
      await screen.findByRole("heading", { level: 3, name: "Select Notes" }),
    ).toBeInTheDocument();
    recallControls = within(screen.getByLabelText("Recall selection controls"));
    expect(recallControls.getByText("0 notes selected")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search notes"), {
      target: { value: "encoding specificity" },
    });
    fireEvent.click(
      searchResults().getByRole("option", {
        name: /Encoding specificity Title/,
      }),
    );
    fireEvent.change(screen.getByLabelText("Search notes"), {
      target: { value: "plan organize monitor" },
    });
    fireEvent.click(
      searchResults().getByRole("option", {
        name: /Metacognition Acronym/,
      }),
    );

    fireEvent.click(
      recallControls.getByRole("button", { name: "Start recall" }),
    );

    expect(router.state.location.pathname).toBe("/recall/session");
    expect(
      await screen.findByRole("heading", { name: "FlashCard session" }),
    ).toBeInTheDocument();
    expect(recallContext.getSnapshot()).toMatchObject({
      mode: "FlashCard",
      notes: [
        { id: titleNote.id, title: "Encoding specificity" },
        { id: acronymNote.id, title: "Metacognition" },
      ],
      questions: [{ noteId: titleNote.id }, { noteId: acronymNote.id }],
    });
    expect(recallContext.getSnapshot()?.notes).not.toEqual(
      expect.arrayContaining([{ id: bodyNote.id }, { id: metaphorNote.id }]),
    );
  });

  it("shows a structural Recall / Session breadcrumb for an active recall session", async () => {
    const { labelsContext, notesContext, recallContext } =
      createLearningLoopTestContexts({
        shuffleNotes: (sessionNotes) => [...sessionNotes],
      });
    const userId = "user-jordan";
    const note = notesContext.createNote(userId, {
      acronyms: [],
      body: "Session progress should stay out of the breadcrumb.",
      labelIds: [],
      metaphors: [],
      title: "Recall session route",
    });

    recallContext.startFlashCardSession({
      noteIds: [note.id],
      userId,
    });

    renderRoute("/recall/session", {
      labelsContext,
      notesContext,
      recallContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "FlashCard session" }),
    ).toBeInTheDocument();

    const breadcrumb = screen.getByRole("navigation", {
      name: "Workspace breadcrumb",
    });

    expect(
      within(breadcrumb).getByRole("link", { name: "Recall" }),
    ).toHaveAttribute("href", "/recall");
    expect(within(breadcrumb).getByText("Session")).toBeInTheDocument();
    expect(
      within(breadcrumb).queryByText("Completed 0 of 1 questions"),
    ).toBeNull();
    expect(screen.getByText("Completed 0 of 1 questions")).toBeInTheDocument();
  });

  it("redirects direct recall session visits without an active session back to recall", async () => {
    const { router } = renderRoute("/recall/session");

    expect(
      await screen.findByRole("heading", { level: 3, name: "Results" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
    expect(
      screen.queryByRole("heading", { name: "FlashCard session" }),
    ).toBeNull();
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
      await screen.findByRole("heading", { name: "FlashCard session" }),
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

  it("returns completed recall sessions to /recall and opens the new result", async () => {
    const { labelsContext, notesContext, recallContext } =
      createDeterministicRecallTestContexts();
    const userId = "user-placeholder";
    const science = labelsContext.createLabel({
      name: "Science",
      userId,
    });
    const note = createRecallNote(notesContext, userId, {
      body: "Completed sessions should return to Recall recent results.",
      labelIds: [science.id],
      title: "Spacing effect",
    });

    const { router } = await renderRecallSelection({
      labelsContext,
      notesContext,
      recallContext,
    });

    selectRecallableNote(
      "Spacing effect",
      "Completed sessions should return to Recall recent results.",
    );
    await startSelectedRecallSession();

    expect(router.state.location.pathname).toBe("/recall/session");

    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Nailed it" }));

    await expectReturnedToRecall(router);
    const selectedResult = getSelectedSessionResultRegion();
    const questionReview = within(selectedResult).getByRole("region", {
      name: "Question review",
    });
    expect(
      within(selectedResult).getByText("1 attempted question"),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getByText("Nailed 1 · Partial 0 · Missed 0"),
    ).toBeInTheDocument();
    expect(
      within(questionReview).getByRole("heading", {
        name: "Spacing effect",
      }),
    ).toBeInTheDocument();
    expect(recallContext.listSessionResults({ userId })).toMatchObject([
      {
        attempts: [{ noteId: note.id, rating: "nailed" }],
        notes: [{ id: note.id, title: "Spacing effect" }],
      },
    ]);
  });

  it("returns completed recall sessions to the newest selected result when older results already exist", async () => {
    vi.useFakeTimers();

    const { labelsContext, notesContext, recallContext } =
      createLearningLoopTestContexts({
        shuffleNotes: (sessionNotes) => [...sessionNotes],
      });
    const userId = "user-placeholder";
    const olderNote = createRecallNote(notesContext, userId, {
      body: "Older result should not stay selected after a new completion.",
      title: "Older spacing note",
    });
    const newerExistingNote = createRecallNote(notesContext, userId, {
      body: "Existing newest result should be replaced by the just-finished one.",
      title: "Existing newest note",
    });
    createRecallNote(notesContext, userId, {
      body: "Fresh completion should be selected on return to Recall.",
      title: "Returned newest note",
    });

    for (const [timestamp, noteId, rating] of [
      ["2026-04-01T09:00:00.000Z", olderNote.id, "missed"],
      ["2026-04-02T09:00:00.000Z", newerExistingNote.id, "partial"],
    ] as const) {
      completeRecallSessionAt({
        noteId,
        rating,
        recallContext,
        timestamp,
        userId,
      });
    }

    vi.setSystemTime(new Date("2026-04-03T09:00:00.000Z"));
    vi.useRealTimers();

    const { router } = renderRoute("/recall", {
      labelsContext,
      notesContext,
      recallContext,
    });

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Results",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Review session" })[1],
    );

    const selectedOlderResult = getSelectedSessionResultRegion();
    const olderQuestionReview = within(selectedOlderResult).getByRole(
      "region",
      {
        name: "Question review",
      },
    );
    expect(
      within(olderQuestionReview).getByRole("heading", {
        name: "Older spacing note",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Start Recall" }));
    expect(
      await screen.findByRole("heading", { level: 3, name: "Select Notes" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall/select");

    selectRecallableNote(
      "Returned newest note",
      "Fresh completion should be selected on return to Recall.",
    );
    await startSelectedRecallSession();

    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Nailed it" }));

    await expectReturnedToRecall(router);
    const selectedReturnedResult = getSelectedSessionResultRegion();
    const returnedQuestionReview = within(selectedReturnedResult).getByRole(
      "region",
      {
        name: "Question review",
      },
    );
    expect(
      within(returnedQuestionReview).getByRole("heading", {
        name: "Returned newest note",
      }),
    ).toBeInTheDocument();
    expect(
      within(selectedReturnedResult).queryByText("Older spacing note"),
    ).toBeNull();
  });

  it("selects the newest result when a fresh SessionResult is added after an older result was selected", async () => {
    vi.useFakeTimers();

    const { labelsContext, notesContext, recallContext } =
      createLearningLoopTestContexts({
        shuffleNotes: (sessionNotes) => [...sessionNotes],
      });
    const userId = "user-placeholder";
    const olderNote = createRecallNote(notesContext, userId, {
      body: "Older result starts selected after manual switch.",
      title: "Earlier note",
    });
    const newerExistingNote = createRecallNote(notesContext, userId, {
      body: "This is the existing newest result before the fresh completion.",
      title: "Current newest note",
    });
    const freshNote = createRecallNote(notesContext, userId, {
      body: "Fresh result should take selection when it lands at the top.",
      title: "Fresh result note",
    });

    for (const [timestamp, noteId, rating] of [
      ["2026-04-01T09:00:00.000Z", olderNote.id, "missed"],
      ["2026-04-02T09:00:00.000Z", newerExistingNote.id, "partial"],
    ] as const) {
      completeRecallSessionAt({
        noteId,
        rating,
        recallContext,
        timestamp,
        userId,
      });
    }

    vi.useRealTimers();

    renderRoute("/recall", {
      labelsContext,
      notesContext,
      recallContext,
    });

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Results",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Review session" })[1],
    );

    const selectedOlderResult = getSelectedSessionResultRegion();
    expect(
      within(
        within(selectedOlderResult).getByRole("region", {
          name: "Question review",
        }),
      ).getByRole("heading", {
        name: "Earlier note",
      }),
    ).toBeInTheDocument();

    const session = recallContext.startFlashCardSession({
      noteIds: [freshNote.id],
      userId,
    });
    recallContext.revealFlashCardAnswer({
      sessionId: session.id,
      userId,
    });
    recallContext.rateFlashCardAnswer({
      rating: "nailed",
      sessionId: session.id,
      userId,
    });

    const selectedFreshResult = getSelectedSessionResultRegion();
    expect(
      await within(
        within(selectedFreshResult).getByRole("region", {
          name: "Question review",
        }),
      ).findByRole("heading", {
        name: "Fresh result note",
      }),
    ).toBeInTheDocument();
    expect(within(selectedFreshResult).queryByText("Earlier note")).toBeNull();
  });

  it("returns attempted early-ended recall sessions to /recall and opens the new result", async () => {
    const { labelsContext, notesContext, recallContext } =
      createDeterministicRecallTestContexts();
    const userId = "user-placeholder";
    const firstNote = createRecallNote(notesContext, userId, {
      body: "Attempted sessions should persist when ended early.",
      title: "Retrieval strength",
    });
    createRecallNote(notesContext, userId, {
      body: "A second prompt keeps the session active after one rating.",
      title: "Desirable difficulty",
    });

    const { router } = await renderRecallSelection({
      labelsContext,
      notesContext,
      recallContext,
    });

    selectRecallableNote(
      "Retrieval strength",
      "Attempted sessions should persist when ended early.",
    );
    selectRecallableNote(
      "Desirable difficulty",
      "A second prompt keeps the session active after one rating.",
    );
    await startSelectedRecallSession();

    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Partly recalled" }));
    fireEvent.click(screen.getByRole("button", { name: "End session" }));

    await expectReturnedToRecall(router);
    const selectedResult = getSelectedSessionResultRegion();
    const questionReview = within(selectedResult).getByRole("region", {
      name: "Question review",
    });
    expect(
      within(selectedResult).getByText("1 attempted question"),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getByText("Nailed 0 · Partial 1 · Missed 0"),
    ).toBeInTheDocument();
    expect(
      within(questionReview).getByRole("heading", {
        name: "Retrieval strength",
      }),
    ).toBeInTheDocument();
    expect(recallContext.listSessionResults({ userId })).toMatchObject([
      {
        attempts: [{ noteId: firstNote.id, rating: "partial" }],
        notes: [
          { title: "Retrieval strength" },
          { title: "Desirable difficulty" },
        ],
      },
    ]);
  });

  it("returns zero-attempt recall sessions to /recall without creating a recent result", async () => {
    const { labelsContext, notesContext, recallContext } =
      createDeterministicRecallTestContexts();
    const userId = "user-placeholder";

    createRecallNote(notesContext, userId, {
      body: "Zero-attempt sessions should keep discard behavior.",
      title: "Testing cue",
    });

    const { router } = await renderRecallSelection({
      labelsContext,
      notesContext,
      recallContext,
    });

    selectRecallableNote(
      "Testing cue",
      "Zero-attempt sessions should keep discard behavior.",
    );
    await startSelectedRecallSession();

    fireEvent.click(screen.getByRole("button", { name: "End session" }));

    await expectReturnedToRecall(router);
    expect(screen.getByText("No results yet")).toBeInTheDocument();
    expect(recallContext.listSessionResults({ userId })).toHaveLength(0);
  });

  it("shows a true empty results state with a recall CTA", async () => {
    const { labelsContext, notesContext } = createLearningLoopTestContexts();
    const userId = "user-placeholder";

    createRecallNote(notesContext, userId, {
      body: "A note exists, but recall results do not.",
      title: "Fresh note",
    });

    renderRoute("/recall", {
      labelsContext,
      notesContext,
    });

    expect(
      await screen.findByRole("heading", { name: "No results yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Complete a recall session to build reviewable results.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start Recall" })).toHaveAttribute(
      "href",
      "/recall/select",
    );
    expect(
      screen.queryByText(
        "No session results yet. Complete at least one attempted recall session to build history.",
      ),
    ).toBeNull();
  });

  it("shows /recall as the canonical results workspace with newest result selected by default", async () => {
    vi.useFakeTimers();

    const { labelsContext, notesContext, recallContext } =
      createLearningLoopTestContexts({
        shuffleNotes: (sessionNotes) => [...sessionNotes],
      });
    const userId = "user-placeholder";
    const science = labelsContext.createLabel({
      name: "Science",
      userId,
    });
    const firstNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "Stored snapshots should stay inside full results review.",
      labelIds: [science.id],
      metaphors: [],
      title: "Testing effect",
    });
    const secondNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "Newest results should open directly in the detail pane.",
      labelIds: [science.id],
      metaphors: [],
      title: "Spacing effect",
    });

    for (const [timestamp, noteId, rating] of [
      ["2026-04-01T09:00:00.000Z", firstNote.id, "nailed"],
      ["2026-04-02T09:00:00.000Z", secondNote.id, "partial"],
    ] as const) {
      vi.setSystemTime(new Date(timestamp));
      const session = recallContext.startFlashCardSession({
        noteIds: [noteId],
        userId,
      });

      recallContext.revealFlashCardAnswer({
        sessionId: session.id,
        userId,
      });
      recallContext.rateFlashCardAnswer({
        rating,
        sessionId: session.id,
        userId,
      });
    }

    vi.useRealTimers();

    renderRoute("/recall", {
      labelsContext,
      notesContext,
      recallContext,
    });

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Results",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start Recall" })).toHaveAttribute(
      "href",
      "/recall/select",
    );

    const resultsList = screen.getByRole("region", {
      name: "Session results list",
    });
    const selectedResult = screen.getByRole("region", {
      name: "Selected session result",
    });

    const sessionButtons = within(resultsList).getAllByRole("button", {
      name: "Review session",
    });

    expect(sessionButtons).toHaveLength(2);
    expect(sessionButtons[0]).toHaveAttribute("aria-pressed", "true");
    expect(sessionButtons[1]).toHaveAttribute("aria-pressed", "false");
    const questionReview = within(selectedResult).getByRole("region", {
      name: "Question review",
    });
    expect(
      within(questionReview).getByRole("heading", {
        name: "Spacing effect",
      }),
    ).toBeInTheDocument();
    expect(
      within(questionReview).getByText(
        "Newest results should open directly in the detail pane.",
      ),
    ).toBeInTheDocument();
    expect(
      within(questionReview).getByText("Rating: Partly recalled"),
    ).toBeInTheDocument();
    expect(within(selectedResult).queryByText("Testing effect")).toBeNull();
  });

  it("shows persisted session results with stored note snapshots", async () => {
    const { labelsContext, notesContext, recallContext } =
      createDeterministicRecallTestContexts();
    const userId = "user-placeholder";
    const science = labelsContext.createLabel({
      name: "Alpha Science",
      userId,
    });
    const note = notesContext.createNote(userId, {
      acronyms: [],
      body: "Original study snapshot",
      labelIds: [science.id],
      metaphors: [],
      title: "Original prompt",
    });

    const session = recallContext.startFlashCardSession({
      noteIds: [note.id],
      userId,
    });

    recallContext.revealFlashCardAnswer({
      sessionId: session.id,
      userId,
    });
    recallContext.rateFlashCardAnswer({
      rating: "nailed",
      sessionId: session.id,
      userId,
    });

    notesContext.updateNote(userId, note.id, {
      acronyms: [],
      body: "Edited live note",
      labelIds: [science.id],
      metaphors: [],
      title: "Edited live prompt",
    });

    cleanup();

    renderRoute("/recall", {
      labelsContext,
      notesContext,
      recallContext,
    });

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Results",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Review session" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("1 attempted question")).toHaveLength(2);
    expect(
      within(getSelectedSessionResultRegion()).getByText(
        "Nailed 1 · Partial 0 · Missed 0",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Review session" }));

    const selectedResult = getSelectedSessionResultRegion();
    const questionReview = within(selectedResult).getByRole("region", {
      name: "Question review",
    });
    expect(
      within(questionReview).getByRole("heading", {
        name: "Original prompt",
      }),
    ).toBeInTheDocument();
    expect(
      within(questionReview).getByText("Original study snapshot"),
    ).toBeInTheDocument();
    expect(
      within(questionReview).getByText("Rating: Nailed it"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Edited live note")).toBeNull();
  });

  it("shows read-only selected SessionResult details with stored note snapshot summaries", async () => {
    const { labelsContext, notesContext, recallContext } =
      createDeterministicRecallTestContexts();
    const userId = "user-placeholder";
    const science = labelsContext.createLabel({
      name: "Alpha Science",
      userId,
    });
    const promptedNote = notesContext.createNote(userId, {
      acronyms: [{ expansion: "Long term potentiation", shortForm: "LTP" }],
      body: "Original study snapshot",
      labelIds: [science.id],
      metaphors: [
        {
          explanation: "Neurons that wire together stay together.",
          title: "Wiring path",
        },
      ],
      title: "Original prompt",
    });
    const unattemptedNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "Stored but not attempted in this session",
      labelIds: [],
      metaphors: [],
      title: "Second stored prompt",
    });

    const session = recallContext.startFlashCardSession({
      noteIds: [promptedNote.id, unattemptedNote.id],
      userId,
    });

    recallContext.revealFlashCardAnswer({
      sessionId: session.id,
      userId,
    });
    recallContext.rateFlashCardAnswer({
      rating: "nailed",
      sessionId: session.id,
      userId,
    });
    recallContext.endFlashCardSession({
      sessionId: session.id,
      userId,
    });

    notesContext.updateNote(userId, promptedNote.id, {
      acronyms: [{ expansion: "Live edited acronym", shortForm: "LEA" }],
      body: "Edited live note",
      labelIds: [science.id],
      metaphors: [],
      title: "Edited live prompt",
    });

    renderRoute("/recall", {
      labelsContext,
      notesContext,
      recallContext,
    });

    const selectedResult = await screen.findByRole("region", {
      name: "Selected session result",
    });

    expect(
      within(selectedResult).getByRole("heading", {
        level: 4,
        name: "Session details",
      }),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getByText("Mode: FlashCard"),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getByText("1 attempted question"),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getByText("2 questions in session"),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getByText("Nailed 1 · Partial 0 · Missed 0"),
    ).toBeInTheDocument();

    expect(
      within(selectedResult).getByRole("heading", {
        level: 4,
        name: "Question review",
      }),
    ).toBeInTheDocument();
    expect(
      within(selectedResult).getByRole("heading", {
        level: 4,
        name: "Stored note snapshots",
      }),
    ).toBeInTheDocument();
    const snapshotSummary = within(selectedResult).getByRole("region", {
      name: "Stored note snapshots",
    });
    expect(
      within(snapshotSummary).getByText("Original study snapshot"),
    ).toBeInTheDocument();
    expect(
      within(snapshotSummary).getByText(
        "Stored but not attempted in this session",
      ),
    ).toBeInTheDocument();
    expect(
      within(snapshotSummary).getByText(
        /1 acronym\s+·\s+1 metaphor\s+·\s+1 label/,
      ),
    ).toBeInTheDocument();
    expect(within(selectedResult).queryByText("Edited live note")).toBeNull();
    expect(
      within(selectedResult).queryByRole("button", { name: /edit/i }),
    ).toBeNull();
    expect(
      within(selectedResult).queryByRole("button", { name: /delete/i }),
    ).toBeNull();
  });

  it("switches the selected result without changing the route", async () => {
    vi.useFakeTimers();

    let sessionCounter = 0;
    const { labelsContext, notesContext, recallContext } =
      createLearningLoopTestContexts({
        crypto: {
          randomUUID: () =>
            `session-by-note-ui-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
        },
        shuffleNotes: (sessionNotes) => [...sessionNotes],
      });
    const userId = "user-placeholder";
    const science = labelsContext.createLabel({
      name: "Alpha Science",
      userId,
    });
    const neuralNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "Neural pathways original snapshot",
      labelIds: [science.id],
      metaphors: [],
      title: "Neural pathways",
    });
    const retrievalNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "Retrieval practice snapshot",
      labelIds: [],
      metaphors: [],
      title: "Retrieval practice",
    });

    for (const [timestamp, noteId, rating] of [
      ["2026-04-01T09:00:00.000Z", neuralNote.id, "missed"],
      ["2026-04-02T09:00:00.000Z", retrievalNote.id, "partial"],
    ] as const) {
      vi.setSystemTime(new Date(timestamp));
      const session = recallContext.startFlashCardSession({
        noteIds: [noteId],
        userId,
      });
      recallContext.revealFlashCardAnswer({ sessionId: session.id, userId });
      recallContext.rateFlashCardAnswer({
        rating,
        sessionId: session.id,
        userId,
      });
    }

    vi.useRealTimers();

    const { router } = renderRoute("/recall", {
      labelsContext,
      notesContext,
      recallContext,
    });

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Results",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Review session" }).length,
    ).toBeGreaterThan(0);

    fireEvent.click(
      screen.getAllByRole("button", { name: "Review session" })[1],
    );

    const resultsPane = screen.getByRole("region", {
      name: "Selected session result",
    });
    const questionReview = within(resultsPane).getByRole("region", {
      name: "Question review",
    });

    expect(
      within(questionReview).getByRole("heading", {
        name: "Neural pathways",
      }),
    ).toBeInTheDocument();
    expect(
      within(questionReview).getByText("Neural pathways original snapshot"),
    ).toBeInTheDocument();
    expect(
      within(questionReview).getByText("Rating: Missed it"),
    ).toBeInTheDocument();
    expect(
      within(resultsPane).queryByText("Retrieval practice snapshot"),
    ).toBeNull();
    expect(router.state.location.pathname).toBe("/recall");
  });

  it("keeps secondary label filtering on recall results", async () => {
    vi.useFakeTimers();

    let sessionCounter = 0;
    const { labelsContext, notesContext, recallContext } =
      createLearningLoopTestContexts({
        crypto: {
          randomUUID: () =>
            `session-label-filter-ui-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
        },
        shuffleNotes: (sessionNotes) => [...sessionNotes],
      });
    const userId = "user-placeholder";
    const science = labelsContext.createLabel({
      name: "Science",
      userId,
    });
    const history = labelsContext.createLabel({
      name: "History",
      userId,
    });
    const unmatched = labelsContext.createLabel({
      name: "Unmatched",
      userId,
    });
    const scienceNote = createRecallNote(notesContext, userId, {
      body: "Science snapshot",
      labelIds: [science.id],
      title: "Science result",
    });
    const historyNote = createRecallNote(notesContext, userId, {
      body: "History snapshot",
      labelIds: [history.id],
      title: "History result",
    });

    for (const [timestamp, noteId] of [
      ["2026-04-01T09:00:00.000Z", scienceNote.id],
      ["2026-04-02T09:00:00.000Z", historyNote.id],
    ] as const) {
      createCompletedRecallSession(recallContext, {
        noteId,
        rating: "partial",
        timestamp,
        userId,
      });
    }

    vi.useRealTimers();

    renderRoute("/recall", {
      labelsContext,
      notesContext,
      recallContext,
    });

    expect(
      await screen.findByRole("heading", { level: 3, name: "Results" }),
    ).toBeInTheDocument();

    const resultsList = screen.getByRole("region", {
      name: "Session results list",
    });
    const labelFilter = screen.getByLabelText("Filter results by label");

    function getQuestionReview() {
      return within(
        screen.getByRole("region", {
          name: "Selected session result",
        }),
      ).getByRole("region", {
        name: "Question review",
      });
    }

    expect(
      within(resultsList).getAllByRole("button", { name: "Review session" }),
    ).toHaveLength(2);
    expect(
      within(getQuestionReview()).getByText("History result"),
    ).toBeInTheDocument();

    fireEvent.change(labelFilter, {
      target: { value: science.id },
    });

    expect(
      within(resultsList).getAllByRole("button", { name: "Review session" }),
    ).toHaveLength(1);
    expect(
      within(getQuestionReview()).getByText("Science result"),
    ).toBeInTheDocument();

    fireEvent.change(labelFilter, {
      target: { value: unmatched.id },
    });

    expect(
      within(resultsList).getByText("No results match this label yet."),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("region", {
          name: "Selected session result",
        }),
      ).getByText(
        "Complete a recall session to review stored note snapshots and question ratings.",
      ),
    ).toBeInTheDocument();

    fireEvent.change(labelFilter, {
      target: { value: "" },
    });

    const restoredButtons = within(resultsList).getAllByRole("button", {
      name: "Review session",
    });
    expect(restoredButtons).toHaveLength(2);
    expect(restoredButtons[0]).toHaveAttribute("aria-pressed", "true");
    expect(
      within(getQuestionReview()).getByText("History result"),
    ).toBeInTheDocument();
  });
});
