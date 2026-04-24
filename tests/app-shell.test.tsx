// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { type AppNotesContext, createAppNotesContext } from "../src/lib/notes";
import {
  type AppSessionContext,
  type AppSessionSnapshot,
  createAppSessionContext,
} from "../src/lib/session";
import { routeTree } from "../src/routeTree.gen";

function renderRoute(
  initialPath: string,
  options: {
    notesContext?: AppNotesContext;
    session?: AppSessionSnapshot;
    sessionContext?: AppSessionContext;
  } = {},
) {
  const staticSnapshot = options.session ?? {
    user: {
      displayName: "Placeholder user",
      email: "placeholder@example.com",
      id: "user-placeholder",
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
  };
  const notesContext =
    options.notesContext ??
    createAppNotesContext({
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [initialPath],
    }),
    context: {
      notes: notesContext,
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
});

afterEach(() => {
  cleanup();
});

describe("authenticated app shell", () => {
  it("redirects unauthenticated protected navigation into the public login area", async () => {
    const { router } = renderRoute("/settings", { session: { user: null } });

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("After authentication you'll continue to:"),
    ).toBeInTheDocument();
    expect(screen.getByText("/settings")).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Casey Learner" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "casey@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Registration form" }));

    expect(
      await screen.findByRole("heading", { name: "Settings placeholder" }),
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
    fireEvent.submit(screen.getByRole("form", { name: "Login form" }));

    expect(
      await screen.findByRole("heading", { name: "History placeholder" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Jordan Review")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/history");
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
      await screen.findByRole("heading", { name: "Labels placeholder" }),
    ).toBeInTheDocument();
    expect(labelsLink).toHaveAttribute("aria-current", "page");

    fireEvent.click(recallLink);

    expect(
      await screen.findByRole("heading", { name: "Recall placeholder" }),
    ).toBeInTheDocument();
    expect(recallLink).toHaveAttribute("aria-current", "page");

    fireEvent.click(
      within(sidebar).getByRole("button", { name: "Collapse sidebar" }),
    );

    expect(sidebar).toHaveAttribute("data-sidebar-state", "collapsed");
    expect(
      within(sidebar).getByRole("button", { name: "Expand sidebar" }),
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
    fireEvent.click(screen.getByRole("button", { name: "New note" }));
    fireEvent.click(screen.getByRole("button", { name: /Spaced repetition/ }));

    expect(
      screen.getByDisplayValue(
        "Reviewing at expanding intervals improves recall over long spans.",
      ),
    ).toBeInTheDocument();
  });
});
