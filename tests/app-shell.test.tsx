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
  type AppLabelsContext,
  createAppLabelsContext,
} from "../src/features/labels/labels";
import {
  type AppNotesContext,
  createAppNotesContext,
  listNotesForUser,
} from "../src/features/notes/notes";
import {
  type AppRecallContext,
  createAppRecallContext,
} from "../src/features/recall/recall";
import {
  type AppSessionContext,
  type AppSessionSnapshot,
  createAppSessionContext,
} from "../src/features/session/session";
import { routeTree } from "../src/routeTree.gen";

function renderRoute(
  initialPath: string,
  options: {
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
  const recallContext =
    options.recallContext ??
    createAppRecallContext({
      keyPrefix: `test-recall-${Math.random().toString(36).slice(2)}`,
      notes: notesContext,
      storage: window.localStorage,
    });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [initialPath],
    }),
    context: {
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
    Pick<Parameters<typeof createAppRecallContext>[0], "shuffleNotes">
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
  const recallContext = createAppRecallContext({
    keyPrefix: `test-recall-${Math.random().toString(36).slice(2)}`,
    notes: notesContext,
    storage: window.localStorage,
    ...recallOptions,
  });

  return {
    labelsContext,
    notesContext,
    recallContext,
  };
}

type AppShellRouter = ReturnType<typeof renderRoute>["router"];
type LearningLoopTestContexts = ReturnType<
  typeof createLearningLoopTestContexts
>;

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

async function renderRecallSelection(contexts: LearningLoopTestContexts) {
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
    await screen.findByRole("heading", { level: 3, name: "Recall" }),
  ).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/recall");
}

function openAccountMenu() {
  fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
}

