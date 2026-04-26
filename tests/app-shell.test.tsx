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
      labels: labelsContext,
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

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

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

    const { router } = renderRoute("/login?redirect=%2Fhistory", {
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
      await screen.findByRole("heading", { name: "Study history" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Jordan Review")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/history");
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

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

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

  it("renders the shell landmarks, supports sidebar states, and navigates across protected placeholders", async () => {
    renderRoute("/settings");

    const sidebar = await screen.findByRole("complementary", {
      name: "App sidebar",
    });
    const navigation = within(sidebar).getByRole("navigation", {
      name: "App sections",
    });

    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(
      within(sidebar).getByRole("img", { name: "Learning Makes Difference" }),
    ).toBeInTheDocument();

    const notesLink = within(navigation).getByRole("link", {
      name: "Notes",
    });
    const labelsLink = within(navigation).getByRole("link", {
      name: "Labels",
    });
    const recallLink = within(navigation).getByRole("link", {
      name: "Recall",
    });
    const historyLink = within(navigation).getByRole("link", {
      name: "History",
    });
    const settingsLink = within(navigation).getByRole("link", {
      name: "Settings",
    });

    expect(notesLink).toHaveAttribute("href", "/notes");
    expect(labelsLink).toHaveAttribute("href", "/labels");
    expect(recallLink).toHaveAttribute("href", "/recall");
    expect(historyLink).toHaveAttribute("href", "/history");
    expect(settingsLink).toHaveAttribute("aria-current", "page");
    expect(sidebar).toHaveAttribute("data-sidebar-state", "expanded");

    fireEvent.click(labelsLink);

    expect(
      await screen.findByRole("heading", { name: "Labels" }),
    ).toBeInTheDocument();
    expect(labelsLink).toHaveAttribute("aria-current", "page");

    fireEvent.click(recallLink);

    expect(
      await screen.findByRole("heading", { name: "Start a recall session" }),
    ).toBeInTheDocument();
    expect(recallLink).toHaveAttribute("aria-current", "page");

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
      name: "Recall",
    });

    expect(headerSidebarToggle).toHaveAttribute("aria-controls", navigation.id);
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

    const notesLink = await screen.findByRole("link", { name: "Notes" });

    expect(notesLink).toHaveFocus();

    fireEvent.click(
      screen.getByRole("button", { name: "Close navigation menu" }),
    );

    expect(mobileToggle).toHaveFocus();
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
      name: "App sidebar",
    });
    const notesNavigation = within(sidebar).getByRole("navigation", {
      name: "Notes list",
    });
    const notesLinks = within(notesNavigation).getAllByRole("button");

    expect(
      within(sidebar).getByRole("button", { name: "New note" }),
    ).toBeInTheDocument();
    expect(notesLinks).toHaveLength(2);
    expect(notesLinks[0]).toHaveTextContent("Neural pathways");
    expect(notesLinks[1]).toHaveTextContent("Second note");
    expect(notesLinks[0]).toHaveAttribute("aria-current", "page");
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
      name: "App sidebar",
    });
    const notesList = within(sidebar).getByRole("navigation", {
      name: "Notes list",
    });
    const collapseSidebarButton = within(sidebar).getByRole("button", {
      name: "Collapse sidebar",
    });

    expect(notesList).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Hide notes catalog" }),
    ).not.toBeInTheDocument();

    fireEvent.click(collapseSidebarButton);

    expect(sidebar).not.toBeVisible();
    expect(
      screen.getByDisplayValue(
        "Repeated review strengthens long-term retention.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Show notes catalog" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));

    expect(sidebar).toBeVisible();
    expect(
      within(sidebar).getByRole("navigation", { name: "Notes list" }),
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
      await screen.findByRole("button", { name: /Spaced repetition/ }),
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
      within(screen.getByRole("complementary", { name: "App sidebar" })).getByRole(
        "button",
        { name: "New note" },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /Spaced repetition/ }));

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
    const details = screen.getByLabelText("Details");

    expect(titleHeader).not.toBeNull();
    expect(titleHeader).toContainElement(saveButton);
    expect(details).not.toContainElement(saveButton);

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
      notesList.getByRole("button", { name: /Working memory/ }),
    ).toBeInTheDocument();
    expect(
      notesList.getByRole("button", { name: /Synaptic plasticity/ }),
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
      notesList.getByRole("button", { name: /Working memory/ }),
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

    fireEvent.change(searchInput, {
      target: { value: "spaced retrieval cue" },
    });

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
      await screen.findByDisplayValue("This note stays selected before searching."),
    ).toBeInTheDocument();

    const notesList = within(screen.getByRole("navigation", { name: "Notes list" }));
    const currentSidebarNote = notesList.getByRole("button", {
      name: /Current note/,
    });
    const targetSidebarNote = notesList.getByRole("button", {
      name: /Older target note/,
    });
    const scrollIntoView = vi.mocked(HTMLElement.prototype.scrollIntoView);

    expect(currentSidebarNote).toHaveAttribute("aria-current", "page");
    expect(targetSidebarNote).not.toHaveAttribute("aria-current");

    scrollIntoView.mockClear();

    fireEvent.change(screen.getByRole("combobox", { name: "Search notes" }), {
      target: { value: "search phrase" },
    });
    fireEvent.click(
      within(screen.getByLabelText("Notes search results")).getByRole("option", {
        name: /Older target note/,
      }),
    );

    expect(
      await screen.findByDisplayValue("The search phrase appears in this older note."),
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
      await screen.findByRole("heading", { name: "Labels" }),
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

  it("starts a FlashCard session from one of the signed-in user's labels", async () => {
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
      labels: labelsContext,
      notes: notesContext,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage: window.localStorage,
    });
    const userId = "user-placeholder";
    const science = labelsContext.createLabel({
      name: "Alpha Science",
      userId,
    });
    const biology = labelsContext.createLabel({ name: "Biology", userId });
    const otherUsersLabel = labelsContext.createLabel({
      name: "Private topic",
      userId: "other-user",
    });

    labelsContext.addParent({
      labelId: biology.id,
      parentId: science.id,
      userId,
    });

    notesContext.createNote(userId, {
      acronyms: [],
      body: "Broad foundation",
      labelIds: [science.id],
      metaphors: [],
      title: "Study foundation",
    });
    notesContext.createNote(userId, {
      acronyms: [],
      body: "Child topic",
      labelIds: [biology.id],
      metaphors: [],
      title: "Leaf detail",
    });
    notesContext.createNote(userId, {
      acronyms: [],
      body: "Ignored until organized",
      labelIds: [],
      metaphors: [],
      title: "Loose note",
    });
    notesContext.createNote("other-user", {
      acronyms: [],
      body: "Other account note",
      labelIds: [otherUsersLabel.id],
      metaphors: [],
      title: "Private note",
    });

    renderRoute("/recall", {
      labelsContext,
      notesContext,
      recallContext,
    });

    expect(
      await screen.findByRole("heading", { name: "Start a recall session" }),
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Choose a label")).toHaveDisplayValue(
      "Alpha Science",
    );
    expect(screen.queryByRole("option", { name: "Private topic" })).toBeNull();
    expect(await screen.findByText("2 reachable notes")).toBeInTheDocument();

    fireEvent.submit(
      screen.getByRole("form", { name: "Recall session setup form" }),
    );

    expect(
      await screen.findByRole("heading", { name: "FlashCard session" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Target label: Alpha Science")).toBeInTheDocument();
    expect(screen.getByText("2 notes in play")).toBeInTheDocument();
    expect(screen.getByText("Leaf detail")).toBeInTheDocument();
    expect(screen.getByText("Completed 0 of 2 questions")).toBeInTheDocument();
    expect(screen.queryByText("Child topic")).toBeNull();
    expect(screen.queryByText("Loose note")).toBeNull();
  });

  it("runs a FlashCard session one question at a time and supports ending early", async () => {
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
      labels: labelsContext,
      notes: notesContext,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage: window.localStorage,
    });
    const userId = "user-placeholder";
    const science = labelsContext.createLabel({
      name: "Alpha Science",
      userId,
    });

    notesContext.createNote(userId, {
      acronyms: [],
      body: "Broad foundation",
      labelIds: [science.id],
      metaphors: [],
      title: "Study foundation",
    });
    notesContext.createNote(userId, {
      acronyms: [],
      body: "Child topic",
      labelIds: [science.id],
      metaphors: [],
      title: "Leaf detail",
    });

    renderRoute("/recall", {
      labelsContext,
      notesContext,
      recallContext,
    });

    fireEvent.submit(
      await screen.findByRole("form", { name: "Recall session setup form" }),
    );

    expect(
      await screen.findByRole("heading", { name: "FlashCard session" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Completed 0 of 2 questions")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Leaf detail" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Child topic")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Reveal answer" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));

    expect(screen.getByText("Child topic")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Missed it" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Partly recalled" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nailed it" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Partly recalled" }));

    expect(screen.getByText("Completed 1 of 2 questions")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Study foundation" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Child topic")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Partly recalled" }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "End session early" }));

    expect(
      screen.queryByRole("heading", { name: "FlashCard session" }),
    ).toBeNull();
    expect(
      screen.getByText("Ended session early after 1 of 2 questions."),
    ).toBeInTheDocument();
  });

  it("shows persisted session history with label filtering and stored note snapshots", async () => {
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
      labels: labelsContext,
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

    renderRoute("/recall", {
      labelsContext,
      notesContext,
      recallContext,
    });

    fireEvent.submit(
      await screen.findByRole("form", { name: "Recall session setup form" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Reveal answer" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Nailed it" }));

    expect(
      await screen.findByText("Completed all 1 questions."),
    ).toBeInTheDocument();

    notesContext.updateNote(userId, note.id, {
      acronyms: [],
      body: "Edited live note",
      labelIds: [science.id],
      metaphors: [],
      title: "Edited live prompt",
    });

    cleanup();

    renderRoute("/history", {
      labelsContext,
      notesContext,
      recallContext,
    });

    expect(
      await screen.findByRole("heading", { name: "Study history" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Review session" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("1 attempted question")).toHaveLength(2);

    fireEvent.change(screen.getByLabelText("Filter by label"), {
      target: { value: historyLabel.id },
    });

    expect(
      screen.getByText("No sessions match the current label filter."),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by label"), {
      target: { value: science.id },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review session" }));

    expect(
      await screen.findByRole("heading", { name: "Original prompt" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Original study snapshot")).toBeInTheDocument();
    expect(screen.getByText("Rating: Nailed it")).toBeInTheDocument();
    expect(screen.queryByText("Edited live note")).toBeNull();
    expect(screen.queryByText("Edited live prompt")).toBeNull();
  });
});
