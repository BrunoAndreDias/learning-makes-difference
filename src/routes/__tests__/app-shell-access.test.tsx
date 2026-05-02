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

  it("restores a protected route after refresh until sign-out clears the session", async () => {
    const keyPrefix = `test-auth-refresh-${Math.random().toString(36).slice(2)}`;
    const sessionContext = createAppSessionContext({
      keyPrefix,
      storage: window.localStorage,
    });

    await sessionContext.register({
      displayName: "Casey Learner",
      email: "casey@example.com",
      password: "correct horse battery staple",
    });

    const refreshedSessionContext = createAppSessionContext({
      keyPrefix,
      storage: window.localStorage,
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

    const loggedOutSessionContext = createAppSessionContext({
      keyPrefix,
      storage: window.localStorage,
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
        name: "Practice",
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

  it("restores persisted note metaphors and acronyms after refresh and account sign-in", async () => {
    const authKeyPrefix = `test-auth-persisted-notes-${Math.random().toString(36).slice(2)}`;
    const notesKeyPrefix = `test-notes-persisted-memory-hooks-${Math.random().toString(36).slice(2)}`;
    const sessionContext = createAppSessionContext({
      keyPrefix: authKeyPrefix,
      storage: window.localStorage,
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
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Sign up form" }));

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Action potentials" },
    });
    fireEvent.change(screen.getByLabelText("Body"), {
      target: {
        value: "Repeated threshold crossings reinforce the same neural path.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add metaphor" }));
    fireEvent.change(screen.getByLabelText("Metaphor title"), {
      target: { value: "Domino line" },
    });
    fireEvent.change(screen.getByLabelText("Metaphor explanation"), {
      target: {
        value:
          "Crossing threshold is like tipping the first domino so the whole chain commits.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add acronym" }));
    fireEvent.change(screen.getByLabelText("Acronym"), {
      target: { value: "LTP" },
    });
    fireEvent.change(screen.getByLabelText("Acronym expansion"), {
      target: { value: "Long-Term Potentiation" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Note editor" }));

    expect(await screen.findByDisplayValue("Domino line")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("LTP")).toBeInTheDocument();

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
      sessionContext: createAppSessionContext({
        keyPrefix: authKeyPrefix,
        storage: window.localStorage,
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
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Action potentials")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Domino line")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Long-Term Potentiation"),
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
