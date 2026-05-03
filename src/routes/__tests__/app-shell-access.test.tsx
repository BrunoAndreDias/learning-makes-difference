// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createAppSessionContext } from "../../modules/access/session/session";
import {
  createAppNotesContext,
  createRouteTestSessionContext,
  createRouteTestSessionStore,
  createSessionCookieJar,
  openAccountMenu,
  renderRoute,
  TEST_PILOT_REGISTRATION_CODE,
} from "./app-shell-test-support";

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
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
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
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/notes");
  });

  it("redirects the removed /recall/results route to the canonical Recall workspace", async () => {
    const { router } = renderRoute("/recall/results");

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Recall starts with notes",
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
    expect(
      screen.queryByRole("heading", { level: 3, name: "Practice" }),
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

  it("redirects to login when persisted session restoration fails", async () => {
    const sessionContext = createAppSessionContext({
      initialSnapshot: {
        user: {
          displayName: "Stale Casey",
          email: "casey@example.com",
          id: "user-stale-casey",
          interfaceLanguage: "en",
          studyLanguage: "en",
        },
      },
      service: {
        getSessionSnapshot: vi.fn(async () => {
          throw new Error("Failed query: select from auth_sessions");
        }),
        login: vi.fn(async () => ({ user: null })),
        logout: vi.fn(async () => ({ user: null })),
        register: vi.fn(async () => ({ user: null })),
        updatePreferences: vi.fn(async () => ({ user: null })),
      },
    });
    const { router } = renderRoute("/notes", { sessionContext });

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search.redirect).toBe("/notes");
  });

  it("registers a new account into the intended protected route and logs out cleanly", async () => {
    const sessionContext = createRouteTestSessionContext();
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
    fireEvent.change(screen.getByLabelText("Pilot registration code"), {
      target: { value: TEST_PILOT_REGISTRATION_CODE },
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

  it("restores a protected route after refresh until sign-out clears the session", async () => {
    const store = createRouteTestSessionStore();
    const cookie = createSessionCookieJar();
    const sessionContext = createRouteTestSessionContext({
      cookie,
      store,
    });

    await sessionContext.register({
      displayName: "Casey Learner",
      email: "casey@example.com",
      password: "correct horse battery staple",
      pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
    });

    const refreshedSessionContext = createRouteTestSessionContext({
      cookie,
      store,
    });
    const refreshedRoute = renderRoute("/settings", {
      sessionContext: refreshedSessionContext,
    });

    expect(
      await screen.findByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Casey Learner")).toBeInTheDocument();
    expect(refreshedRoute.router.state.location.pathname).toBe("/settings");

    openAccountMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();

    cleanup();

    const loggedOutSessionContext = createRouteTestSessionContext({
      cookie,
      store,
    });
    const loggedOutRoute = renderRoute("/settings", {
      sessionContext: loggedOutSessionContext,
    });

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(loggedOutRoute.router.state.location.pathname).toBe("/login");
    expect(loggedOutRoute.router.state.location.search.redirect).toBe(
      "/settings",
    );
  });

  it("uses the route-hydrated session while the client session store catches up", async () => {
    const anonymousSession = { user: null };
    const hydratedSession = {
      user: {
        displayName: "Hydrated Casey",
        email: "casey@example.com",
        id: "user-hydrated-casey",
        interfaceLanguage: "en" as const,
        studyLanguage: "en" as const,
      },
    };

    renderRoute("/settings", {
      sessionContext: {
        getSnapshot: () => anonymousSession,
        refresh: () => Promise.resolve(hydratedSession),
        subscribe: () => () => undefined,
        login: () => Promise.resolve(hydratedSession),
        logout: () => Promise.resolve({ user: null }),
        register: () => Promise.resolve(hydratedSession),
        updatePreferences: () => Promise.resolve(hydratedSession),
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Hydrated Casey")).toBeInTheDocument();
    expect(screen.queryByText("Unknown user")).not.toBeInTheDocument();
  });

  it("loads notes with the route-hydrated user instead of clearing them as anonymous", async () => {
    const anonymousSession = { user: null };
    const hydratedSession = {
      user: {
        displayName: "Hydrated Casey",
        email: "casey@example.com",
        id: "user-hydrated-casey",
        interfaceLanguage: "en" as const,
        studyLanguage: "en" as const,
      },
    };
    const emptyNotes = [] as const;
    const refresh = vi.fn(async () => []);

    renderRoute("/notes", {
      persistentNotesContext: {
        createNote: vi.fn(),
        deleteNote: vi.fn(),
        getSnapshot: () => emptyNotes,
        refresh,
        subscribe: () => () => undefined,
        updateNote: vi.fn(),
      },
      sessionContext: {
        getSnapshot: () => anonymousSession,
        refresh: () => Promise.resolve(hydratedSession),
        subscribe: () => () => undefined,
        login: () => Promise.resolve(hydratedSession),
        logout: () => Promise.resolve({ user: null }),
        register: () => Promise.resolve(hydratedSession),
        updatePreferences: () => Promise.resolve(hydratedSession),
      },
    });

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledWith("user-hydrated-casey");
    });
    expect(refresh).not.toHaveBeenCalledWith(null);
  });

  it("supports keyboard navigation across memory hook tabs", async () => {
    const userId = "user-jordan";
    const notesContext = createAppNotesContext({
      keyPrefix: `test-notes-keyboard-hooks-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    notesContext.createNote(userId, {
      acronyms: [],
      body: "Neurons fire once membrane voltage crosses threshold.",
      labelIds: [],
      metaphors: [],
      title: "Action potentials",
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
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();

    const memoryHooks = screen.getByLabelText("Memory hooks");
    const tablist = within(memoryHooks).getByRole("tablist", {
      name: "Memory hook types",
    });
    const metaphorTab = within(tablist).getByRole("tab", {
      name: "Metaphor",
      selected: true,
    });
    const acronymTab = within(tablist).getByRole("tab", {
      name: "Acronym",
      selected: false,
    });

    metaphorTab.focus();
    fireEvent.keyDown(metaphorTab, { key: "ArrowRight" });

    expect(acronymTab).toHaveFocus();
    expect(acronymTab).toHaveAttribute("aria-selected", "true");
    expect(metaphorTab).toHaveAttribute("aria-selected", "false");

    fireEvent.keyDown(acronymTab, { key: "ArrowLeft" });

    expect(metaphorTab).toHaveFocus();
    expect(metaphorTab).toHaveAttribute("aria-selected", "true");
  });

  it("logs a returning user into the requested protected route", async () => {
    const sessionContext = createRouteTestSessionContext();

    await sessionContext.register({
      displayName: "Jordan Review",
      email: "jordan@example.com",
      password: "correct horse battery staple",
      pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
    });
    await sessionContext.logout();

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
        name: "Recall starts with notes",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Jordan Review")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
  });

  it("shows serialized authentication errors from the login service", async () => {
    renderRoute("/login", {
      sessionContext: {
        getSnapshot: () => ({ user: null }),
        refresh: () => Promise.resolve({ user: null }),
        subscribe: () => () => undefined,
        login: () =>
          Promise.reject({
            code: "invalid_credentials",
            message: "Email or password is incorrect.",
          }),
        logout: () => Promise.resolve({ user: null }),
        register: () => Promise.resolve({ user: null }),
        updatePreferences: () => Promise.resolve({ user: null }),
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "casey@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong password" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Sign in form" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email or password is incorrect.",
    );
    expect(
      screen.queryByText("Authentication failed. Try again."),
    ).not.toBeInTheDocument();
  });

  it("updates account preferences from settings and restores them for the same account", async () => {
    const sessionContext = createRouteTestSessionContext();

    await sessionContext.register({
      displayName: "Casey Learner",
      email: "casey@example.com",
      password: "correct horse battery staple",
      pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
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

  it("restores persisted note metaphors and acronyms after refresh and account sign-in", async () => {
    const notesKeyPrefix = `test-notes-persisted-memory-hooks-${Math.random().toString(36).slice(2)}`;
    const store = createRouteTestSessionStore();
    const cookie = createSessionCookieJar();
    const sessionContext = createRouteTestSessionContext({
      cookie,
      store,
    });
    const notesContext = createAppNotesContext({
      keyPrefix: notesKeyPrefix,
      storage: window.localStorage,
    });

    const initialRoute = renderRoute("/notes", {
      notesContext,
      sessionContext,
    });

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
    fireEvent.change(screen.getByLabelText("Pilot registration code"), {
      target: { value: TEST_PILOT_REGISTRATION_CODE },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Sign up form" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Action potentials" },
    });
    fireEvent.change(screen.getByLabelText("Body"), {
      target: {
        value: "Repeated threshold crossings reinforce the same neural path.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create note" }));

    expect(
      await screen.findByRole("tab", {
        name: "Metaphor",
        selected: true,
      }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Your metaphor"), {
      target: {
        value:
          "Domino line: crossing threshold is like tipping the first domino so the whole chain commits.",
      },
    });
    fireEvent.click(
      within(screen.getByRole("group", { name: "Metaphor editor" })).getByRole(
        "button",
        { name: "Save" },
      ),
    );

    fireEvent.click(screen.getByRole("tab", { name: "Acronym" }));
    fireEvent.change(screen.getByLabelText("Your acronym"), {
      target: { value: "LTP means Long-Term Potentiation." },
    });
    fireEvent.click(
      within(screen.getByRole("group", { name: "Acronym editor" })).getByRole(
        "button",
        { name: "Save" },
      ),
    );

    fireEvent.click(screen.getByRole("tab", { name: "Metaphor" }));

    expect(
      await screen.findByDisplayValue(
        "Domino line: crossing threshold is like tipping the first domino so the whole chain commits.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Acronym" }));
    expect(
      await screen.findByDisplayValue("LTP means Long-Term Potentiation."),
    ).toBeInTheDocument();

    openAccountMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();

    initialRoute.unmount();

    const refreshedRoute = renderRoute("/login", {
      notesContext: createAppNotesContext({
        keyPrefix: notesKeyPrefix,
        storage: window.localStorage,
      }),
      sessionContext: createRouteTestSessionContext({
        cookie,
        store,
      }),
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
      await screen.findByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Action potentials")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        "Domino line: crossing threshold is like tipping the first domino so the whole chain commits.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Acronym" }));
    expect(
      screen.getByDisplayValue("LTP means Long-Term Potentiation."),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Search notes" }), {
      target: { value: "domino" },
    });

    expect(
      within(screen.getByLabelText("Notes search results")).getByRole(
        "option",
        { name: /Action potentials/ },
      ),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Search notes" }), {
      target: { value: "long-term potentiation" },
    });

    expect(
      within(screen.getByLabelText("Notes search results")).getByRole(
        "option",
        { name: /Action potentials/ },
      ),
    ).toBeInTheDocument();
    expect(refreshedRoute.router.state.location.pathname).toBe("/notes");
  });
});
