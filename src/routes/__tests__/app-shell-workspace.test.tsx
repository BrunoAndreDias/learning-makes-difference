// @vitest-environment jsdom

import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createAppNotesContext,
  openAccountMenu,
  renderRoute,
} from "./app-shell-test-support";

describe("authenticated app shell", () => {
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
      screen.getByRole("button", { name: "Open navigation menu" }),
    ).toHaveAttribute("aria-expanded", "false");
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
      notesLink,
      recallLink,
      labelsLink,
      focusLink,
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
      await screen.findByRole("heading", { level: 3, name: "Practice" }),
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
      await screen.findByRole("heading", { level: 3, name: "Study sessions" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/focus");
    expect(focusLink).toHaveAttribute("aria-current", "page");
  });

  it("supports skip navigation with a header navigation opener", async () => {
    renderRoute("/notes");

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    const skipLink = screen.getByRole("link", { name: "Skip to main content" });
    const main = screen.getByRole("main");

    expect(skipLink).toHaveAttribute("href", "#main-content");
    expect(main).toHaveAttribute("id", "main-content");

    expect(
      screen.getByRole("button", { name: "Open navigation menu" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("uses the notes sidebar with a header navigation opener", async () => {
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
      screen.getByRole("button", { name: "Open navigation menu" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("opens and closes the mobile navigation menu from the header", async () => {
    renderRoute("/notes");

    expect(
      await screen.findByRole("heading", { name: "Notes workspace" }),
    ).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary", {
      name: "Notes workspace",
    });
    const mobileToggle = screen.getByRole("button", {
      name: "Open navigation menu",
    });

    expect(mobileToggle).toHaveAttribute("aria-controls", sidebar.id);
    expect(mobileToggle).toHaveAttribute("aria-expanded", "false");
    expect(sidebar).toHaveAttribute("data-mobile-open", "false");

    fireEvent.click(mobileToggle);

    expect(mobileToggle).toHaveAttribute("aria-expanded", "true");
    expect(sidebar).toHaveAttribute("data-mobile-open", "true");

    fireEvent.click(
      within(sidebar).getByRole("button", { name: "Close navigation menu" }),
    );

    expect(sidebar).toHaveAttribute("data-mobile-open", "false");
    expect(mobileToggle).toHaveAttribute("aria-expanded", "false");
    expect(mobileToggle).toHaveFocus();
  });
});