beforeAll(() => {
  window.scrollTo = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
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

    const { router } = renderRoute("/login?redirect=%2Frecall%2Fresults", {
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
    expect(router.state.location.pathname).toBe("/recall/results");
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

    const mobileToggle = screen.getByRole("button", {
      name: "Open navigation menu",
    });

    expect(mobileToggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(mobileToggle);

    expect(mobileToggle).toHaveAttribute("aria-expanded", "true");
    expect(sidebar).toHaveAttribute("data-mobile-open", "true");

    fireEvent.click(
      screen.getByRole("button", { name: "Close navigation menu" }),
    );

    expect(mobileToggle).toHaveAttribute("aria-expanded", "false");
    expect(sidebar).toHaveAttribute("data-mobile-open", "false");
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

    expect(within(appSections).getAllByRole("link")).toEqual([
      notesLink,
      labelsLink,
      recallLink,
    ]);
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
      await screen.findByRole("heading", { level: 3, name: "Recall" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
    expect(recallLink).toHaveAttribute("aria-current", "page");
    expect(labelsLink).not.toHaveAttribute("aria-current");
  });

  it("supports skip navigation and manages focus when the mobile menu opens and closes", async () => {
    renderRoute("/notes");

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    const skipLink = screen.getByRole("link", { name: "Skip to main content" });
    const main = screen.getByRole("main");

    expect(skipLink).toHaveAttribute("href", "#main-content");
    expect(main).toHaveAttribute("id", "main-content");

    const mobileToggle = screen.getByRole("button", {
      name: "Open navigation menu",
    });

    mobileToggle.focus();
    expect(mobileToggle).toHaveFocus();

    fireEvent.click(mobileToggle);

    const sidebar = await screen.findByRole("complementary", {
      name: "Notes workspace",
    });

    expect(sidebar).toHaveFocus();

    fireEvent.click(
      screen.getByRole("button", { name: "Close navigation menu" }),
    );

    expect(mobileToggle).toHaveFocus();
  });

  it("uses the notes sidebar as a mobile drawer and returns focus to the editor after note selection", async () => {
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

    const mobileToggle = screen.getByRole("button", {
      name: "Open navigation menu",
    });
    const sidebar = screen.getByRole("complementary", {
      name: "Notes workspace",
    });

    fireEvent.click(mobileToggle);

    const notesList = within(sidebar).getByRole("navigation", {
      name: "Notes list",
    });

    expect(sidebar).toHaveAttribute("data-mobile-open", "true");
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
    expect(screen.getByLabelText("Title")).toHaveFocus();
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

    fireEvent.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );
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

  it("starts and completes a single-note FlashCard session from the notes workspace", async () => {
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
    const note = notesContext.createNote(userId, {
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

    fireEvent.click(screen.getByRole("button", { name: "Select for recall" }));
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Notes list" })).getByRole(
        "button",
        { name: "Testing effect" },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Start recall" }));

    expect(router.state.location.pathname).toBe("/notes/recall");
    expect(
      await screen.findByRole("heading", { name: "FlashCard session" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Testing effect" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Retrieval is strengthened by effortful recall."),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));

    expect(
      screen.getByText("Retrieval is strengthened by effortful recall."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Nailed it" }));

    expect(router.state.location.pathname).toBe("/notes");
    expect(
      await screen.findByDisplayValue(
        "Retrieval is strengthened by effortful recall.",
      ),
    ).toBeInTheDocument();
    expect(recallContext.listSessionResults({ userId })).toMatchObject([
      {
        attempts: [{ noteId: note.id, rating: "nailed" }],
        labelId: null,
        notes: [{ id: note.id, title: "Testing effect" }],
      },
    ]);
  });

  it("guards starting a RecallSession when the selected Note has unsaved edits", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Select for recall" }));
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Notes list" })).getByRole(
        "button",
        { name: "Guarded recall start" },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Start recall" }));

    const dialog = screen.getByRole("dialog", {
      name: "Discard unsaved changes?",
    });

    expect(router.state.location.pathname).toBe("/notes");
    expect(recallContext.getSnapshot()).toBeNull();
    expect(
      screen.getByDisplayValue("Unsaved recall answer."),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(
      screen.queryByRole("dialog", { name: "Discard unsaved changes?" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start recall" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Start recall" }));
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "Discard unsaved changes?" }),
      ).getByRole("button", { name: "Discard changes" }),
    );

    expect(router.state.location.pathname).toBe("/notes/recall");
    expect(
      await screen.findByRole("heading", { name: "FlashCard session" }),
    ).toBeInTheDocument();
    expect(recallContext.getSnapshot()).toMatchObject({
      notes: [{ id: note.id, title: "Guarded recall start" }],
    });
  });

  it("completes the searched Notes recall loop while keeping recall mode and utilities clear", async () => {
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
      body: "The complete loop returns to the notes workspace.",
      labelIds: [],
      metaphors: [
        {
          explanation: "A lighthouse search cue points back to this note.",
          title: "Lighthouse cue",
        },
      ],
      title: "Recall loop polish",
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

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    const workspace = screen.getByLabelText("Notes workspace surface");

    expect(workspace).toHaveAttribute("data-recall-selection-mode", "false");
    openAccountMenu();
    const accountMenu = screen.getByRole("menu", { name: "Account options" });
    expect(
      within(accountMenu).getByRole("menuitem", { name: "Settings" }),
    ).toBeVisible();
    expect(
      within(accountMenu).getByRole("menuitem", { name: "Log out" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Select for recall" }));

    expect(workspace).toHaveAttribute("data-recall-selection-mode", "true");
    expect(screen.getByText("Selecting for recall")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start recall" })).toBeDisabled();

    fireEvent.change(screen.getByRole("combobox", { name: "Search notes" }), {
      target: { value: "lighthouse search cue" },
    });
    fireEvent.click(
      within(screen.getByLabelText("Notes search results")).getByRole(
        "option",
        { name: /Recall loop polish Metaphor/ },
      ),
    );

    expect(
      within(screen.getByLabelText("Recall selection controls")).getByText(
        "1 note selected",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start recall" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Start recall" }));

    expect(router.state.location.pathname).toBe("/notes/recall");
    expect(
      await screen.findByRole("heading", { name: "FlashCard session" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "App sections" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /account menu/i }),
    ).toBeInTheDocument();

    const breadcrumb = screen.getByRole("navigation", {
      name: "Workspace breadcrumb",
    });

    expect(within(breadcrumb).getByText("Recall")).toBeInTheDocument();
    expect(
      within(breadcrumb).queryByText("Completed 0 of 1 questions"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Completed 0 of 1 questions")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Partly recalled" }));

    expect(router.state.location.pathname).toBe("/notes");
    expect(
      await screen.findByDisplayValue(
        "The complete loop returns to the notes workspace.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Selecting for recall")).not.toBeInTheDocument();
    expect(recallContext.listSessionResults({ userId })).toMatchObject([
      {
        attempts: [{ noteId: note.id, rating: "partial" }],
        notes: [{ id: note.id, title: "Recall loop polish" }],
      },
    ]);
  });

  it("selects multiple notes for recall from the notes workspace without changing the edited note", async () => {
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

    const firstNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "Retrieval practice strengthens recall.",
      labelIds: [],
      metaphors: [],
      title: "Retrieval practice",
    });
    const secondNote = notesContext.createNote(userId, {
      acronyms: [],
      body: "Spacing practice reduces forgetting.",
      labelIds: [],
      metaphors: [],
      title: "Spacing effect",
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
      await screen.findByDisplayValue("Spacing practice reduces forgetting."),
    ).toBeInTheDocument();

    const notesList = within(
      screen.getByRole("navigation", { name: "Notes list" }),
    );

    fireEvent.click(
      notesList.getByRole("button", { name: "Retrieval practice" }),
    );

    expect(
      await screen.findByDisplayValue("Retrieval practice strengthens recall."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Select for recall" }));

    let recallControls = within(
      screen.getByLabelText("Recall selection controls"),
    );

    expect(recallControls.getByText("0 notes selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start recall" })).toBeDisabled();

    fireEvent.click(notesList.getByRole("button", { name: "Spacing effect" }));
    fireEvent.click(
      notesList.getByRole("button", { name: "Retrieval practice" }),
    );
    fireEvent.click(notesList.getByRole("button", { name: "Spacing effect" }));

    expect(recallControls.getByText("1 note selected")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Retrieval practice strengthens recall."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start recall" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Select for recall" }));

    recallControls = within(screen.getByLabelText("Recall selection controls"));

    expect(recallControls.getByText("0 notes selected")).toBeInTheDocument();

    fireEvent.click(
      notesList.getByRole("button", { name: "Retrieval practice" }),
    );
    fireEvent.click(notesList.getByRole("button", { name: "Spacing effect" }));
    fireEvent.click(screen.getByRole("button", { name: "Start recall" }));

    expect(router.state.location.pathname).toBe("/notes/recall");
    expect(
      await screen.findByRole("heading", { name: "FlashCard session" }),
    ).toBeInTheDocument();
    expect(recallContext.getSnapshot()).toMatchObject({
      labelId: null,
      notes: [
        { id: firstNote.id, title: "Retrieval practice" },
        { id: secondNote.id, title: "Spacing effect" },
      ],
    });
  });

  it("selects owning notes from recall search matches across note text and memory aids", async () => {
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

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Select for recall" }));

    const searchInput = screen.getByRole("combobox", {
      name: "Search notes",
    });
    const recallControls = within(
      screen.getByLabelText("Recall selection controls"),
    );

    fireEvent.change(searchInput, {
      target: { value: "encoding specificity" },
    });
    fireEvent.click(
      within(screen.getByLabelText("Notes search results")).getByRole(
        "option",
        { name: /Encoding specificity Title/ },
      ),
    );
    expect(recallControls.getByText("1 note selected")).toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: { value: "distinctive body cue" },
    });
    fireEvent.click(
      within(screen.getByLabelText("Notes search results")).getByRole(
        "option",
        { name: /Retrieval cues Body/ },
      ),
    );
    expect(recallControls.getByText("2 notes selected")).toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: { value: "safe harbor" },
    });
    fireEvent.click(
      within(screen.getByLabelText("Notes search results")).getByRole(
        "option",
        { name: /Context reinstatement Metaphor/ },
      ),
    );
    expect(recallControls.getByText("3 notes selected")).toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: { value: "plan organize monitor" },
    });
    fireEvent.click(
      within(screen.getByLabelText("Notes search results")).getByRole(
        "option",
        { name: /Metacognition Acronym/ },
      ),
    );
    expect(recallControls.getByText("4 notes selected")).toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: { value: "lighthouse harbor" },
    });
    fireEvent.click(
      within(screen.getByLabelText("Notes search results")).getByRole(
        "option",
        { name: /Context reinstatement Metaphor/ },
      ),
    );
    expect(recallControls.getByText("3 notes selected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start recall" }));

    expect(router.state.location.pathname).toBe("/notes/recall");
    expect(recallContext.getSnapshot()).toMatchObject({
      labelId: null,
      notes: [
        { id: titleNote.id, title: "Encoding specificity" },
        { id: bodyNote.id, title: "Retrieval cues" },
        { id: acronymNote.id, title: "Metacognition" },
      ],
    });
    expect(recallContext.getSnapshot()?.notes).not.toEqual(
      expect.arrayContaining([{ id: metaphorNote.id }]),
    );
  });

  it("shows a structural Notes / Recall breadcrumb for an active notes recall session", async () => {
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
    const note = notesContext.createNote(userId, {
      acronyms: [],
      body: "Progress belongs inside the session view.",
      labelIds: [],
      metaphors: [],
      title: "Breadcrumb recall",
    });

    recallContext.startFlashCardSession({
      noteIds: [note.id],
      userId,
    });

    renderRoute("/notes/recall", {
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
      within(breadcrumb).getByRole("link", { name: "Notes" }),
    ).toHaveAttribute("href", "/notes");
    expect(within(breadcrumb).getByText("Recall")).toBeInTheDocument();
    expect(
      within(breadcrumb).queryByText("Completed 0 of 1 questions"),
    ).toBeNull();
    expect(screen.getByText("Completed 0 of 1 questions")).toBeInTheDocument();
  });

  it("redirects direct notes recall visits without an active session back to notes", async () => {
    const { router } = renderRoute("/notes/recall", {
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
    expect(router.state.location.pathname).toBe("/notes");
    expect(
      screen.queryByRole("heading", { name: "FlashCard session" }),
    ).toBeNull();
  });

  it("returns to notes and discards a zero-attempt single-note session", async () => {
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
      storage: window.localStorage,
    });
    const userId = "user-jordan";

    notesContext.createNote(userId, {
      acronyms: [],
      body: "This session will be ended before any rating.",
      labelIds: [],
      metaphors: [],
      title: "Early exit",
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
        "This session will be ended before any rating.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Select for recall" }));
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Notes list" })).getByRole(
        "button",
        { name: "Early exit" },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Start recall" }));

    expect(router.state.location.pathname).toBe("/notes/recall");
    expect(
      await screen.findByRole("heading", { name: "FlashCard session" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "End session" }));

    expect(router.state.location.pathname).toBe("/notes");
    expect(
      await screen.findByDisplayValue(
        "This session will be ended before any rating.",
      ),
    ).toBeInTheDocument();
    expect(recallContext.listSessionResults({ userId })).toHaveLength(0);
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

  it("renders recall entry points with a stable empty recent-results preview", async () => {
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
      await screen.findByRole("heading", { level: 3, name: "Recall" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
    expect(screen.getByRole("link", { name: "Start Recall" })).toHaveAttribute(
      "href",
      "/recall/select",
    );
    expect(screen.getByRole("link", { name: "Open Results" })).toHaveAttribute(
      "href",
      "/recall/results",
    );
    expect(
      screen.getByRole("heading", { level: 4, name: "Results" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No recent results yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your completed and attempted recall sessions will appear here.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps no-note users on /recall with a path back to notes", async () => {
    const { router } = renderRoute("/recall");

    expect(
      await screen.findByRole("heading", { level: 4, name: "No notes yet" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
    expect(
      screen.getByText("Create notes first, then come back to start recall."),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: "Go to Notes" })
        .every((link) => link.getAttribute("href") === "/notes"),
    ).toBe(true);
    expect(
      screen.queryByRole("link", { name: "Start Recall" }),
    ).not.toBeInTheDocument();
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
      await screen.findByRole("heading", { level: 3, name: "Recall" }),
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
      labelId: null,
      notes: [
        { id: titleNote.id, title: "Encoding specificity" },
        { id: acronymNote.id, title: "Metacognition" },
      ],
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
      await screen.findByRole("heading", { level: 3, name: "Recall" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
    expect(
      screen.queryByRole("heading", { name: "FlashCard session" }),
    ).toBeNull();
  });

  it("returns completed recall sessions to /recall and shows the new session in recent results", async () => {
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
    expect(screen.getByText("1 attempted question")).toBeInTheDocument();
    expect(
      screen.getByText("Nailed 1 · Partial 0 · Missed 0"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Spacing effect")).toBeNull();
    expect(recallContext.listSessionResults({ userId })).toMatchObject([
      {
        attempts: [{ noteId: note.id, rating: "nailed" }],
        notes: [{ id: note.id, title: "Spacing effect" }],
      },
    ]);
  });

  it("returns attempted early-ended recall sessions to /recall and shows the new session in recent results", async () => {
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
    expect(screen.getByText("1 attempted question")).toBeInTheDocument();
    expect(
      screen.getByText("Nailed 0 · Partial 1 · Missed 0"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Retrieval strength")).toBeNull();
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
    expect(screen.getByText("No recent results yet")).toBeInTheDocument();
    expect(recallContext.listSessionResults({ userId })).toHaveLength(0);
  });

  it("shows a true empty results state with a recall CTA", async () => {
    renderRoute("/recall/results");

    expect(
      await screen.findByRole("heading", { name: "No results yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Complete a recall session to build reviewable results.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Recall" })).toHaveAttribute(
      "href",
      "/recall",
    );
    expect(
      screen.queryByText(
        "No session results yet. Complete at least one attempted recall session to build history.",
      ),
    ).toBeNull();
  });

  it("shows recent results as a compact session-level preview on /recall", async () => {
    const { labelsContext, notesContext, recallContext } =
      createLearningLoopTestContexts({
        shuffleNotes: (sessionNotes) => [...sessionNotes],
      });
    const userId = "user-placeholder";
    const science = labelsContext.createLabel({
      name: "Science",
      userId,
    });
    const note = notesContext.createNote(userId, {
      acronyms: [],
      body: "Stored snapshots should stay inside full results review.",
      labelIds: [science.id],
      metaphors: [],
      title: "Testing effect",
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

    renderRoute("/recall", {
      labelsContext,
      notesContext,
      recallContext,
    });

    expect(await screen.findByText("1 attempted question")).toBeInTheDocument();
    expect(
      screen.getByText("Nailed 1 · Partial 0 · Missed 0"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Testing effect")).toBeNull();
    expect(
      screen.queryByText(
        "Stored snapshots should stay inside full results review.",
      ),
    ).toBeNull();
  });

  it("shows persisted session results with label filtering and stored note snapshots", async () => {
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
    const recallContext = createAppRecallContext({
      keyPrefix: `test-recall-${Math.random().toString(36).slice(2)}`,
      notes: notesContext,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage: window.localStorage,
    });
    const userId = "user-placeholder";
    const science = labelsContext.createLabel({
      name: "Alpha Science",
      userId,
    });
    const historyLabel = labelsContext.createLabel({
      name: "World History",
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

    renderRoute("/recall/results", {
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
      screen.getByText("Nailed 1 · Partial 0 · Missed 0"),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by label"), {
      target: { value: historyLabel.id },
    });

    expect(
      screen.getByText("No sessions match the current label filter."),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by label"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review session" }));

    expect(
      await screen.findByRole("heading", { name: "Original prompt" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Original study snapshot")).toBeInTheDocument();
    expect(screen.getByText("Rating: Nailed it")).toBeInTheDocument();
    expect(screen.queryByText("Edited live note")).toBeNull();
  });

  it("toggles results by note and updates the drill-down pane", async () => {
    vi.useFakeTimers();

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
    let sessionCounter = 0;
    const recallContext = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          `session-by-note-ui-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: `test-recall-${Math.random().toString(36).slice(2)}`,
      notes: notesContext,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage: window.localStorage,
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

    renderRoute("/recall/results", {
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

    fireEvent.click(screen.getByRole("button", { name: "By note" }));

    expect(
      screen.queryByRole("button", { name: "Review session" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Review note Neural pathways/i }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Review note Retrieval practice/i }),
    );

    const resultsPane = screen.getByRole("region", {
      name: "Inspect Results",
    });

    expect(
      within(resultsPane).getAllByRole("heading", {
        name: "Retrieval practice",
      }).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("Recall history")).toBeNull();
    expect(
      within(resultsPane).getByText("Retrieval practice snapshot"),
    ).toBeInTheDocument();
    expect(
      within(resultsPane).getByText("Rating: Partly recalled"),
    ).toBeInTheDocument();
    expect(
      within(resultsPane).queryByText("Neural pathways original snapshot"),
    ).toBeNull();

    fireEvent.change(screen.getByLabelText("Filter by label"), {
      target: { value: science.id },
    });

    expect(
      screen.getByRole("button", { name: /Review note Neural pathways/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Retrieval practice")).toBeNull();
  });
});
