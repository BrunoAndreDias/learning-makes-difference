// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createAppStudyNotesContext } from "../../modules/study-notes";
import { openAccountMenu, renderRoute } from "./app-shell-test-support";

function setBrowserLanguages(languages: readonly string[]) {
  Object.defineProperty(window.navigator, "languages", {
    configurable: true,
    value: languages,
  });
}

describe("authenticated app shell", () => {
  it("uses the stored User Language for authenticated shell chrome instead of browser detection", async () => {
    setBrowserLanguages(["pt-PT", "en"]);

    renderRoute("/settings", {
      session: {
        user: {
          displayName: "Casey Learner",
          email: "casey@example.com",
          id: "user-casey",
          userLanguage: "es",
        },
      },
    });

    const sidebar = await screen.findByRole("complementary", {
      name: "Espacio de trabajo de notas de estudio",
    });
    const appSections = within(sidebar).getByRole("navigation", {
      name: "Secciones de la aplicacion",
    });

    expect(
      within(appSections).getByRole("link", { name: "Notas" }),
    ).toBeInTheDocument();
    expect(
      within(appSections).getByRole("link", { name: "Repaso" }),
    ).toBeInTheDocument();
    expect(
      within(appSections).queryByRole("link", { name: "Etiquetas" }),
    ).not.toBeInTheDocument();
    expect(
      within(appSections).getByRole("link", { name: "Concentracion" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Configuracion" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Abrir menu de navegacion" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Iniciar concentracion" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Casey Learner casey@example.com menu de cuenta",
      }),
    );

    const accountMenu = screen.getByRole("menu", {
      name: "Opciones de cuenta",
    });

    expect(
      within(accountMenu).getByRole("menuitem", { name: "Configuracion" }),
    ).toHaveAttribute("href", "/settings");
    expect(
      within(accountMenu).getByRole("menuitem", { name: "Cerrar sesion" }),
    ).toBeInTheDocument();
  });

  it("translates representative authenticated shell chrome in Portuguese", async () => {
    renderRoute("/focus", {
      session: {
        user: {
          displayName: "Casey Learner",
          email: "casey@example.com",
          id: "user-casey",
          userLanguage: "pt-PT",
        },
      },
    });

    const sidebar = await screen.findByRole("complementary", {
      name: "Area de trabalho de notas de estudo",
    });
    const appSections = within(sidebar).getByRole("navigation", {
      name: "Seccoes da aplicacao",
    });

    expect(
      within(appSections).getByRole("link", { name: "Notas" }),
    ).toBeInTheDocument();
    expect(
      within(appSections).getByRole("link", { name: "Recordar" }),
    ).toBeInTheDocument();
    expect(
      within(appSections).queryByRole("link", { name: "Etiquetas" }),
    ).not.toBeInTheDocument();
    expect(
      within(appSections).getByRole("link", { name: "Foco" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("heading", { level: 2, name: "Foco" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Abrir menu de navegacao" }),
    ).toBeInTheDocument();
  });

  it("keeps the collapsed workspace header as an overlaid menu toggle", () => {
    const appCss = readFileSync(join(process.cwd(), "src/styles/app.css"), {
      encoding: "utf8",
    });

    expect(appCss).toContain("--workspace-collapsed-header-offset");
    expect(appCss).toContain(
      '.authenticated-shell[data-sidebar-state="collapsed"]\n  .app-frame__workspace-header',
    );
    expect(appCss).toMatch(
      /\.app-shell:has\(\.authenticated-shell\)\s+\.notes-workspace__page-header\s*{[^}]*padding-inline:\s*var\(--notes-workspace-inline-start\)\s+var\(--notes-workspace-inline-end\)/s,
    );
    expect(appCss).not.toMatch(
      /\.app-shell:has\(\.authenticated-shell\)\s+\.notes-workspace__page-header\s*{[^}]*padding-inline:\s*var\(--notes-workspace-inline-end\)\s+var\(--notes-workspace-inline-start\)/s,
    );
    expect(appCss).not.toContain(
      '.authenticated-shell[data-sidebar-state="collapsed"]\n  .app-frame[data-workspace="notes"]\n  .app-frame__workspace-header {\n  position: sticky',
    );
  });

  it("renders a Study Notes workspace shell with an account menu instead of product navigation", async () => {
    renderRoute("/settings");

    const sidebar = await screen.findByRole("complementary", {
      name: "Study Notes workspace",
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
      within(appSections).getByRole("link", { name: "Study Notes" }),
    ).toBeInTheDocument();
    expect(
      within(appSections).queryByRole("link", { name: "Labels" }),
    ).not.toBeInTheDocument();
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
    expect(
      screen.getAllByRole("button", { name: "Collapse sidebar" }),
    ).toHaveLength(1);

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

  it("keeps the shared top-right Focus action primary in shell headers", async () => {
    renderRoute("/settings");

    expect(
      await screen.findByRole("heading", { level: 2, name: "Settings" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Start Focus" })).toHaveClass(
      "notes-action-primary",
    );
  });

  it("renders global workspace navigation and updates the active link when navigating", async () => {
    const { router } = renderRoute("/study-notes");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Study Notes" }),
    ).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary", {
      name: "Study Notes workspace",
    });
    const appSections = within(sidebar).getByRole("navigation", {
      name: "App sections",
    });
    const todayLink = within(appSections).getByRole("link", {
      name: "Today",
    });
    const notesLink = within(appSections).getByRole("link", {
      name: "Study Notes",
    });
    const recallLink = within(appSections).getByRole("link", {
      name: "Recall",
    });
    const practiceRepairLink = within(appSections).getByRole("link", {
      name: "Practice Repair",
    });
    const focusLink = within(appSections).getByRole("link", { name: "Focus" });

    expect(within(appSections).getAllByRole("link")).toEqual([
      todayLink,
      notesLink,
      recallLink,
      practiceRepairLink,
      focusLink,
    ]);
    expect(
      within(appSections).queryByRole("link", { name: "Recall history" }),
    ).not.toBeInTheDocument();
    expect(
      within(appSections).queryByRole("link", { name: "Insights" }),
    ).not.toBeInTheDocument();
    expect(todayLink).toHaveAttribute("href", "/today");
    expect(
      within(appSections).queryByRole("link", { name: "Recall results" }),
    ).not.toBeInTheDocument();
    expect(notesLink).toHaveAttribute("href", "/study-notes");
    expect(recallLink).toHaveAttribute("href", "/recall");
    expect(practiceRepairLink).toHaveAttribute("href", "/practice-repair");
    expect(notesLink).toHaveAttribute("aria-current", "page");

    fireEvent.click(recallLink);

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Recall starts with Study Notes",
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
    expect(recallLink).toHaveAttribute("aria-current", "page");
    expect(notesLink).not.toHaveAttribute("aria-current");
    expect(
      within(appSections).getByRole("link", { name: "Recall Today" }),
    ).toHaveAttribute("href", "/recall");
    expect(
      within(appSections).getByRole("link", { name: "Recall results" }),
    ).toHaveAttribute("href", "/recall/results");
    expect(
      within(appSections).getByRole("link", { name: "Recall setup" }),
    ).toHaveAttribute("href", "/recall/select");
    expect(
      within(appSections).getByRole("link", { name: "Recall session" }),
    ).toHaveAttribute("href", "/recall/session");
  });

  it("adds Focus to primary navigation and opens the Focus section", async () => {
    const { router } = renderRoute("/study-notes");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Study Notes" }),
    ).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary", {
      name: "Study Notes workspace",
    });
    const appSections = within(sidebar).getByRole("navigation", {
      name: "App sections",
    });
    const focusLink = within(appSections).getByRole("link", { name: "Focus" });

    expect(focusLink).toHaveAttribute("href", "/focus");

    fireEvent.click(focusLink);

    expect(
      await screen.findByRole("heading", { level: 2, name: "Focus" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/focus");
    expect(focusLink).toHaveAttribute("aria-current", "page");
  });

  it("supports skip navigation with a header navigation opener", async () => {
    renderRoute("/study-notes");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Study Notes" }),
    ).toBeInTheDocument();

    const skipLink = screen.getByRole("link", { name: "Skip to main content" });
    const main = screen.getByRole("main");

    expect(skipLink).toHaveAttribute("href", "#main-content");
    expect(main).toHaveAttribute("id", "main-content");

    expect(
      screen.getByRole("button", { name: "Open navigation menu" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("uses the in-page Study Notes list with a header navigation opener", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      getOwnedLabelIdsForUser: () => [],
      keyPrefix: `test-study-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    studyNotesContext.createStudyNote("user-jordan", {
      sourceBody: "Repeated review strengthens long-term retention.",
      sourceTitle: "Spaced repetition",
    });
    studyNotesContext.createStudyNote("user-jordan", {
      sourceBody: "Retrieval cues make later recall easier.",
      sourceTitle: "Retrieval practice",
    });

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Study Notes" }),
    ).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary", {
      name: "Study Notes workspace",
    });
    const studyNotesCatalog = screen.getByRole("complementary", {
      name: "Study Notes catalog",
    });
    const studyNotesList = within(studyNotesCatalog).getByRole("navigation", {
      name: "Study Notes list",
    });

    expect(sidebar).toHaveAttribute("data-mobile-open", "false");
    expect(
      screen.getByRole("button", { name: "New Study Note" }),
    ).toBeInTheDocument();
    expect(
      within(sidebar).queryByRole("navigation", { name: "Study Notes list" }),
    ).not.toBeInTheDocument();
    expect(
      within(sidebar).getByRole("navigation", { name: "App sections" }),
    ).toBeInTheDocument();
    expect(
      within(sidebar).getByRole("button", { name: /account menu/i }),
    ).toBeInTheDocument();

    const retrievalPracticeButton = within(studyNotesList).getByRole("button", {
      name: "Retrieval practice",
    });

    retrievalPracticeButton.focus();
    expect(retrievalPracticeButton).toHaveFocus();

    fireEvent.click(retrievalPracticeButton);

    expect(sidebar).toHaveAttribute("data-mobile-open", "false");
    expect(screen.getByLabelText("Prompt")).toHaveValue("Retrieval practice");
    expect(
      screen.getByRole("button", { name: "Open navigation menu" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("opens and closes the mobile navigation menu from the header", async () => {
    renderRoute("/study-notes");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Study Notes" }),
    ).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary", {
      name: "Study Notes workspace",
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
